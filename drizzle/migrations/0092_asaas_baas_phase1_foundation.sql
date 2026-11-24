-- ============================================================================
-- ASAAS BaaS Integration — Phase 1: Structural Database Foundation
-- Purely additive, fail-closed RLS, multitenant keyed by store_id = profiles.id
-- No external calls, no secrets, no changes to orders or legacy gateways.
-- ============================================================================

-- 1. Subcontas ASAAS por loja e ambiente
CREATE TABLE public.store_asaas_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  environment TEXT NOT NULL,
  asaas_account_id TEXT NULL,
  wallet_id TEXT NULL,
  account_number TEXT NULL,
  encrypted_api_key TEXT NULL,
  api_key_fingerprint TEXT NULL,
  webhook_token_hash TEXT NULL,
  status TEXT NOT NULL DEFAULT 'pending_creation',
  commercial_status TEXT NULL,
  bank_account_status TEXT NULL,
  document_status TEXT NULL,
  general_approval_status TEXT NULL,
  document_summary JSONB NOT NULL DEFAULT '{}'::jsonb,
  creation_lease_expires_at TIMESTAMPTZ NULL,
  last_sync_at TIMESTAMPTZ NULL,
  last_error_code TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT store_asaas_accounts_store_env_key UNIQUE (store_id, environment),
  CONSTRAINT store_asaas_accounts_environment_check CHECK (environment IN ('sandbox', 'production')),
  CONSTRAINT store_asaas_accounts_status_check CHECK (
    status IN ('pending_creation', 'awaiting_documents', 'under_review', 'active', 'rejected', 'suspended', 'error')
  ),
  CONSTRAINT store_asaas_accounts_document_summary_check CHECK (jsonb_typeof(document_summary) = 'object'),
  CONSTRAINT store_asaas_accounts_credentials_lifecycle_check CHECK (
    status IN ('pending_creation', 'error')
    OR (
      nullif(btrim(asaas_account_id), '') IS NOT NULL
      AND nullif(btrim(wallet_id), '') IS NOT NULL
      AND nullif(btrim(encrypted_api_key), '') IS NOT NULL
    )
  )
);

REVOKE ALL ON public.store_asaas_accounts FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.store_asaas_accounts TO service_role;
ALTER TABLE public.store_asaas_accounts ENABLE ROW LEVEL SECURITY;

CREATE UNIQUE INDEX idx_store_asaas_accounts_account_env
  ON public.store_asaas_accounts (asaas_account_id, environment)
  WHERE asaas_account_id IS NOT NULL;

CREATE INDEX idx_store_asaas_accounts_wallet_id
  ON public.store_asaas_accounts (wallet_id)
  WHERE wallet_id IS NOT NULL;

CREATE INDEX idx_store_asaas_accounts_env_status
  ON public.store_asaas_accounts (environment, status);

CREATE TRIGGER trg_store_asaas_accounts_updated_at
  BEFORE UPDATE ON public.store_asaas_accounts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Mapeamento cliente ShopDrive <-> cliente ASAAS por loja e ambiente
CREATE TABLE public.store_asaas_customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  environment TEXT NOT NULL,
  customer_profile_id UUID NULL REFERENCES public.customer_profiles(id) ON DELETE SET NULL,
  cpf_cnpj_normalized TEXT NOT NULL,
  asaas_customer_id TEXT NOT NULL,
  name TEXT NOT NULL,
  email TEXT NULL,
  phone TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT store_asaas_customers_store_env_asaas_id_key UNIQUE (store_id, environment, asaas_customer_id),
  CONSTRAINT store_asaas_customers_store_env_cpf_cnpj_key UNIQUE (store_id, environment, cpf_cnpj_normalized),
  CONSTRAINT store_asaas_customers_id_store_env_key UNIQUE (id, store_id, environment),
  CONSTRAINT store_asaas_customers_environment_check CHECK (environment IN ('sandbox', 'production')),
  CONSTRAINT store_asaas_customers_cpf_cnpj_check CHECK (cpf_cnpj_normalized ~ '^[0-9]{11}([0-9]{3})?$'),
  CONSTRAINT store_asaas_customers_asaas_id_check CHECK (nullif(btrim(asaas_customer_id), '') IS NOT NULL),
  CONSTRAINT store_asaas_customers_name_check CHECK (nullif(btrim(name), '') IS NOT NULL)
);

REVOKE ALL ON public.store_asaas_customers FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.store_asaas_customers TO service_role;
ALTER TABLE public.store_asaas_customers ENABLE ROW LEVEL SECURITY;

CREATE UNIQUE INDEX idx_store_asaas_customers_store_env_profile
  ON public.store_asaas_customers (store_id, environment, customer_profile_id)
  WHERE customer_profile_id IS NOT NULL;

CREATE INDEX idx_store_asaas_customers_profile_id
  ON public.store_asaas_customers (customer_profile_id)
  WHERE customer_profile_id IS NOT NULL;

CREATE TRIGGER trg_store_asaas_customers_updated_at
  BEFORE UPDATE ON public.store_asaas_customers
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 3. Tabela financeira canônica de cobranças ASAAS por pedido
CREATE OR REPLACE FUNCTION public._store_charges_enforce_external_reference()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.id IS NULL THEN
      NEW.id := gen_random_uuid();
    END IF;
    IF NEW.external_reference IS NULL OR btrim(NEW.external_reference) = '' THEN
      NEW.external_reference := 'sd_charge_' || NEW.id::text;
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.external_reference IS DISTINCT FROM OLD.external_reference THEN
      RAISE EXCEPTION 'store_charges.external_reference is immutable' USING ERRCODE = '22023';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public._store_charges_enforce_external_reference() FROM PUBLIC, anon, authenticated;

