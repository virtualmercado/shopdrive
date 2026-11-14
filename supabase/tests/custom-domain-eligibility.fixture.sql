-- Disposable local PostgreSQL only. Never execute this fixture against a hosted database.
CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
CREATE SCHEMA auth; CREATE SCHEMA extensions;
GRANT USAGE ON SCHEMA auth, extensions TO anon, authenticated, service_role;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
CREATE FUNCTION extensions.gen_random_bytes(n int) RETURNS bytea LANGUAGE sql VOLATILE AS $$ SELECT decode(substr(md5(random()::text)||md5(random()::text),1,n*2),'hex') $$;
CREATE TYPE public.app_role AS ENUM ('admin','user');
CREATE TABLE public.profiles(id uuid PRIMARY KEY, store_slug text, deleted_at timestamptz, account_status text DEFAULT 'active');
CREATE TABLE public.user_roles(id uuid DEFAULT gen_random_uuid(), user_id uuid, role public.app_role);
CREATE FUNCTION public.has_role(_user_id uuid, _role public.app_role) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
  AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role) $$;
CREATE FUNCTION public.is_public_store_active(_store_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = _store_id AND p.store_slug IS NOT NULL
    AND p.deleted_at IS NULL AND coalesce(p.account_status,'active') = 'active') $$;
-- Stand-in for the real effective-plan resolver (MARCA inheritance etc. are tested elsewhere).
CREATE TABLE public._plan_stub(store uuid PRIMARY KEY, plan text);
CREATE FUNCTION public.get_effective_store_plan(p uuid) RETURNS jsonb LANGUAGE sql STABLE AS $$
  SELECT jsonb_build_object('plan', COALESCE((SELECT plan FROM public._plan_stub WHERE store = p), 'free'), 'resolved', true) $$;
CREATE TABLE public.custom_domain_platform_config(id boolean PRIMARY KEY DEFAULT true CHECK (id), feature_enabled boolean DEFAULT false,
  infrastructure_provider text, ingress_ready boolean DEFAULT false, dns_strategy text DEFAULT 'a_root_cname_www', root_record_type text DEFAULT 'A',
  root_record_value text, www_record_type text DEFAULT 'CNAME', www_record_value text, ingress_hostname text, ingress_ips text[] DEFAULT '{}',
  txt_host_prefix text DEFAULT '_shopdrive-verification', txt_value_prefix text DEFAULT 'shopdrive=', challenge_ttl_hours integer DEFAULT 72,
  revalidation_failure_threshold integer DEFAULT 3, domain_purchase_url text, updated_at timestamptz DEFAULT now(),
  cloudflare_writes_enabled boolean DEFAULT false, cloudflare_deletes_enabled boolean DEFAULT false, protected_external_hostname_ids text[] DEFAULT '{}');
CREATE TABLE public.custom_domain_v2_access(store_id uuid PRIMARY KEY REFERENCES public.profiles(id), enabled boolean NOT NULL DEFAULT false,
  updated_by uuid, updated_at timestamptz DEFAULT now(), pilot_hostname text);
CREATE TABLE public.merchant_domains(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), merchant_id uuid REFERENCES public.profiles(id), domain text,
  domain_type text DEFAULT 'subdomain', status text DEFAULT 'pending', is_active boolean DEFAULT false, redirect_old_link boolean DEFAULT true,
  dns_cname_verified boolean DEFAULT false, dns_a_verified boolean DEFAULT false, ssl_status text DEFAULT 'pending', last_dns_check timestamptz,
  last_ssl_check timestamptz, dns_error_message text, ssl_error_message text, expected_cname text, expected_ip text,
  created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now(), flow_version smallint DEFAULT 1, v2_state text,
  normalized_domain text, verification_token text, verification_expires_at timestamptz, ownership_verified_at timestamptz,
  dns_verified_at timestamptz, dns_provider text, detected_nameservers text[] DEFAULT '{}', routing_status text DEFAULT 'not_started',
  infrastructure_provider text, external_hostname_id text, activated_at timestamptz, consecutive_dns_failures integer DEFAULT 0,
  needs_reverification boolean DEFAULT false, released_at timestamptz, disconnected_at timestamptz, last_verification_result jsonb,
  external_created_at timestamptz, external_last_check_at timestamptz, external_error text, provision_attempts integer DEFAULT 0,
  provision_next_retry_at timestamptz);
CREATE UNIQUE INDEX merchant_domains_normalized_domain_unique ON public.merchant_domains(normalized_domain) WHERE normalized_domain IS NOT NULL AND released_at IS NULL;
CREATE TABLE public.domain_verification_logs(id uuid DEFAULT gen_random_uuid(), domain_id uuid, verification_type text, status text,
  expected_value text, found_value text, error_message text, created_at timestamptz DEFAULT now(), source text, details jsonb);
CREATE FUNCTION public._custom_domain_norm_or_null(p text) RETURNS text LANGUAGE plpgsql IMMUTABLE SET search_path TO 'public' AS $$
BEGIN RETURN public.normalize_custom_domain(p); EXCEPTION WHEN OTHERS THEN RETURN NULL; END $$;
