ALTER TABLE public.store_clone_logs
  ADD COLUMN IF NOT EXISTS request_id text,
  ADD COLUMN IF NOT EXISTS clone_phase text NOT NULL DEFAULT 'queued';

CREATE INDEX IF NOT EXISTS idx_store_clone_logs_request_id
  ON public.store_clone_logs (request_id)
  WHERE request_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_store_clone_logs_status_phase
  ON public.store_clone_logs (status, clone_phase);