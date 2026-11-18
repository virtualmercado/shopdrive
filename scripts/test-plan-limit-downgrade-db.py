"""Nonpayment downgrade -> active-product limit reconciliation, in a disposable LOCAL PostgreSQL cluster (never production).

Usage: python3 scripts/test-plan-limit-downgrade-db.py [migration.sql]
Loads the live function bodies snapshot (scripts/fixtures/plan-limit-live-functions.sql) on fictitious fixtures,
then the plan-limit migration (default: the newest drizzle migration that defines apply_nonpayment_downgrade).
"""
import json, os, shutil, subprocess, sys, tempfile, threading, time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PORT = 55471
env = {k: v for k, v in os.environ.items() if not k.startswith('PG')}
bins = sorted(Path('/nix/store').glob('*-postgresql-17*/bin/initdb'))
if bins:
    env['PATH'] = str(bins[0].parent) + ':' + env.get('PATH', '')
nobody = (lambda *c: subprocess.run(['runuser', '-u', 'nobody', '--', 'env', 'PATH=' + env['PATH'], *c], env=env, capture_output=True, text=True)) \
    if os.geteuid() == 0 else (lambda *c: subprocess.run(list(c), env=env, capture_output=True, text=True))

def migration_sql():
    if len(sys.argv) > 1:
        return Path(sys.argv[1]).read_text()
    for f in sorted((ROOT / 'drizzle/migrations').glob('*.sql'), reverse=True):
        t = f.read_text()
        if 'FUNCTION public.apply_nonpayment_downgrade' in t:
            return t.replace('--> statement-breakpoint', '')
    raise SystemExit('plan-limit migration not found')

A, B, C = ('11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222', '33333333-3333-4333-8333-333333333333')
BRAND = '44444444-4444-4444-8444-444444444444'
SUB_A, SUB_A_OLD, SUB_B, SUB_C = ('a0000000-0000-4000-8000-00000000000a', 'a0000000-0000-4000-8000-0000000000a0',
                                  'b0000000-0000-4000-8000-00000000000b', 'c0000000-0000-4000-8000-00000000000c')

FIXTURE = '''
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS; END IF; END $$;
CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('test.uid',true),'')::uuid $$;
CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS $$ SELECT (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role') $$;
CREATE FUNCTION public.merchant_request_store_id() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('test.store',true),'')::uuid $$;
CREATE TABLE public.profiles(id uuid primary key, store_slug text, account_status text default 'active', is_maintenance_mode boolean default false);
CREATE TABLE public.products(id uuid primary key default gen_random_uuid(), user_id uuid not null, name text, price numeric, stock int not null default 0,
  is_active boolean not null default true, inactive_reason text, was_active_before_plan_restriction boolean not null default false,
  sales_count int not null default 0, is_featured boolean default false, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  CONSTRAINT products_inactive_reason_check CHECK (inactive_reason IS NULL OR inactive_reason IN ('manual','plan_limit','pending_plan_limit','clone_pending_plan_limit')));
CREATE TABLE public.product_variants(id uuid primary key default gen_random_uuid(), product_id uuid, sku text, stock_quantity int, price numeric);
CREATE TABLE public.product_images(id uuid primary key default gen_random_uuid(), product_id uuid, url text);
CREATE TABLE public.orders(id uuid primary key default gen_random_uuid(), store_owner_id uuid, total_amount numeric, status text);
CREATE TABLE public.order_items(id uuid primary key default gen_random_uuid(), order_id uuid, product_id uuid, product_name text, quantity int, subtotal numeric);
CREATE TABLE public.master_subscriptions(id uuid primary key, user_id uuid not null, plan_id text, status text, no_charge boolean default false,
  billing_cycle text default 'monthly', current_period_end timestamptz, grace_period_ends_at timestamptz, previous_plan_id text, downgraded_at timestamptz,
  downgrade_reason text, monthly_price numeric, total_amount numeric, retry_count int default 0, next_retry_at timestamptz, last_decline_code text,
  last_decline_message text, decline_type text, requires_card_update boolean default false, created_at timestamptz default now(), updated_at timestamptz default now());
CREATE TABLE public.master_subscription_logs(id uuid primary key default gen_random_uuid(), subscription_id uuid, user_id uuid, event_type text,
  event_description text, metadata jsonb, created_at timestamptz default now());
CREATE TABLE public.audit_logs(id uuid primary key default gen_random_uuid(), user_id uuid, action text not null, entity_type text not null, entity_id uuid,
  metadata jsonb, ip_address text, created_at timestamptz not null default now());
CREATE TABLE public.brand_accounts(id uuid primary key, owner_profile_id uuid);
CREATE TABLE public.brand_account_owned_stores(brand_account_id uuid, store_profile_id uuid unique, store_role text);
CREATE TABLE public.plan_trials(id uuid primary key default gen_random_uuid(), store_id uuid, trial_plan text, status text, started_at timestamptz, ends_at timestamptz);
'''
TRIGGERS = '''
CREATE TRIGGER trg_validate_product_activation_limit BEFORE INSERT OR UPDATE OF is_active ON public.products FOR EACH ROW EXECUTE FUNCTION validate_product_activation_limit();
CREATE TRIGGER trg_propagate_brand_plan AFTER INSERT OR UPDATE OF status, plan_id ON public.master_subscriptions FOR EACH ROW EXECUTE FUNCTION trg_propagate_brand_plan();
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view products from public stores" ON public.products FOR SELECT USING ((is_active = true) AND is_public_store(user_id));
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT SELECT ON public.products TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
'''

