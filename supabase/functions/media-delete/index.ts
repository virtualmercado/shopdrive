import { S3Client, DeleteObjectCommand } from "npm:@aws-sdk/client-s3@3.700.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { mediaDeleteDecision } from "../_shared/authorization.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ ok: false, error: "Method not allowed" }, 405);
  }

  try {
    // --- Authentication ---
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return jsonResponse({ ok: false, error: "Unauthorized" }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabaseAuth.auth.getClaims(token);

    if (claimsError || !claimsData?.claims) {
      return jsonResponse({ ok: false, error: "Invalid token" }, 401);
    }

    const { publicUrl } = await req.json();

    if (!publicUrl || typeof publicUrl !== "string") {
      return jsonResponse({ ok: false, error: "publicUrl é obrigatório" }, 400);
    }

    const baseUrl = Deno.env.get("PUBLIC_MEDIA_BASE_URL")!;
    const bucket = Deno.env.get("MINIO_BUCKET_PUBLIC") || "media-public";
    const bucketSegment = `/${bucket}/`;

    // Validate origin
    if (!publicUrl.startsWith(baseUrl)) {
      return jsonResponse({ ok: false, error: "URL não pertence ao domínio permitido" }, 400);
    }

    // Extract objectKey
    const bucketIndex = publicUrl.indexOf(bucketSegment);
    if (bucketIndex === -1) {
      return jsonResponse({ ok: false, error: "URL não contém o bucket esperado" }, 400);
    }

    const objectKey = publicUrl.substring(bucketIndex + bucketSegment.length);
    if (!objectKey || objectKey.includes("..")) {
      return jsonResponse({ ok: false, error: "objectKey inválido" }, 400);
    }

    // --- Ownership verification (fail-closed) ---
    // Only products/{product_id}/... keys are deletable, and only by the product
    // owner or a Master/admin. Any other prefix is rejected — no generic deletes.
    const userId = claimsData.claims.sub as string;
    const pathParts = objectKey.split("/");
    const supabaseService = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: isAdmin } = await supabaseService.rpc("has_role", {
      _user_id: userId,
      _role: "admin",
    });

    let productOwnerId: string | null = null;
    if (pathParts[0] === "products" && pathParts[1]) {
      const { data: product } = await supabaseService
        .from("products")
        .select("user_id")
        .eq("id", pathParts[1])
        .maybeSingle();
      productOwnerId = product?.user_id ?? null;
    }

    if (mediaDeleteDecision(objectKey, { userId, isAdmin: isAdmin === true }, productOwnerId) !== "allow") {
      return jsonResponse({ ok: false, error: "Sem permissão para deletar este arquivo" }, 403);
    }

    // Delete from MinIO
    const s3 = new S3Client({
      endpoint: Deno.env.get("MINIO_ENDPOINT")!,
      region: Deno.env.get("MINIO_REGION") || "eu-south",
      credentials: {
        accessKeyId: Deno.env.get("MINIO_ACCESS_KEY")!,
        secretAccessKey: Deno.env.get("MINIO_SECRET_KEY")!,
      },
      forcePathStyle: true,
    });

    await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: objectKey }));

    return jsonResponse({ ok: true, objectKey });
  } catch (err) {
    console.error("media-delete error:", err);
    return jsonResponse({ ok: false, error: "Erro interno ao deletar objeto" }, 500);
  }
});
