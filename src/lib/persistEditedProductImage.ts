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

  // ROOT-CAUSE FIX (production hang):
  // In production behind the published-domain CDN, `supabase.storage.from(...).upload(...)`
  // could hang indefinitely (Promise neither resolved nor rejected) when the access_token
  // expired or rotated mid-flight. The SDK uses an internal XHR with no AbortController,
  // so the request became orphaned and the editor modal stayed stuck on "Salvando...".
  //
  // Replacement: do the upload via plain `fetch` against the Storage REST endpoint with:
  //   - a fresh access_token (we refresh just before)
  //   - an explicit `AbortController` so we can ALWAYS resolve/reject the Promise
  //   - explicit HTTP status handling (no silent 401-retry loop)
  let accessToken: string;
  try {
    trace("session_get_start");
    const { data: sessionData } = await supabase.auth.getSession();
    trace("session_get_success", { hasSession: !!sessionData.session });
    if (!sessionData.session) {
      throw new Error("Sessão expirada. Faça login novamente para salvar a imagem.");
    }
    trace("session_refresh_start");
    const refreshed = await supabase.auth.refreshSession().catch(() => null);
    accessToken = refreshed?.data?.session?.access_token ?? sessionData.session.access_token;
    trace("session_refresh_success", { tokenLen: accessToken?.length ?? 0 });
  } catch (sessErr) {
    traceError("session_refresh_error", sessErr);
    console.error("[VM][ImageSave] session refresh failed", sessErr);
    console.groupEnd();
    throw sessErr;
  }

  const SUPABASE_URL = (import.meta as any).env?.VITE_SUPABASE_URL as string;
  const SUPABASE_ANON_KEY = (import.meta as any).env?.VITE_SUPABASE_PUBLISHABLE_KEY as string;
  const uploadEndpoint = `${SUPABASE_URL}/storage/v1/object/product-images/${filePath}`;

  const UPLOAD_TIMEOUT_MS = 45000;
  const controller = new AbortController();
  const abortTimer = setTimeout(() => controller.abort(), UPLOAD_TIMEOUT_MS);

  trace("storage_upload_start", { bucket: "product-images", filePath, endpoint: uploadEndpoint, timeoutMs: UPLOAD_TIMEOUT_MS });

  let uploadHttpStatus = 0;
  try {
    const res = await fetch(uploadEndpoint, {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        apikey: SUPABASE_ANON_KEY,
        "Content-Type": "image/jpeg",
        "x-upsert": "false",
        "cache-control": "3600",
      },
      body: blob,
    });
    uploadHttpStatus = res.status;

    if (!res.ok) {
      let errBody: any = null;
      try { errBody = await res.json(); } catch { /* ignore */ }
      traceError("storage_upload_http_error", new Error(errBody?.message || `HTTP ${res.status}`), {
        httpStatus: res.status,
        body: errBody,
      });
      console.groupEnd();
      throw new Error(errBody?.message || `Falha no upload da imagem (HTTP ${res.status})`);
    }

    trace("storage_upload_response", { hasData: true, httpStatus: res.status });
    console.log("upload result", { httpStatus: res.status });
  } catch (uploadErr: any) {
    if (uploadErr?.name === "AbortError") {
      traceError("storage_upload_abort", uploadErr, { timeoutMs: UPLOAD_TIMEOUT_MS, httpStatus: uploadHttpStatus });
      console.groupEnd();
      throw new Error("Tempo esgotado ao enviar a imagem. Verifique sua conexão e tente novamente.");
    }
    traceError("storage_upload_network_error", uploadErr, { httpStatus: uploadHttpStatus });
    console.groupEnd();
    throw uploadErr;
  } finally {
    clearTimeout(abortTimer);
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
      uploadData: { httpStatus: 200 },
      updateData: updateResponse.data,
      refetchData: refetchResponse.data,
    },
  };
}
