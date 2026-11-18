"""Regularization of a contracted, delinquent subscription in a disposable LOCAL PostgreSQL cluster (never production).

Usage: python3 scripts/test-subscription-regularization-db.py [migration.sql]
Loads the read-only live schema/function snapshot (scripts/fixtures/subscription-regularization-live.sql) on
fictitious fixtures, then the regularization migration. No provider, account, credential or charge is involved.
"""
import json, os, shutil, subprocess, sys, tempfile, concurrent.futures
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PORT = 55483
env = {k: v for k, v in os.environ.items() if not k.startswith('PG')}
bins = sorted(Path('/nix/store').glob('*-postgresql-17*/bin/initdb'))
if bins:
    env['PATH'] = str(bins[0].parent) + ':' + env.get('PATH', '')
nobody = (lambda *c: subprocess.run(['runuser', '-u', 'nobody', '--', 'env', 'PATH=' + env['PATH'], *c], env=env, capture_output=True, text=True)) \
    if os.geteuid() == 0 else (lambda *c: subprocess.run(list(c), env=env, capture_output=True, text=True))

def migration_sql():
    if len(sys.argv) > 1:
        return Path(sys.argv[1]).read_text()
    files = sorted((ROOT / 'drizzle/migrations').glob('*_subscription_regularization*.sql'))
    if not files:
        raise SystemExit('regularization migration not found')
    return '\n'.join(f.read_text().replace('--> statement-breakpoint', '') for f in files)

A, B, C, D = ('a1111111-1111-4111-8111-111111111111', 'b2222222-2222-4222-8222-222222222222',
              'c3333333-3333-4333-8333-333333333333', 'd4444444-4444-4444-8444-444444444444')
BA, ACC, SA, SD, UP = ('ba000000-0000-4000-8000-0000000000ba', 'acc00000-0000-4000-8000-000000000acc',
                       '5a000000-0000-4000-8000-00000000005a', '5d000000-0000-4000-8000-00000000005d',
                       'f0000000-0000-4000-8000-0000000000f0')

PRELUDE = '''
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS; END IF; END $$;
CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('test.uid',true),'')::uuid $$;
CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS $$ SELECT (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role') $$;
GRANT USAGE ON SCHEMA auth, public TO anon, authenticated, service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA auth TO anon, authenticated, service_role;
CREATE TABLE public.test_effects(name text, store uuid, at timestamptz default clock_timestamp());
CREATE FUNCTION public.is_plan_marca_enabled() RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT true $$;
CREATE FUNCTION public._marca_assert_owner_eligible(uuid) RETURNS void LANGUAGE sql AS $$ SELECT $$;
CREATE FUNCTION public.propagate_brand_plan_to_secondaries(p uuid) RETURNS integer LANGUAGE plpgsql AS $$ BEGIN INSERT INTO public.test_effects(name,store) VALUES('propagate',p); RETURN 1; END $$;
'''

