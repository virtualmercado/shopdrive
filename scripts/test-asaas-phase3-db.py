"""Phase 3 SQL/concurrency checks in disposable localhost PostgreSQL only.
No hosted connection, real credential, customer data or Asaas network call.
"""
import concurrent.futures
import importlib.util
import json
import subprocess
import sys
from pathlib import Path

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parent.parent
SPEC = importlib.util.spec_from_file_location("asaas_phase1", ROOT / "scripts/test-asaas-phase1-db.py")
base = importlib.util.module_from_spec(SPEC)
assert SPEC.loader
SPEC.loader.exec_module(base)
base.DATA = Path("/tmp/asaas-phase3-db")
base.PORT = "55450"
base.DSN = f"postgresql://nobody@127.0.0.1:{base.PORT}/asaas_phase3_test?sslmode=disable"
base.ADMIN = f"postgresql://nobody@127.0.0.1:{base.PORT}/postgres?sslmode=disable"

A = "11111111-1111-4111-8111-111111111111"
B = "22222222-2222-4222-8222-222222222222"
C = "33333333-3333-4333-8333-333333333333"
D = "44444444-4444-4444-8444-444444444444"
E = "55555555-5555-4555-8555-555555555555"
F = "66666666-6666-4666-8666-666666666666"
G = "77777777-7777-4777-8777-777777777777"
HASH_A = "a" * 64
HASH_B = "b" * 64


def rpc(name, args):
    rendered = ", ".join(f"{key} := {value}" for key, value in args.items())
    return json.loads(base.sql(f"SELECT public.{name}({rendered});"))


def quoted(value):
    return "NULL" if value is None else "'" + str(value).replace("'", "''") + "'"


def begin(actor, store, token_hash):
    return rpc("begin_asaas_subaccount_creation", {
        "p_actor": f"'{actor}'", "p_store_id": f"'{store}'", "p_webhook_token_hash": f"'{token_hash}'",
    })


def capture(attempt, account, wallet):
    return base.sql(f"SELECT public.capture_asaas_subaccount_credentials('{attempt}', '{account}', '{wallet}', '000123', 'v1.synthetic.ciphertext', 'sha256:{'1' * 64}');") == "t"


def apply_event(store, token_hash, event_id, account, event_type="ACCOUNT_STATUS_GENERAL_APPROVAL_APPROVED", general="APPROVED"):
    return rpc("apply_asaas_account_webhook", {
        "p_store_id": f"'{store}'", "p_webhook_token_hash": f"'{token_hash}'", "p_event_id": f"'{event_id}'",
        "p_event_type": f"'{event_type}'", "p_account_id": f"'{account}'",
        "p_payload": "'{}'::jsonb", "p_commercial_status": "'APPROVED'", "p_bank_account_status": "'APPROVED'",
        "p_document_status": "'APPROVED'", "p_general_approval_status": f"'{general}'",
    })


def concurrent_begin(index):
    query = f"SELECT public.begin_asaas_subaccount_creation('{C}', '{C}', '{index + 1:064x}');"
    process = subprocess.run(["psql", base.DSN, "-X", "-q", "-v", "ON_ERROR_STOP=1", "-At", "-c", query], env=base.ENV, capture_output=True, text=True)
    assert process.returncode == 0, process.stderr
    return json.loads(process.stdout.strip())["state"]


