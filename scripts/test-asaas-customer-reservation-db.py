"""Minimal Phase 5.1 reservation regression: disposable localhost PostgreSQL only.
Synthetic actors/accounts; no hosted database, credentials or external calls.
"""
import concurrent.futures
import importlib.util
import json
import os
import subprocess
import sys
from pathlib import Path

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parent.parent
SPEC = importlib.util.spec_from_file_location('asaas_base', ROOT / 'scripts/test-asaas-phase1-db.py')
base = importlib.util.module_from_spec(SPEC)
assert SPEC.loader
SPEC.loader.exec_module(base)
base.DATA = Path('/tmp/asaas-customer-reservation-db')
base.PORT = '55453'
base.DSN = f'postgresql://nobody@127.0.0.1:{base.PORT}/asaas_customer_test?sslmode=disable'
base.ADMIN = f'postgresql://nobody@127.0.0.1:{base.PORT}/postgres?sslmode=disable'
STORE = '323c7e89-7d28-492f-b3bc-be9f7f014bf0'  # fixed scope, entirely synthetic local fixture
OTHER = '22222222-2222-4222-8222-222222222222'
MASTER = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
ACCOUNT = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
OTHER_ACCOUNT = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
CHECKS = 0


def check(condition):
    global CHECKS
    assert condition
    CHECKS += 1


def q(value):
    return 'NULL' if value is None else "'" + str(value).replace("'", "''") + "'"


def reserve(doc='52998224725', actor=MASTER, store=STORE, env='sandbox', account=ACCOUNT, profile=None):
    return json.loads(base.sql(f"SELECT public.reserve_asaas_customer({q(actor)},{q(store)},{q(env)},{q(account)},{q(doc)},'Synthetic payer',{q(profile)});"))


def complete(c, provider='cus_fixture1', count=1, reference=None, doc='52998224725', token=None):
    return json.loads(base.sql(f"SELECT public.complete_asaas_customer_reservation('{MASTER}','{STORE}','sandbox','{ACCOUNT}',{q(c['customerId'])},{q(token or c['attemptToken'])},{q(reference or c['externalReference'])},{q(doc)},{q(provider)},{count});"))


def fail(sql, error):
    base.sql(sql, fail=True, expect_err=error)
    check(True)


def setup():
    base.start_cluster()
    subprocess.run(['dropdb','--if-exists','--maintenance-db='+base.ADMIN,'asaas_customer_test'],env=base.ENV,check=True,capture_output=True)
    subprocess.run(['createdb','--maintenance-db='+base.ADMIN,'asaas_customer_test'],env=base.ENV,check=True,capture_output=True)
    base.sql("""
    DO $$ BEGIN
      IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon; END IF;
      IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated; END IF;
      IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN CREATE ROLE service_role BYPASSRLS; END IF;
    END $$;
    GRANT USAGE ON SCHEMA public TO anon,authenticated,service_role;
    CREATE EXTENSION pgcrypto;
    CREATE FUNCTION public.update_updated_at_column() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN NEW.updated_at=now(); RETURN NEW; END; $$;
    CREATE TABLE public.profiles(id uuid PRIMARY KEY,deleted_at timestamptz,account_status text DEFAULT 'active');
    CREATE TABLE public.customer_profiles(id uuid PRIMARY KEY);
    CREATE TABLE public.orders(id uuid PRIMARY KEY,store_owner_id uuid);
    CREATE TABLE public.user_roles(user_id uuid,role text);
    CREATE FUNCTION public.has_role(p_user uuid,p_role text) RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=p_user AND role=p_role) $$;
    """)
    base.sql_file(ROOT / 'drizzle/migrations/0092_asaas_baas_phase1_foundation.sql')
    path = os.environ.get('ASAAS_CUSTOMER_RESERVATION_SQL')
    migration = Path(path) if path else sorted((ROOT/'drizzle/migrations').glob('*asaas_customer_reservation*.sql'))[-1]
    base.sql_file(migration)
    base.sql(f"""
    INSERT INTO public.profiles(id) VALUES('{STORE}'),('{OTHER}'),('{MASTER}');
    INSERT INTO public.user_roles VALUES('{MASTER}','admin');
    INSERT INTO public.store_asaas_accounts(id,store_id,environment,asaas_account_id,wallet_id,encrypted_api_key,status,
      commercial_status,bank_account_status,document_status,general_approval_status)
    VALUES('{ACCOUNT}','{STORE}','sandbox','111ce0e7-8dd0-4348-97bd-4b25add64fb0','wallet_fixture','synthetic-encrypted-fixture','active','APPROVED','APPROVED','APPROVED','APPROVED'),
      ('{OTHER_ACCOUNT}','{OTHER}','sandbox','account_other_fixture','wallet_other_fixture','synthetic-encrypted-fixture','active','APPROVED','APPROVED','APPROVED','APPROVED');
    """)


