-- Prompt 10.2: relatório legado (AROMA) passa a exigir token interno. Mesmo job, mesma cadência.
INSERT INTO public.internal_job_tokens(job_name, token)
  VALUES ('send-brand-reports', encode(extensions.gen_random_bytes(32), 'hex'))
  ON CONFLICT (job_name) DO NOTHING;

DO $$
DECLARE v_id bigint;
BEGIN
  SELECT jobid INTO v_id FROM cron.job WHERE jobname = 'send-brand-reports-monthly';
  IF v_id IS NOT NULL THEN
    PERFORM cron.alter_job(v_id, command := $cmd$
  select net.http_post(
    url := 'https://nkoogfznnqlnragbauez.supabase.co/functions/v1/send-brand-reports',
    headers := jsonb_build_object('Content-Type','application/json',
      'x-internal-job-token', (select token from public.internal_job_tokens where job_name='send-brand-reports')),
    body := '{}'::jsonb) as request_id;
$cmd$);
  END IF;
END $$;