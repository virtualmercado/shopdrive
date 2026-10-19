CREATE OR REPLACE FUNCTION public._campaign_has_activity(p_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT EXISTS(SELECT 1 FROM public.email_campaign_recipients WHERE campaign_id=p_id)
 OR EXISTS(SELECT 1 FROM public.email_queue WHERE payload->>'campaign_id'=p_id::text OR idempotency_key LIKE 'campaign:'||p_id::text||':%')
 OR EXISTS(SELECT 1 FROM public.email_logs l JOIN public.email_queue q ON q.id=l.queue_id WHERE q.payload->>'campaign_id'=p_id::text OR q.idempotency_key LIKE 'campaign:'||p_id::text||':%')
 OR EXISTS(SELECT 1 FROM public.audit_logs WHERE entity_type='email_campaign' AND entity_id=p_id AND action NOT IN ('email_campaign_create','email_campaign_update','email_campaign_save','email_campaign_cancel','email_campaign_archive','email_campaign_restore'))
 OR EXISTS(SELECT 1 FROM public.email_campaigns WHERE id=p_id AND (confirmed_at IS NOT NULL OR started_at IS NOT NULL OR completed_at IS NOT NULL OR total_recipients<>0 OR total_queued<>0 OR total_sent<>0 OR total_failed<>0 OR total_suppressed<>0));
$$;