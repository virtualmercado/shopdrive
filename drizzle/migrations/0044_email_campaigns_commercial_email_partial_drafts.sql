-- Marketing only: deterministic recipient selection, independent of login/transational email.
CREATE OR REPLACE FUNCTION public.resolve_campaign_marketing_email(p_commercial text, p_account text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = public
AS $$
 SELECT CASE
 WHEN public.normalize_email(p_commercial) ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' THEN public.normalize_email(p_commercial)
 WHEN public.normalize_email(p_account) ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' THEN public.normalize_email(p_account)
 ELSE NULL END
$$;
REVOKE ALL ON FUNCTION public.resolve_campaign_marketing_email(text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_campaign_marketing_email(text,text) TO service_role;

CREATE OR REPLACE FUNCTION public._assert_email_campaign_content(p_subject text, p_content text, p_cta_label text, p_cta_url text)
RETURNS void LANGUAGE plpgsql IMMUTABLE SET search_path = public
AS $$ BEGIN
 IF p_subject IS NULL OR char_length(btrim(p_subject)) NOT BETWEEN 1 AND 200 THEN RAISE EXCEPTION 'invalid_campaign_subject'; END IF;
 IF p_content IS NULL OR char_length(btrim(p_content)) < 1 OR char_length(p_content) > 20000 THEN RAISE EXCEPTION 'invalid_campaign_content'; END IF;
 IF (nullif(btrim(p_cta_label),'') IS NULL) <> (nullif(btrim(p_cta_url),'') IS NULL) THEN RAISE EXCEPTION 'invalid_campaign_cta'; END IF;
 IF nullif(btrim(p_cta_label),'') IS NOT NULL AND (char_length(btrim(p_cta_label)) > 60 OR char_length(p_cta_url) > 2000 OR p_cta_url !~ '^https://[^[:space:]"''<>]+$') THEN RAISE EXCEPTION 'invalid_cta_url'; END IF;
 END $$;
REVOKE ALL ON FUNCTION public._assert_email_campaign_content(text,text,text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._assert_email_campaign_content(text,text,text,text) TO service_role;

-- Empty draft content remains valid on cancellation; no empty ready/processing/completed campaign.
ALTER TABLE public.email_campaigns DROP CONSTRAINT email_campaigns_content_len;
ALTER TABLE public.email_campaigns ADD CONSTRAINT email_campaigns_content_len CHECK (
 char_length(content) <= 20000 AND (status IN ('draft','cancelled') OR char_length(btrim(content)) >= 1)
);

-- Preserve existing filtering, authorization, snapshot, audit and queue logic verbatim.
DO $migration$
DECLARE v_definition text; v_old text; v_new text;
BEGIN
 v_definition := pg_get_functiondef('public._campaign_resolve_audience(jsonb)'::regprocedure);
 v_old := 'coalesce(d.account_email, d.profile_email) AS contact_email';
 v_new := 'public.resolve_campaign_marketing_email(d.profile_email, d.account_email) AS contact_email';
 IF position(v_old in v_definition) = 0 THEN RAISE EXCEPTION 'audience_patch_context_missing'; END IF;
 v_definition := replace(v_definition, v_old, v_new);
 v_old := '  PERFORM public.assert_caller_is_admin();';
 v_new := v_old || E'\n  IF p_filters IS NULL OR jsonb_typeof(p_filters) <> ''object'' THEN RAISE EXCEPTION ''invalid_audience_filters''; END IF;\n  IF v_plan NOT IN (''all'',''gratis'',''pro'',''premium'',''marca'') OR v_status NOT IN (''all'',''active'',''inactive'',''pending'',''suspenso'',''bloqueado'',''exclusao_solicitada'',''excluida'') OR v_products NOT IN (''all'',''none'',''1_20'',''21_150'',''over_150'') OR v_setup NOT IN (''all'',''ready'',''incomplete'') OR (v_from IS NOT NULL AND v_to IS NOT NULL AND v_from > v_to) THEN RAISE EXCEPTION ''invalid_audience_filters''; END IF;';
 IF position(v_old in v_definition) = 0 THEN RAISE EXCEPTION 'audience_validation_context_missing'; END IF;
 EXECUTE replace(v_definition, v_old, v_new);

 v_definition := pg_get_functiondef('public.admin_preview_email_campaign(text,text,text,text)'::regprocedure);
 v_old := '  PERFORM public.assert_caller_is_admin();';
 IF position(v_old in v_definition) = 0 THEN RAISE EXCEPTION 'preview_patch_context_missing'; END IF;
 EXECUTE replace(v_definition, v_old, v_old || E'\n  PERFORM public._assert_email_campaign_content(p_subject, p_content, p_cta_label, p_cta_url);');

 v_definition := pg_get_functiondef('public.admin_confirm_email_campaign(uuid)'::regprocedure);
 v_old := '  INSERT INTO public.email_campaign_recipients (campaign_id, store_id, email, status)';
 v_new := E'  IF v_c.name IS NULL OR char_length(btrim(v_c.name)) NOT BETWEEN 1 AND 120 THEN RAISE EXCEPTION ''invalid_campaign_name''; END IF;\n  PERFORM public._assert_email_campaign_content(v_c.subject, v_c.content, v_c.cta_label, v_c.cta_url);\n  IF NOT EXISTS (SELECT 1 FROM public._campaign_resolve_audience(v_c.audience_filters) a LEFT JOIN public.email_suppressions s ON s.email = a.email WHERE s.email IS NULL) THEN RAISE EXCEPTION ''campaign_audience_empty''; END IF;\n\n' || v_old;
 IF position(v_old in v_definition) = 0 THEN RAISE EXCEPTION 'confirmation_patch_context_missing'; END IF;
 EXECUTE replace(v_definition, v_old, v_new);
END $migration$;
COMMENT ON FUNCTION public.resolve_campaign_marketing_email(text,text) IS 'Marketing only: valid commercial profile email, then valid account email; no mutation of source data.';
COMMENT ON CONSTRAINT email_campaigns_content_len ON public.email_campaigns IS 'Partial draft (and cancelled draft) may omit content; ready/processing/completed require content. Final confirmation additionally validates content, CTA and audience.';