import type { CatalogIdentity } from "../types";

export const EDITORIAL_TEMPLATE_ID = "editorial_01";
export const EDITORIAL_TEMPLATE_VERSION = "1.1";

/** A4 retrato em milímetros. */
export const PAGE = { w: 210, h: 297, margin: 14, headerH: 12, footerH: 10 } as const;

export type RGB = [number, number, number];

export interface EditorialTheme {
  primary: RGB;
  onPrimary: RGB;
  accent: RGB;
  onAccent: RGB;
  ink: RGB;
  muted: RGB;
  hairline: RGB;
  paper: RGB;
  tint: RGB;
  imageBg: RGB;
  price: RGB;
  font: "helvetica";
}

const FALLBACK_PRIMARY: RGB = [31, 41, 55];

export const hexToRgb = (hex: string | null | undefined): RGB | null => {
  if (!hex) return null;
  let h = hex.trim().replace(/^#/, "");
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  if (!/^[0-9a-f]{6}$/i.test(h)) return null;
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
};

const lin = (c: number) => {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};
export const luminance = ([r, g, b]: RGB) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
export const contrast = (a: RGB, b: RGB) => {
  const [x, y] = [luminance(a), luminance(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
};
export const mix = (a: RGB, b: RGB, t: number): RGB => [0, 1, 2].map((i) => Math.round(a[i] * (1 - t) + b[i] * t)) as RGB;

const WHITE: RGB = [255, 255, 255];
const INK: RGB = [24, 24, 27];
export const readableOn = (bg: RGB): RGB => (contrast(bg, WHITE) >= contrast(bg, INK) ? WHITE : INK);

/** Escurece a cor até atingir contraste mínimo sobre fundo claro. */
const ensureOnLight = (c: RGB, min = 4.5): RGB => {
  let out = c;
  for (let i = 0; i < 10 && contrast(out, WHITE) < min; i++) out = mix(out, INK, 0.2);
  return out;
};

export const buildEditorialTheme = (identity: CatalogIdentity): EditorialTheme => {
  const base = hexToRgb(identity.colors.primary) ?? FALLBACK_PRIMARY;
  // Cor de marca muito clara não funciona como fundo de capa: escurecida com segurança.
  const primary = luminance(base) > 0.6 ? ensureOnLight(base, 3) : base;
  const accentRaw = hexToRgb(identity.colors.buttonBg) ?? hexToRgb(identity.colors.secondary) ?? primary;
  const accent = contrast(accentRaw, WHITE) < 1.6 ? primary : accentRaw;
  const priceRaw = hexToRgb(identity.colors.price) ?? primary;
  return {
    primary,
    onPrimary: readableOn(primary),
    accent,
    onAccent: readableOn(accent),
    ink: INK,
    muted: [107, 114, 128],
    hairline: [226, 228, 232],
    paper: WHITE,
    tint: mix(primary, WHITE, 0.93),
    imageBg: mix(primary, WHITE, 0.96),
    price: ensureOnLight(priceRaw),
    font: "helvetica",
  };
};
