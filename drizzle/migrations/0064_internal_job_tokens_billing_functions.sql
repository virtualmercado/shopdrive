-- Hotfix autorização: tokens internos para funções privilegiadas e cron com token.
INSERT INTO public.internal_job_tokens(job_name, token)
  VALUES ('check-billing-status', encode(extensions.gen_random_bytes(32), 'hex'))
  ON CONFLICT (job_name) DO NOTHING;

INSERT INTO public.internal_job_tokens(job_name, token)
  VALUES ('retry-master-payments', encode(extensions.gen_random_bytes(32), 'hex'))
  ON CONFLICT (job_name) DO NOTHING;

INSERT INTO public.internal_job_tokens(job_name, token)
  VALUES ('send-platform-email', encode(extensions.gen_random_bytes(32), 'hex'))
  ON CONFLICT (job_name) DO NOTHING;

INSERT INTO public.internal_job_tokens(job_name, token)
  VALUES ('send-order-notifications', encode(extensions.gen_random_bytes(32), 'hex'))
  ON CONFLICT (job_name) DO NOTHING;

DO $$
DECLARE v_id bigint;
BEGIN
  SELECT jobid INTO v_id FROM cron.job WHERE jobname = 'check-billing-status-daily';
  IF v_id IS NOT NULL THEN
    PERFORM cron.alter_job(v_id, command := $cmd$
  select net.http_post(
    url := 'https://nkoogfznnqlnragbauez.supabase.co/functions/v1/check-billing-status',
    headers := jsonb_build_object('Content-Type','application/json',
      'x-internal-job-token', (select token from public.internal_job_tokens where job_name='check-billing-status')),
    body := '{}'::jsonb) as request_id;
$cmd$);
  END IF;
END $$;