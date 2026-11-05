"""Run the real webhook migration and legacy invoice trigger in disposable localhost PostgreSQL only.
Requires the local synthetic cluster on 127.0.0.1:55439; never reads managed credentials.
"""
import subprocess, json, concurrent.futures, os, glob
from pathlib import Path
ROOT=Path(__file__).resolve().parent.parent
DSN='postgresql://nobody@127.0.0.1:55439/subscription_webhook_test?sslmode=disable'
ENV={k:v for k,v in os.environ.items() if not k.startswith('PG')}
ADMIN='postgresql://nobody@127.0.0.1:55439/postgres?sslmode=disable'
subprocess.run(['dropdb','--if-exists','--maintenance-db='+ADMIN,'subscription_webhook_test'],env=ENV,check=True,capture_output=True)
subprocess.run(['createdb','--maintenance-db='+ADMIN,'subscription_webhook_test'],env=ENV,check=True,capture_output=True)
def sql(q,ok=True):
 p=subprocess.run(['psql',DSN,'-X','-v','ON_ERROR_STOP=1','-At','-c',q],env=ENV,text=True,capture_output=True)
 if ok and p.returncode: raise AssertionError(p.stderr)
 if not ok: assert p.returncode!=0,'expected rejection'
 return p.stdout.strip()
sql("""DO $$ BEGIN IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS; END IF; END $$;
CREATE SCHEMA auth;
CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql AS $$SELECT current_setting('test.role',true)$$;
CREATE TABLE public.master_subscriptions(id uuid primary key default gen_random_uuid(),user_id uuid,plan_id text,billing_cycle text,monthly_price numeric,total_amount numeric,status text,started_at timestamptz,current_period_start timestamptz,current_period_end timestamptz,cancelled_at timestamptz,gateway text,gateway_subscription_id text,grace_period_ends_at timestamptz,decline_type text,last_decline_code text,last_decline_message text,next_retry_at timestamptz,requires_card_update boolean,retry_count int,previous_plan_id text,downgraded_at timestamptz,downgrade_reason text,pending_plan_id text,contract_acceptance_id uuid,brand_account_id uuid);
CREATE TABLE public.master_subscription_payments(id uuid primary key default gen_random_uuid(),subscription_id uuid,user_id uuid,amount numeric,gateway text,payment_method text,status text,gateway_payment_id text,gateway_status text,gateway_response jsonb,paid_at timestamptz,refunded_at timestamptz,idempotency_key text unique,created_at timestamptz default now(),pix_expires_at timestamptz,boleto_expires_at timestamptz,decline_code text,decline_type text,user_message text,attempt_number int default 1);
CREATE TABLE public.invoices(id uuid primary key default gen_random_uuid(),subscriber_id uuid,subscription_id uuid,amount numeric,due_date timestamptz,paid_at timestamptz,status text,reference_period_start date,reference_period_end date,created_at timestamptz default now(),updated_at timestamptz,payment_method text,mp_payment_id text,plan text,invoice_id text unique,contract_acceptance_id uuid,brand_account_id uuid);
CREATE TABLE public.master_subscription_logs(id uuid primary key default gen_random_uuid(),subscription_id uuid,user_id uuid,payment_id uuid,event_type text,event_description text,metadata jsonb);
CREATE TABLE public.webhook_events(id uuid primary key default gen_random_uuid(),gateway text,gateway_event_id text,event_type text,payload jsonb,unique(gateway,gateway_event_id));
CREATE TABLE public.test_effects(name text);
CREATE FUNCTION public.reactivate_products_after_upgrade(uuid,integer) RETURNS integer LANGUAGE plpgsql AS $$BEGIN INSERT INTO public.test_effects VALUES('reactivate'); RETURN 1; END$$;
""")
sync=(ROOT/'supabase/migrations/20260421012542_e0618455-b39c-4007-a992-905628794332.sql').read_text()
sql(sync[sync.index('CREATE OR REPLACE FUNCTION public.sync_invoice_for_payment'):sync.index('-- Backfill')])
migrations=glob.glob(str(ROOT/'drizzle/migrations/*_subscription_webhook_atomic.sql'))
migration=Path(migrations[0]) if len(migrations)==1 else Path('/tmp/subscription-webhook-hotfix.sql')
sql(migration.read_text())
A='11111111-1111-4111-8111-111111111111';S='22222222-2222-4222-8222-222222222222';P='33333333-3333-4333-8333-333333333333';I='44444444-4444-4444-8444-444444444444'
sql(f"insert into master_subscriptions(id,user_id,plan_id,billing_cycle,monthly_price,total_amount,status,gateway,gateway_subscription_id,current_period_start,current_period_end) values('{S}','{A}','premium','monthly',49.97,49.97,'pending','mercadopago','fixture-preapproval','2026-10-20','2026-11-20'); insert into master_subscription_payments(id,subscription_id,user_id,amount,gateway,payment_method,status) values('{P}','{S}','{A}',49.97,'mercadopago','credit_card','pending'); update invoices set id='{I}',invoice_id='inv_fixture' where subscription_id='{S}';")
q="select claim_master_subscription_webhook('payment:184105194045:fixture-event','184105194045','payment')"
def claim(): return json.loads(sql("set test.role='service_role';"+q).splitlines()[-1])
with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool: results=list(pool.map(lambda _:claim(),range(8)))
assert sum(r['claimed'] for r in results)==1
print('PASS 8 concurrent signed-event claims: one worker')
token=next(r['token'] for r in results if r['claimed'])
payload={'id':'184105194045','status':'approved','transaction_amount':49.97,'currency_id':'BRL','date_approved':'2026-10-20T08:33:35-04:00','external_reference':'inv_fixture','preapproval_id':'fixture-preapproval','payment_method_id':'master','hard_decline':False}
def apply(event,token,payload=payload,ok=True): return sql("set test.role='service_role';select apply_master_subscription_webhook('"+event+"','"+token+"','payment','"+json.dumps(payload)+"')",ok)
sql("create table test_invoice_updates(id uuid); create function count_invoice_update() returns trigger language plpgsql as $$begin insert into test_invoice_updates values(new.id);return new;end$$; create trigger count_invoice_updates after update on invoices for each row execute function count_invoice_update();")
apply('payment:184105194045:fixture-event',token)
assert sql('select count(*) from test_invoice_updates')=='1' 
assert sql(f"select status||':'||gateway_payment_id from master_subscription_payments where id='{P}'")=='paid:184105194045'
assert sql(f"select status||':'||mp_payment_id from invoices where id='{I}'")=='paid:184105194045'
assert sql(f"select paid_at from invoices where id='{I}'").startswith('2026-10-20 12:33:35')
assert sql(f"select status from master_subscriptions where id='{S}'")=='active'
assert sql("select count(*) from master_subscription_logs where event_type='payment_paid'")=='1'
assert sql('select count(*) from test_effects')=='1'
assert sql(f"select attempt_number from master_subscription_payments where id='{P}'")=='1'
print('PASS approval: exact invoice/payment/date and single entitlement application')
assert claim()['duplicate']
apply('payment:184105194045:fixture-event',token,ok=False)
# distinct event deliveries for same payment remain once
for x in range(8):
 event=f'payment:184105194045:different-{x}'
 tok=json.loads(sql(f"set test.role='service_role';select claim_master_subscription_webhook('{event}','184105194045','payment')").splitlines()[-1])['token']
 apply(event,tok)
