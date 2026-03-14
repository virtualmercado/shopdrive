/**
 * ShopDrive Elevation System
 * 
 * Standardized visual depth levels for the entire UI.
 * 
 * LEVEL 0 — SURFACE:   Backgrounds, layout containers, non-interactive areas
 * LEVEL 1 — CARD:      Dashboard widgets, product cards, list items, standard cards
 * LEVEL 2 — FEATURED:  Promotional banners, upsell cards, highlighted alerts
 * LEVEL 3 — OVERLAY:   Modals, dropdowns, popovers, tooltips, floating elements
 */

export const elevation = {
  /** Level 0 — flat surface, no shadow */
  surface: "bg-card",

  /** Level 1 — standard card with subtle hover lift */
  card: "rounded-xl border border-border bg-card shadow-sm transition-all duration-200 ease-out hover:shadow-md",

  /** Level 2 — featured/promoted card with stronger hover */
  featured: "rounded-2xl border border-border bg-card shadow-md transition-all duration-200 ease-out hover:shadow-lg",

  /** Level 3 — overlay (modals, dropdowns, popovers) — no hover */
  overlay: "rounded-2xl border border-border bg-card shadow-xl",
} as const;

export type ElevationLevel = keyof typeof elevation;
