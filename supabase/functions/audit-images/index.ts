import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Auth check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabaseAuth = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabaseAuth.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = claimsData.claims.sub as string;

    // Check admin role
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    const { data: roleData } = await supabaseAdmin.rpc("has_role", {
      _user_id: userId,
      _role: "admin",
    });

    if (!roleData) {
      return new Response(JSON.stringify({ error: "Forbidden: admin only" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { action, urls, orphanKeys } = await req.json();

    const endpoint = Deno.env.get("MINIO_ENDPOINT")!;
    const accessKey = Deno.env.get("MINIO_ACCESS_KEY")!;
    const secretKey = Deno.env.get("MINIO_SECRET_KEY")!;
    const bucket = Deno.env.get("MINIO_BUCKET_PUBLIC") || "media-public";
    const region = Deno.env.get("MINIO_REGION") || "us-east-1";
    const publicBaseUrl = Deno.env.get("PUBLIC_MEDIA_BASE_URL") || "";

    // ---- ACTION: validate_urls ----
    if (action === "validate_urls") {
      if (!Array.isArray(urls) || urls.length === 0) {
        return new Response(JSON.stringify({ results: [] }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const results: Array<{
        url: string;
        objectKey: string;
        exists: boolean;
        size: number | null;
        contentType: string | null;
        error: string | null;
      }> = [];

      for (const url of urls.slice(0, 100)) {
        let objectKey = extractObjectKey(url, publicBaseUrl, bucket);
        if (!objectKey) {
          results.push({ url, objectKey: "", exists: false, size: null, contentType: null, error: "cannot_extract_key" });
          continue;
        }

        try {
          const headRes = await s3Head(endpoint, bucket, objectKey, accessKey, secretKey, region);
          results.push({
            url,
            objectKey,
            exists: headRes.status === 200,
            size: headRes.size,
            contentType: headRes.contentType,
            error: headRes.status !== 200 ? `status_${headRes.status}` : null,
          });
        } catch (e) {
          results.push({ url, objectKey, exists: false, size: null, contentType: null, error: String(e) });
        }
      }

      return new Response(JSON.stringify({ results }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ---- ACTION: list_storage_objects ----
    if (action === "list_storage_objects") {
      const prefix = "products/";
      const objects = await s3ListObjects(endpoint, bucket, prefix, accessKey, secretKey, region);

      return new Response(JSON.stringify({ objects }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ---- ACTION: delete_orphans ----
    if (action === "delete_orphans") {
      if (!Array.isArray(orphanKeys) || orphanKeys.length === 0) {
        return new Response(JSON.stringify({ deleted: 0 }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      let deleted = 0;
      for (const key of orphanKeys.slice(0, 200)) {
        try {
          await s3Delete(endpoint, bucket, key, accessKey, secretKey, region);
          deleted++;
        } catch (_e) {
          // skip
        }
      }

      // Audit log
      await supabaseAdmin.from("audit_logs").insert({
        user_id: userId,
        action: "delete_orphan_images",
        entity_type: "storage",
        metadata: { deleted_count: deleted, keys: orphanKeys.slice(0, 50) },
      });

      return new Response(JSON.stringify({ deleted }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ---- ACTION: fix_paths ----
    if (action === "fix_paths") {
      // This converts full URLs to objectKeys in the DB
      const fixes = urls as Array<{ table: string; id: string; field: string; oldValue: string; newValue: string }>;
      if (!Array.isArray(fixes) || fixes.length === 0) {
        return new Response(JSON.stringify({ fixed: 0 }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      let fixed = 0;
      for (const fix of fixes.slice(0, 500)) {
        try {
          if (fix.table === "product_images") {
            await supabaseAdmin
              .from("product_images")
              .update({ image_url: fix.newValue })
              .eq("id", fix.id);
            fixed++;
          } else if (fix.table === "products" && fix.field === "image_url") {
            await supabaseAdmin
              .from("products")
              .update({ image_url: fix.newValue })
              .eq("id", fix.id);
            fixed++;
          }
        } catch (_e) {
          // skip
        }
      }

      await supabaseAdmin.from("audit_logs").insert({
        user_id: userId,
        action: "fix_image_paths",
        entity_type: "products",
        metadata: { fixed_count: fixed },
      });

      return new Response(JSON.stringify({ fixed }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

// ---- Helpers ----

function extractObjectKey(url: string, publicBaseUrl: string, bucket: string): string | null {
  if (!url || typeof url !== "string") return null;

  // Already a bare key (no http)
  if (!url.startsWith("http")) {
    return url.startsWith("/") ? url.slice(1) : url;
  }

  // Try removing publicBaseUrl prefix
  if (publicBaseUrl && url.startsWith(publicBaseUrl)) {
    let key = url.slice(publicBaseUrl.length);
    if (key.startsWith("/")) key = key.slice(1);
    return key || null;
  }

  // Try extracting from URL path after bucket name
  try {
    const u = new URL(url);
    const path = u.pathname;
    // Pattern: /{bucket}/key or /key
    const bucketPrefix = `/${bucket}/`;
    if (path.startsWith(bucketPrefix)) {
      return path.slice(bucketPrefix.length);
    }
    // Just return path without leading slash
    return path.startsWith("/") ? path.slice(1) : path;
  } catch {
    return null;
  }
}

async function s3Sign(
  method: string,
  endpoint: string,
  bucket: string,
  key: string,
  accessKey: string,
  secretKey: string,
  region: string,
  _headers: Record<string, string> = {}
): Promise<{ url: string; headers: Record<string, string> }> {
  // Simple unsigned request with path-style URL
  const url = `${endpoint}/${bucket}/${key}`;
  const now = new Date();
  const dateStr = now.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
  const dateShort = dateStr.slice(0, 8);

  const headers: Record<string, string> = {
    Host: new URL(endpoint).host,
    "x-amz-date": dateStr,
    "x-amz-content-sha256": "UNSIGNED-PAYLOAD",
    ..._headers,
  };

  // Build canonical request
  const signedHeaderKeys = Object.keys(headers)
    .map((k) => k.toLowerCase())
    .sort();
  const signedHeaders = signedHeaderKeys.join(";");
  const canonicalHeaders = signedHeaderKeys.map((k) => `${k}:${headers[k.charAt(0).toUpperCase() + k.slice(1).toLowerCase().replace(/-([a-z])/g, (_, c) => '-' + c)] || headers[k]}\n`).join("");

  // Simplified: use the AWS SDK approach with UNSIGNED-PAYLOAD
  // For MinIO compatibility, we use a simple approach
  const encoder = new TextEncoder();

  const canonicalUri = `/${bucket}/${key}`;
  const canonicalQueryString = "";
  const payloadHash = "UNSIGNED-PAYLOAD";

  const canonicalHeadersStr = signedHeaderKeys
    .map((k) => {
      const val = Object.entries(headers).find(([hk]) => hk.toLowerCase() === k)?.[1] || "";
      return `${k}:${val.trim()}\n`;
    })
    .join("");

  const canonicalRequest = [method, canonicalUri, canonicalQueryString, canonicalHeadersStr, signedHeaders, payloadHash].join("\n");

  const scope = `${dateShort}/${region}/s3/aws4_request`;
  const stringToSign = ["AWS4-HMAC-SHA256", dateStr, scope, await sha256Hex(canonicalRequest)].join("\n");

  const signingKey = await getSignatureKey(secretKey, dateShort, region, "s3");
  const signature = await hmacHex(signingKey, stringToSign);

  headers["Authorization"] = `AWS4-HMAC-SHA256 Credential=${accessKey}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  return { url, headers };
}

async function sha256Hex(data: string): Promise<string> {
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(data));
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function hmacSha256(key: ArrayBuffer | Uint8Array, data: string): Promise<ArrayBuffer> {
  const cryptoKey = await crypto.subtle.importKey("raw", key, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return crypto.subtle.sign("HMAC", cryptoKey, new TextEncoder().encode(data));
}

async function hmacHex(key: ArrayBuffer, data: string): Promise<string> {
  const sig = await hmacSha256(key, data);
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function getSignatureKey(secret: string, dateStamp: string, region: string, service: string): Promise<ArrayBuffer> {
  const kDate = await hmacSha256(new TextEncoder().encode("AWS4" + secret), dateStamp);
  const kRegion = await hmacSha256(kDate, region);
  const kService = await hmacSha256(kRegion, service);
  return hmacSha256(kService, "aws4_request");
}

async function s3Head(
  endpoint: string,
  bucket: string,
  key: string,
  accessKey: string,
  secretKey: string,
  region: string
): Promise<{ status: number; size: number | null; contentType: string | null }> {
  const { url, headers } = await s3Sign("HEAD", endpoint, bucket, key, accessKey, secretKey, region);
  const res = await fetch(url, { method: "HEAD", headers });
  return {
    status: res.status,
    size: res.headers.get("content-length") ? parseInt(res.headers.get("content-length")!) : null,
    contentType: res.headers.get("content-type"),
  };
}

async function s3Delete(
  endpoint: string,
  bucket: string,
  key: string,
  accessKey: string,
  secretKey: string,
  region: string
): Promise<void> {
  const { url, headers } = await s3Sign("DELETE", endpoint, bucket, key, accessKey, secretKey, region);
  const res = await fetch(url, { method: "DELETE", headers });
  await res.text();
}

async function s3ListObjects(
  endpoint: string,
  bucket: string,
  prefix: string,
  accessKey: string,
  secretKey: string,
  region: string
): Promise<Array<{ key: string; size: number; lastModified: string }>> {
  const objects: Array<{ key: string; size: number; lastModified: string }> = [];
  let continuationToken = "";
  let hasMore = true;

  while (hasMore) {
    const queryParams = new URLSearchParams({
      "list-type": "2",
      prefix,
      "max-keys": "1000",
    });
    if (continuationToken) queryParams.set("continuation-token", continuationToken);

    const url = `${endpoint}/${bucket}?${queryParams.toString()}`;
    const now = new Date();
    const dateStr = now.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
    const dateShort = dateStr.slice(0, 8);

    const host = new URL(endpoint).host;
    const headers: Record<string, string> = {
      Host: host,
      "x-amz-date": dateStr,
      "x-amz-content-sha256": "UNSIGNED-PAYLOAD",
    };

    const signedHeaderKeys = Object.keys(headers).map((k) => k.toLowerCase()).sort();
    const signedHeaders = signedHeaderKeys.join(";");
    const canonicalHeadersStr = signedHeaderKeys
      .map((k) => {
        const val = Object.entries(headers).find(([hk]) => hk.toLowerCase() === k)?.[1] || "";
        return `${k}:${val.trim()}\n`;
      })
      .join("");

    const canonicalUri = `/${bucket}`;
    const canonicalRequest = ["GET", canonicalUri, queryParams.toString(), canonicalHeadersStr, signedHeaders, "UNSIGNED-PAYLOAD"].join("\n");
    const scope = `${dateShort}/${region}/s3/aws4_request`;
    const stringToSign = ["AWS4-HMAC-SHA256", dateStr, scope, await sha256Hex(canonicalRequest)].join("\n");
    const signingKey = await getSignatureKey(secretKey, dateShort, region, "s3");
    const signature = await hmacHex(signingKey, stringToSign);
    headers["Authorization"] = `AWS4-HMAC-SHA256 Credential=${accessKey}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

    const res = await fetch(url, { headers });
    const xml = await res.text();

    // Parse XML response
    const keyMatches = [...xml.matchAll(/<Key>([^<]+)<\/Key>/g)];
    const sizeMatches = [...xml.matchAll(/<Size>(\d+)<\/Size>/g)];
    const dateMatches = [...xml.matchAll(/<LastModified>([^<]+)<\/LastModified>/g)];

    for (let i = 0; i < keyMatches.length; i++) {
      objects.push({
        key: keyMatches[i][1],
        size: sizeMatches[i] ? parseInt(sizeMatches[i][1]) : 0,
        lastModified: dateMatches[i] ? dateMatches[i][1] : "",
      });
    }

    const truncated = xml.includes("<IsTruncated>true</IsTruncated>");
    if (truncated) {
      const tokenMatch = xml.match(/<NextContinuationToken>([^<]+)<\/NextContinuationToken>/);
      continuationToken = tokenMatch ? tokenMatch[1] : "";
      hasMore = !!continuationToken;
    } else {
      hasMore = false;
    }
  }

  return objects;
}
