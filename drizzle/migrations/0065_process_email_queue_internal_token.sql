INSERT INTO public.internal_job_tokens(job_name, token)
  VALUES ('process-email-queue', encode(extensions.gen_random_bytes(32), 'hex'))
  ON CONFLICT (job_name) DO NOTHING;

DO $$
DECLARE v_id bigint;
BEGIN
  SELECT jobid INTO v_id FROM cron.job WHERE jobname = 'process-email-queue-worker';
  IF v_id IS NOT NULL THEN
    PERFORM cron.alter_job(v_id, command := $cmd$
  select net.http_post(
    url := 'https://nkoogfznnqlnragbauez.supabase.co/functions/v1/process-email-queue',
    headers := jsonb_build_object('Content-Type','application/json',
      'x-internal-job-token', (select token from public.internal_job_tokens where job_name='process-email-queue')),
    body := '{}'::jsonb) as request_id;
$cmd$);
  END IF;
END $$;