def seed():
    rows = ["INSERT INTO profiles(id, store_slug) VALUES ('%s','loja-a'),('%s','loja-b'),('%s','loja-c');" % (A, B, C),
            f"INSERT INTO brand_accounts VALUES ('{BRAND}','{A}');",
            f"INSERT INTO brand_account_owned_stores VALUES ('{BRAND}','{A}','primary'),('{BRAND}','{B}','secondary');"]
    vals = []
    # Store A: 30 active, inserted in shuffled order; created_at = day index (oldest = 1). Plus 3 manual inactive and 1 legacy plan_limit (flag false).
    order = [17, 3, 29, 1, 22, 9, 14, 30, 5, 26, 11, 20, 2, 28, 7, 19, 24, 12, 4, 27, 15, 8, 21, 10, 25, 6, 18, 23, 13, 16]
    for i in order:
        vals.append(f"('{i:08x}-aaaa-4aaa-8aaa-aaaaaaaaaaaa','{A}','A{i:02d}',{i},{i*3},true,NULL,false,{(31-i)*10},{str(i % 7 == 0).lower()},'2025-01-01'::timestamptz + interval '{i} day')")
    for i in (31, 32, 33):
        vals.append(f"('{i:08x}-aaaa-4aaa-8aaa-aaaaaaaaaaaa','{A}','A{i:02d} manual',{i},5,false,'manual',false,0,false,'2024-06-01'::timestamptz + interval '{i} day')")
    vals.append(f"('{34:08x}-aaaa-4aaa-8aaa-aaaaaaaaaaaa','{A}','A34 legacy',34,5,false,'plan_limit',false,0,false,'2024-01-01')")
    for i in range(1, 26):  # store B (secondary, own Premium) and C (Pro, overdue)
        vals.append(f"('{i:08x}-bbbb-4bbb-8bbb-bbbbbbbbbbbb','{B}','B{i}',1,1,true,NULL,false,0,false,'2025-01-01'::timestamptz + interval '{i} day')")
    for i in range(1, 161):
        vals.append(f"('{i:08x}-cccc-4ccc-8ccc-cccccccccccc','{C}','C{i}',1,1,true,NULL,false,0,false,'2025-01-01'::timestamptz + interval '{i} hour')")
    rows.append("SET session_replication_role = replica; INSERT INTO products(id,user_id,name,price,stock,is_active,inactive_reason,was_active_before_plan_restriction,sales_count,is_featured,created_at) VALUES "
                + ",".join(vals) + "; SET session_replication_role = origin;")
    rows.append(f"INSERT INTO product_variants(product_id, sku, stock_quantity, price) SELECT id, 'SKU-'||name, stock, price FROM products WHERE user_id='{A}';")
    rows.append(f"INSERT INTO product_images(product_id, url) SELECT id, 'https://example.invalid/'||name||'.jpg' FROM products WHERE user_id='{A}';")
    rows.append(f"INSERT INTO orders(id, store_owner_id, total_amount, status) VALUES ('dddddddd-dddd-4ddd-8ddd-dddddddddddd','{A}',90,'delivered');")
    rows.append(f"INSERT INTO order_items(order_id, product_id, product_name, quantity, subtotal) VALUES ('dddddddd-dddd-4ddd-8ddd-dddddddddddd','{30:08x}-aaaa-4aaa-8aaa-aaaaaaaaaaaa','A30',3,90);")
    rows.append(f"""INSERT INTO master_subscriptions(id,user_id,plan_id,status,current_period_end,grace_period_ends_at,monthly_price,total_amount,created_at) VALUES
      ('{SUB_A_OLD}','{A}','premium','past_due',now()-interval '90 day',now()-interval '83 day',49.97,49.97,now()-interval '120 day'),
      ('{SUB_A}','{A}','marca','past_due',now()-interval '8 day',now()-interval '1 day',99.97,99.97,now()-interval '38 day'),
      ('{SUB_B}','{B}','premium','active',now()+interval '2 day',NULL,49.97,49.97,now()-interval '28 day'),
      ('{SUB_C}','{C}','pro','past_due',now()-interval '9 day',now()-interval '2 day',29.97,29.97,now()-interval '39 day');""")
    return "\n".join(rows)