FIXTURE = f'''
INSERT INTO profiles(id,store_name) VALUES('{A}','Marca Fictícia'),('{B}','Secundária Fictícia'),('{C}','Outra Loja'),('{D}','Pro Fictícia');
INSERT INTO master_plans(plan_id,display_name,monthly_price,annual_discount_percent,is_active) VALUES('pro','PRO',29.97,30,true),('premium','PREMIUM',49.97,30,true),('marca','MARCA',199.97,30,true);
INSERT INTO brand_accounts(id,owner_profile_id,display_name) VALUES('{BA}','{A}','Marca Fictícia');
INSERT INTO brand_account_owned_stores(brand_account_id,store_profile_id,store_role,slot) VALUES('{BA}','{A}','primary',1),('{BA}','{B}','secondary',2);
INSERT INTO plan_contract_acceptances(id,contract_version_id,plan_id_snapshot,brand_account_id,accepted_by_profile_id,accepted_by_profile_id_snapshot,billing_cycle,
  monthly_price_snapshot,annual_discount_percent_snapshot,contract_hash_snapshot,version_label_snapshot,brand_display_name_snapshot,acceptance_statement_snapshot,commercial_terms_hash)
  VALUES('{ACC}',gen_random_uuid(),'marca','{BA}','{A}','{A}','monthly',199.97,30,'h','1.0','Marca Fictícia','aceito','t');
INSERT INTO master_subscriptions(id,user_id,plan_id,previous_plan_id,downgrade_reason,downgraded_at,status,billing_cycle,payment_method,gateway,monthly_price,total_amount,
  current_period_start,current_period_end,contract_acceptance_id,brand_account_id,created_at)
  VALUES('{SA}','{A}','gratis','marca','nonpayment',now()-interval '1 hour','past_due','monthly','pix','mercadopago',0,0,now()-interval '38 day',now()-interval '8 day','{ACC}','{BA}',now()-interval '38 day'),
        ('{SD}','{D}','gratis','pro','nonpayment',now()-interval '1 hour','active','monthly','pix','mercadopago',0,0,now()-interval '40 day',now()-interval '10 day',NULL,NULL,now()-interval '40 day');
INSERT INTO marca_scheduled_upgrades(id,store_profile_id,brand_account_id,source_subscription_id,source_plan_id,source_billing_cycle,source_payment_method,
  target_billing_cycle,contract_acceptance_id,target_subscription_id,frozen_amount,status,effective_at,grace_until)
  VALUES('{UP}','{A}','{BA}','{SD}','premium','monthly','pix','monthly','{ACC}','{SA}',199.97,'activated',now()-interval '38 day',now()-interval '30 day');
INSERT INTO invoices(subscriber_id,subscription_id,amount,status,due_date,paid_at,reference_period_start,reference_period_end,plan,invoice_id,mp_payment_id)
  VALUES('{A}','{SA}',199.97,'paid',now()-interval '38 day',now()-interval '38 day',(now()-interval '38 day')::date,(now()-interval '8 day')::date,'marca','inv_00030','historical-1');
INSERT INTO master_subscription_payments(subscription_id,user_id,amount,gateway,payment_method,status,gateway_payment_id,paid_at,gateway_response)
  VALUES('{SA}','{A}',199.97,'mercadopago','pix','paid','historical-1',now()-interval '38 day','{{"transaction_amount":199.97,"currency_id":"BRL","external_reference":"inv_00030"}}');
INSERT INTO products(user_id,name,price,stock,is_active,inactive_reason,was_active_before_plan_restriction,created_at)
  SELECT '{A}','ativo '||g,10,1,true,NULL,false,now()-(g||' day')::interval FROM generate_series(1,20) g;
INSERT INTO products(user_id,name,price,stock,is_active,inactive_reason,was_active_before_plan_restriction,created_at)
  SELECT '{A}','limitado '||g,10,1,false,'plan_limit',true,now()-(g||' hour')::interval FROM generate_series(1,5) g;
INSERT INTO products(user_id,name,price,stock,is_active,inactive_reason,was_active_before_plan_restriction)
  SELECT '{A}','manual '||g,10,1,false,'manual',false FROM generate_series(1,2) g;
INSERT INTO products(user_id,name,price,stock,is_active,inactive_reason,was_active_before_plan_restriction)
  SELECT '{D}','limitado pro '||g,10,1,false,'plan_limit',true FROM generate_series(1,3) g;
'''

