import { supabase } from "@/integrations/supabase/client";

interface PresignResponse {
  ok: boolean;
  uploadUrl: string;
  publicUrl: string;
  bucket: string;
  objectKey: string;
  headers: { "Content-Type": string };
  error?: string;
}

/**
 * Upload a product image to MinIO via the media-presign Edge Function.
 * Returns the public URL of the uploaded file.
 */
export async function uploadProductImage(
  productId: string,
  file: File
): Promise<string> {
  const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
  if (!allowedTypes.includes(file.type)) {
    throw new Error("Tipo de arquivo não permitido. Use JPEG, PNG ou WEBP.");
  }

  const maxSize = 10 * 1024 * 1024;
  if (file.size > maxSize) {
    throw new Error("Arquivo excede o limite de 10 MB.");
  }

  // 1. Get presigned URL
  const { data, error } = await supabase.functions.invoke<PresignResponse>(
    "media-presign",
    {
      body: {
        product_id: productId,
        mime_type: file.type,
        size_bytes: file.size,
      },
    }
  );

  if (error || !data?.ok) {
    throw new Error(
      data?.error || error?.message || "Erro ao gerar URL de upload"
    );
  }

  // 2. PUT file to presigned URL
  const uploadRes = await fetch(data.uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": file.type },
    body: file,
  });

  if (!uploadRes.ok) {
    throw new Error(`Falha no upload: ${uploadRes.status} ${uploadRes.statusText}`);
  }

  return data.publicUrl;
}

/**
 * Attach an already-uploaded image URL to the product_images table.
 */
export async function attachImageToProduct(
  productId: string,
  publicUrl: string,
  displayOrder: number
): Promise<void> {
  const { error } = await supabase.from("product_images").insert({
    product_id: productId,
    image_url: publicUrl,
    display_order: displayOrder,
  });

  if (error) {
    throw new Error(`Erro ao salvar imagem: ${error.message}`);
  }
}
