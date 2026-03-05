

## Plan: Unify Product Images into Single Component

### Problem
The product form has two separate image sections: "Imagens do Produto" (top, using Supabase Storage) and "Galeria de Imagens (MinIO)" (bottom, using MinIO via edge functions). This creates confusion and duplicity.

### Solution
1. Remove the `ProductGalleryUploader` component usage from ProductForm (line 1422-1425)
2. Refactor the existing top image section in ProductForm to:
   - Replace the two buttons ("Câmera" + "Arquivos") with a single "Adicionar imagens" button
   - Add a "Principal" badge on the first image
   - Add "Definir como principal" action (move image to index 0)
   - Update grid to be responsive: `grid-cols-2 sm:grid-cols-3 md:grid-cols-4`
   - Ensure all thumbnails use `aspect-square object-cover`
   - Remove all references to "MinIO" text
   - Keep the existing upload/persist logic (Supabase Storage) which already works for both create and edit
3. Remove the `Camera` import (no longer needed as separate button)
4. Use a single hidden file input with `accept="image/*"` and `multiple` (mobile devices naturally offer camera option)

### Changes — Single file: `src/components/ProductForm.tsx`

**1. Imports** (line 9): Remove `Camera` from lucide imports, add `Upload` icon.

**2. Remove refs** (line 133): Remove `cameraInputRef`, keep only `fileInputRef`. Remove `handleCameraCapture` function.

**3. Image grid section** (lines 851-968): Replace entirely with:
- Label: "Imagens do Produto (máx. 7)" — no MinIO mention
- Responsive grid: `grid-cols-2 sm:grid-cols-3 md:grid-cols-4`
- First image gets a "Principal" badge (absolute positioned)
- Non-first images get a small "star" button to set as principal (moves to index 0)
- Single "Adicionar imagens" button with Upload icon
- Single hidden `<input type="file" accept="image/*" multiple>` (no separate camera input)

**4. Remove Gallery section** (lines 1422-1425): Delete the `ProductGalleryUploader` block and its import (line 13).

**5. Add "set as primary" handler**: New function that moves an image from index N to index 0, updates state, and triggers persist for existing products.

No database changes needed. The existing Supabase Storage upload pipeline remains unchanged.

