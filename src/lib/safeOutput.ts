// Output-encoding helpers for exports and printable HTML.

/** Neutralizes spreadsheet formulas: a leading = + - @ tab or CR gets a ' prefix. */
export const neutralizeFormula = (v: unknown): string => {
  const s = v == null ? "" : String(v);
  return /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
};

/** Always-quoted CSV cell with formula neutralization. */
export const csvQuoted = (v: unknown): string => `"${neutralizeFormula(v).replace(/"/g, '""')}"`;

/** Escapes text for safe interpolation into HTML markup. */
export const escapeHtml = (v: unknown): string =>
  (v == null ? "" : String(v))
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
