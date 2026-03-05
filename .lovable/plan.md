

## Plan: Align Product Cards in Dashboard Grid

### Problem
Cards have variable heights due to differing description lengths, causing prices, stock info, and buttons to misalign across the grid row.

### Solution
Apply `flex-col h-full` structure to each Card so content stretches uniformly and the price/stock/buttons section is always pinned to the bottom.

### Changes — Single file: `src/pages/dashboard/Products.tsx`

**1. Card container** (line 284): Add `flex flex-col h-full` to the `<Card>`.

**2. Content area** (line 310): Split the `<div className="p-4">` into two sections:
- **Top section** (`flex-1`): title + description (description clamped to 3 lines via `line-clamp-3`)
- **Bottom section** (`mt-auto`): price, stock, and action buttons — always pinned to card bottom.

**3. Description clamp**: Change `line-clamp-2` → `line-clamp-3`, and add a fixed min-height so cards without descriptions still align.

No other files or database changes needed.

