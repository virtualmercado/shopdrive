import { supabase } from "@/integrations/supabase/client";

export type PersistEditedProductImageParams = {
  userId: string;
  productId: string;
  imageIndex: number;
  blob: Blob;
};

export type PersistEditedProductImageResult = {
  publicUrl: string;
  images: string[];
  mainImage: string | null;
  debug: {
    filePath: string;
    uploadData: unknown;
    updateData: unknown;
    refetchData: unknown;
  };
};

const genId = () => {
  try {
    if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  } catch {
    // ignore
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
};

/**
 * Uploads an edited image blob and persists it to the product in the database.
 * This is used ONLY by the "Salvar imagem processada" flow.
 */
export async function persistEditedProductImage({
  userId,
  productId,
  imageIndex,
  blob,
}: PersistEditedProductImageParams): Promise<PersistEditedProductImageResult> {
  const debugEnabled = import.meta.env.DEV;
  const id = genId();
  const now = Date.now();

  // Keep uploads inside merchant folder for storage isolation and cache-busting.
  const filePath = `brands/${userId}/products/${productId}/${imageIndex}-${now}-${id}.jpg`;

  if (debugEnabled) {
    console.groupCollapsed("[VM][ImageSave] persistEditedProductImage");
    console.log("params", { productId, imageIndex, bytes: blob.size, type: blob.type, filePath });
  }

  const file = new File([blob], `product-${productId}-${imageIndex}.jpg`, { type: "image/jpeg" });

  const uploadResponse = await supabase.storage
    .from("product-images")
    .upload(filePath, file, { contentType: "image/jpeg", upsert: false });

  if (debugEnabled) {
    console.log("uploadResponse.data", uploadResponse.data);
    console.log("uploadResponse.error", uploadResponse.error);
  }

  if (uploadResponse.error) {
    if (debugEnabled) console.groupEnd();
    throw uploadResponse.error;
  }

  const publicUrl = supabase.storage.from("product-images").getPublicUrl(filePath).data.publicUrl;
  if (!publicUrl) {
    if (debugEnabled) console.groupEnd();
    throw new Error("Não foi possível obter a URL pública da imagem");
  }

  // Fetch current persisted images (do NOT trust local state; requirement: rehydrate).
  const fetchResponse = await supabase
    .from("products")
    .select("images,image_url")
    .eq("id", productId)
    .maybeSingle();

  if (debugEnabled) {
    console.log("preUpdateFetch.data", fetchResponse.data);
    console.log("preUpdateFetch.error", fetchResponse.error);
  }

  if (fetchResponse.error) {
    if (debugEnabled) console.groupEnd();
    throw fetchResponse.error;
  }

  const currentImagesRaw = (fetchResponse.data as any)?.images;
  const currentImages = Array.isArray(currentImagesRaw) ? (currentImagesRaw as string[]) : [];

  const nextImages = [...currentImages];
  if (nextImages.length === 0) {
    nextImages.push(publicUrl);
  } else if (imageIndex >= 0 && imageIndex < nextImages.length) {
    nextImages[imageIndex] = publicUrl;
  } else {
    nextImages.push(publicUrl);
  }

  const nextMain = nextImages[0] || null;

  const updateResponse = await supabase
    .from("products")
    .update({ images: nextImages, image_url: nextMain })
    .eq("id", productId)
    .select("images,image_url")
    .maybeSingle();

  if (debugEnabled) {
    console.log("updateResponse.data", updateResponse.data);
    console.log("updateResponse.error", updateResponse.error);
  }

  if (updateResponse.error) {
    if (debugEnabled) console.groupEnd();
    throw updateResponse.error;
  }

  // Mandatory re-fetch after update (proof of persistence)
  const refetchResponse = await supabase
    .from("products")
    .select("images,image_url")
    .eq("id", productId)
    .maybeSingle();

  if (debugEnabled) {
    console.log("refetchResponse.data", refetchResponse.data);
    console.log("refetchResponse.error", refetchResponse.error);
    console.groupEnd();
  }

  if (refetchResponse.error) throw refetchResponse.error;

  const finalImagesRaw = (refetchResponse.data as any)?.images ?? (updateResponse.data as any)?.images;
  const finalImages = Array.isArray(finalImagesRaw) ? (finalImagesRaw as string[]) : nextImages;
  const finalMain = ((refetchResponse.data as any)?.image_url ?? (updateResponse.data as any)?.image_url ?? nextMain) as
    | string
    | null;

  return {
    publicUrl,
    images: finalImages,
    mainImage: finalMain,
    debug: {
      filePath,
      uploadData: uploadResponse.data,
      updateData: updateResponse.data,
      refetchData: refetchResponse.data,
    },
  };
}