def main():
    base.start_cluster()
    subprocess.run(["dropdb", "--if-exists", "--maintenance-db=" + base.ADMIN, "asaas_phase3_test"], env=base.ENV, check=True, capture_output=True)
    subprocess.run(["createdb", "--maintenance-db=" + base.ADMIN, "asaas_phase3_test"], env=base.ENV, check=True, capture_output=True)
    base.sql("""
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon; END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated; END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN CREATE ROLE service_role BYPASSRLS; END IF;
    END $$;
    CREATE EXTENSION IF NOT EXISTS pgcrypto;
    CREATE FUNCTION public.update_updated_at_column() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
    BEGIN NEW.updated_at=now(); RETURN NEW; END; $$;
    CREATE TABLE public.profiles(id uuid PRIMARY KEY, deleted_at timestamptz NULL, account_status text NOT NULL DEFAULT 'active');
    CREATE TABLE public.customer_profiles(id uuid PRIMARY KEY);
    CREATE TABLE public.orders(id uuid PRIMARY KEY, store_owner_id uuid NOT NULL REFERENCES public.profiles(id));
    CREATE TABLE public.merchant_store_memberships(user_id uuid, store_id uuid, active boolean, authorization_approved boolean, permission text);
    CREATE FUNCTION public.can_actor_manage_marca_store(p_actor uuid, p_store_id uuid) RETURNS boolean
      LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
      SELECT p_actor=p_store_id OR EXISTS(SELECT 1 FROM merchant_store_memberships WHERE user_id=p_actor AND store_id=p_store_id AND active AND authorization_approved AND permission='administrator')
    $$;
    """)
    phase1 = sorted((ROOT / "drizzle/migrations").glob("*asaas_baas_phase1*.sql"))[-1]
    phase3 = sorted((ROOT / "drizzle/migrations").glob("*asaas_baas_phase3*.sql"))[-1]
    base.sql_file(phase1)
    base.sql_file(phase3)
    base.sql(f"""
    INSERT INTO public.profiles(id) VALUES ('{A}'),('{B}'),('{C}'),('{D}'),('{E}'),('{F}'),('{G}');
    INSERT INTO public.merchant_store_memberships VALUES ('{A}','{B}',true,true,'administrator');
    """)

    assert begin(A, C, "9" * 64)["state"] == "forbidden"
    claimed = begin(A, A, HASH_A)
    assert claimed["state"] == "claimed"
    assert begin(A, A, "c" * 64)["state"] == "creation_in_progress"
    assert capture(claimed["attemptToken"], "acc_synthetic_a", "wal_synthetic_a")
    assert base.sql(f"SELECT public.complete_asaas_subaccount_creation('{claimed['attemptToken']}','APPROVED','APPROVED','APPROVED','APPROVED','active',NULL);") == "t"
    assert begin(A, A, "d" * 64)["state"] == "existing"

    delegated = begin(A, B, HASH_B)
    assert delegated["state"] == "claimed"
    early = apply_event(B, HASH_B, "evt_early", "acc_synthetic_b", general="PENDING")
    assert early["state"] == "deferred"
    assert apply_event(B, HASH_B, "evt_early", "acc_synthetic_b", general="PENDING")["state"] == "duplicate"
    assert base.sql(f"SELECT status FROM public.store_asaas_accounts WHERE store_id='{B}';") == "pending_creation"
    assert capture(delegated["attemptToken"], "acc_synthetic_b", "wal_synthetic_b")
    assert apply_event(B, HASH_B, "evt_approved", "acc_synthetic_b")["status"] == "active"
    assert apply_event(B, HASH_B, "evt_approved", "acc_synthetic_b", general="REJECTED")["state"] == "duplicate"
    assert base.sql(f"SELECT status || '|' || general_approval_status FROM public.store_asaas_accounts WHERE store_id='{B}';") == "active|APPROVED"
    rejected = apply_event(B, HASH_B, "evt_rejected", "acc_synthetic_b", event_type="ACCOUNT_STATUS_GENERAL_APPROVAL_REJECTED", general="REJECTED")
    assert rejected["status"] == "rejected"

    lost = begin(D, D, "e" * 64)
    assert base.sql(f"SELECT public.fail_asaas_subaccount_creation('{lost['attemptToken']}','ASAAS_SUBACCOUNT_CREATED_API_KEY_NOT_CAPTURED','acc_lost','wal_lost',NULL);") == "t"
    assert begin(D, D, "f" * 64)["state"] == "existing"
    assert base.sql(f"SELECT count(*) FROM public.store_asaas_accounts WHERE store_id='{D}';") == "1"

    ambiguous = begin(E, E, "0" * 64)
    assert base.sql(f"SELECT public.fail_asaas_subaccount_creation('{ambiguous['attemptToken']}','ASAAS_SUBACCOUNT_RECONCILIATION_AMBIGUOUS',NULL,NULL,NULL);") == "t"
    assert begin(E, E, "1" * 64)["state"] == "existing"

    recoverable = begin(F, F, "2" * 64)
    old_attempt = recoverable["attemptToken"]
    assert base.sql(f"SELECT public.fail_asaas_subaccount_creation('{old_attempt}','ASAAS_SUBACCOUNT_NOT_FOUND',NULL,NULL,NULL);") == "t"
    reclaimed = begin(F, F, "3" * 64)
    assert reclaimed["state"] == "claimed"
    assert base.sql(f"SELECT public.fail_asaas_subaccount_creation('{old_attempt}','STALE_ATTEMPT',NULL,NULL,NULL);") == "f"

    base.sql(f"""
    INSERT INTO public.store_asaas_accounts(store_id,environment,status,webhook_token_hash)
    VALUES ('{G}','sandbox','pending_creation','{HASH_A}');
    """, fail=True, expect_err="idx_store_asaas_accounts_webhook_token_hash")

    with concurrent.futures.ThreadPoolExecutor(max_workers=8) as executor:
        states = list(executor.map(concurrent_begin, range(8)))
    assert states.count("claimed") == 1, states
    assert states.count("creation_in_progress") == 7, states
    assert base.sql(f"SELECT count(*) FROM public.store_asaas_accounts WHERE store_id='{C}';") == "1"

    for role in ("anon", "authenticated"):
        base.sql(f"SET LOCAL ROLE {role}; SELECT public.begin_asaas_subaccount_creation('{A}','{A}','{'4' * 64}');", fail=True, expect_err="permission denied")
        base.sql(f"SET LOCAL ROLE {role}; SELECT * FROM public.store_asaas_accounts;", fail=True, expect_err="permission denied")

    print(f"ALL ASAAS PHASE 3 DB CHECKS PASSED ({phase3.name}; 8 concurrent attempts)")


if __name__ == "__main__":
    try:
        main()
    finally:
        base.as_nobody("pg_ctl", "-D", str(base.DATA), "-m", "fast", "stop")
