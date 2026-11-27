"""Four Phase 3 safeguards: synthetic rows in disposable localhost PostgreSQL only."""
import concurrent.futures
import importlib.util
import json
import os
import subprocess
import sys
from pathlib import Path
sys.dont_write_bytecode=True
ROOT=Path(__file__).resolve().parent.parent
spec=importlib.util.spec_from_file_location('phase1', ROOT/'scripts/test-asaas-phase1-db.py')
assert spec and spec.loader
base=importlib.util.module_from_spec(spec); spec.loader.exec_module(base)
base.DATA=Path('/tmp/asaas-complementary-db'); base.PORT='55451'
base.DSN=f'postgresql://nobody@127.0.0.1:{base.PORT}/asaas_complementary_test?sslmode=disable'
base.ADMIN=f'postgresql://nobody@127.0.0.1:{base.PORT}/postgres?sslmode=disable'
A='11111111-1111-4111-8111-111111111111'; B='22222222-2222-4222-8222-222222222222'
C='33333333-3333-4333-8333-333333333333'; ADMIN='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
H='a'*64; HB='b'*64
checks=0

def check(value):
 global checks
 assert value
 checks+=1

def begin(actor,store,grant,hashed=H):
 return json.loads(base.sql(f"SELECT public.begin_asaas_subaccount_creation('{actor}','{store}','{hashed}',{repr(grant) if grant else 'NULL'}::uuid);"))
def grant(store,actor):
 return json.loads(base.sql(f"BEGIN; SET LOCAL ROLE authenticated; SELECT set_config('test.actor','{ADMIN}',true); SELECT public.admin_authorize_asaas_subaccount_creation('{store}','{actor}',now()+interval '30 minutes'); COMMIT;"))['authorizationId']
def capture(attempt,account,wallet):
 return base.sql(f"SELECT public.capture_asaas_subaccount_credentials('{attempt}','{account}','{wallet}',NULL,'v1.synthetic','sha256:{H}');")=='t'
def event(store,hash_value,event_id,account,general='APPROVED',date='2026-11-27T20:00:00Z'):
 return json.loads(base.sql(f"SELECT public.apply_asaas_account_webhook('{store}','{hash_value}','{event_id}','ACCOUNT_STATUS_GENERAL_APPROVAL_{general}','{account}','{{\"dateCreated\":\"{date}\"}}','APPROVED','APPROVED','APPROVED','{general}');"))
def reconcile(store,account,hashed,rev,general='APPROVED',through=None):
 cutoff=f"'{through}'::timestamptz" if through else 'now()'
 return json.loads(base.sql(f"SELECT public.reconcile_asaas_account_events('{store}','{account}','{hashed}',{rev},{cutoff},'APPROVED','APPROVED','APPROVED','{general}');"))