def main(mig):
    def run(query, ok=True, uid='', role=None):
        pre = f"SET test.uid='{uid}'; SET request.jwt.claims='{json.dumps({'role': role}) if role else ''}';"
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
    svc = lambda q, ok=True: run(q, ok, role='service_role')
    js = lambda s: json.loads(s)
    passed = []
    def ok(name): passed.append(name); print('PASS', name)

    def prep(q):  # fixtures need columns that the snapshot may enforce as NOT NULL; fill defaults generically
        run(q)
    run(PRELUDE)
    run((ROOT / 'scripts/fixtures/subscription-regularization-live.sql').read_text())
    run(mig)
    run(FIXTURE)
    count = lambda t, w='true': int(run(f'SELECT count(*) FROM {t} WHERE {w}'))
    base_subs, base_acc, base_brand = count('master_subscriptions'), count('plan_contract_acceptances'), count('brand_accounts')
    sub = lambda s: js(run(f"SELECT row_to_json(x) FROM (SELECT plan_id,status,previous_plan_id,downgrade_reason,monthly_price,total_amount,billing_cycle,current_period_start,current_period_end FROM master_subscriptions WHERE id='{s}') x"))

    # Projection: contracted MARCA, pending payment, temporarily limited; never for secondary or strangers.
    # Value source: the subscription's own financial record, never the contract text nor the browser.
    run("UPDATE master_plans SET monthly_price=249.97 WHERE plan_id='marca'")
    t = js(svc(f"SELECT _subscription_regularization_terms('{A}')"))
    assert t['value_source'] == 'subscription_invoice' and float(t['amount']) == 199.97 and t['billing_cycle'] == 'monthly', t
    assert js(svc(f"SELECT _subscription_regularization_terms('{D}')"))['value_source'] == 'official_price'
    E = 'e5555555-5555-4555-8555-555555555555'
    run(f"""INSERT INTO master_subscriptions(user_id,plan_id,status,billing_cycle,payment_method,gateway,monthly_price,total_amount,current_period_end)
      VALUES('{E}','premium','past_due','monthly','pix','mercadopago',44.44,44.44,now()-interval '9 day'),
            ('{C}','premium','past_due','monthly','credit_card','mercadopago',49.97,49.97,now()-interval '9 day')""")
    t = js(svc(f"SELECT _subscription_regularization_terms('{E}')"))
    assert t['value_source'] == 'subscription' and float(t['amount']) == 44.44, t
    run(f"UPDATE master_subscriptions SET gateway_subscription_id='fixture-preapproval' WHERE user_id='{C}'")
    assert js(svc(f"SELECT _subscription_regularization_terms('{C}')"))['reason'] == 'recurring_charge'
    run(f"UPDATE master_subscriptions SET status='cancelled' WHERE user_id IN ('{C}','{E}')")
    ok('amount from subscription record (199.97 via its paid invoice even with official price 249.97); official price only as fallback; automatic recurrence excluded')
    base_subs = count('master_subscriptions')

    v = js(run('SELECT get_my_subscription_regularization()', uid=A, role='authenticated'))
    assert v['state'] == 'payable' and v['plan_id'] == 'marca' and float(v['amount']) == 199.97 and v['billing_cycle'] == 'monthly' and v['temporarily_limited'] is True, v
    assert js(run('SELECT get_my_subscription_regularization()', uid=B, role='authenticated'))['state'] == 'none'
    assert js(run('SELECT get_my_subscription_regularization()', uid=C, role='authenticated'))['state'] == 'none'
    assert js(run('SELECT get_my_marca_offer()', uid=A, role='authenticated'))['path'] == 'regularize'
    ok('contracted MARCA shown as payable regularization (199.97 monthly) for owner only; offer path is regularize, not new contract')

    for role in ('anon', 'authenticated'):
        for fn in ('begin_subscription_regularization(uuid)', 'record_subscription_regularization_charge(uuid,jsonb)', '_subscription_regularization_terms(uuid)',
                   'expire_subscription_regularization(uuid,text)', 'release_subscription_regularization_charge(uuid)'):
            assert run(f"SELECT has_function_privilege('{role}','public.{fn}','execute')") == 'f', (role, fn)
        assert run(f"SELECT has_table_privilege('{role}','public.master_subscription_regularizations','select')") == 'f'
    assert run("SELECT has_function_privilege('anon','public.get_my_subscription_regularization()','execute')") == 'f'
    run(f"SELECT begin_subscription_regularization('{A}')", ok=False, uid=A, role='authenticated')
    ok('charge RPCs and ledger are service-only; browser cannot start, record or read charges directly')

    # Double click / two sessions: exactly one invoice and ledger row, others told to wait.
    with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:
        res = list(pool.map(lambda _: js(svc(f"SELECT begin_subscription_regularization('{A}')")), range(8)))
    charges = [r for r in res if r['status'] == 'charge']
    assert len(charges) == 1 and all(r['status'] in ('charge', 'busy') for r in res), res
    c1 = charges[0]
    assert float(c1['amount']) == 199.97 and c1['plan_id'] == 'marca' and c1['billing_cycle'] == 'monthly'
    assert count('master_subscription_regularizations') == 1 and count('invoices', f"subscription_id='{SA}'") == 2
    assert count('master_subscriptions') == base_subs and count('plan_contract_acceptances') == base_acc and count('brand_accounts') == base_brand
    s = sub(SA); assert s['plan_id'] == 'gratis' and s['status'] == 'past_due', s
    inv = js(run(f"SELECT row_to_json(i) FROM invoices i WHERE invoice_id='{c1['invoice_reference']}'"))
    assert inv['plan'] == 'marca' and inv['contract_acceptance_id'] == ACC and inv['brand_account_id'] == BA and inv['subscription_id'] == SA
    ok('8 concurrent starts: one invoice on the same subscription with the accepted contract; no new subscription, contract or company')

    assert js(svc(f"SELECT begin_subscription_regularization('{A}')"))['status'] == 'busy'
    svc(f"SELECT release_subscription_regularization_charge('{c1['regularization_id']}')")
    again = js(svc(f"SELECT begin_subscription_regularization('{A}')"))
    assert again['status'] == 'charge' and again['idempotency_key'] == c1['idempotency_key'] and again['invoice_reference'] == c1['invoice_reference']
    assert count('invoices', f"subscription_id='{SA}'") == 2
    ok('provider retry after a lost response reuses the same invoice reference and idempotency key')

    res_pending = {'id': 'pix-fixture-1', 'status': 'pending', 'transaction_amount': 199.97, 'currency_id': 'BRL', 'external_reference': c1['invoice_reference'],
                   'pix_qr_code': 'fixture-qr-1', 'pix_qr_code_base64': 'Zml4dHVyZQ=='}
    rec = lambda rid, r, okk=True: svc(f"SELECT record_subscription_regularization_charge('{rid}','{json.dumps(r)}')", okk)
    r1 = js(rec(c1['regularization_id'], res_pending)); r2 = js(rec(c1['regularization_id'], res_pending))
    assert r1['pix_qr_code'] == r2['pix_qr_code'] == 'fixture-qr-1' and count('master_subscription_payments', "gateway_payment_id='pix-fixture-1'") == 1
    rec(c1['regularization_id'], {**res_pending, 'id': 'pix-other'}, False)
    rec(c1['regularization_id'], {**res_pending, 'transaction_amount': 1.0}, False)
    rec(c1['regularization_id'], {**res_pending, 'external_reference': 'inv_00030'}, False)
    op = js(svc(f"SELECT begin_subscription_regularization('{A}')"))
    assert op['status'] == 'open' and op['pix_qr_code'] == 'fixture-qr-1'
    assert js(run('SELECT get_my_subscription_regularization()', uid=A, role='authenticated'))['open']['pix_qr_code'] == 'fixture-qr-1'
    ok('PIX recorded once; replays idempotent; other provider id, amount or reference rejected; reopening returns the same QR')

    def notify(pid, status, ref, key, amount=199.97, okk=True):
        claim = js(svc(f"SELECT claim_master_subscription_webhook('{key}','{pid}','payment')"))
        if not claim.get('claimed'): return claim
        resource = {'id': pid, 'status': status, 'transaction_amount': amount, 'currency_id': 'BRL', 'external_reference': ref, 'preapproval_id': None,
                    'next_payment_date': None, 'payment_method_id': 'pix', 'hard_decline': False, 'user_message': 'x', 'status_detail': status}
        if status == 'approved': resource['date_approved'] = '2026-11-19T12:00:00+00:00'
        out = svc(f"SELECT apply_master_subscription_webhook('{key}','{claim['token']}','payment','{json.dumps(resource)}')", okk)
        if not okk: svc(f"SELECT release_master_subscription_webhook('{key}','{claim['token']}')")
        return out
    products_active = lambda u: count('products', f"user_id='{u}' AND is_active")

    notify('pix-fixture-1', 'pending', c1['invoice_reference'], 'payment:pix-fixture-1:pending')
    s = sub(SA); assert s['plan_id'] == 'gratis' and s['status'] == 'past_due' and products_active(A) == 20
    ok('pending payment keeps Free effective plan, subscription and 20 active products')

    notify('pix-fixture-1', 'cancelled', c1['invoice_reference'], 'payment:pix-fixture-1:cancelled')
    s = sub(SA); assert s['plan_id'] == 'gratis' and s['status'] == 'past_due' and products_active(A) == 20, s
    assert run(f"SELECT status FROM master_subscription_regularizations WHERE id='{c1['regularization_id']}'") == 'cancelled'
    assert run(f"SELECT status FROM invoices WHERE invoice_id='{c1['invoice_reference']}'") == 'cancelled'
    ok('expired/cancelled PIX closes only the charge; contracted subscription is not cancelled nor re-graced')

    # Direct reactivation without a confirmed regularization stays blocked by the completed-upgrade guard.
    svc(f"UPDATE master_subscriptions SET status='active', plan_id='marca' WHERE id='{SA}'")
    s = sub(SA); assert s['status'] == 'past_due' and s['plan_id'] == 'gratis', s
    ok('historical activated upgrade or old payment never reactivates MARCA by itself')

    c2 = js(svc(f"SELECT begin_subscription_regularization('{A}')"))
    assert c2['status'] == 'charge' and c2['invoice_reference'] != c1['invoice_reference']
    rec(c2['regularization_id'], {**res_pending, 'id': 'pix-fixture-2', 'external_reference': c2['invoice_reference'], 'pix_qr_code': 'fixture-qr-2'})
    with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
        list(pool.map(lambda k: notify('pix-fixture-2', 'approved', c2['invoice_reference'], f'payment:pix-fixture-2:evt-{k}'), range(6)))
    s = sub(SA)
    assert s['plan_id'] == 'marca' and s['status'] == 'active' and s['previous_plan_id'] is None and s['downgrade_reason'] is None, s
    assert float(s['monthly_price']) == 199.97 and float(s['total_amount']) == 199.97 and s['billing_cycle'] == 'monthly'
    assert s['current_period_start'].startswith('2026-11-19T12:00:00') and s['current_period_end'].startswith('2026-12-19T12:00:00'), s
    assert products_active(A) == 25 and count('products', f"user_id='{A}' AND inactive_reason='manual' AND NOT is_active") == 2
    assert count('master_subscription_webhook_applications') == 1 and count('test_effects', "name='propagate'") >= 1
    assert run(f"SELECT status FROM master_subscription_regularizations WHERE id='{c2['regularization_id']}'") == 'paid'
    assert run(f"SELECT status FROM invoices WHERE invoice_id='{c2['invoice_reference']}'") == 'paid'
    assert count('master_subscriptions') == base_subs and count('plan_contract_acceptances') == base_acc and count('brand_accounts') == base_brand
    assert run(f"SELECT status FROM marca_scheduled_upgrades WHERE id='{UP}'") == 'activated'
    ok('approved PIX (6 concurrent deliveries): same subscription back to MARCA monthly 199.97, new period, 5 system-limited products back, 2 manual stay off, secondary propagation called once path')

    snap = run(f"SELECT md5(string_agg(row_to_json(x)::text,'|' ORDER BY id)) FROM (SELECT id,is_active,updated_at FROM products) x")
    snap_sub = sub(SA); logs = count('master_subscription_logs')
    notify('pix-fixture-2', 'approved', c2['invoice_reference'], 'payment:pix-fixture-2:late-duplicate')
    assert sub(SA) == snap_sub and run(f"SELECT md5(string_agg(row_to_json(x)::text,'|' ORDER BY id)) FROM (SELECT id,is_active,updated_at FROM products) x") == snap
    assert count('master_subscription_logs') == logs and count('master_subscription_webhook_applications') == 1
    v = js(run('SELECT get_my_subscription_regularization()', uid=A, role='authenticated'))
    assert v['state'] == 'none' and v['last']['status'] == 'paid'
    assert js(svc(f"SELECT begin_subscription_regularization('{A}')"))['status'] == 'not_eligible'
    ok('duplicate approval is a no-op; regularized account is no longer payable')

    # Pro downgraded store: rejected keeps Free; expiry closes; approval restores Pro with its 150 limit.
    d1 = js(svc(f"SELECT begin_subscription_regularization('{D}')"))
    assert d1['status'] == 'charge' and float(d1['amount']) == 29.97 and d1['plan_id'] == 'pro'
    rec(d1['regularization_id'], {**res_pending, 'id': 'pix-d-1', 'transaction_amount': 29.97, 'external_reference': d1['invoice_reference']})
    notify('pix-d-1', 'rejected', d1['invoice_reference'], 'payment:pix-d-1:rejected', 29.97)
    s = sub(SD); assert s['plan_id'] == 'gratis' and s['status'] == 'active' and products_active(D) == 0, s
    assert run(f"SELECT status FROM master_subscription_regularizations WHERE id='{d1['regularization_id']}'") == 'failed'
    d2 = js(svc(f"SELECT begin_subscription_regularization('{D}')"))
    rec(d2['regularization_id'], {**res_pending, 'id': 'pix-d-2', 'transaction_amount': 29.97, 'external_reference': d2['invoice_reference']})
    svc(f"UPDATE master_subscription_regularizations SET pix_expires_at=now()-interval '10 minutes' WHERE id='{d2['regularization_id']}'")
    assert js(svc(f"SELECT begin_subscription_regularization('{D}')"))['status'] == 'reconcile'
    svc(f"SELECT expire_subscription_regularization('{d2['regularization_id']}','approved')", False)
    assert js(svc(f"SELECT expire_subscription_regularization('{d2['regularization_id']}','pending')"))['status'] == 'expired'
    assert run(f"SELECT status FROM master_subscription_payments WHERE gateway_payment_id='pix-d-2'") == 'expired'
    s = sub(SD); assert s['plan_id'] == 'gratis' and products_active(D) == 0
    d3 = js(svc(f"SELECT begin_subscription_regularization('{D}')"))
    rec(d3['regularization_id'], {**res_pending, 'id': 'pix-d-3', 'transaction_amount': 29.97, 'external_reference': d3['invoice_reference']})
    notify('pix-d-3', 'approved', d3['invoice_reference'], 'payment:pix-d-3:approved', 29.97)
    s = sub(SD); assert s['plan_id'] == 'pro' and s['status'] == 'active' and products_active(D) == 3, s
    assert count('master_subscriptions', f"user_id='{D}'") == 1
    ok('Pro store: rejected and expired keep Free; approval restores the same Pro subscription and its products')

    # First purchase (no regularization row) keeps the existing reconciliation behaviour.
    SC = 'c5000000-0000-4000-8000-0000000000c5'
    run(f"""INSERT INTO master_subscriptions(id,user_id,plan_id,status,billing_cycle,payment_method,gateway,monthly_price,total_amount,current_period_start,current_period_end)
      VALUES('{SC}','{C}','premium','pending','monthly','pix','mercadopago',49.97,49.97,'2026-11-19','2026-12-19');
      INSERT INTO invoices(subscriber_id,subscription_id,amount,status,due_date,reference_period_start,reference_period_end,plan,invoice_id)
      VALUES('{C}','{SC}',49.97,'pending',now(),'2026-11-19','2026-12-19','premium','inv_first');
      INSERT INTO master_subscription_payments(subscription_id,user_id,amount,gateway,payment_method,status,gateway_payment_id)
      VALUES('{SC}','{C}',49.97,'mercadopago','pix','pending','pix-first')""")
    notify('pix-first', 'approved', 'inv_first', 'payment:pix-first:approved', 49.97)
    s = sub(SC); assert s['plan_id'] == 'premium' and s['status'] == 'active' and s['current_period_end'].startswith('2026-12-19') and float(s['monthly_price']) == 49.97, s
    assert js(run('SELECT get_my_subscription_regularization()', uid=C, role='authenticated'))['state'] == 'none'
    ok('first purchase without regularization: unchanged activation and period')

    print(f'\n{len(passed)} PASS')

if __name__ == '__main__':
    mig = migration_sql()
    data = tempfile.mkdtemp(prefix='regularization-db-')
    shutil.chown(data, 'nobody') if os.geteuid() == 0 else None
    try:
        r = nobody('initdb', '-D', data, '-U', 'nobody', '--auth=trust', '-E', 'UTF8')
        assert r.returncode == 0, r.stderr
        r = nobody('pg_ctl', '-D', data, '-o', f'-p {PORT} -k {data} -c listen_addresses=127.0.0.1', '-l', data + '/log', '-w', 'start')
        assert r.returncode == 0, r.stderr
        main(mig)
    finally:
        nobody('pg_ctl', '-D', data, '-m', 'immediate', 'stop')
        shutil.rmtree(data, ignore_errors=True)
