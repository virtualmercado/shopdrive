

## Plan: Enhanced Image Audit with Auto-Discovery & Storage Map

### Current State
The existing `AdminImageAudit.tsx` (806 lines) only audits `products.image_url`, `products.images`, and `product_images.image_url`. The user wants a full platform-wide audit covering ALL tables with image columns.

### Phase 1 — Storage Map (Auto-Discovery)

From the schema, here are ALL tables/columns that store image references:

| Table | Column | Type | Entity |
|-------|--------|------|--------|
| `products` | `image_url` | text | Produto |
| `products` | `images` | jsonb (array) | Produto |
| `product_images` | `image_url` | text | Produto (galeria) |
| `product_brands` | `logo_url` | text | Marca |
| `profiles` | `store_logo_url` | text | Lojista |
| `profiles` | `banner_desktop_url` | text | Lojista |
| `profiles` | `banner_desktop_urls` | jsonb (array) | Lojista |
| `profiles` | `banner_mobile_url` | text | Lojista |
| `profiles` | `banner_mobile_urls` | jsonb (array) | Lojista |
| `profiles` | `banner_rect_1_url` | text | Lojista |
| `profiles` | `banner_rect_2_url` | text | Lojista |
| `profiles` | `minibanner_1_img2_url` | text | Lojista |
| `profiles` | `minibanner_2_img2_url` | text | Lojista |
| `brand_templates` | `logo_url` | text | Template |
| `brand_templates` | `banner_desktop_urls` | jsonb | Template |
| `brand_templates` | `banner_mobile_urls` | jsonb | Template |
| `cms_banners` | `media_url` | text | CMS |
| `media_files` | `url` | text | Mídia |
| `media_files` | `file_path` | text | Mídia |

### Changes to `AdminImageAudit.tsx`

**1. Add Storage Map section** — A collapsible card shown before running the audit that displays the table above in a clean UI. Each row shows: Table, Column, Type, Entity, and a sample value (fetched on-demand with a small query).

**2. Expand the audit scan** to cover ALL tables above, not just products. The `ImageRef` type gets generalized:
```typescript
interface ImageRef {
  entity: string;        // "Produto", "Marca", "Lojista", "Template", "CMS", "Mídia"
  entityId: string;
  entityName: string;
  table: string;
  column: string;
  rowId?: string;
  url: string;
}
```

**3. Add "Mapa de Armazenamento" tab** — Shows the discovered schema with sample data and classification per column.

**4. Add duplicate detection** — Group refs by URL value, flag any URL appearing in multiple records.

**5. Enhance "Corrigir Paths" button** — For full URLs that match the PUBLIC_MEDIA_BASE_URL pattern, extract the key/path portion and update via the edge function's `fix_paths` action (already supports `product_images` and `products` tables).

### Changes to Edge Function `audit-images`

**6. Expand `fix_paths` action** to support additional tables: `product_brands`, `profiles`, `cms_banners`, `media_files`.

### New Audit Phases (client-side)

The scan becomes multi-phase:
1. Fetch products + product_images (existing)
2. Fetch product_brands (logo_url)
3. Fetch profiles (all banner/logo columns)
4. Fetch brand_templates (logo + banners)
5. Fetch cms_banners (media_url)
6. Fetch media_files (url, file_path)
7. Classify all refs
8. Validate via edge function (batched)
9. List storage objects for orphan detection
10. Duplicate detection

### UI Additions

- New "Mapa de Armazenamento" section at top (always visible, collapsible)
- Summary cards updated with per-entity breakdown
- New "Duplicadas" tab showing URLs referenced multiple times
- Existing tabs enhanced with entity/table/column info instead of just product info

### Files Changed

| File | Change |
|------|--------|
| `src/pages/admin/AdminImageAudit.tsx` | Major rewrite: add storage map, expand scan to all tables, add duplicates tab |
| `supabase/functions/audit-images/index.ts` | Expand `fix_paths` to support more tables |

No database changes needed.

