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
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabaseAuth = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await supabaseAuth.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = user.id;
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    const { data: roleData } = await supabaseAdmin.rpc("has_role", { _user_id: userId, _role: "admin" });

    if (!roleData) {
      return new Response(JSON.stringify({ error: "Forbidden: admin only" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
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
        return jsonResponse({ results: [] });
      }

      const results: Array<{
        url: string; objectKey: string; exists: boolean;
        size: number | null; contentType: string | null; error: string | null;
      }> = [];

      for (const url of urls.slice(0, 100)) {
        const objectKey = extractObjectKey(url, publicBaseUrl, bucket);
        if (!objectKey) {
          results.push({ url, objectKey: "", exists: false, size: null, contentType: null, error: "cannot_extract_key" });
          continue;
        }
        try {
          const headRes = await s3Head(endpoint, bucket, objectKey, accessKey, secretKey, region);
          results.push({
            url, objectKey, exists: headRes.status === 200,
            size: headRes.size, contentType: headRes.contentType,
            error: headRes.status !== 200 ? `status_${headRes.status}` : null,
          });
        } catch (e) {
          results.push({ url, objectKey, exists: false, size: null, contentType: null, error: String(e) });
        }
      }
      return jsonResponse({ results });
    }

    // ---- ACTION: list_storage_objects ----
    if (action === "list_storage_objects") {
      const objects = await s3ListObjects(endpoint, bucket, "products/", accessKey, secretKey, region);
      return jsonResponse({ objects });
    }

    // ---- ACTION: delete_orphans ----
    if (action === "delete_orphans") {
      if (!Array.isArray(orphanKeys) || orphanKeys.length === 0) {
        return jsonResponse({ deleted: 0 });
      }
      let deleted = 0;
      for (const key of orphanKeys.slice(0, 200)) {
        try { await s3Delete(endpoint, bucket, key, accessKey, secretKey, region); deleted++; } catch { /* skip */ }
      }
      await supabaseAdmin.from("audit_logs").insert({
        user_id: userId, action: "delete_orphan_images", entity_type: "storage",
        metadata: { deleted_count: deleted, keys: orphanKeys.slice(0, 50) },
      });
      return jsonResponse({ deleted });
    }

    // ---- ACTION: fix_paths ----
    if (action === "fix_paths") {
      const fixes = urls as Array<{ table: string; id: string; field: string; oldValue: string; newValue: string }>;
      if (!Array.isArray(fixes) || fixes.length === 0) {
        return jsonResponse({ fixed: 0 });
      }

      const ALLOWED_TABLES: Record<string, string[]> = {
        product_images: ["image_url"],
        products: ["image_url"],
        product_brands: ["logo_url"],
        profiles: [
          "store_logo_url", "banner_desktop_url", "banner_mobile_url",
          "banner_rect_1_url", "banner_rect_2_url",
          "minibanner_1_img2_url", "minibanner_2_img2_url",
        ],
        cms_banners: ["media_url"],
        media_files: ["url", "file_path"],
        brand_templates: ["logo_url"],
      };

      let fixed = 0;
      for (const fix of fixes.slice(0, 500)) {
        const allowedFields = ALLOWED_TABLES[fix.table];
        if (!allowedFields || !allowedFields.includes(fix.field)) continue;

        // Extract key from full URL
        const key = extractObjectKey(fix.oldValue, publicBaseUrl, bucket);
        if (!key) continue;

        try {
          await supabaseAdmin.from(fix.table).update({ [fix.field]: key }).eq("id", fix.id);
          fixed++;
        } catch { /* skip */ }
      }

      await supabaseAdmin.from("audit_logs").insert({
        user_id: userId, action: "fix_image_paths", entity_type: "multi_table",
        metadata: { fixed_count: fixed },
      });
      return jsonResponse({ fixed });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

// ---- Helpers ----

function jsonResponse(data: unknown) {
  return new Response(JSON.stringify(data), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function extractObjectKey(url: string, publicBaseUrl: string, bucket: string): string | null {
  if (!url || typeof url !== "string") return null;
  if (!url.startsWith("http")) return url.startsWith("/") ? url.slice(1) : url;
  if (publicBaseUrl && url.startsWith(publicBaseUrl)) {
    let key = url.slice(publicBaseUrl.length);
    if (key.startsWith("/")) key = key.slice(1);
    return key || null;
  }
  try {
    const u = new URL(url);
    const path = u.pathname;
    const bucketPrefix = `/${bucket}/`;
    if (path.startsWith(bucketPrefix)) return path.slice(bucketPrefix.length);
    return path.startsWith("/") ? path.slice(1) : path;
  } catch { return null; }
}

// ---- S3 signing & operations ----

async function sha256Hex(data: string): Promise<string> {
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(data));
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, "0")).join("");
}

async function hmacSha256(key: ArrayBuffer | Uint8Array, data: string): Promise<ArrayBuffer> {
  const cryptoKey = await crypto.subtle.importKey("raw", key, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return crypto.subtle.sign("HMAC", cryptoKey, new TextEncoder().encode(data));
}

async function hmacHex(key: ArrayBuffer, data: string): Promise<string> {
  const sig = await hmacSha256(key, data);
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, "0")).join("");
}

async function getSignatureKey(secret: string, dateStamp: string, region: string, service: string): Promise<ArrayBuffer> {
  const kDate = await hmacSha256(new TextEncoder().encode("AWS4" + secret), dateStamp);
  const kRegion = await hmacSha256(kDate, region);
  const kService = await hmacSha256(kRegion, service);
  return hmacSha256(kService, "aws4_request");
}

async function s3SignedHeaders(
  method: string, endpoint: string, bucket: string, key: string,
  accessKey: string, secretKey: string, region: string,
): Promise<{ url: string; headers: Record<string, string> }> {
  const url = `${endpoint}/${bucket}/${key}`;
  const now = new Date();
  const dateStr = now.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
  const dateShort = dateStr.slice(0, 8);
  const host = new URL(endpoint).host;

  const headers: Record<string, string> = {
    host, "x-amz-date": dateStr, "x-amz-content-sha256": "UNSIGNED-PAYLOAD",
  };

  const signedHeaderKeys = Object.keys(headers).sort();
  const signedHeaders = signedHeaderKeys.join(";");
  const canonicalHeadersStr = signedHeaderKeys.map(k => `${k}:${headers[k].trim()}\n`).join("");
  const canonicalUri = `/${bucket}/${key}`;
  const canonicalRequest = [method, canonicalUri, "", canonicalHeadersStr, signedHeaders, "UNSIGNED-PAYLOAD"].join("\n");
  const scope = `${dateShort}/${region}/s3/aws4_request`;
  const stringToSign = ["AWS4-HMAC-SHA256", dateStr, scope, await sha256Hex(canonicalRequest)].join("\n");
  const signingKey = await getSignatureKey(secretKey, dateShort, region, "s3");
  const signature = await hmacHex(signingKey, stringToSign);

  headers["Authorization"] = `AWS4-HMAC-SHA256 Credential=${accessKey}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
  // Capitalize for fetch
  const fetchHeaders: Record<string, string> = {
    Host: host, "x-amz-date": dateStr, "x-amz-content-sha256": "UNSIGNED-PAYLOAD",
    Authorization: headers["Authorization"],
  };

  return { url, headers: fetchHeaders };
}

async function s3Head(endpoint: string, bucket: string, key: string, accessKey: string, secretKey: string, region: string) {
  const { url, headers } = await s3SignedHeaders("HEAD", endpoint, bucket, key, accessKey, secretKey, region);
  const res = await fetch(url, { method: "HEAD", headers });
  return {
    status: res.status,
    size: res.headers.get("content-length") ? parseInt(res.headers.get("content-length")!) : null,
    contentType: res.headers.get("content-type"),
  };
}

async function s3Delete(endpoint: string, bucket: string, key: string, accessKey: string, secretKey: string, region: string) {
  const { url, headers } = await s3SignedHeaders("DELETE", endpoint, bucket, key, accessKey, secretKey, region);
  await fetch(url, { method: "DELETE", headers });
}

async function s3ListObjects(endpoint: string, bucket: string, prefix: string, accessKey: string, secretKey: string, region: string) {
  const objects: Array<{ key: string; size: number; lastModified: string }> = [];
  let continuationToken = "";
  let hasMore = true;

  while (hasMore) {
    const queryParams = new URLSearchParams({ "list-type": "2", prefix, "max-keys": "1000" });
    if (continuationToken) queryParams.set("continuation-token", continuationToken);

    const url = `${endpoint}/${bucket}?${queryParams.toString()}`;
    const now = new Date();
    const dateStr = now.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
    const dateShort = dateStr.slice(0, 8);
    const host = new URL(endpoint).host;

    const headers: Record<string, string> = {
      host, "x-amz-date": dateStr, "x-amz-content-sha256": "UNSIGNED-PAYLOAD",
    };

    const signedHeaderKeys = Object.keys(headers).sort();
    const signedHeaders = signedHeaderKeys.join(";");
    const canonicalHeadersStr = signedHeaderKeys.map(k => `${k}:${headers[k].trim()}\n`).join("");
    const canonicalUri = `/${bucket}`;
    const canonicalRequest = ["GET", canonicalUri, queryParams.toString(), canonicalHeadersStr, signedHeaders, "UNSIGNED-PAYLOAD"].join("\n");
    const scope = `${dateShort}/${region}/s3/aws4_request`;
    const stringToSign = ["AWS4-HMAC-SHA256", dateStr, scope, await sha256Hex(canonicalRequest)].join("\n");
    const signingKey = await getSignatureKey(secretKey, dateShort, region, "s3");
    const signature = await hmacHex(signingKey, stringToSign);

    const fetchHeaders: Record<string, string> = {
      Host: host, "x-amz-date": dateStr, "x-amz-content-sha256": "UNSIGNED-PAYLOAD",
      Authorization: `AWS4-HMAC-SHA256 Credential=${accessKey}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
    };

    const res = await fetch(url, { headers: fetchHeaders });
    const xml = await res.text();

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
