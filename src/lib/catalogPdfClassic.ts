/**
 * Pure helpers shared by the classic Catálogo PDF preview and its jsPDF
 * renderer. Kept free of DOM/React so the same rules apply to both engines.
 */

/** Public ShopDrive origin baked into PDFs (never the preview/admin host). */
export const CATALOG_PUBLIC_ORIGIN = "https://shopdrive.com.br";

export const buildCatalogStoreUrl = (storeSlug: string): string =>
  `${CATALOG_PUBLIC_ORIGIN}/${storeSlug}`;

export const buildCatalogProductUrl = (storeSlug: string, productId: string): string =>
  `${CATALOG_PUBLIC_ORIGIN}/${storeSlug}/produto/${productId}?src=catalogo_pdf`;

const NAMED_ENTITIES: Record<string, string> = {
  nbsp: " ",
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  ndash: "–",
  mdash: "—",
  hellip: "…",
  bull: "•",
  laquo: "«",
  raquo: "»",
  ordm: "º",
  ordf: "ª",
  deg: "°",
};

const decodeEntities = (s: string): string =>
  s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, code: string) => {
    if (code[0] === "#") {
      const n = code[1] === "x" || code[1] === "X" ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      if (!Number.isFinite(n) || n <= 0 || n > 0x10ffff) return "";
      return String.fromCodePoint(n);
    }
    return NAMED_ENTITIES[code.toLowerCase()] ?? match;
  });

/**
 * Converts stored rich-text HTML into plain, readable catalog text.
 * Text-only: tags are stripped, never parsed into DOM or executed.
 */
export const htmlToCatalogText = (html: string | null | undefined): string => {
  if (!html) return "";
  let s = String(html);
  s = s.replace(/<!--[\s\S]*?-->/g, "");
  s = s.replace(/<(script|style|iframe|object|noscript)[^>]*>[\s\S]*?<\/\1\s*>/gi, "");
  s = s.replace(/<br\s*\/?>/gi, "\n");
  s = s.replace(/<li[^>]*>/gi, "\n• ");
  s = s.replace(/<\/(p|div|h[1-6]|blockquote|ul|ol|tr|section|article)\s*>/gi, "\n\n");
  s = s.replace(/<\/li\s*>/gi, "");
  s = s.replace(/<[^>]*>/g, "");
  s = s.replace(/</g, "");
  s = decodeEntities(s);
  s = s.replace(/\u00a0/g, " ");
  s = s
    .split("\n")
    .map((line) => line.replace(/[ \t\f\v]+/g, " ").trim())
    .join("\n");
  s = s.replace(/\n{3,}/g, "\n\n");
  return s.trim();
};

/** Pixel budget for an image drawn at `maxMm` (≈200 dpi, never upscaled). */
export const catalogImageMaxEdgePx = (maxMm: number): number =>
  Math.max(160, Math.min(1600, Math.round(maxMm * 8)));

/** Fits (w,h) into maxEdge keeping aspect ratio; never enlarges. */
export const fitWithinEdge = (w: number, h: number, maxEdge: number) => {
  const scale = Math.min(1, maxEdge / Math.max(w, h));
  return { width: Math.max(1, Math.round(w * scale)), height: Math.max(1, Math.round(h * scale)) };
};

export interface CatalogImage {
  data: string;
  width: number;
  height: number;
  format: "PNG" | "JPEG";
  /** Stable jsPDF alias so a repeated image is embedded only once. */
  alias: string;
}

/**
 * Per-generation image cache: each (url, transparency, size) is downloaded
 * and encoded once; failures and timeouts resolve to null.
 */
export const createCatalogImageLoader = (
  decode: (url: string, preserveTransparency: boolean, maxEdgePx: number, timeoutMs: number) => Promise<Omit<CatalogImage, "alias"> | null>,
  timeoutMs = 15000,
) => {
  const cache = new Map<string, Promise<CatalogImage | null>>();
  let counter = 0;
  const load = (url: string, preserveTransparency: boolean, maxEdgePx: number) => {
    const key = `${preserveTransparency ? "p" : "j"}|${maxEdgePx}|${url}`;
    let hit = cache.get(key);
    if (!hit) {
      const alias = `cimg${counter++}`;
      hit = decode(url, preserveTransparency, maxEdgePx, timeoutMs)
        .then((r) => (r ? { ...r, alias } : null))
        .catch(() => null);
      cache.set(key, hit);
    }
    return hit;
  };
  return { load, size: () => cache.size };
};