def main():
 base.start_cluster()
 subprocess.run(['dropdb','--if-exists','--maintenance-db='+base.ADMIN,'asaas_complementary_test'],env=base.ENV,check=True,capture_output=True)
 subprocess.run(['createdb','--maintenance-db='+base.ADMIN,'asaas_complementary_test'],env=base.ENV,check=True,capture_output=True)
 base.sql("""
 DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN CREATE ROLE service_role BYPASSRLS; END IF;
 END $$;
 CREATE EXTENSION IF NOT EXISTS pgcrypto;
 CREATE SCHEMA auth; GRANT USAGE ON SCHEMA public,auth TO anon,authenticated,service_role;
 CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('test.actor',true),'')::uuid $$;
 CREATE FUNCTION public.has_role(_user_id uuid,_role text) RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT _user_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid AND _role='admin' $$;
 CREATE FUNCTION public.update_updated_at_column() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN NEW.updated_at=now(); RETURN NEW; END $$;
 CREATE TABLE public.profiles(id uuid PRIMARY KEY,deleted_at timestamptz,account_status text DEFAULT 'active');
 CREATE TABLE public.customer_profiles(id uuid PRIMARY KEY);
 CREATE TABLE public.orders(id uuid PRIMARY KEY);
 CREATE FUNCTION public.can_actor_manage_marca_store(p_actor uuid,p_store_id uuid) RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT p_actor=p_store_id OR (p_actor='11111111-1111-4111-8111-111111111111'::uuid AND p_store_id='22222222-2222-4222-8222-222222222222'::uuid) $$;
 """)
 base.sql_file(ROOT/'drizzle/migrations/0092_asaas_baas_phase1_foundation.sql')
 base.sql_file(ROOT/'drizzle/migrations/0093_asaas_baas_phase3_subaccount_provisioning.sql')
 migration=os.environ.get('ASAAS_COMPLEMENTARY_SQL')
 if not migration:
  migration=str(sorted((ROOT/'drizzle/migrations').glob('*asaas_phase3_complementary*.sql'))[-1])
 base.sql_file(Path(migration))
 base.sql(f"INSERT INTO profiles(id) VALUES('{A}'),('{B}'),('{C}'),('{ADMIN}');")
 # 1: UI-only flag cannot grant creation; nobody may bypass Master/actor/store binding.
 base.sql(f"CREATE TABLE public.asaas_baas_ui_access(store_id uuid PRIMARY KEY,enabled boolean); INSERT INTO asaas_baas_ui_access VALUES('{B}',true);")
 check(begin(A,A,None)['state']=='creation_not_authorized')
 check(begin(A,B,None)['state']=='creation_not_authorized')
 check(begin(B,B,None)['state']=='creation_not_authorized')
 check(json.loads(base.sql(f"SELECT begin_asaas_subaccount_creation('{A}','{A}','{H}');"))['state']=='creation_not_authorized')
 check(base.sql('SELECT count(*) FROM store_asaas_accounts')=='0')
 base.sql(f"BEGIN; SET LOCAL ROLE authenticated; SELECT set_config('test.actor','{A}',true); SELECT admin_authorize_asaas_subaccount_creation('{B}','{A}',now()+interval '1 minute'); COMMIT;",fail=True,expect_err='forbidden')
 for role in ['anon','authenticated']:
  base.sql(f"SET LOCAL ROLE {role}; SELECT begin_asaas_subaccount_creation('{A}','{A}','{H}',NULL);",fail=True,expect_err='permission denied')
  base.sql(f"SET LOCAL ROLE {role}; SELECT * FROM asaas_subaccount_creation_authorizations;",fail=True,expect_err='permission denied')
 g=grant(A,A)
 check(begin(A,B,g)['state']=='creation_not_authorized')
 g_b=grant(B,A)
 check(begin(B,B,g_b)['state']=='creation_not_authorized')
 with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:
  states=list(pool.map(lambda _:begin(A,A,g)['state'],range(8)))
 check(states.count('claimed')==1); check(states.count('creation_in_progress')==7)
 check(base.sql(f"SELECT enabled::text||'|'||(consumed_at IS NOT NULL)::text FROM asaas_subaccount_creation_authorizations WHERE id='{g}'")=='false|true')
 attempt=base.sql(f"SELECT creation_attempt_token FROM store_asaas_accounts WHERE store_id='{A}'")
 # 2: empty lookup legacy error, expired lease and failed persistence NEVER release a creation.
 base.sql(f"UPDATE store_asaas_accounts SET creation_lease_expires_at=now()-interval '1 second' WHERE store_id='{A}';")
 check(begin(A,A,g)['state']=='reconciliation_required')
 check(capture(attempt,'acc_a','wal_a') is False)
 check(base.sql(f"SELECT fail_asaas_subaccount_creation('{attempt}','ASAAS_SUBACCOUNT_NOT_FOUND',NULL,NULL,NULL)")=='t')
 check(begin(A,A,g)['state']=='reconciliation_required')
 base.sql(f"BEGIN; SELECT set_config('test.actor','{ADMIN}',true); SELECT admin_authorize_asaas_subaccount_creation('{A}','{A}',now()+interval '1 minute'); COMMIT;",fail=True,expect_err='reconciliation_required')
 # 3: direct identifiers unique across shops AND environments, wallet too.
 b=begin(A,B,g_b,HB); check(b['state']=='claimed')
 check(capture(b['attemptToken'],'acc_b','wal_b'))
 base.sql(f"INSERT INTO store_asaas_accounts(store_id,environment,asaas_account_id) VALUES('{C}','production','acc_b');",fail=True,expect_err='idx_asaas_account_global')
 base.sql(f"INSERT INTO store_asaas_accounts(store_id,environment,wallet_id) VALUES('{C}','sandbox','wal_b');",fail=True,expect_err='idx_asaas_wallet_global')
 # 4: early event remains received, duplicate unfinished is never terminal.
 check(event(B,HB,'evt_early','acc_b')['state']=='deferred')
 check(base.sql("SELECT processing_status FROM asaas_webhook_events WHERE event_id='evt_early'")=='received')
 check(event(B,HB,'evt_early','acc_b')['state']=='deferred')
 check(base.sql(f"SELECT complete_asaas_subaccount_creation('{b['attemptToken']}','APPROVED','APPROVED','APPROVED','APPROVED','active',NULL)")=='t')
 check(event(B,HB,'evt_early','acc_b')['state']=='reconciliation_required')
 check(reconcile(B,'acc_b',HB,1)['state']=='processed')
 check(event(B,HB,'evt_early','acc_b')['state']=='duplicate')
 # delayed REJECTED payload doesn't change current approval; GET is authoritative.
 check(event(B,HB,'evt_old','acc_b','REJECTED','2020-01-01T00:00:00Z')['state']=='reconciliation_required')
 check(base.sql(f"SELECT general_approval_status FROM store_asaas_accounts WHERE store_id='{B}'")=='APPROVED')
 check(reconcile(B,'acc_b',HB,2,'APPROVED')['state']=='processed')
 check(base.sql(f"SELECT status FROM store_asaas_accounts WHERE store_id='{B}'")=='active')
 event(B,HB,'evt_error','acc_b')
 base.sql("UPDATE asaas_webhook_events SET processing_status='error',error_code='synthetic_failure' WHERE event_id='evt_error';")
 check(event(B,HB,'evt_error','acc_b')['state']=='reconciliation_required')
 check(reconcile(B,'acc_b',HB,3)['state']=='processed')
 check(base.sql("SELECT processing_status FROM asaas_webhook_events WHERE event_id='evt_error'")=='processed')
 event(B,HB,'evt_concurrent','acc_b')
 with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:
  states=list(pool.map(lambda _:reconcile(B,'acc_b',HB,4)['state'],range(8)))
 check(states.count('processed')==1); check(states.count('stale_observation')==7)
 event(B,HB,'evt_after','acc_b')
 check(reconcile(B,'acc_b',HB,4,'REJECTED')['state']=='stale_observation')
 check(base.sql(f"SELECT status FROM store_asaas_accounts WHERE store_id='{B}'")=='active')
 check(base.sql("SELECT processing_status FROM asaas_webhook_events WHERE event_id='evt_after'")=='received')
 # Bound the observation to events present before GET; concurrent later events stay pending.
 event(B,HB,'evt_cutoff','acc_b')
 cutoff=base.sql("SELECT max(received_at) FROM asaas_webhook_events WHERE store_id='"+B+"'")
 event(B,HB,'evt_later','acc_b')
 check(reconcile(B,'acc_b',HB,5,through=cutoff)['state']=='processed')
 check(base.sql("SELECT processing_status FROM asaas_webhook_events WHERE event_id='evt_later'")=='received')
 # Default-disabled and expired authorizations cannot execute the first POST.
 disabled=base.sql(f"INSERT INTO asaas_subaccount_creation_authorizations(store_id,actor_id,authorized_by,expires_at) VALUES('{C}','{C}','{ADMIN}',now()+interval '30 minutes') RETURNING id")
 check(begin(C,C,disabled,'c'*64)['state']=='creation_not_authorized')
 g_c=grant(C,C)
 base.sql(f"UPDATE asaas_subaccount_creation_authorizations SET expires_at=now()-interval '1 second' WHERE id='{g_c}'")
 check(begin(C,C,g_c,'c'*64)['state']=='creation_not_authorized')
 g_c=grant(C,C); c=begin(C,C,g_c,'c'*64)
 check(capture(c['attemptToken'],'acc_c','wal_c'))
 event(C,'c'*64,'evt_c_early','acc_c')
 base.sql(f"UPDATE store_asaas_accounts SET creation_lease_expires_at=now()-interval '1 second' WHERE store_id='{C}'")
 check(begin(C,C,g_c,'c'*64)['state']=='existing')
 check(reconcile(C,'acc_c','c'*64,0)['state']=='processed')
 check(base.sql(f"SELECT creation_attempt_token IS NULL AND status='active' FROM store_asaas_accounts WHERE store_id='{C}'")=='t')
 # Wrong account cannot cross associate; failure within the transaction leaves no acknowledgement evidence.
 check(event(B,HB,'evt_wrong','acc_other')['state']=='ignored')
 check(reconcile(B,'acc_other',HB,5)['state']=='deferred')
 base.sql("CREATE FUNCTION reject_test_event() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.event_id='evt_fail' THEN RAISE EXCEPTION 'synthetic_persistence_failure'; END IF; RETURN NEW; END $$; CREATE TRIGGER test_fail BEFORE INSERT ON asaas_webhook_events FOR EACH ROW EXECUTE FUNCTION reject_test_event();")
 base.sql(f"SELECT apply_asaas_account_webhook('{B}','{HB}','evt_fail','ACCOUNT_STATUS_GENERAL_APPROVAL_APPROVED','acc_b','{{}}',NULL,NULL,NULL,NULL)",fail=True,expect_err='synthetic_persistence_failure')
 check(base.sql("SELECT count(*) FROM asaas_webhook_events WHERE event_id='evt_fail'")=='0')
 check(base.sql('SELECT count(*) FROM store_asaas_customers')=='0'); check(base.sql('SELECT count(*) FROM store_charges')=='0')
 subprocess.run(['deno','run','--allow-run=psql','--allow-env',str(ROOT/'scripts/asaasComplementaryIntegration.ts'),base.DSN],env=base.ENV,check=True)
 print(f'PASS: {checks} concrete assertions; gate, concurrency, uncertain creation, identity and webhook recovery/order; no external calls.')
try:
 if __name__=='__main__': main()
finally:
 base.as_nobody('pg_ctl','-D',str(base.DATA),'-m','fast','-w','stop')
