"""Validate ASAAS BaaS Phase 1 structural migration in a disposable localhost
PostgreSQL cluster with synthetic rows only. Never connects to the hosted
database, never reads secrets, and never calls any external API.
"""
import os
import shutil
import subprocess
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = Path("/tmp/asaas-phase1-db")
PORT = "55449"
ENV = {k: v for k, v in os.environ.items() if not k.startswith("PG")}
_bins = sorted(Path("/nix/store").glob("*-postgresql-17*/bin/initdb"))
if _bins:
    ENV["PATH"] = str(_bins[0].parent) + ":" + ENV.get("PATH", "")
DSN = f"postgresql://nobody@127.0.0.1:{PORT}/asaas_phase1_test?sslmode=disable"
ADMIN = f"postgresql://nobody@127.0.0.1:{PORT}/postgres?sslmode=disable"


def as_nobody(*cmd):
    return subprocess.run(
        ["runuser", "-u", "nobody", "--", "env", "PATH=" + ENV["PATH"], *cmd],
        env=ENV,
        capture_output=True,
        text=True,
    )


def start_cluster():
    if not (DATA / "PG_VERSION").exists():
        shutil.rmtree(DATA, ignore_errors=True)
        DATA.mkdir(parents=True)
        shutil.chown(DATA, "nobody")
        res = as_nobody("initdb", "-D", str(DATA), "-U", "nobody", "--auth=trust")
        assert res.returncode == 0, res.stderr
    if as_nobody("pg_ctl", "-D", str(DATA), "status").returncode != 0:
        res = as_nobody(
            "pg_ctl", "-D", str(DATA), "-l", str(DATA / "server.log"), "-w",
            "-o", f"-p {PORT} -k /tmp -c listen_addresses=127.0.0.1", "start",
        )
        assert res.returncode == 0, res.stderr
    for _ in range(30):
        if subprocess.run(["psql", ADMIN, "-Atc", "select 1"], env=ENV, capture_output=True).returncode == 0:
            return
        time.sleep(0.2)
    raise AssertionError("local postgres cluster unavailable")


def sql(query, fail=False, expect_err=None):
    p = subprocess.run(
        ["psql", DSN, "-X", "-q", "-v", "ON_ERROR_STOP=1", "-At", "-c", query],
        env=ENV,
        capture_output=True,
        text=True,
    )
    if fail:
        assert p.returncode != 0, f"expected failure but succeeded:\n{query}\nstdout={p.stdout}"
        if expect_err:
            assert expect_err in p.stderr, f"expected '{expect_err}' in stderr, got:\n{p.stderr}"
        return p.stderr
    if p.returncode != 0:
        raise AssertionError(f"SQL failed:\n{query}\nstderr:\n{p.stderr}")
    return p.stdout.strip().splitlines()[-1] if p.stdout.strip() else ""


def sql_file(path: Path):
    p = subprocess.run(
        ["psql", DSN, "-X", "-v", "ON_ERROR_STOP=1", "-f", str(path)],
        env=ENV,
        capture_output=True,
        text=True,
    )
    if p.returncode != 0:
        raise AssertionError(f"Migration file {path} failed:\n{p.stderr}")


def resolve_migration_path() -> Path:
    override = os.environ.get("ASAAS_PHASE1_SQL")
    if override:
        return Path(override)
    matches = sorted((ROOT / "drizzle" / "migrations").glob("*asaas_baas_phase1*.sql"))
    assert matches, "No asaas_baas_phase1 migration file found in drizzle/migrations"
    return matches[-1]


