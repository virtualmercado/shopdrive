-- Disposable local PostgreSQL only. Never execute this fixture against a hosted database.
CREATE ROLE anon;
CREATE ROLE authenticated;
CREATE ROLE service_role BYPASSRLS;
CREATE SCHEMA auth;
GRANT USAGE ON SCHEMA auth TO anon,authenticated,service_role;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
CREATE TYPE public.app_role AS ENUM ('admin','user','financeiro','suporte','tecnico');
CREATE TABLE public.profiles(id uuid PRIMARY KEY, store_slug text, deleted_at timestamptz, account_status text DEFAULT 'active');
CREATE TABLE public.user_roles(id uuid DEFAULT gen_random_uuid(),user_id uuid,role public.app_role);
CREATE TABLE public.audit_logs(id uuid DEFAULT gen_random_uuid(),user_id uuid,action text,entity_type text,entity_id uuid,metadata jsonb,created_at timestamptz DEFAULT now());
CREATE TABLE public.custom_domain_platform_config(id boolean PRIMARY KEY CHECK(id), feature_enabled boolean DEFAULT false,
  ingress_ready boolean DEFAULT false,infrastructure_provider text);
CREATE TABLE public.custom_domain_v2_access(store_id uuid PRIMARY KEY REFERENCES profiles(id), enabled boolean NOT NULL DEFAULT false,updated_by uuid,updated_at timestamptz DEFAULT now());
CREATE TABLE public.merchant_domains(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), merchant_id uuid REFERENCES profiles(id),normalized_domain text,
 flow_version smallint DEFAULT 2,released_at timestamptz,v2_state text DEFAULT 'active',is_active boolean DEFAULT true,
 needs_reverification boolean DEFAULT false,ownership_verified_at timestamptz DEFAULT now(),dns_verified_at timestamptz DEFAULT now(),
 routing_status text DEFAULT 'active',ssl_status text DEFAULT 'active',activated_at timestamptz DEFAULT now());
CREATE UNIQUE INDEX merchant_domains_normalized_domain_unique ON public.merchant_domains(normalized_domain) WHERE normalized_domain IS NOT NULL AND released_at IS NULL;
GRANT SELECT ON public.custom_domain_platform_config,public.custom_domain_v2_access,public.merchant_domains TO authenticated;
GRANT ALL ON public.custom_domain_platform_config,public.custom_domain_v2_access,public.merchant_domains,public.audit_logs TO service_role;
ALTER TABLE public.custom_domain_platform_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.custom_domain_v2_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.merchant_domains ENABLE ROW LEVEL SECURITY;
-- Policies are installed after the captured has_role function by the local runner.