import { S3Client, DeleteObjectCommand } from "npm:@aws-sdk/client-s3@3.700.0";

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