assert sql('select count(*) from master_subscription_payments')=='1';assert sql('select count(*) from invoices')=='1'
assert sql('select count(*) from test_effects')=='1';assert sql("select count(*) from master_subscription_logs where event_type='payment_paid'")=='1'
assert sql('select count(*) from test_invoice_updates')=='1'
print('PASS different event IDs, same real payment: no extra payment/invoice/plan update')
# amount/reference/tenant mismatch rollback and retry
for name,change in [('amount',{'transaction_amount':0.01}),('reference',{'external_reference':'inv_wrong'}),('subscription',{'preapproval_id':'other-sub'})]:
 event=f'payment:184105194045:bad-{name}';tok=json.loads(sql(f"set test.role='service_role';select claim_master_subscription_webhook('{event}','184105194045','payment')").splitlines()[-1])['token']
 apply(event,tok,{**payload,**change},False)
 assert sql(f"select state from master_subscription_webhook_receipts where event_key='{event}'")=='processing'
 sql(f"set test.role='service_role';select release_master_subscription_webhook('{event}','{tok}')")
 assert json.loads(sql(f"set test.role='service_role';select claim_master_subscription_webhook('{event}','184105194045','payment')").splitlines()[-1])['claimed']
print('PASS mismatched amount/reference/subscription reject atomically, safe retry')
# stale provider snapshots cannot revert paid status
for gst in ['pending','rejected','cancelled']:
 event=f'payment:184105194045:stale-{gst}';tok=json.loads(sql(f"set test.role='service_role';select claim_master_subscription_webhook('{event}','184105194045','payment')").splitlines()[-1])['token']
 apply(event,tok,{**payload,'status':gst})
assert sql(f"select status from master_subscription_payments where id='{P}'")=='paid'
assert sql('select count(*) from test_effects')=='1'
print('PASS stale events do not downgrade paid state')
assert sql("select has_table_privilege('anon','master_subscription_webhook_receipts','select')")=='f'
for role in ['anon','authenticated']:
 assert sql(f"select has_function_privilege('{role}','claim_master_subscription_webhook(text,text,text)','execute')")=='f'
 assert sql(f"select has_function_privilege('{role}','apply_master_subscription_webhook(text,uuid,text,jsonb)','execute')")=='f'
sql("set test.role='authenticated';"+q,False)
print('PASS claim table/RPCs service-role only')
# invoice-trigger failure cannot leave paid payment/plan nor complete dedup
S2='55555555-5555-4555-8555-555555555555';P2='66666666-6666-4666-8666-666666666666'
sql(f"insert into master_subscriptions(id,user_id,plan_id,billing_cycle,monthly_price,total_amount,status,gateway) values('{S2}','{A}','premium','monthly',49.97,49.97,'pending','mercadopago'); insert into master_subscription_payments(id,subscription_id,user_id,amount,gateway,payment_method,status) values('{P2}','{S2}','{A}',49.97,'mercadopago','credit_card','pending'); update invoices set invoice_id='inv_failure' where subscription_id='{S2}'; create function fail_invoice() returns trigger language plpgsql as $$begin raise exception 'synthetic failure';end$$; create trigger synthetic_fail before update on invoices for each row execute function fail_invoice();")
event='payment:999:failure';tok=json.loads(sql(f"set test.role='service_role';select claim_master_subscription_webhook('{event}','999','payment')").splitlines()[-1])['token']
apply(event,tok,{**payload,'id':'999','external_reference':'inv_failure','preapproval_id':None},False)
assert sql(f"select status from master_subscription_payments where id='{P2}'")=='pending'
assert sql(f"select status from master_subscriptions where id='{S2}'")=='pending'
assert sql(f"select state from master_subscription_webhook_receipts where event_key='{event}'")=='processing'
print('PASS swallowed legacy invoice trigger error: transaction rolls back payment and plan')
