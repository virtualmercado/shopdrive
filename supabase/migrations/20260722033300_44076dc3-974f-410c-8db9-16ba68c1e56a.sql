
CREATE OR REPLACE FUNCTION public.search_store_products(
  p_store_slug text,
  p_query text,
  p_category_id uuid DEFAULT NULL,
  p_limit integer DEFAULT 40,
  p_offset integer DEFAULT 0
)
RETURNS TABLE (
  id uuid,
  name text,
  price numeric,
  promotional_price numeric,
  image_url text,
  images jsonb,
  stock integer,
  category_id uuid,
  brand_id uuid,
  is_featured boolean,
  is_new boolean,
  weight numeric,
  height numeric,
  width numeric,
  length numeric,
  variations jsonb,
  popularity_score numeric,
  promotion_countdown_enabled boolean,
  promotion_countdown_text text,
  promotion_countdown_ends_at timestamptz,
  relevance real,
  total_count bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_store_id uuid;
  v_q text;
  v_tokens text[];
BEGIN
  IF p_store_slug IS NULL OR length(trim(p_store_slug)) = 0 THEN
    RETURN;
  END IF;

  SELECT pr.id INTO v_store_id
  FROM public.profiles pr
  WHERE pr.store_slug = p_store_slug
    AND COALESCE(pr.account_status, 'active') = 'active'
  LIMIT 1;

  IF v_store_id IS NULL THEN
    RETURN;
  END IF;

  v_q := public.normalize_search_text(coalesce(p_query, ''));
  v_tokens := CASE WHEN length(v_q) = 0 THEN ARRAY[]::text[]
                   ELSE regexp_split_to_array(v_q, '\s+') END;

  RETURN QUERY
  WITH candidates AS (
    SELECT
      p.*,
      public.normalize_search_text(p.name) AS norm_name,
      public.normalize_search_text(coalesce(pb.name, '')) AS norm_brand,
      public.normalize_search_text(coalesce(pc.name, '')) AS norm_category
    FROM public.products p
    LEFT JOIN public.product_brands pb ON pb.id = p.brand_id
    LEFT JOIN public.product_categories pc ON pc.id = p.category_id
    WHERE p.user_id = v_store_id
      AND p.is_active = true
      AND (p_category_id IS NULL OR p.category_id = p_category_id)
  ),
  scored AS (
    SELECT c.*,
      (
        CASE WHEN length(v_q) = 0 THEN 0
             WHEN c.norm_name = v_q THEN 1000
             WHEN c.norm_name LIKE v_q || '%' THEN 900
             WHEN c.norm_name LIKE '% ' || v_q || '%' THEN 820
             WHEN c.norm_name LIKE '%' || v_q || '%' THEN 750
             WHEN c.norm_category LIKE '%' || v_q || '%' THEN 500
             WHEN c.norm_brand LIKE '%' || v_q || '%' THEN 480
             ELSE 0
        END
        +
        CASE WHEN length(v_q) >= 3
             THEN (similarity(c.norm_name, v_q) * 600)::int
             ELSE 0
        END
        +
        CASE WHEN array_length(v_tokens, 1) IS NOT NULL THEN (
          SELECT COALESCE(SUM(
            CASE
              WHEN length(tok) = 0 THEN 0
              WHEN c.norm_name LIKE tok || '%' THEN 120
              WHEN c.norm_name LIKE '% ' || tok || '%' THEN 100
              WHEN c.norm_name LIKE '%' || tok || '%' THEN 80
              WHEN c.norm_category LIKE '%' || tok || '%' THEN 40
              WHEN c.norm_brand LIKE '%' || tok || '%' THEN 40
              WHEN length(tok) >= 4 AND similarity(c.norm_name, tok) > 0.35
                   THEN (similarity(c.norm_name, tok) * 120)::int
              ELSE 0
            END
          ), 0)
          FROM unnest(v_tokens) AS tok
        ) ELSE 0 END
        +
        LEAST(COALESCE(c.popularity_score, 0)::int, 50)
      )::real AS score
    FROM candidates c
  ),
  filtered AS (
    SELECT * FROM scored s
    WHERE length(v_q) = 0 OR s.score > 30
  ),
  counted AS (
    SELECT count(*)::bigint AS total FROM filtered
  )
  SELECT
    f.id, f.name, f.price, f.promotional_price, f.image_url, f.images, f.stock,
    f.category_id, f.brand_id, f.is_featured, f.is_new,
    f.weight, f.height, f.width, f.length, f.variations,
    f.popularity_score,
    f.promotion_countdown_enabled, f.promotion_countdown_text, f.promotion_countdown_ends_at,
    f.score AS relevance,
    (SELECT total FROM counted) AS total_count
  FROM filtered f
  ORDER BY f.score DESC NULLS LAST,
           f.popularity_score DESC NULLS LAST,
           f.created_at DESC
  LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 40), 100))
  OFFSET GREATEST(0, COALESCE(p_offset, 0));
END;
$$;

GRANT EXECUTE ON FUNCTION public.search_store_products(text, text, uuid, integer, integer)
  TO anon, authenticated;