def main():
    setup()
    for args,error in [
        ((OTHER,STORE,'sandbox',ACCOUNT),'ASAAS_CUSTOMER_FORBIDDEN'),
        ((MASTER,OTHER,'sandbox',OTHER_ACCOUNT),'ASAAS_CUSTOMER_SCOPE_BLOCKED'),
        ((MASTER,STORE,'production',ACCOUNT),'ASAAS_CUSTOMER_SCOPE_BLOCKED'),
        ((MASTER,STORE,'sandbox',OTHER_ACCOUNT),'ASAAS_CUSTOMER_ACCOUNT_NOT_APPROVED'),
        ((MASTER,STORE,'sandbox',MASTER),'ASAAS_CUSTOMER_ACCOUNT_NOT_APPROVED'),
    ]:
        fail(f"SELECT public.reserve_asaas_customer({','.join(q(x) for x in args)},'52998224725','Fixture');",error)
    for field in ('commercial_status','bank_account_status','document_status','general_approval_status'):
        base.sql(f"UPDATE public.store_asaas_accounts SET {field}='PENDING' WHERE id='{ACCOUNT}';")
        fail(f"SELECT public.reserve_asaas_customer('{MASTER}','{STORE}','sandbox','{ACCOUNT}','52998224725','Fixture');",'ASAAS_CUSTOMER_ACCOUNT_NOT_APPROVED')
        base.sql(f"UPDATE public.store_asaas_accounts SET {field}='APPROVED' WHERE id='{ACCOUNT}';")
    base.sql(f"UPDATE public.profiles SET account_status='suspended' WHERE id='{STORE}';")
    fail(f"SELECT public.reserve_asaas_customer('{MASTER}','{STORE}','sandbox','{ACCOUNT}','52998224725','Fixture');",'ASAAS_CUSTOMER_ACCOUNT_NOT_APPROVED')
    base.sql(f"UPDATE public.profiles SET account_status='active' WHERE id='{STORE}';")
    for role in ('anon','authenticated'):
        for query in (f"SELECT public.reserve_asaas_customer('{MASTER}','{STORE}','sandbox','{ACCOUNT}','52998224725','Fixture');", 'SELECT * FROM public.store_asaas_customers;'):
            fail(f'SET ROLE {role}; '+query,'permission denied')
        for function in ('_lock_asaas_customer_scope','record_asaas_customer_unknown','complete_asaas_customer_reservation'):
            check(base.sql(f"SELECT bool_and(NOT has_function_privilege('{role}',oid,'EXECUTE')) FROM pg_proc WHERE proname='{function}';")=='t')
    fail(f"SELECT public.reserve_asaas_customer('{MASTER}','{STORE}','sandbox','{ACCOUNT}','not-a-document','Fixture');",'ASAAS_CUSTOMER_INVALID_IDENTITY')
    with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:
        results = list(pool.map(lambda _: reserve(), range(8)))
    check(sum(x['state']=='reserved' for x in results)==1)
    check(sum(x['state']=='reservation_exists' for x in results)==7)
    c = next(x for x in results if x['state']=='reserved')
    check(base.sql('SELECT count(*) FROM public.store_asaas_customers;')=='1')
    check(base.sql('SELECT asaas_customer_id IS NULL FROM public.store_asaas_customers;')=='t')
    check('52998224725' not in c['externalReference'])
    base.sql(f"UPDATE public.store_asaas_customers SET lease_expires_at=now()-interval '1 day' WHERE id='{c['customerId']}';")
    check(reserve()['state']=='reservation_exists')
    check(reserve()['externalReference']==c['externalReference'])
    check(complete(c,token=OTHER)['state']=='stale_attempt')
    for field,value in [('external_reference','sd_customer_'+OTHER),('cpf_cnpj_normalized','11144477735'),('store_id',OTHER),('store_asaas_account_id',OTHER_ACCOUNT),('environment','production')]:
        fail(f"UPDATE public.store_asaas_customers SET {field}={q(value)} WHERE id='{c['customerId']}';",'ASAAS_CUSTOMER_IDENTITY_IMMUTABLE')
    check(complete(c)['state']=='linked')
    check(complete(c)['state']=='existing')
    check(reserve()['asaasCustomerId']=='cus_fixture1')
    fail(f"UPDATE public.store_asaas_customers SET asaas_customer_id='cus_reassign' WHERE id='{c['customerId']}';",'ASAAS_CUSTOMER_IDENTITY_IMMUTABLE')
    for i,match in enumerate((0,2,1)):
        doc=('11144477735','12345678000195','04252011000110')[i]
        r=reserve(doc)
        check(r['state']=='reserved')
        check(complete(r,count=match,doc=doc,reference=('sd_customer_'+OTHER if match==1 else None))['state']=='reconciliation_required')
        check(reserve(doc)['state']=='reservation_exists')
        check(complete(r,doc=doc)['state']=='administrative_review_required')
    # Synthetic lost provider response. Only tests simulate sending; no send RPC exists.
    lost=reserve('21972048000192')
    base.sql(f"UPDATE public.store_asaas_customers SET reservation_state='sending',send_started_at=now() WHERE id='{lost['customerId']}';")
    check(base.sql(f"SELECT public.record_asaas_customer_unknown('{MASTER}','{STORE}','sandbox','{ACCOUNT}','{lost['customerId']}','{lost['attemptToken']}');")=='t')
    check(reserve('21972048000192')['state']=='reconciliation_required')
    check(complete(lost,doc='21972048000192',provider='cus_recovered')['state']=='linked')
    conflict=reserve('11222333000181')
    check(complete(conflict,doc='11222333000181',provider='cus_fixture1')['state']=='identity_conflict')
    check(base.sql(f"SELECT asaas_customer_id IS NULL FROM public.store_asaas_customers WHERE id='{conflict['customerId']}';")=='t')
    # Same document in another tenant remains a distinct row; composite FK prevents wrong subaccount.
    base.sql(f"INSERT INTO public.store_asaas_customers(store_id,environment,store_asaas_account_id,cpf_cnpj_normalized,name,asaas_customer_id,reservation_state) VALUES('{OTHER}','sandbox','{OTHER_ACCOUNT}','52998224725','Other fixture','cus_other','linked');")
    check(base.sql("SELECT count(*) FROM public.store_asaas_customers WHERE cpf_cnpj_normalized='52998224725';")=='2')
    fail(f"INSERT INTO public.store_asaas_customers(store_id,environment,store_asaas_account_id,cpf_cnpj_normalized,name,asaas_customer_id,reservation_state) VALUES('{OTHER}','sandbox','{ACCOUNT}','11144477735','Wrong fixture','cus_wrong','linked');",'store_asaas_customers_account_tenant_fkey')
    fail(f"INSERT INTO public.store_asaas_customers(store_id,environment,store_asaas_account_id,cpf_cnpj_normalized,name,asaas_customer_id,reservation_state) VALUES('{OTHER}','sandbox','{OTHER_ACCOUNT}','11144477735','Duplicate fixture','cus_other','linked');",'duplicate key')
    check(base.sql("SELECT count(*) FROM public.store_charges;")=='0')
    check(base.sql("SELECT count(*) FROM pg_proc WHERE proname='claim_asaas_customer_send';")=='0')
    # Failed transaction must retain reservation/identity for reconciliation, never duplicate.
    pending=reserve('11444777000161')
    fail(f"BEGIN; SELECT public.complete_asaas_customer_reservation('{MASTER}','{STORE}','sandbox','{ACCOUNT}','{pending['customerId']}','{pending['attemptToken']}','{pending['externalReference']}','11444777000161','cus_rollback',1); SELECT 1/0; COMMIT;",'division by zero')
    check(reserve('11444777000161')['state']=='reservation_exists')
    check(complete(pending,doc='11444777000161',provider='cus_rollback')['state']=='linked')
    print(f'ALL ASAAS CUSTOMER RESERVATION CHECKS PASSED ({CHECKS} checks; 8 concurrent attempts; localhost only)')


if __name__=='__main__':
    try:
        main()
    finally:
        base.as_nobody('pg_ctl','-D',str(base.DATA),'-m','fast','stop')
