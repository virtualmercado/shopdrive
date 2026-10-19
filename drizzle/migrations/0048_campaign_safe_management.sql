ALTER TABLE public.email_campaigns ADD COLUMN is_archived boolean NOT NULL DEFAULT false, ADD COLUMN archived_at timestamptz, ADD COLUMN archived_by uuid;
CREATE INDEX idx_campaign_archive_created ON public.email_campaigns(is_archived, created_at DESC, id DESC);
COMMENT ON COLUMN public.email_campaigns.is_archived IS 'Administrative visibility only; operational status and history remain unchanged.';

CREATE FUNCTION public._campaign_has_activity(p_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT EXISTS(SELECT 1 FROM public.email_campaign_recipients WHERE campaign_id=p_id)
 OR EXISTS(SELECT 1 FROM public.email_queue WHERE payload->>'campaign_id'=p_id::text OR idempotency_key LIKE 'campaign:'||p_id::text||':%')
 OR EXISTS(SELECT 1 FROM public.email_logs l JOIN public.email_queue q ON q.id=l.queue_id WHERE q.payload->>'campaign_id'=p_id::text OR q.idempotency_key LIKE 'campaign:'||p_id::text||':%')
 OR EXISTS(SELECT 1 FROM public.audit_logs WHERE entity_type='email_campaign' AND entity_id=p_id AND action NOT IN ('email_campaign_save','email_campaign_cancel','email_campaign_archive','email_campaign_restore'))
 OR EXISTS(SELECT 1 FROM public.email_campaigns WHERE id=p_id AND (confirmed_at IS NOT NULL OR started_at IS NOT NULL OR completed_at IS NOT NULL OR total_recipients<>0 OR total_queued<>0 OR total_sent<>0 OR total_failed<>0 OR total_suppressed<>0));
$$;
CREATE FUNCTION public._campaign_has_pending(p_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT EXISTS(SELECT 1 FROM public.email_campaign_recipients WHERE campaign_id=p_id AND status IN ('pending','queued'))
 OR EXISTS(SELECT 1 FROM public.email_queue WHERE (payload->>'campaign_id'=p_id::text OR idempotency_key LIKE 'campaign:'||p_id::text||':%') AND (status IN ('pending','retry','processing') OR locked_at IS NOT NULL));
$$;
CREATE FUNCTION public._campaign_management_flags(p_id uuid) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT jsonb_build_object('is_archived',c.is_archived,'archived_at',c.archived_at,'archived_by',c.archived_by,
 'can_delete',NOT c.is_archived AND c.status IN ('draft','ready','cancelled') AND NOT public._campaign_has_activity(c.id),
 'can_archive',NOT c.is_archived AND c.status IN ('completed','completed_with_errors','cancelled') AND NOT public._campaign_has_pending(c.id) AND (c.status<>'cancelled' OR public._campaign_has_activity(c.id)),
 'can_restore',c.is_archived)
 FROM public.email_campaigns c WHERE c.id=p_id;
$$;
REVOKE ALL ON FUNCTION public._campaign_has_activity(uuid), public._campaign_has_pending(uuid), public._campaign_management_flags(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public._campaign_has_activity(uuid), public._campaign_has_pending(uuid), public._campaign_management_flags(uuid) TO service_role;

CREATE FUNCTION public._guard_campaign_delete() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF OLD.status NOT IN ('draft','ready','cancelled') OR public._campaign_has_activity(OLD.id) OR public._campaign_has_pending(OLD.id) THEN
 RAISE EXCEPTION 'Esta campanha possui histórico de envio e não pode ser excluída. Arquive-a para removê-la da listagem principal.' USING ERRCODE='23514';
 END IF;
 RETURN OLD;
END $$;
REVOKE ALL ON FUNCTION public._guard_campaign_delete() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER guard_campaign_safe_delete BEFORE DELETE ON public.email_campaigns FOR EACH ROW EXECUTE FUNCTION public._guard_campaign_delete();

CREATE FUNCTION public.admin_delete_email_campaign(p_campaign_id uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE c public.email_campaigns;
BEGIN
 PERFORM public.assert_caller_is_admin();
 SELECT * INTO c FROM public.email_campaigns WHERE id=p_campaign_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'campaign_not_found'; END IF;
 IF c.is_archived OR c.status NOT IN ('draft','ready','cancelled') OR public._campaign_has_activity(c.id) OR public._campaign_has_pending(c.id) THEN
 RAISE EXCEPTION 'Esta campanha possui histórico de envio e não pode ser excluída. Arquive-a para removê-la da listagem principal.' USING ERRCODE='23514'; END IF;
 DELETE FROM public.email_campaigns WHERE id=c.id;
 INSERT INTO public.audit_logs(user_id,action,entity_type,entity_id,metadata) VALUES(auth.uid(),'email_campaign_delete','email_campaign',c.id,jsonb_build_object('status',c.status));
 RETURN jsonb_build_object('deleted',true,'id',c.id);
END $$;
CREATE FUNCTION public.admin_archive_email_campaign(p_campaign_id uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE c public.email_campaigns;
BEGIN
 PERFORM public.assert_caller_is_admin();
 SELECT * INTO c FROM public.email_campaigns WHERE id=p_campaign_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'campaign_not_found'; END IF;
 IF c.is_archived THEN RETURN jsonb_build_object('is_archived',true,'already',true); END IF;
 IF c.status NOT IN ('completed','completed_with_errors','cancelled') OR public._campaign_has_pending(c.id) OR (c.status='cancelled' AND NOT public._campaign_has_activity(c.id)) THEN RAISE EXCEPTION 'Esta campanha não pode ser arquivada enquanto houver processamento pendente ou sem histórico a preservar.'; END IF;
 UPDATE public.email_campaigns SET is_archived=true,archived_at=now(),archived_by=auth.uid() WHERE id=c.id;
 INSERT INTO public.audit_logs(user_id,action,entity_type,entity_id,metadata) VALUES(auth.uid(),'email_campaign_archive','email_campaign',c.id,jsonb_build_object('status',c.status));
 RETURN jsonb_build_object('is_archived',true);
END $$;
CREATE FUNCTION public.admin_restore_email_campaign(p_campaign_id uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE c public.email_campaigns;
BEGIN
 PERFORM public.assert_caller_is_admin();
 SELECT * INTO c FROM public.email_campaigns WHERE id=p_campaign_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'campaign_not_found'; END IF;
 IF NOT c.is_archived THEN RETURN jsonb_build_object('is_archived',false,'already',true); END IF;
 UPDATE public.email_campaigns SET is_archived=false,archived_at=NULL,archived_by=NULL WHERE id=c.id;
 INSERT INTO public.audit_logs(user_id,action,entity_type,entity_id,metadata) VALUES(auth.uid(),'email_campaign_restore','email_campaign',c.id,jsonb_build_object('status',c.status));
 RETURN jsonb_build_object('is_archived',false);
END $$;
REVOKE ALL ON FUNCTION public.admin_delete_email_campaign(uuid),public.admin_archive_email_campaign(uuid),public.admin_restore_email_campaign(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.admin_delete_email_campaign(uuid),public.admin_archive_email_campaign(uuid),public.admin_restore_email_campaign(uuid) TO authenticated;

CREATE FUNCTION public.admin_list_managed_email_campaigns(p_search text DEFAULT NULL,p_status text DEFAULT 'all',p_date_from timestamptz DEFAULT NULL,p_date_to timestamptz DEFAULT NULL,p_limit integer DEFAULT 50,p_offset integer DEFAULT 0,p_archive text DEFAULT 'active') RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE v_search text:=nullif(btrim(coalesce(p_search,'')),''); v_result jsonb;
BEGIN
 PERFORM public.assert_caller_is_admin();
 IF p_archive IS NULL OR p_archive NOT IN ('active','archived','all') THEN RAISE EXCEPTION 'invalid_archive_filter'; END IF;
 p_limit:=least(greatest(coalesce(p_limit,50),1),50); p_offset:=greatest(coalesce(p_offset,0),0);
 WITH filtered AS MATERIALIZED (
 SELECT c.*,u.email::text AS creator_email FROM public.email_campaigns c LEFT JOIN auth.users u ON u.id=c.created_by
 WHERE (p_archive='all' OR c.is_archived=(p_archive='archived'))
 AND (v_search IS NULL OR c.name ILIKE '%'||v_search||'%' OR c.subject ILIKE '%'||v_search||'%')
 AND (coalesce(p_status,'all')='all' OR c.status=p_status)
 AND (p_date_from IS NULL OR c.created_at>=p_date_from) AND (p_date_to IS NULL OR c.created_at<=p_date_to))
 SELECT jsonb_build_object('total',(SELECT count(*) FROM filtered),
 'counts',(SELECT coalesce(jsonb_object_agg(status,n),'{}'::jsonb) FROM (SELECT status,count(*) n FROM filtered GROUP BY status) s),
 'rows',coalesce((SELECT jsonb_agg(to_jsonb(r)||public._campaign_management_flags(r.id) ORDER BY r.created_at DESC,r.id DESC) FROM (
 SELECT id,name,subject,status,audience_filters,creator_email,created_at,updated_at,confirmed_at,started_at,completed_at,cancelled_at,total_recipients,total_queued,total_sent,total_failed,total_suppressed
 FROM filtered ORDER BY created_at DESC,id DESC LIMIT p_limit OFFSET p_offset) r),'[]'::jsonb)) INTO v_result;
 RETURN v_result;
END $$;
REVOKE ALL ON FUNCTION public.admin_list_managed_email_campaigns(text,text,timestamptz,timestamptz,integer,integer,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.admin_list_managed_email_campaigns(text,text,timestamptz,timestamptz,integer,integer,text) TO authenticated;
CREATE OR REPLACE FUNCTION public.admin_list_email_campaigns(p_search text DEFAULT NULL,p_status text DEFAULT 'all',p_date_from timestamptz DEFAULT NULL,p_date_to timestamptz DEFAULT NULL,p_limit integer DEFAULT 50,p_offset integer DEFAULT 0) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
BEGIN
 PERFORM public.assert_caller_is_admin();
 RETURN public.admin_list_managed_email_campaigns(p_search,p_status,p_date_from,p_date_to,p_limit,p_offset,'active');
END $$;
DO $$ DECLARE d text; BEGIN
 d:=pg_get_functiondef('public.admin_get_email_campaign(uuid)'::regprocedure);
 d:=replace(d,'RETURN v_result;','RETURN v_result || public._campaign_management_flags(p_campaign_id);');
 EXECUTE d;
END $$;