CREATE TABLE public.store_charges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE RESTRICT,
  customer_profile_id UUID NULL REFERENCES public.customer_profiles(id) ON DELETE SET NULL,
  store_asaas_customer_id UUID NULL,
  provider TEXT NOT NULL DEFAULT 'asaas',
  environment TEXT NOT NULL,
  billing_type TEXT NOT NULL,
  external_reference TEXT NOT NULL,
  asaas_payment_id TEXT NULL,
  status TEXT NOT NULL DEFAULT 'creating',
  provider_status TEXT NULL,
  value NUMERIC NOT NULL,
  net_value NUMERIC NULL,
  fee_amount NUMERIC NULL,
  split_value NUMERIC NULL,
  due_date DATE NOT NULL,
  confirmed_at TIMESTAMPTZ NULL,
  settled_at TIMESTAMPTZ NULL,
  cancelled_at TIMESTAMPTZ NULL,
  invoice_url TEXT NULL,
  bank_slip_url TEXT NULL,
  identification_field TEXT NULL,
  bar_code TEXT NULL,
  last_error_code TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT store_charges_external_reference_key UNIQUE (external_reference),
  CONSTRAINT store_charges_external_reference_format_check CHECK (
    external_reference ~ '^sd_charge_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  ),
  CONSTRAINT store_charges_provider_check CHECK (nullif(btrim(provider), '') IS NOT NULL),
  CONSTRAINT store_charges_environment_check CHECK (environment IN ('sandbox', 'production')),
  CONSTRAINT store_charges_billing_type_check CHECK (billing_type IN ('BOLETO', 'PIX', 'CREDIT_CARD', 'UNDEFINED')),
  CONSTRAINT store_charges_status_check CHECK (
    status IN ('creating', 'pending', 'viewed', 'confirmed', 'settled', 'overdue', 'cancelled', 'refunded', 'failed')
  ),
  CONSTRAINT store_charges_value_check CHECK (value > 0),
  CONSTRAINT store_charges_net_value_check CHECK (net_value IS NULL OR net_value >= 0),
  CONSTRAINT store_charges_fee_amount_check CHECK (fee_amount IS NULL OR fee_amount >= 0),
  CONSTRAINT store_charges_split_value_check CHECK (split_value IS NULL OR split_value >= 0),
  CONSTRAINT store_charges_asaas_customer_tenant_fkey
    FOREIGN KEY (store_asaas_customer_id, store_id, environment)
    REFERENCES public.store_asaas_customers(id, store_id, environment)
    ON DELETE RESTRICT
);

REVOKE ALL ON public.store_charges FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.store_charges TO service_role;
ALTER TABLE public.store_charges ENABLE ROW LEVEL SECURITY;

CREATE UNIQUE INDEX idx_store_charges_one_active_per_order
  ON public.store_charges (order_id)
  WHERE provider = 'asaas'
    AND status IN ('creating', 'pending', 'viewed', 'confirmed', 'settled');

CREATE UNIQUE INDEX idx_store_charges_asaas_payment_env
  ON public.store_charges (asaas_payment_id, environment)
  WHERE asaas_payment_id IS NOT NULL;

CREATE INDEX idx_store_charges_store_env_status
  ON public.store_charges (store_id, environment, status);

CREATE INDEX idx_store_charges_order_history
  ON public.store_charges (order_id, created_at DESC);

CREATE TRIGGER trg_store_charges_external_reference
  BEFORE INSERT OR UPDATE ON public.store_charges
  FOR EACH ROW
  EXECUTE FUNCTION public._store_charges_enforce_external_reference();

CREATE TRIGGER trg_store_charges_updated_at
  BEFORE UPDATE ON public.store_charges
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 4. Auditoria e idempotência de Webhooks ASAAS
CREATE TABLE public.asaas_webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id TEXT NOT NULL,
  account_id TEXT NULL,
  event_type TEXT NOT NULL,
  store_id UUID NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  charge_id UUID NULL REFERENCES public.store_charges(id) ON DELETE RESTRICT,
  payload_sanitized JSONB NULL,
  processing_status TEXT NOT NULL DEFAULT 'received',
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ NULL,
  error_code TEXT NULL,
  CONSTRAINT asaas_webhook_events_event_id_key UNIQUE (event_id),
  CONSTRAINT asaas_webhook_events_event_id_check CHECK (nullif(btrim(event_id), '') IS NOT NULL),
  CONSTRAINT asaas_webhook_events_event_type_check CHECK (nullif(btrim(event_type), '') IS NOT NULL),
  CONSTRAINT asaas_webhook_events_payload_check CHECK (payload_sanitized IS NULL OR jsonb_typeof(payload_sanitized) = 'object'),
  CONSTRAINT asaas_webhook_events_status_check CHECK (
    processing_status IN ('received', 'processed', 'ignored', 'error')
  )
);

REVOKE ALL ON public.asaas_webhook_events FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.asaas_webhook_events TO service_role;
ALTER TABLE public.asaas_webhook_events ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_asaas_webhook_events_account_id
  ON public.asaas_webhook_events (account_id)
  WHERE account_id IS NOT NULL;

CREATE INDEX idx_asaas_webhook_events_store_id
  ON public.asaas_webhook_events (store_id)
  WHERE store_id IS NOT NULL;

CREATE INDEX idx_asaas_webhook_events_charge_id
  ON public.asaas_webhook_events (charge_id)
  WHERE charge_id IS NOT NULL;

CREATE INDEX idx_asaas_webhook_events_status
  ON public.asaas_webhook_events (processing_status, received_at DESC);