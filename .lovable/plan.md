

## Plan: Image Audit Admin Page

### Overview
Create an admin-only page at `/gestor/auditoria-imagens` that scans all product image references across the database and validates them against the storage backend, producing a detailed report with actionable fixes.

### Architecture

The audit is split into two phases:
1. **Database scan** (client-side) — queries `products` and `product_images` tables, classifies each URL/reference
2. **Storage validation** (edge function) — receives batches of URLs, performs HEAD requests against MinIO to verify existence, size, and content-type

An edge function is necessary because the MinIO storage is external and browser CORS may block HEAD requests. The function also enables orphan detection by listing objects in MinIO.

### Data Model

**Image sources in the DB today:**
- `products.image_url` — single URL (legacy, string)
- `products.images` — jsonb array of URLs (legacy)
- `product_images` table — rows with `image_url` (full public URL) per product

All three store **full public URLs** (e.g. `https://cdn.example.com/media-public/products/{id}/...`), not bare keys. The audit must account for this.

### New Files

**1. `supabase/functions/audit-images/index.ts`** — Edge function (admin-only)
- Accepts two actions:
  - `validate_urls`: receives array of URLs, performs HEAD on each via S3 client, returns status/size/content-type
  - `list_storage_objects`: lists all objects under `products/` prefix in the MinIO bucket, returns keys (for orphan detection)
- Auth: validates JWT, checks `has_role(uid, 'admin')` via service role client
- Processes in batches of 50 to avoid timeouts

**2. `src/pages/admin/AdminImageAudit.tsx`** — Main audit page
- Uses `AdminLayout`
- "Run Audit" button triggers the scan
- Progress bar during scan
- Summary cards at top (total products, OK products, broken refs, base64 found, orphans, etc.)
- Tabbed detail tables: Broken References, Invalid Format, Base64/Local, Orphans
- "Fix paths" and "Remove orphans" action buttons

### Database Scan Logic (client-side)

```text
1. Fetch all products (id, image_url, images) — paginated in batches of 500
2. Fetch all product_images rows — paginated
3. For each product, collect all image URLs from all three sources
4. Classify each URL:
   - base64: starts with "data:image"
   - local: contains "localhost", "blob:", "file:", "/uploads"
   - valid_url: starts with "http" and contains the PUBLIC_MEDIA_BASE_URL domain
   - unknown: anything else
5. Products with zero images across all sources → "no images"
6. Build list of all valid URLs to send to edge function for HEAD validation
```

### Storage Validation Logic (edge function)

```text
validate_urls action:
  For each URL → extract objectKey from URL → S3 HeadObject
  Return: { url, exists, size, contentType }

list_storage_objects action:
  S3 ListObjectsV2 with prefix "products/"
  Return all keys found in storage
  Client compares against DB references to find orphans
```

### Route & Navigation

- Route: `/gestor/auditoria-imagens`
- Add to `AdminLayout` menu items (with `Shield` or `SearchCheck` icon, label "Auditoria de Imagens")
- Add to `App.tsx` wrapped in `<AdminRoute>`
- Add to `supabase/config.toml` with `verify_jwt = false` (validated in code)

### UI Structure

```text
┌─────────────────────────────────────────────┐
│ 🔍 Auditoria de Imagens                    │
│ [Executar Auditoria]              Progresso │
├─────────────────────────────────────────────┤
│ Summary Cards (grid 2x4):                  │
│ Total Produtos | Com Imagens OK | Refs DB   │
│ Refs Storage OK | Quebradas | Base64/Local  │
│ Fora do Padrão | Órfãs no Storage          │
├─────────────────────────────────────────────┤
│ Tabs:                                       │
│ [Quebradas] [Base64/Local] [Fora Padrão]   │
│ [Órfãs] [Sem Imagens]                      │
│                                             │
│ <Table with relevant columns per tab>       │
│                                             │
│ Actions:                                    │
│ [Corrigir paths] [Remover órfãs]           │
└─────────────────────────────────────────────┘
```

### Action Buttons

- **Corrigir paths**: For URLs that are full URLs but valid, extract and store just the objectKey portion. Updates `product_images.image_url` and `products.image_url`/`products.images` via the edge function (admin service role).
- **Remover órfãs**: Calls edge function with list of orphan keys to delete from MinIO. Requires confirmation dialog.

### Files Changed

| File | Change |
|------|--------|
| `supabase/functions/audit-images/index.ts` | New edge function |
| `src/pages/admin/AdminImageAudit.tsx` | New audit page |
| `src/App.tsx` | Add route `/gestor/auditoria-imagens` |
| `src/components/layout/AdminLayout.tsx` | Add menu item |
| `supabase/config.toml` | Add `[functions.audit-images]` with `verify_jwt = false` |

### Security
- Edge function validates admin role via `has_role()` before any operation
- All destructive actions (delete orphans, fix paths) require confirmation
- No data from other stores is exposed (the scan is global but admin-only)

### Performance
- DB queries paginated in batches of 500
- Storage HEAD requests batched in groups of 50 via edge function
- UI shows progress bar with percentage
- Audit runs on-demand only (not automatic)

