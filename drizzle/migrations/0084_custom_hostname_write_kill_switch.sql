-- Backend kill switch for Cloudflare Custom Hostname mutations (POST/PATCH/DELETE).
-- Fail-closed defaults: no external writes until explicitly enabled; GET diagnostics are unaffected.
ALTER TABLE public.custom_domain_platform_config
  ADD COLUMN IF NOT EXISTS cloudflare_writes_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS cloudflare_deletes_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS protected_external_hostname_ids text[] NOT NULL DEFAULT '{}'::text[];

COMMENT ON COLUMN public.custom_domain_platform_config.cloudflare_writes_enabled IS
  'Kill switch: when false, edge functions never send POST/PATCH/DELETE to Cloudflare Custom Hostnames.';
COMMENT ON COLUMN public.custom_domain_platform_config.cloudflare_deletes_enabled IS
  'Extra gate for DELETE (stricter than create); requires cloudflare_writes_enabled as well.';
COMMENT ON COLUMN public.custom_domain_platform_config.protected_external_hostname_ids IS
  'Cloudflare Custom Hostname ids that automation must never adopt, patch or delete.';

-- Backfill of the new column: protect the single Custom Hostname active before global ingress.
UPDATE public.custom_domain_platform_config
   SET protected_external_hostname_ids = ARRAY['fd3cd405-657e-4da7-a2ce-6424dc865670']
 WHERE id = true AND protected_external_hostname_ids = '{}'::text[];