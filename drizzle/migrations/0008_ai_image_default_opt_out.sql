-- IA de imagens do onboarding: de opt-in manual para liberada por padrão (opt-out administrativo).
-- Rollback: ALTER COLUMN ai_image_enabled SET DEFAULT false; UPDATE ... SET ai_image_enabled=false
--   WHERE store_id IN (SELECT store_id FROM store_onboarding_events WHERE event_type='AI_ACCESS_DEFAULT_ENABLED');

-- 1) Converte lojas existentes, exceto as com revogação administrativa explícita
--    (último evento AI_ACCESS_* da loja = AI_ACCESS_REVOKED).
WITH last_admin AS (
  SELECT DISTINCT ON (store_id) store_id, event_type
  FROM public.store_onboarding_events
  WHERE event_type IN ('AI_ACCESS_GRANTED', 'AI_ACCESS_REVOKED')
  ORDER BY store_id, created_at DESC
),
converted AS (
  UPDATE public.store_onboarding_state s
     SET ai_image_enabled = true, updated_at = now()
   WHERE s.ai_image_enabled = false
     AND NOT EXISTS (
       SELECT 1 FROM last_admin la
        WHERE la.store_id = s.store_id AND la.event_type = 'AI_ACCESS_REVOKED'
     )
  RETURNING s.store_id
)
INSERT INTO public.store_onboarding_events (store_id, user_id, event_type, metadata)
SELECT store_id, store_id, 'AI_ACCESS_DEFAULT_ENABLED',
       jsonb_build_object('source', 'default_opt_out_migration', 'at', now())
FROM converted;

-- 2) Novas lojas nascem com IA de imagens ativa.
ALTER TABLE public.store_onboarding_state ALTER COLUMN ai_image_enabled SET DEFAULT true;
COMMENT ON COLUMN public.store_onboarding_state.ai_image_enabled IS
  'IA de imagens do onboarding. true = ativa (padrão); false = suspensa individualmente pelo Master.';

-- 3) Uso agregado de imagens por loja nas últimas 24h (evita o teto de 1000 linhas no Master).
CREATE OR REPLACE FUNCTION public.admin_ai_image_usage_24h()
RETURNS TABLE(store_id uuid, used_24h bigint, last_generation_at timestamptz, last_error text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'not authorized';
  END IF;
  RETURN QUERY
  SELECT l.store_id,
         count(*)::bigint,
         max(l.created_at),
         (array_agg(COALESCE(l.error_message, 'erro') ORDER BY l.created_at DESC)
            FILTER (WHERE l.status = 'error'))[1]
  FROM public.ai_media_generation_logs l
  WHERE l.created_at >= now() - interval '24 hours'
    AND l.kind = 'hero_banner'
  GROUP BY l.store_id;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_ai_image_usage_24h() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_ai_image_usage_24h() TO authenticated;