import { supabase } from "@/integrations/supabase/client";

/**
 * Tonal adjustments stored per image (7 sliders).
 */
export interface ImageAdjustments {
  exposure: number;
  contrast: number;
  highlights: number;
  shadows: number;
  whites: number;
  blacks: number;
  sharpness: number;
}

export type PersistEditedProductImageParams = {
  userId: string;
  productId: string;
  imageIndex: number;
  blob: Blob;
  /** Tonal adjustments to persist (so sliders rehydrate on reopen). */
  adjustments?: ImageAdjustments;
};

export type PersistEditedProductImageResult = {
  publicUrl: string;
  images: string[];
  mainImage: string | null;
  /** Current adjustments array (one entry per image). */
  imageAdjustments: ImageAdjustments[];
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

const defaultAdjustments: ImageAdjustments = {
  exposure: 0,
  contrast: 0,
  highlights: 0,
  shadows: 0,
  whites: 0,
  blacks: 0,
  sharpness: 0,
};

/**
 * Uploads an edited image blob and persists it to the product in the database.
 * Also stores tonal adjustments for this image index so sliders rehydrate correctly.
 */
export async function persistEditedProductImage({
  userId,
  productId,
  imageIndex,
  blob,
  adjustments,
}: PersistEditedProductImageParams): Promise<PersistEditedProductImageResult> {
  const traceStart = performance.now();
  const trace = (stage: string, detail?: Record<string, unknown>) => {
    const elapsedMs = Math.round(performance.now() - traceStart);
    console.log("[VM][ImagePersistTrace]", { stage, elapsedMs, ...(detail ?? {}) });
  };
  const traceError = (stage: string, error: unknown, detail?: Record<string, unknown>) => {
    const elapsedMs = Math.round(performance.now() - traceStart);
    const err = error instanceof Error
      ? { name: error.name, message: error.message, stack: error.stack }
      : { value: error };
    console.error("[VM][ImagePersistTrace]", { stage, elapsedMs, success: false, error: err, ...(detail ?? {}) });
  };

  // Always log key milestones so production failures are diagnosable from the user's console.
  const debugEnabled = true;
  const id = genId();
  const now = Date.now();

  // Keep uploads inside merchant folder for storage isolation and cache-busting.
  const filePath = `brands/${userId}/products/${productId}/${imageIndex}-${now}-${id}.jpg`;
  trace("start", { productId, imageIndex, bytes: blob.size, type: blob.type, filePath });

  console.groupCollapsed("[VM][ImageSave] persistEditedProductImage");
  console.log("params", { productId, imageIndex, bytes: blob.size, type: blob.type, filePath });

  // CRITICAL: in production the user's auth session may have expired silently while the
  // editor was open (tokens have a short TTL). The Storage API will then hang waiting for
  // a 401-retry that never comes through certain proxies. Force a refresh BEFORE upload
  // so we always have a fresh access_token on the wire.
  try {
    trace("session_get_start");
    const { data: sessionData } = await supabase.auth.getSession();
    trace("session_get_success", { hasSession: !!sessionData.session });
    if (!sessionData.session) {
      throw new Error("Sessão expirada. Faça login novamente para salvar a imagem.");
    }
    // Best-effort refresh; ignore "already fresh" errors.
    trace("session_refresh_start");
    await supabase.auth.refreshSession().catch(() => {});
    trace("session_refresh_success");
    console.log("session refreshed before upload");
  } catch (sessErr) {
    traceError("session_refresh_error", sessErr);
    console.error("[VM][ImageSave] session refresh failed", sessErr);
    console.groupEnd();
    throw sessErr;
  }

  const file = new File([blob], `product-${productId}-${imageIndex}.jpg`, { type: "image/jpeg" });

  // Upload with a hard timeout so production never hangs indefinitely on a stalled request.
  const UPLOAD_TIMEOUT_MS = 45000;
  const uploadPromise = supabase.storage
    .from("product-images")
    .upload(filePath, file, { contentType: "image/jpeg", upsert: false });
  trace("storage_upload_start", { bucket: "product-images", filePath, timeoutMs: UPLOAD_TIMEOUT_MS });

  const uploadResponse: any = await Promise.race([
    uploadPromise,
    new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new Error("Timeout ao enviar imagem (45s). Verifique sua conexão e tente novamente.")),
        UPLOAD_TIMEOUT_MS
      )
    ),
  ]);
  trace("storage_upload_response", {
    hasData: !!uploadResponse?.data,
    errorMessage: uploadResponse?.error?.message,
    errorStatus: uploadResponse?.error?.statusCode,
  });

  console.log("upload result", { data: uploadResponse?.data, error: uploadResponse?.error });

  if (uploadResponse?.error) {
    traceError("storage_upload_error", uploadResponse.error, { httpStatus: uploadResponse.error.statusCode });
    console.groupEnd();
    const msg = uploadResponse.error.message || "Falha no upload da imagem";
    throw new Error(msg);
  }

  const publicUrl = supabase.storage.from("product-images").getPublicUrl(filePath).data.publicUrl;
  trace("public_url_generated", { publicUrl, filePath });
  if (!publicUrl) {
    console.groupEnd();
    throw new Error("Não foi possível obter a URL pública da imagem");
  }

  // Fetch current persisted images + adjustments (do NOT trust local state; requirement: rehydrate).
  const fetchResponse = await supabase
    .from("products")
    .select("images,image_url,image_adjustments")
    .eq("id", productId)
    .maybeSingle();
  trace("product_prefetch_response", {
    hasData: !!fetchResponse.data,
    errorMessage: fetchResponse.error?.message,
    errorCode: fetchResponse.error?.code,
  });

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
  const currentAdjRaw = (fetchResponse.data as any)?.image_adjustments;
  const currentAdj: ImageAdjustments[] = Array.isArray(currentAdjRaw) ? currentAdjRaw : [];

  const nextImages = [...currentImages];
  if (nextImages.length === 0) {
    nextImages.push(publicUrl);
  } else if (imageIndex >= 0 && imageIndex < nextImages.length) {
    nextImages[imageIndex] = publicUrl;
  } else {
    nextImages.push(publicUrl);
  }

  const nextMain = nextImages[0] || null;

  // Build adjustments array (one entry per image slot)
  const nextAdj = [...currentAdj];
  while (nextAdj.length < nextImages.length) {
    nextAdj.push({ ...defaultAdjustments });
  }
  // Update the slot with new values
  nextAdj[imageIndex] = adjustments ?? { ...defaultAdjustments };
  // Trim to match images length (just in case)
  const finalAdj = nextAdj.slice(0, nextImages.length);

  // Cast adjustments to any to avoid TS Json type issues.
  const updateResponse = await supabase
    .from("products")
    .update({
      images: nextImages,
      image_url: nextMain,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      image_adjustments: finalAdj as any,
    })
    .eq("id", productId)
    .select("images,image_url,image_adjustments")
    .maybeSingle();
  trace("product_update_response", {
    hasData: !!updateResponse.data,
    errorMessage: updateResponse.error?.message,
    errorCode: updateResponse.error?.code,
  });

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
    .select("images,image_url,image_adjustments")
    .eq("id", productId)
    .maybeSingle();
  trace("product_refetch_response", {
    hasData: !!refetchResponse.data,
    errorMessage: refetchResponse.error?.message,
    errorCode: refetchResponse.error?.code,
  });

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
  const finalImageAdj: ImageAdjustments[] =
    (refetchResponse.data as any)?.image_adjustments ?? (updateResponse.data as any)?.image_adjustments ?? finalAdj;

  trace("complete", {
    imagesCount: finalImages.length,
    hasMainImage: !!finalMain,
  });

  return {
    publicUrl,
    images: finalImages,
    mainImage: finalMain,
    imageAdjustments: finalImageAdj,
    debug: {
      filePath,
      uploadData: uploadResponse.data,
      updateData: updateResponse.data,
      refetchData: refetchResponse.data,
    },
  };
}
