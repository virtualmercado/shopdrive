

## Analysis

The database linter reports **1 ERROR-level issue**: the `public_store_products` view is a **Security Definer View** — it lacks `security_invoker = on`, meaning it bypasses RLS policies on the underlying `products` and `profiles` tables, executing with the owner's (postgres) privileges instead of the querying user's.

All other 6 views already have `security_invoker = on/true`. Only `public_store_products` is missing it.

## What This Means

Currently, any query through `public_store_products` ignores Row Level Security on `products` and `profiles`. While the view itself filters for `is_active = true` and `store_slug IS NOT NULL`, it still bypasses other RLS controls (e.g., admin-only policies, merchant isolation).

## Fix

Create a database migration that recreates the `public_store_products` view with `security_invoker = on`:

```sql
CREATE OR REPLACE VIEW public.public_store_products
WITH (security_invoker = on) AS
SELECT 
  p.id, p.name, p.description, p.price, p.promotional_price,
  p.image_url, p.images, p.stock, p.user_id, p.category_id,
  p.brand_id, p.is_featured, p.is_new, p.weight, p.height,
  p.width, p.length, p.variations, p.created_at,
  pr.store_slug
FROM products p
JOIN profiles pr ON pr.id = p.user_id
WHERE p.is_active = true AND pr.store_slug IS NOT NULL;
```

This is a single-migration fix. No application code changes are needed since the view name and columns remain identical. The only difference is that queries will now respect RLS policies — which already include "Anyone can view products from public stores" via `is_public_store(user_id)`, so public store functionality continues working.

## Impact

- No breaking changes to frontend queries
- Public store products remain visible (existing SELECT policy covers this)
- Merchant isolation and admin policies are now properly enforced through the view

