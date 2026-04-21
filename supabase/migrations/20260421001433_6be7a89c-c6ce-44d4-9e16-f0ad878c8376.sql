
-- 1) Add popularity_score column on products (cached for performance)
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS popularity_score numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sales_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS views_count integer NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_products_popularity
  ON public.products (user_id, is_active, popularity_score DESC, created_at DESC);

-- 2) Function to recompute scores for a single store (lightweight)
CREATE OR REPLACE FUNCTION public.recompute_product_popularity(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  WITH sales AS (
    SELECT oi.product_id, COALESCE(SUM(oi.quantity),0)::int AS qty
    FROM public.order_items oi
    JOIN public.orders o ON o.id = oi.order_id
    WHERE o.store_owner_id = p_user_id
      AND o.status NOT IN ('cancelled','canceled','expired')
    GROUP BY oi.product_id
  ),
  views AS (
    SELECT product_id, COUNT(*)::int AS v
    FROM public.store_events
    WHERE store_id = p_user_id
      AND event_type IN ('product_view','add_to_cart')
      AND product_id IS NOT NULL
    GROUP BY product_id
  )
  UPDATE public.products p
  SET sales_count = COALESCE(s.qty, 0),
      views_count = COALESCE(v.v, 0),
      -- Score: sales weight 10, views weight 1, recency small bonus (decays)
      popularity_score = (COALESCE(s.qty,0) * 10.0)
                       + (COALESCE(v.v,0) * 1.0)
                       + GREATEST(0, 30 - EXTRACT(EPOCH FROM (now() - p.created_at))/86400) * 0.1
  FROM (SELECT id FROM public.products WHERE user_id = p_user_id) ids
  LEFT JOIN sales s ON s.product_id = ids.id
  LEFT JOIN views v ON v.product_id = ids.id
  WHERE p.id = ids.id;
END;
$$;

-- 3) Trigger: when an order item is inserted, bump score for that product
CREATE OR REPLACE FUNCTION public.bump_product_score_on_order()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE public.products
  SET sales_count = sales_count + COALESCE(NEW.quantity, 1),
      popularity_score = popularity_score + (COALESCE(NEW.quantity, 1) * 10.0)
  WHERE id = NEW.product_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_bump_product_score_on_order ON public.order_items;
CREATE TRIGGER trg_bump_product_score_on_order
AFTER INSERT ON public.order_items
FOR EACH ROW EXECUTE FUNCTION public.bump_product_score_on_order();

-- 4) Trigger: when a store_event view/add_to_cart is inserted, bump views
CREATE OR REPLACE FUNCTION public.bump_product_score_on_view()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.product_id IS NOT NULL AND NEW.event_type IN ('product_view','add_to_cart') THEN
    UPDATE public.products
    SET views_count = views_count + 1,
        popularity_score = popularity_score + 1.0
    WHERE id = NEW.product_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_bump_product_score_on_view ON public.store_events;
CREATE TRIGGER trg_bump_product_score_on_view
AFTER INSERT ON public.store_events
FOR EACH ROW EXECUTE FUNCTION public.bump_product_score_on_view();

-- 5) Backfill scores for all existing stores
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT DISTINCT user_id FROM public.products LOOP
    PERFORM public.recompute_product_popularity(r.user_id);
  END LOOP;
END $$;

-- 6) Recreate the public view to expose popularity_score
DROP VIEW IF EXISTS public.public_store_products;
CREATE VIEW public.public_store_products AS
SELECT p.id, p.name, p.description, p.price, p.promotional_price, p.image_url,
       p.images, p.stock, p.user_id, p.category_id, p.brand_id,
       p.is_featured, p.is_new, p.weight, p.height, p.width, p.length,
       p.variations, p.created_at, p.popularity_score, p.sales_count, p.views_count,
       pr.store_slug
FROM public.products p
JOIN public.profiles pr ON pr.id = p.user_id
WHERE p.is_active = true AND pr.store_slug IS NOT NULL;
