-- Run through the privileged database query tool. Nothing commits; no worker can see the test queue.
BEGIN;
DO $tests$
DECLARE v_admin uuid; v_id uuid; v_store uuid; v_email text; v_count jsonb; v_result jsonb; v_before bigint;
BEGIN
 SELECT user_id INTO v_admin FROM public.user_roles WHERE role='admin' ORDER BY user_id LIMIT 1;
 IF v_admin IS NULL THEN RAISE EXCEPTION 'test_requires_admin'; END IF;
 PERFORM set_config('request.jwt.claim.sub',v_admin::text,true);
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',v_admin,'role','authenticated')::text,true);
 SELECT count(*) INTO v_before FROM public.email_queue;

 IF public.resolve_campaign_marketing_email(' Comercial@Example.com ','account@example.com') IS DISTINCT FROM 'comercial@example.com' THEN RAISE EXCEPTION 'commercial_priority_failed'; END IF;
 IF public.resolve_campaign_marketing_email(NULL,' Account@Example.com ') IS DISTINCT FROM 'account@example.com' THEN RAISE EXCEPTION 'missing_commercial_fallback_failed'; END IF;
 IF public.resolve_campaign_marketing_email('invalid','account@example.com') IS DISTINCT FROM 'account@example.com' THEN RAISE EXCEPTION 'invalid_commercial_fallback_failed'; END IF;
 IF public.resolve_campaign_marketing_email('invalid','invalid') IS NOT NULL THEN RAISE EXCEPTION 'invalid_emails_not_excluded'; END IF;

 SELECT store_id,email INTO v_store,v_email FROM public._campaign_resolve_audience('{"search":"aromadaamazoniarevenda"}');
 IF v_email IS DISTINCT FROM 'contato@aromadamazonia.com.br' THEN RAISE EXCEPTION 'store_commercial_resolution_failed'; END IF;
 v_count := public.admin_count_campaign_audience('{"search":"aromadaamazoniarevenda"}');
 IF (v_count->>'eligible')::int <> 1 THEN RAISE EXCEPTION 'expected_one_eligible'; END IF;
 IF NOT EXISTS (SELECT 1 FROM public._campaign_resolve_audience('{"search":"contato@virtualmercado.com.br"}') WHERE store_id=v_store AND email=v_email) THEN RAISE EXCEPTION 'account_email_search_compatibility_failed'; END IF;

 v_id := public.admin_save_email_campaign(NULL,'Hotfix rollback test','Assunto','',NULL,NULL,'{"search":"aromadaamazoniarevenda"}');
 IF NOT EXISTS (SELECT 1 FROM public.email_campaigns WHERE id=v_id AND content='' AND status='draft') THEN RAISE EXCEPTION 'partial_draft_not_saved'; END IF;
 BEGIN
  PERFORM public.admin_confirm_email_campaign(v_id);
  RAISE EXCEPTION 'incomplete_confirmation_accepted';
 EXCEPTION WHEN others THEN
  IF SQLERRM <> 'invalid_campaign_content' THEN RAISE; END IF;
 END;
 BEGIN
  PERFORM public.admin_preview_email_campaign('Assunto',' ',NULL,NULL);
  RAISE EXCEPTION 'empty_preview_accepted';
 EXCEPTION WHEN others THEN
  IF SQLERRM <> 'invalid_campaign_content' THEN RAISE; END IF;
 END;
 BEGIN
  UPDATE public.email_campaigns SET status='processing' WHERE id=v_id;
  RAISE EXCEPTION 'empty_processing_accepted';
 EXCEPTION WHEN check_violation THEN NULL;
 END;
 BEGIN
  PERFORM public.admin_count_campaign_audience('{"date_from":"2026-10-17","date_to":"2026-10-16"}');
  RAISE EXCEPTION 'reversed_dates_accepted';
 EXCEPTION WHEN others THEN
  IF SQLERRM <> 'invalid_audience_filters' THEN RAISE; END IF;
 END;

 PERFORM public.admin_save_email_campaign(v_id,'Hotfix rollback test','Assunto','Mensagem',NULL,NULL,'{"search":"no-store-hotfix-unique"}');
 BEGIN
  PERFORM public.admin_confirm_email_campaign(v_id);
  RAISE EXCEPTION 'empty_audience_accepted';
 EXCEPTION WHEN others THEN
  IF SQLERRM <> 'campaign_audience_empty' THEN RAISE; END IF;
 END;
 PERFORM public.admin_save_email_campaign(v_id,'Hotfix rollback test','Assunto','Mensagem',NULL,NULL,'{"search":"aromadaamazoniarevenda"}');
 PERFORM public.admin_preview_email_campaign('Assunto','Mensagem',NULL,NULL);
 v_result := public.admin_confirm_email_campaign(v_id);
 IF (v_result->>'queued')::int <> 1 THEN RAISE EXCEPTION 'snapshot_count_mismatch'; END IF;
 IF NOT EXISTS (SELECT 1 FROM public.email_campaign_recipients r JOIN public.email_queue q ON q.id=r.email_queue_id WHERE r.campaign_id=v_id AND r.email=v_email AND q.to_email=v_email AND q.category='marketing') THEN RAISE EXCEPTION 'snapshot_queue_email_mismatch'; END IF;
 IF (public.admin_list_campaign_recipients(v_id)->'rows'->0->>'email') IS DISTINCT FROM v_email THEN RAISE EXCEPTION 'detail_email_mismatch'; END IF;
 IF (SELECT count(*) FROM public.email_queue) <> v_before+1 THEN RAISE EXCEPTION 'unexpected_queue_changes'; END IF;
 RAISE NOTICE 'Campaign hotfix assertions passed; all changes rolled back, no SMTP invoked.';
END $tests$;
ROLLBACK;