
CREATE OR REPLACE FUNCTION public.increment_email_metric_counters(p_tenant_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE public.tenant_email_metrics
  SET
    emails_last_hour = emails_last_hour + 1,
    emails_last_day = emails_last_day + 1,
    total_sent = total_sent + 1,
    last_email_sent_at = now()
  WHERE tenant_id = p_tenant_id;

  -- Create row if it doesn't exist
  IF NOT FOUND THEN
    INSERT INTO public.tenant_email_metrics (tenant_id, emails_last_hour, emails_last_day, total_sent, last_email_sent_at)
    VALUES (p_tenant_id, 1, 1, 1, now())
    ON CONFLICT DO NOTHING;
  END IF;
END;
$$;