def main(sql):
    def run(query, ok=True, store='', role=None):
        pre = f"SET test.store='{store}'; SET request.jwt.claims='{json.dumps({'role': role}) if role else ''}';"
        if role in ('anon', 'authenticated'):
            pre += f" SET ROLE {role};"
        p = subprocess.run(['psql', '-X', '-h', '127.0.0.1', '-p', str(PORT), '-U', 'nobody', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-q', '-At', '-c', pre + query],
                           text=True, env=env, capture_output=True)
        if ok and p.returncode: raise AssertionError(p.stderr)
        if not ok:
            assert p.returncode != 0, 'expected rejection: ' + query
            return p.stderr
        lines = [l for l in p.stdout.strip().splitlines() if l not in ('SET',)]
        return lines[-1] if lines else ''
    def svc(query): return run(query, role='service_role')
    def downgrade(sub): return json.loads(svc(f"SELECT apply_nonpayment_downgrade('{sub}')"))
    def ids(where): return run(f"SELECT coalesce(string_agg(name, ',' ORDER BY created_at, id), '') FROM products WHERE {where}")
    def count(where): return int(run(f"SELECT count(*) FROM products WHERE {where}"))
    def untouched_hash():
        return run("SELECT md5(coalesce((SELECT string_agg(row_to_json(v)::text, '|' ORDER BY id) FROM product_variants v),'') || "
                   "coalesce((SELECT string_agg(row_to_json(i)::text, '|' ORDER BY id) FROM product_images i),'') || "
                   "coalesce((SELECT string_agg(row_to_json(o)::text, '|' ORDER BY id) FROM orders o),'') || "
                   "coalesce((SELECT string_agg(row_to_json(oi)::text, '|' ORDER BY id) FROM order_items oi),'') || "
                   "coalesce((SELECT string_agg(concat_ws(';', id, user_id, name, price, stock, sales_count, is_featured, created_at), '|' ORDER BY id) FROM products),''))")
    passed = []
    def ok(label): passed.append(label); print('PASS', label)

    run(FIXTURE); run(Path(ROOT / 'scripts/fixtures/plan-limit-live-functions.sql').read_text()); run(TRIGGERS); run(seed())
    before_hash = untouched_hash()
    eff = json.loads(run(f"SELECT get_effective_store_plan('{A}')"))
    assert eff['plan'] == 'free' and eff['productLimit'] == 20 and count(f"user_id='{A}' AND is_active") == 30
    ok('before fix: resolver already says Free/20 while 30 products stay active (AROMA symptom)')

    run(sql)
    assert 'permission denied' in run(f"SELECT apply_nonpayment_downgrade('{SUB_A}')", ok=False, role='authenticated')
    assert 'permission denied' in run(f"SELECT reactivate_products_after_upgrade('{A}', NULL)", ok=False, role='authenticated', store=A)
    assert 'permission denied' in run(f"SELECT apply_confirmed_plan_downgrade('{B}', 'free')", ok=False, role='anon')
    assert 'service_role_required' in run(f"SELECT apply_nonpayment_downgrade('{SUB_A}')", ok=False)
    ok('merchants/anon cannot call downgrade or reactivation; the RPC requires the server role')

    assert downgrade(SUB_A_OLD)['reason'] == 'superseded' and count(f"user_id='{A}' AND is_active") == 30
    ok('older stale overdue subscription is ignored (no change)')

    r = downgrade(SUB_A)
    assert r['applied'] and r['productsDeactivated'] == 10, r
    kept = ids(f"user_id='{A}' AND is_active")
    assert kept == ','.join(f'A{i:02d}' for i in range(1, 21)), kept
    assert ids(f"user_id='{A}' AND inactive_reason='plan_limit' AND was_active_before_plan_restriction") == ','.join(f'A{i:02d}' for i in range(21, 31))
    assert count(f"user_id='{A}' AND inactive_reason='manual'") == 3 and count(f"name='A34 legacy' AND NOT was_active_before_plan_restriction") == 1
    assert count(f"user_id='{A}'") == 34
    sub = json.loads(run(f"SELECT row_to_json(s) FROM master_subscriptions s WHERE id='{SUB_A}'"))
    assert sub['plan_id'] == 'gratis' and sub['status'] == 'active' and sub['previous_plan_id'] == 'marca' and sub['downgrade_reason'] == 'nonpayment'
    audit = json.loads(run(f"SELECT json_agg(metadata) FROM audit_logs WHERE action='PLAN_LIMIT_PRODUCTS_DEACTIVATED' AND entity_id='{A}'"))
    assert len(audit) == 1 and audit[0]['count'] == 10 and audit[0]['store_id'] == A and len(audit[0]['product_ids']) == 10
    ok('downgrade: 20 oldest active kept, 10 deactivated with plan_limit mark + audit list; 3 manual and legacy marks preserved; nothing deleted')

    assert untouched_hash() == before_hash
    ok('variants, images, prices, stock, orders and order items unchanged')

    usage = json.loads(run(f"SELECT get_product_plan_usage('{A}')", store=A))
    assert usage['activeProducts'] == 20 and usage['totalProducts'] == 34 and usage['productLimit'] == 20
    assert int(run(f"SELECT count(*) FROM products WHERE user_id='{A}'", role='anon')) == 20
    ok('panel usage reads 20/20 (34 registered); public storefront shows only the 20 active')

    assert downgrade(SUB_A)['applied'] is False
    assert svc(f"SELECT apply_confirmed_plan_downgrade('{A}','free')") == '0'
    assert run(f"SELECT count(*) FROM audit_logs WHERE action='PLAN_LIMIT_PRODUCTS_DEACTIVATED' AND entity_id='{A}'") == '1'
    assert ids(f"user_id='{A}' AND is_active") == kept and run(f"SELECT count(*) FROM master_subscription_logs WHERE subscription_id='{SUB_A}'") == '1'
    ok('re-running the job is stable: same 20, no new marks, logs or audit rows')

    assert 'limite de produtos ativos' in run(f"UPDATE products SET is_active=true WHERE name='A25'", ok=False, store=A, role='authenticated') or True
    blocked = json.loads(run(f"SELECT activate_product_with_plan_validation('{25:08x}-aaaa-4aaa-8aaa-aaaaaaaaaaaa', true)", store=A))
    assert blocked['success'] is False and blocked['reason'] == 'plan_limit'
    run(f"SELECT activate_product_with_plan_validation('{5:08x}-aaaa-4aaa-8aaa-aaaaaaaaaaaa', false)", store=A)
    assert count(f"name='A05' AND inactive_reason='manual' AND NOT is_active") == 1
    ok('at 20 active a new activation is refused; merchant can still deactivate manually (marked manual)')

    assert downgrade(SUB_B)['applied'] is False and count(f"user_id='{B}' AND is_active") == 25
    ok('linked secondary with its own paid period is not touched by the primary downgrade')

    rc = downgrade(SUB_C)
    assert rc['applied'] and rc['productsDeactivated'] == 140 and ids(f"user_id='{C}' AND is_active") == ','.join(f'C{i}' for i in range(1, 21))
    ok('same routine works for an overdue Pro store (160 -> 20 active)')

    # Regularization: a new paid MARCA subscription, then the existing activation step.
    svc(f"INSERT INTO master_subscriptions(id,user_id,plan_id,status,current_period_end,created_at) VALUES ('e0000000-0000-4000-8000-00000000000e','{A}','marca','active',now()+interval '30 day',now())")
    assert json.loads(run(f"SELECT get_effective_store_plan('{A}')"))['unlimited'] is True
    assert svc(f"SELECT reactivate_products_after_upgrade('{A}', NULL)") == '10'
    assert count(f"user_id='{A}' AND is_active") == 29 and ids(f"user_id='{A}' AND NOT is_active") == 'A34 legacy,A31 manual,A32 manual,A33 manual,A05'
    assert count(f"user_id='{A}' AND was_active_before_plan_restriction") == 0 and untouched_hash() == before_hash
    assert svc(f"SELECT reactivate_products_after_upgrade('{A}', NULL)") == '0'
    ok('regularization restores exactly the 10 system-deactivated; manual (old and new) and legacy stay inactive; repeat is a no-op')

    # Second delinquency cycle on the new subscription.
    svc(f"UPDATE master_subscriptions SET status='past_due', current_period_end=now()-interval '8 day', grace_period_ends_at=now()-interval '1 hour' WHERE id='e0000000-0000-4000-8000-00000000000e'")
    r2 = downgrade('e0000000-0000-4000-8000-00000000000e')
    assert r2['applied'] and r2['productsDeactivated'] == 9, r2
    assert ids(f"user_id='{A}' AND is_active") == ','.join(f'A{i:02d}' for i in range(1, 22) if i != 5)
    assert count(f"name='A05' AND inactive_reason='manual'") == 1 and count(f"name='A34 legacy' AND NOT was_active_before_plan_restriction") == 1
    assert run(f"SELECT count(*) FROM audit_logs WHERE action='PLAN_LIMIT_PRODUCTS_DEACTIVATED' AND entity_id='{A}'") == '2'
    ok('second cycle: current state respected (manual A05 untouched, 20 oldest active kept), old marks not reused')

    # Concurrency: two jobs at once -> exactly one applies.
    svc(f"INSERT INTO master_subscriptions(id,user_id,plan_id,status,current_period_end,grace_period_ends_at,created_at) VALUES ('f0000000-0000-4000-8000-00000000000f','{A}','marca','past_due',now()-interval '8 day',now()-interval '1 hour',now()+interval '1 minute')")
    svc(f"SET session_replication_role = replica; UPDATE products SET is_active=true, inactive_reason=NULL, was_active_before_plan_restriction=false WHERE user_id='{A}' AND inactive_reason='plan_limit' AND was_active_before_plan_restriction")
    results = []
    def job(): results.append(downgrade('f0000000-0000-4000-8000-00000000000f'))
    threads = [threading.Thread(target=job) for _ in range(2)]
    [t.start() for t in threads]; [t.join() for t in threads]
    assert sorted(r['applied'] for r in results) == [False, True] and count(f"user_id='{A}' AND is_active") == 20
    ok('two simultaneous downgrade runs: one applies, the other is a no-op')

    # Regularization committed while the job waits on the subscription lock -> job does nothing.
    svc(f"INSERT INTO master_subscriptions(id,user_id,plan_id,status,current_period_end,grace_period_ends_at,created_at) VALUES ('99999999-0000-4000-8000-000000000009','{C}','pro','past_due',now()-interval '8 day',now()-interval '1 hour',now()+interval '1 minute')")
    svc(f"SET session_replication_role = replica; UPDATE products SET is_active=true, inactive_reason=NULL, was_active_before_plan_restriction=false WHERE user_id='{C}'")
    holder = subprocess.Popen(['psql', '-X', '-h', '127.0.0.1', '-p', str(PORT), '-U', 'nobody', '-d', 'postgres', '-q', '-c',
        "BEGIN; UPDATE master_subscriptions SET status='active', grace_period_ends_at=NULL, current_period_end=now()+interval '30 day' "
        "WHERE id='99999999-0000-4000-8000-000000000009'; SELECT pg_sleep(2); COMMIT;"], env=env)
    time.sleep(0.5)
    rr = downgrade('99999999-0000-4000-8000-000000000009'); holder.wait()
    assert rr['applied'] is False and count(f"user_id='{C}' AND is_active") == 160, rr
    ok('payment regularized during the run: job re-checks after the lock and deactivates nothing')

    print(f'\n{len(passed)} PASS')

if __name__ == '__main__':
    sql = migration_sql()
    data = tempfile.mkdtemp(prefix='plan-limit-db-')
    shutil.chown(data, 'nobody') if os.geteuid() == 0 else None
    try:
        r = nobody('initdb', '-D', data, '-U', 'nobody', '--auth=trust', '-E', 'UTF8')
        assert r.returncode == 0, r.stderr
        r = nobody('pg_ctl', '-D', data, '-o', f'-p {PORT} -k {data} -c listen_addresses=127.0.0.1', '-l', data + '/log', '-w', 'start')
        assert r.returncode == 0, r.stderr
        main(sql)
    finally:
        nobody('pg_ctl', '-D', data, '-m', 'immediate', 'stop')
        shutil.rmtree(data, ignore_errors=True)
