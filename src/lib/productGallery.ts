import { supabase } from "@/integrations/supabase/client";
import { uploadProductImage, attachImageToProduct } from "./mediaUpload";

export interface ProductImage {
  id: string;
  product_id: string;
  image_url: string;
  display_order: number;
  created_at: string;
}

/**
 * List all images for a product, ordered by display_order.
 */
export async function listProductImages(
  productId: string
): Promise<ProductImage[]> {
  const { data, error } = await supabase
    .from("product_images")
    .select("*")
    .eq("product_id", productId)
    .order("display_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) throw new Error(`Erro ao listar imagens: ${error.message}`);
  return (data ?? []) as ProductImage[];
}

/**
 * Upload a file and insert a new product_images record with the next display_order.
 */
export async function addProductImage(
  productId: string,
  file: File
): Promise<ProductImage> {
  // Find max display_order
  const existing = await listProductImages(productId);
  const maxOrder = existing.reduce(
    (max, img) => Math.max(max, img.display_order ?? 0),
    0
  );
  const nextOrder = maxOrder + 1;

  // Upload via presign
  const publicUrl = await uploadProductImage(productId, file);

  // Insert record
  const { data, error } = await supabase
    .from("product_images")
    .insert({
      product_id: productId,
      image_url: publicUrl,
      display_order: nextOrder,
    })
    .select("*")
    .single();

  if (error) throw new Error(`Erro ao salvar imagem: ${error.message}`);
  return data as ProductImage;
}

/**
 * Remove a product image record (does NOT delete the file from MinIO).
 */
export async function removeProductImage(imageId: string): Promise<void> {
  const { error } = await supabase
    .from("product_images")
    .delete()
    .eq("id", imageId);

  if (error) throw new Error(`Erro ao remover imagem: ${error.message}`);
}

/**
 * Reorder images by updating display_order based on the new ordered array of IDs.
 */
export async function setProductImagesOrder(
  productId: string,
  orderedIds: string[]
): Promise<void> {
  // Run updates sequentially to avoid conflicts
  for (let i = 0; i < orderedIds.length; i++) {
    const { error } = await supabase
      .from("product_images")
      .update({ display_order: i + 1 })
      .eq("id", orderedIds[i])
      .eq("product_id", productId);

    if (error) {
      throw new Error(`Erro ao reordenar imagem: ${error.message}`);
    }
  }
}
