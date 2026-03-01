import { S3Client, PutObjectCommand } from "npm:@aws-sdk/client-s3@3.700.0";
import { getSignedUrl } from "npm:@aws-sdk/s3-request-presigner@3.700.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const ALLOWED_MIMES: Record<string, string> = {
  "image/jpeg": "jpeg",
  "image/png": "png",
  "image/webp": "webp",
};

const MAX_SIZE = 10 * 1024 * 1024; // 10 MB

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
    const { product_id, mime_type, size_bytes } = await req.json();

    // --- Validations ---
    if (!product_id) {
      return jsonResponse({ ok: false, error: "product_id é obrigatório" }, 400);
    }

    if (!ALLOWED_MIMES[mime_type]) {
      return jsonResponse(
        { ok: false, error: "mime_type inválido. Permitidos: image/jpeg, image/png, image/webp" },
        400,
      );
    }

    if (typeof size_bytes !== "number" || size_bytes <= 0 || size_bytes > MAX_SIZE) {
      return jsonResponse(
        { ok: false, error: `size_bytes deve ser entre 1 e ${MAX_SIZE} (10 MB)` },
        400,
      );
    }

    // --- Build object key ---
    const now = new Date();
    const yyyy = now.getUTCFullYear().toString();
    const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
    const ext = ALLOWED_MIMES[mime_type];
    const objectKey = `products/${product_id}/${yyyy}/${mm}/${crypto.randomUUID()}.${ext}`;

    // --- S3 client ---
    const endpoint = Deno.env.get("MINIO_ENDPOINT")!;
    const region = Deno.env.get("MINIO_REGION") || "eu-south";
    const bucket = Deno.env.get("MINIO_BUCKET_PUBLIC") || "media-public";
    const publicBase = Deno.env.get("PUBLIC_MEDIA_BASE_URL") || endpoint;

    const s3 = new S3Client({
      endpoint,
      region,
      credentials: {
        accessKeyId: Deno.env.get("MINIO_ACCESS_KEY")!,
        secretAccessKey: Deno.env.get("MINIO_SECRET_KEY")!,
      },
      forcePathStyle: true,
    });

    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: objectKey,
      ContentType: mime_type,
      ContentLength: size_bytes,
    });

    const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 300 });

    const publicUrl = `${publicBase.replace(/\/+$/, "")}/${bucket}/${objectKey}`;

    return jsonResponse({
      ok: true,
      uploadUrl,
      publicUrl,
      bucket,
      objectKey,
      headers: { "Content-Type": mime_type },
    });
  } catch (err) {
    console.error("media-presign error:", err);
    return jsonResponse({ ok: false, error: "Erro interno ao gerar URL pré-assinada" }, 500);
  }
});
