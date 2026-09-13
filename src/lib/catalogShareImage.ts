import { supabase } from "@/integrations/supabase/client";

export const SHARE_IMAGE_MAX_BYTES = 5 * 1024 * 1024; // 5 MB
export const SHARE_IMAGE_ALLOWED_MIMES = ["image/jpeg", "image/png", "image/webp"] as const;
export const SHARE_IMAGE_ALLOWED_EXTS = ["jpg", "jpeg", "png", "webp"] as const;
const SHARE_IMAGE_FOLDER = "catalog-share";
const BUCKET = "product-images";
const MAX_EDGE = 1440; // downscale very large camera photos

export type ShareImageValidation =
  | { ok: true; warning?: string }
  | { ok: false; error: string };

/** Validates MIME type + extension + size. Never trusts the extension alone. */
export const validateShareImageFile = (file: File): ShareImageValidation => {
  const ext = (file.name.split(".").pop() || "").toLowerCase();
  const mimeOk = (SHARE_IMAGE_ALLOWED_MIMES as readonly string[]).includes(file.type);
  const extOk = (SHARE_IMAGE_ALLOWED_EXTS as readonly string[]).includes(ext);

  if (!mimeOk || !extOk) {
    return { ok: false, error: "Use uma imagem JPG ou PNG." };
  }
  if (file.size > SHARE_IMAGE_MAX_BYTES) {
    return { ok: false, error: "A imagem deve ter no máximo 5 MB." };
  }
  return { ok: true };
};

const loadBitmap = (file: File): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("invalid-image"));
    };
    img.src = url;
  });

interface PreparedImage {
  blob: Blob;
  contentType: string;
  ext: string;
  width: number;
  height: number;
}

/**
 * Decodes the file (real image check), downscales oversized images and
 * compresses gently. PNG keeps PNG (transparency), everything else -> JPEG.
 */
export const prepareShareImage = async (file: File): Promise<PreparedImage> => {
  const img = await loadBitmap(file);
  const { naturalWidth: w, naturalHeight: h } = img;

  const keepPng = file.type === "image/png";
  const scale = Math.min(1, MAX_EDGE / Math.max(w, h));
  const targetW = Math.max(1, Math.round(w * scale));
  const targetH = Math.max(1, Math.round(h * scale));

  // Small enough and already an accepted final format: upload as-is.
  if (scale === 1 && (file.type === "image/jpeg" || keepPng)) {
    return {
      blob: file,
      contentType: file.type,
      ext: keepPng ? "png" : "jpg",
      width: w,
      height: h,
    };
  }

  const canvas = document.createElement("canvas");
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas-unavailable");
  if (!keepPng) {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, targetW, targetH);
  }
  ctx.drawImage(img, 0, 0, targetW, targetH);

  const contentType = keepPng ? "image/png" : "image/jpeg";
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, contentType, keepPng ? undefined : 0.88),
  );
  if (!blob) throw new Error("encode-failed");

  return {
    blob,
    contentType,
    ext: keepPng ? "png" : "jpg",
    width: targetW,
    height: targetH,
  };
};

const objectPathFromPublicUrl = (url: string): string | null => {
  const marker = `/${BUCKET}/`;
  const idx = url.indexOf(marker);
  if (idx === -1) return null;
  const path = decodeURIComponent(url.substring(idx + marker.length).split("?")[0]);
  if (!path || path.includes("..")) return null;
  return path;
};

/** Removes a previously stored share image, only inside the owner's own folder. */
export const deleteStoredShareImage = async (userId: string, url: string | null) => {
  if (!url) return;
  const path = objectPathFromPublicUrl(url);
  if (!path) return;
  if (!path.startsWith(`${userId}/${SHARE_IMAGE_FOLDER}/`)) return; // never touch logos/other assets
  await supabase.storage.from(BUCKET).remove([path]);
};

export interface UploadResult {
  publicUrl: string;
  width: number;
  height: number;
}

/** Uploads the share image into {userId}/catalog-share/{uuid}.{ext} and persists it on the store profile. */
export const uploadShareImage = async (userId: string, file: File): Promise<UploadResult> => {
  const prepared = await prepareShareImage(file);
  const objectName = `${userId}/${SHARE_IMAGE_FOLDER}/${crypto.randomUUID()}.${prepared.ext}`;

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(objectName, prepared.blob, { contentType: prepared.contentType, upsert: false });

  if (uploadError) throw uploadError;

  const publicUrl = supabase.storage.from(BUCKET).getPublicUrl(objectName).data.publicUrl;

  const { error: dbError } = await supabase
    .from("profiles")
    .update({ catalog_share_image_url: publicUrl })
    .eq("id", userId);

  if (dbError) {
    await supabase.storage.from(BUCKET).remove([objectName]);
    throw dbError;
  }

  return { publicUrl, width: prepared.width, height: prepared.height };
};

/** Clears the custom share image on the store profile (logo fallback returns). */
export const clearShareImage = async (userId: string) => {
  const { error } = await supabase
    .from("profiles")
    .update({ catalog_share_image_url: null })
    .eq("id", userId);
  if (error) throw error;
};

/** custom image -> store logo -> nothing (dynamic fallback, resolved at share time). */
export const resolveEffectiveShareImage = (
  customUrl: string | null | undefined,
  storeLogoUrl: string | null | undefined,
): string | null => customUrl?.trim() || storeLogoUrl?.trim() || null;

const extFromType = (type: string) => (type === "image/png" ? "png" : type === "image/webp" ? "webp" : "jpg");

/** Fetches a remote image URL and turns it into a File for the Web Share API. */
export const fetchImageAsFile = async (url: string): Promise<File | null> => {
  try {
    const res = await fetch(url, { mode: "cors" });
    if (!res.ok) return null;
    const blob = await res.blob();
    if (!blob.type.startsWith("image/")) return null;
    if (blob.type === "image/svg+xml") return null;
    return new File([blob], `catalogo.${extFromType(blob.type)}`, { type: blob.type });
  } catch {
    return null;
  }
};