def main():
    migration_path = resolve_migration_path()
    start_cluster()
    subprocess.run(["dropdb", "--if-exists", "--maintenance-db=" + ADMIN, "asaas_phase1_test"], env=ENV, check=True, capture_output=True)
    subprocess.run(["createdb", "--maintenance-db=" + ADMIN, "asaas_phase1_test"], env=ENV, check=True, capture_output=True)

    # Minimal synthetic base schema matching production types/functions referenced by Phase 1.
    sql("""
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon; END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated; END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN CREATE ROLE service_role BYPASSRLS; END IF;
    END $$;
    CREATE EXTENSION IF NOT EXISTS pgcrypto;
    CREATE SCHEMA auth;
    GRANT USAGE ON SCHEMA auth TO anon, authenticated, service_role;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
      SELECT nullif(current_setting('test.actor', true), '')::uuid
    $$;
    GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

    CREATE FUNCTION public.update_updated_at_column() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
    BEGIN NEW.updated_at = now(); RETURN NEW; END;
    $$;

    CREATE TABLE public.profiles (
      id UUID PRIMARY KEY,
      store_name TEXT,
      deleted_at TIMESTAMPTZ NULL,
      account_status TEXT NOT NULL DEFAULT 'active'
    );
    CREATE TABLE public.customer_profiles (
      id UUID PRIMARY KEY,
      full_name TEXT
    );
    CREATE TABLE public.orders (
      id UUID PRIMARY KEY,
      store_owner_id UUID NOT NULL REFERENCES public.profiles(id),
      customer_id UUID NULL REFERENCES public.customer_profiles(id) ON DELETE SET NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      payment_status TEXT NOT NULL DEFAULT 'pending'
    );
    CREATE TABLE public.boleto_payments (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
      status TEXT NOT NULL DEFAULT 'pending'
    );
    CREATE TABLE public.brand_accounts (
      id UUID PRIMARY KEY,
      owner_profile_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL
    );
    CREATE TABLE public.brand_account_owned_stores (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      brand_account_id UUID NOT NULL REFERENCES public.brand_accounts(id) ON DELETE CASCADE,
      store_profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
      slot INT NOT NULL,
      store_role TEXT NOT NULL
    );
    CREATE TABLE public.merchant_store_memberships (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL,
      store_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
      active BOOLEAN NOT NULL DEFAULT true,
      authorization_approved BOOLEAN NOT NULL DEFAULT true,
      permission TEXT NOT NULL DEFAULT 'administrator'
    );
    CREATE FUNCTION public.get_effective_store_plan(p_store_id uuid) RETURNS jsonb LANGUAGE sql STABLE AS $$
      SELECT jsonb_build_object('plan', 'marca', 'planSource', 'direct')
    $$;
    CREATE FUNCTION public.can_actor_manage_marca_store(p_actor uuid, p_store_id uuid)
    RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
      SELECT p_actor IS NOT NULL AND (
        p_actor = p_store_id OR EXISTS (
          SELECT 1 FROM merchant_store_memberships m
          JOIN brand_account_owned_stores o ON o.store_profile_id = m.store_id
          JOIN brand_accounts b ON b.id = o.brand_account_id
          JOIN brand_account_owned_stores p ON p.brand_account_id = b.id AND p.slot = 1 AND p.store_role = 'primary' AND p.store_profile_id = b.owner_profile_id
          JOIN profiles profile ON profile.id = m.store_id
          WHERE m.user_id = p_actor AND m.store_id = p_store_id
            AND m.active AND m.authorization_approved AND m.permission = 'administrator'
            AND b.owner_profile_id = p_actor AND profile.deleted_at IS NULL
            AND coalesce(profile.account_status, 'active') = 'active'
            AND get_effective_store_plan(b.owner_profile_id)->>'plan' = 'marca'
            AND get_effective_store_plan(b.owner_profile_id)->>'planSource' = 'direct'
        )
      )
    $$;
    CREATE FUNCTION public.merchant_request_store_id()
    RETURNS uuid LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
    DECLARE chosen text; sid uuid; actor uuid := auth.uid();
    BEGIN
      chosen := nullif(coalesce(nullif(current_setting('request.headers', true), ''), '{}')::jsonb->>'x-shopdrive-store-id', '');
      IF chosen IS NULL THEN RETURN actor; END IF;
      IF actor IS NULL OR chosen !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
        RAISE EXCEPTION 'store_access_denied' USING ERRCODE = '42501';
      END IF;
      sid := chosen::uuid;
      IF NOT can_actor_manage_marca_store(actor, sid) THEN
        RAISE EXCEPTION 'store_access_denied' USING ERRCODE = '42501';
      END IF;
      RETURN sid;
    END;
    $$;
    """)

    # Snapshot existing orders/boleto_payments columns before migration
    orders_cols_before = sql("SELECT string_agg(column_name, ',' ORDER BY ordinal_position) FROM information_schema.columns WHERE table_schema='public' AND table_name='orders'")
    boleto_cols_before = sql("SELECT string_agg(column_name, ',' ORDER BY ordinal_position) FROM information_schema.columns WHERE table_schema='public' AND table_name='boleto_payments'")

    # Apply Phase 1 migration
    sql_file(migration_path)

    # Verify orders and boleto_payments untouched
    assert sql("SELECT string_agg(column_name, ',' ORDER BY ordinal_position) FROM information_schema.columns WHERE table_schema='public' AND table_name='orders'") == orders_cols_before
    assert sql("SELECT string_agg(column_name, ',' ORDER BY ordinal_position) FROM information_schema.columns WHERE table_schema='public' AND table_name='boleto_payments'") == boleto_cols_before

    # Seed synthetic stores, MARCA primary+secondary, customer, and orders
    STORE_A = "11111111-1111-4111-8111-111111111111"  # MARCA Primary (owned by actor A)
    STORE_B = "22222222-2222-4222-8222-222222222222"  # MARCA Secondary (delegated to actor A)
    STORE_C = "33333333-3333-4333-8333-333333333333"  # Unrelated store
    BRAND_1 = "44444444-4444-4444-8444-444444444444"
    CUST_1 = "55555555-5555-4555-8555-555555555555"
    ORDER_A1 = "66666666-6666-4666-8666-666666666661"
    ORDER_B1 = "66666666-6666-4666-8666-666666666662"

    sql(f"""
    INSERT INTO public.profiles(id, store_name) VALUES
      ('{STORE_A}', 'Loja Marca Primaria'),
      ('{STORE_B}', 'Loja Marca Secundaria'),
      ('{STORE_C}', 'Loja Independente');
    INSERT INTO public.brand_accounts(id, owner_profile_id) VALUES ('{BRAND_1}', '{STORE_A}');
    INSERT INTO public.brand_account_owned_stores(brand_account_id, store_profile_id, slot, store_role) VALUES
      ('{BRAND_1}', '{STORE_A}', 1, 'primary'),
      ('{BRAND_1}', '{STORE_B}', 2, 'secondary');
    INSERT INTO public.merchant_store_memberships(user_id, store_id, active, authorization_approved, permission)
      VALUES ('{STORE_A}', '{STORE_B}', true, true, 'administrator');
    INSERT INTO public.customer_profiles(id, full_name) VALUES ('{CUST_1}', 'Comprador Teste');
    INSERT INTO public.orders(id, store_owner_id, customer_id) VALUES
      ('{ORDER_A1}', '{STORE_A}', '{CUST_1}'),
      ('{ORDER_B1}', '{STORE_B}', '{CUST_1}');
    """)

    # Test 1 & 2: One account per (store_id, environment); same store can have sandbox + production
    sql(f"""
    INSERT INTO public.store_asaas_accounts(store_id, environment, status)
    VALUES ('{STORE_A}', 'sandbox', 'pending_creation');
    INSERT INTO public.store_asaas_accounts(store_id, environment, status, asaas_account_id, wallet_id, encrypted_api_key, webhook_token_hash)
    VALUES ('{STORE_A}', 'production', 'active', 'acc_prod_a_001', 'wal_prod_a_001', 'enc:v1:ciphertext_prod_a', 'sha256:wh_prod_a');
    """)
    # Duplicate (store_id, environment) rejected
    sql(f"INSERT INTO public.store_asaas_accounts(store_id, environment) VALUES ('{STORE_A}', 'sandbox')", fail=True, expect_err="store_asaas_accounts_store_env_key")

    # Credential lifecycle CHECK: operational states require asaas_account_id, wallet_id, encrypted_api_key
    sql(f"UPDATE public.store_asaas_accounts SET status='active' WHERE store_id='{STORE_A}' AND environment='sandbox'", fail=True, expect_err="store_asaas_accounts_credentials_lifecycle_check")
    sql(f"UPDATE public.store_asaas_accounts SET status='awaiting_documents', asaas_account_id='acc_sb_a' WHERE store_id='{STORE_A}' AND environment='sandbox'", fail=True, expect_err="store_asaas_accounts_credentials_lifecycle_check")
    # Valid transition once credentials exist
    sql(f"""
    UPDATE public.store_asaas_accounts
    SET status='active', asaas_account_id='acc_sb_a_001', wallet_id='wal_sb_a_001', encrypted_api_key='enc:v1:ciphertext_sb_a', webhook_token_hash='sha256:wh_sb_a'
    WHERE store_id='{STORE_A}' AND environment='sandbox';
    """)

    # Test 3 & 4: Two different stores (including MARCA primary + secondary managed by same actor) have independent accounts with no auth.uid() collision
    sql(f"""
    INSERT INTO public.store_asaas_accounts(store_id, environment, status, asaas_account_id, wallet_id, encrypted_api_key, webhook_token_hash)
    VALUES
      ('{STORE_B}', 'sandbox', 'active', 'acc_sb_b_001', 'wal_sb_b_001', 'enc:v1:ciphertext_sb_b', 'sha256:wh_sb_b'),
      ('{STORE_C}', 'sandbox', 'pending_creation', NULL, NULL, NULL, NULL);
    """)
    assert sql("SELECT count(*) FROM public.store_asaas_accounts WHERE environment='sandbox'") == "3"

    # Test 5 & 6: Same ShopDrive customer can have distinct ASAAS IDs in distinct stores; duplicate CPF/CNPJ within same store+env rejected
    cust_a_id = sql(f"""
    INSERT INTO public.store_asaas_customers(store_id, environment, customer_profile_id, cpf_cnpj_normalized, asaas_customer_id, name)
    VALUES ('{STORE_A}', 'sandbox', '{CUST_1}', '12345678901', 'cus_loja_a_1', 'Comprador Teste')
    RETURNING id;
    """)
    cust_b_id = sql(f"""
    INSERT INTO public.store_asaas_customers(store_id, environment, customer_profile_id, cpf_cnpj_normalized, asaas_customer_id, name)
    VALUES ('{STORE_B}', 'sandbox', '{CUST_1}', '12345678901', 'cus_loja_b_1', 'Comprador Teste')
    RETURNING id;
    """)
    assert cust_a_id != cust_b_id
    # Duplicate CPF/CNPJ in same store+env rejected
    sql(f"""
    INSERT INTO public.store_asaas_customers(store_id, environment, cpf_cnpj_normalized, asaas_customer_id, name)
    VALUES ('{STORE_A}', 'sandbox', '12345678901', 'cus_loja_a_dup', 'Comprador Dup');
    """, fail=True, expect_err="store_asaas_customers_store_env_cpf_cnpj_key")
    # Duplicate customer_profile_id in same store+env rejected
    sql(f"""
    INSERT INTO public.store_asaas_customers(store_id, environment, customer_profile_id, cpf_cnpj_normalized, asaas_customer_id, name)
    VALUES ('{STORE_A}', 'sandbox', '{CUST_1}', '98765432100', 'cus_loja_a_dup2', 'Comprador Dup 2');
    """, fail=True, expect_err="idx_store_asaas_customers_store_env_profile")
    # Duplicate asaas_customer_id in same store+env rejected
    sql(f"""
    INSERT INTO public.store_asaas_customers(store_id, environment, cpf_cnpj_normalized, asaas_customer_id, name)
    VALUES ('{STORE_A}', 'sandbox', '98765432100', 'cus_loja_a_1', 'Comprador Dup 3');
    """, fail=True, expect_err="store_asaas_customers_store_env_asaas_id_key")

    # Cross-tenant customer reference on store_charges rejected by composite FK
    sql(f"""
    INSERT INTO public.store_charges(store_id, order_id, customer_profile_id, store_asaas_customer_id, environment, billing_type, status, value, due_date)
    VALUES ('{STORE_A}', '{ORDER_A1}', '{CUST_1}', '{cust_b_id}', 'sandbox', 'BOLETO', 'creating', 150.00, '2026-12-01');
    """, fail=True, expect_err="store_charges_asaas_customer_tenant_fkey")

    # Test 7, 8, 9, 10: Canonical sd_charge_<UUID>, one active charge per order, historical charges allowed, duplicate/invalid external_reference rejected
    charge1_row = sql(f"""
    INSERT INTO public.store_charges(store_id, order_id, customer_profile_id, store_asaas_customer_id, environment, billing_type, status, value, due_date)
    VALUES ('{STORE_A}', '{ORDER_A1}', '{CUST_1}', '{cust_a_id}', 'sandbox', 'BOLETO', 'pending', 150.00, '2026-12-01')
    RETURNING id || '|' || external_reference;
    """)
    charge1_id, charge1_ref = charge1_row.split("|")
    assert charge1_ref == f"sd_charge_{charge1_id}", f"unexpected external_reference: {charge1_ref}"

    # Immutability of external_reference
    sql(f"UPDATE public.store_charges SET external_reference='sd_charge_550e8400-e29b-41d4-a716-446655440000' WHERE id='{charge1_id}'", fail=True, expect_err="external_reference is immutable")

    # Invalid external_reference (CPF / order_number / truncated) rejected
    sql(f"""
    INSERT INTO public.store_charges(store_id, order_id, environment, billing_type, external_reference, status, value, due_date)
    VALUES ('{STORE_B}', '{ORDER_B1}', 'sandbox', 'BOLETO', '12345678901', 'creating', 100.00, '2026-12-01');
    """, fail=True, expect_err="store_charges_external_reference_format_check")

    # Test 8: Second active charge for same order rejected
    sql(f"""
    INSERT INTO public.store_charges(store_id, order_id, environment, billing_type, status, value, due_date)
    VALUES ('{STORE_A}', '{ORDER_A1}', 'sandbox', 'BOLETO', 'creating', 150.00, '2026-12-02');
    """, fail=True, expect_err="idx_store_charges_one_active_per_order")

    # Test 9 & 7: Marking first charge overdue/cancelled allows a new active charge (historical charges preserved)
    sql(f"UPDATE public.store_charges SET status='overdue' WHERE id='{charge1_id}';")
    charge2_id = sql(f"""
    INSERT INTO public.store_charges(store_id, order_id, customer_profile_id, store_asaas_customer_id, environment, billing_type, status, value, due_date)
    VALUES ('{STORE_A}', '{ORDER_A1}', '{CUST_1}', '{cust_a_id}', 'sandbox', 'BOLETO', 'cancelled', 150.00, '2026-12-05')
    RETURNING id;
    """)
    charge3_id = sql(f"""
    INSERT INTO public.store_charges(store_id, order_id, customer_profile_id, store_asaas_customer_id, environment, billing_type, status, value, due_date)
    VALUES ('{STORE_A}', '{ORDER_A1}', '{CUST_1}', '{cust_a_id}', 'sandbox', 'BOLETO', 'confirmed', 150.00, '2026-12-10')
    RETURNING id;
    """)
    assert sql(f"SELECT count(*) FROM public.store_charges WHERE order_id='{ORDER_A1}'") == "3"
    # While confirmed (active), another active charge is rejected
    sql(f"""
    INSERT INTO public.store_charges(store_id, order_id, environment, billing_type, status, value, due_date)
    VALUES ('{STORE_A}', '{ORDER_A1}', 'sandbox', 'BOLETO', 'pending', 150.00, '2026-12-12');
    """, fail=True, expect_err="idx_store_charges_one_active_per_order")

    # Test 10: Duplicate external_reference rejected even on a different order
    sql(f"""
    INSERT INTO public.store_charges(store_id, order_id, environment, billing_type, external_reference, status, value, due_date)
    VALUES ('{STORE_B}', '{ORDER_B1}', 'sandbox', 'BOLETO', '{charge1_ref}', 'creating', 200.00, '2026-12-12');
    """, fail=True, expect_err="store_charges_external_reference_key")

    # Test 11: Duplicate webhook event_id rejected
    sql(f"""
    INSERT INTO public.asaas_webhook_events(event_id, account_id, event_type, store_id, charge_id, payload_sanitized, processing_status)
    VALUES ('evt_asaas_001', 'acc_sb_a_001', 'PAYMENT_CONFIRMED', '{STORE_A}', '{charge3_id}', '{{"event":"PAYMENT_CONFIRMED"}}'::jsonb, 'processed');
    """)
    sql(f"""
    INSERT INTO public.asaas_webhook_events(event_id, account_id, event_type, store_id, charge_id, processing_status)
    VALUES ('evt_asaas_001', 'acc_sb_a_001', 'PAYMENT_CONFIRMED', '{STORE_A}', '{charge3_id}', 'received');
    """, fail=True, expect_err="asaas_webhook_events_event_id_key")

    # Retention test: hard-deleting profile or order with financial history is blocked (ON DELETE RESTRICT)
    sql(f"DELETE FROM public.profiles WHERE id='{STORE_A}'", fail=True, expect_err="violates foreign key constraint")
    sql(f"DELETE FROM public.orders WHERE id='{ORDER_A1}'", fail=True, expect_err="violates foreign key constraint")
    # Deleting customer_profile sets customer_profile_id to NULL while preserving financial rows
    CUST_TMP = "55555555-5555-4555-8555-555555555599"
    sql(f"INSERT INTO public.customer_profiles(id, full_name) VALUES ('{CUST_TMP}', 'Temp');")
    tmp_cust_row = sql(f"""
    INSERT INTO public.store_asaas_customers(store_id, environment, customer_profile_id, cpf_cnpj_normalized, asaas_customer_id, name)
    VALUES ('{STORE_C}', 'sandbox', '{CUST_TMP}', '11122233344', 'cus_tmp_1', 'Temp')
    RETURNING id;
    """)
    sql(f"DELETE FROM public.customer_profiles WHERE id='{CUST_TMP}';")
    assert sql(f"SELECT customer_profile_id IS NULL FROM public.store_asaas_customers WHERE id='{tmp_cust_row}'") == "t"

    # Tests 12, 13, 14: Fail-closed RLS & privileges — anon and authenticated (Store A or Store B) cannot read ANY sensitive table or credential column
    for role in ("anon", "authenticated"):
        for tbl in ("store_asaas_accounts", "store_asaas_customers", "store_charges", "asaas_webhook_events"):
            sql(f"SET LOCAL ROLE {role}; SELECT * FROM public.{tbl};", fail=True, expect_err="permission denied")
    # Explicitly verify encrypted_api_key and webhook_token_hash blocked for Store A and Store B authenticated sessions
    sql(f"BEGIN; SET LOCAL ROLE authenticated; SELECT set_config('test.actor', '{STORE_A}', true); SELECT encrypted_api_key, webhook_token_hash FROM public.store_asaas_accounts; COMMIT;", fail=True, expect_err="permission denied")
    sql(f"BEGIN; SET LOCAL ROLE authenticated; SELECT set_config('test.actor', '{STORE_C}', true); SELECT * FROM public.store_charges WHERE store_id='{STORE_A}'; COMMIT;", fail=True, expect_err="permission denied")

    # Verify RLS is enabled on all 4 tables
    rls_count = sql("""
    SELECT count(*) FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname IN ('store_asaas_accounts', 'store_asaas_customers', 'store_charges', 'asaas_webhook_events')
      AND c.relrowsecurity = true;
    """)
    assert rls_count == "4", f"expected RLS on 4 tables, got {rls_count}"

    # Test 15: Delegated MARCA context via merchant_request_store_id() resolves independently by store_id without breaking isolation
    resolved_primary = sql(f"BEGIN; SELECT set_config('test.actor', '{STORE_A}', true); SELECT public.merchant_request_store_id(); COMMIT;")
    assert resolved_primary == STORE_A
    resolved_secondary = sql(f"""
    BEGIN;
    SELECT set_config('test.actor', '{STORE_A}', true);
    SELECT set_config('request.headers', '{{"x-shopdrive-store-id":"{STORE_B}"}}', true);
    SELECT public.merchant_request_store_id();
    COMMIT;
    """)
    assert resolved_secondary == STORE_B
    # Unrelated Store C is denied even for MARCA actor A
    sql(f"""
    BEGIN;
    SELECT set_config('test.actor', '{STORE_A}', true);
    SELECT set_config('request.headers', '{{"x-shopdrive-store-id":"{STORE_C}"}}', true);
    SELECT public.merchant_request_store_id();
    COMMIT;
    """, fail=True, expect_err="store_access_denied")

    # Rollback validation: clean reverse drop removes only Phase 1 objects and leaves existing tables intact
    sql("""
    DROP TABLE public.asaas_webhook_events;
    DROP TABLE public.store_charges;
    DROP FUNCTION public._store_charges_enforce_external_reference();
    DROP TABLE public.store_asaas_customers;
    DROP TABLE public.store_asaas_accounts;
    """)
    assert sql("SELECT count(*) FROM public.orders") == "2"
    assert sql("SELECT count(*) FROM public.profiles") == "3"

    print(f"ALL ASAAS PHASE 1 DB CHECKS PASSED ({migration_path.name})")


if __name__ == "__main__":
    main()