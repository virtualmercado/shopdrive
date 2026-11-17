"""Order item positions (migration 0088) in a disposable LOCAL PostgreSQL cluster (never production).

Usage: python3 scripts/test-order-item-position-db.py
Runs the real order-creation/edit SQL from drizzle/migrations (0033, 0034, 0066, 0070-0072) on fictitious
fixtures, creates legacy orders BEFORE applying 0088 and checks they stay byte-identical afterwards.
"""
import json, os, shutil, subprocess, tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MIG = ROOT / 'drizzle/migrations'
PORT = 55461
env = {k: v for k, v in os.environ.items() if not k.startswith('PG')}
bins = sorted(Path('/nix/store').glob('*-postgresql-17*/bin/initdb'))
if bins:
    env['PATH'] = str(bins[0].parent) + ':' + env.get('PATH', '')
nobody = (lambda *c: subprocess.run(['runuser', '-u', 'nobody', '--', 'env', 'PATH=' + env['PATH'], *c], env=env, capture_output=True, text=True)) \
    if os.geteuid() == 0 else (lambda *c: subprocess.run(list(c), env=env, capture_output=True, text=True))

def mig(prefix):
    return next(MIG.glob(prefix + '_*.sql')).read_text().replace('--> statement-breakpoint', '')

FIXTURE = '''
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS; END IF; END $$;
CREATE SCHEMA auth; CREATE SCHEMA extensions; CREATE EXTENSION pgcrypto WITH SCHEMA extensions;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('test.uid',true),'')::uuid $$;
CREATE FUNCTION public.merchant_request_store_id() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('test.store',true),'')::uuid $$;
CREATE TABLE public.profiles(id uuid primary key);
CREATE TABLE public.products(id uuid primary key, user_id uuid, price numeric, promotional_price numeric, name text, is_active boolean, stock int, inventory_mode text default 'simple');
CREATE TABLE public.product_variants(id uuid primary key, store_id uuid, product_id uuid, sku text, stock_quantity int, snapshot jsonb);
CREATE TABLE public.payment_settings(user_id uuid, pix_discount_percent numeric);
CREATE TABLE public.coupons(user_id uuid, is_active boolean, discount_type text, discount_value numeric, min_order_value numeric);
CREATE TABLE public.orders(id uuid primary key default gen_random_uuid(), store_owner_id uuid not null, customer_id uuid, customer_name text not null, customer_email text,
  customer_phone text, customer_address text, delivery_method text, payment_method text, subtotal numeric, delivery_fee numeric default 0, total_amount numeric not null,
  status text not null default 'pending', payment_status text not null default 'pending', notes text, order_source text not null default 'store', checkout_origin text,
  is_guest_order boolean not null default false, card_payment_id text, pix_payment_id text, pix_payment_status text default 'pending', pix_qr_code text,
  pix_qr_code_base64 text, pix_expires_at timestamptz, order_number text, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
CREATE TABLE public.order_items(id uuid primary key default gen_random_uuid(), order_id uuid not null references public.orders(id), product_id uuid not null,
  product_name text not null, product_price numeric not null, quantity int not null, subtotal numeric not null, created_at timestamptz not null default now(),
  variations jsonb, variant_id uuid, variant_sku text);
CREATE TABLE public.order_stock_movements(id uuid primary key default gen_random_uuid(), store_id uuid, order_id uuid, order_item_id uuid, variant_id uuid,
  quantity int, kind text, reason text, unique(order_item_id, kind));
CREATE TABLE public.pix_payments(id uuid primary key default gen_random_uuid(), order_id uuid, store_owner_id uuid, gateway text, external_payment_id text, amount numeric,
  status text, qr_code text, qr_code_base64 text, expires_at timestamptz, updated_at timestamptz, paid_at timestamptz);
CREATE TABLE public.quotes(id uuid primary key, store_owner_id uuid, customer_id uuid, customer_name text, customer_email text, customer_phone text, delivery_address text,
  shipping_fee numeric, subtotal numeric, discount numeric, total numeric, notes text, status text, converted_order_id uuid, converted_at timestamptz);
CREATE TABLE public.quote_items(id uuid primary key default gen_random_uuid(), quote_id uuid, product_id uuid, name text, sku text, unit_price numeric, quantity int,
  line_total numeric, created_at timestamptz default now());
CREATE FUNCTION public.is_active_store(uuid) RETURNS boolean LANGUAGE sql AS $$ SELECT exists(select 1 from public.profiles where id=$1) $$;
CREATE FUNCTION public.has_role(uuid, text) RETURNS boolean LANGUAGE sql AS $$ SELECT false $$;
CREATE FUNCTION public.reserve_order_item_variant(p_store uuid, p_order uuid, p_product uuid, p_variant uuid, p_qty int, OUT o_sku text, OUT o_snapshot jsonb)
RETURNS record LANGUAGE plpgsql AS $$ BEGIN
  UPDATE public.product_variants SET stock_quantity = stock_quantity - p_qty WHERE id = p_variant AND product_id = p_product AND store_id = p_store AND stock_quantity >= p_qty
  RETURNING sku, snapshot INTO o_sku, o_snapshot;
  IF NOT FOUND THEN RAISE EXCEPTION 'Combinação indisponível'; END IF;
END $$;
'''

A = '11111111-1111-4111-8111-111111111111'; B = '22222222-2222-4222-8222-222222222222'; U = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'
P = {k: f'{i:08x}-aaaa-4aaa-8aaa-aaaaaaaaaaaa' for i, k in enumerate(['sabonete', 'oleo', 'cha', 'mel', 'outra'], start=1)}
V = {k: f'{i:08x}-bbbb-4bbb-8bbb-bbbbbbbbbbbb' for i, k in enumerate(['acai', 'buriti', 'breu'], start=1)}
SEED = f'''
INSERT INTO profiles VALUES ('{A}'),('{B}');
INSERT INTO products(id,user_id,price,name,is_active,stock,inventory_mode) VALUES
 ('{P['sabonete']}','{A}',12,'Sabonete',true,0,'variant'),('{P['oleo']}','{A}',30,'Óleo de Copaíba',true,100,'simple'),
 ('{P['cha']}','{A}',8,'Chá',true,100,'simple'),('{P['mel']}','{A}',20,'Mel',true,100,'simple'),('{P['outra']}','{B}',5,'Outra loja',true,100,'simple');
INSERT INTO product_variants VALUES
 ('{V['acai']}','{A}','{P['sabonete']}','SAB-ACAI',50,'{{"Aroma":"Açaí"}}'),('{V['buriti']}','{A}','{P['sabonete']}','SAB-BURITI',50,'{{"Aroma":"Buriti"}}'),
 ('{V['breu']}','{A}','{P['sabonete']}','SAB-BREU',50,'{{"Aroma":"Breu"}}');
'''

def item(key, qty=1, variant=None):
    d = {'product_id': P[key], 'quantity': qty}
    if variant: d['variant_id'] = V[variant]
    return d
# Mixed on purpose: Sabonete Açaí, Óleo, Sabonete Buriti, Chá, Sabonete Breu
MIXED = [item('sabonete', 1, 'acai'), item('oleo', 2), item('sabonete', 1, 'buriti'), item('cha', 3), item('sabonete', 2, 'breu')]
MIXED_TOTAL = 12 + 60 + 12 + 24 + 24

def manual_items(entries):
    prices = {'sabonete': 12, 'oleo': 30, 'cha': 8, 'mel': 20}
    out = []
    for e in entries:
        key, qty = e[0], e[1]
        d = {'product_id': P[key], 'product_name': key, 'product_price': prices[key], 'quantity': qty, 'subtotal': prices[key] * qty}
        if len(e) > 2 and e[2]: d['variant_id'] = V[e[2]]
        if len(e) > 3: d['item_position'] = e[3]
        out.append(d)
    return out

def main(sql):
    def q(query, ok=True, uid='', store=''):
        # 0034 bodies authorize by auth.uid(); live bodies by merchant_request_store_id(): set both to the store owner.
        pre = f"SET test.uid='{uid or store}'; SET test.store='{store}';"
        p = subprocess.run(['psql', '-X', '-h', '127.0.0.1', '-p', str(PORT), '-U', 'nobody', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-q', '-At', '-c', pre + query],
                           text=True, env=env, capture_output=True)
        if ok and p.returncode: raise AssertionError(p.stderr)
        if not ok: assert p.returncode != 0, 'expected rejection: ' + query
        lines = [l for l in p.stdout.strip().splitlines() if l != 'SET']
        return lines[-1] if lines else ''
    def payload(items, customer=None, method='cartao_credito', total=MIXED_TOTAL):
        return {'p_store_owner_id': A, 'p_customer_id': customer, 'p_customer_name': 'Cliente Fictício', 'p_customer_phone': '00000000000',
                'p_customer_email': 'fixture@example.invalid', 'p_payment_method': method, 'p_subtotal': total, 'p_delivery_fee': 0,
                'p_total_amount': total, 'p_items': items}
    def checkout_once(items, customer=None, method='cartao_credito'):
        cap = json.loads(q(f"SELECT begin_checkout_attempt('{A}',{f"'{customer}'" if customer else 'NULL'})", uid=customer or ''))
        body = json.dumps(payload(items, customer, method)).replace("'", "''")
        return json.loads(q(f"SELECT create_checkout_order_once('{cap['attemptId']}','{cap['guestPaymentToken']}','{body}'::jsonb)", uid=customer or ''))['id']
    def manual_order(items, store=A):
        oid = q(f"INSERT INTO orders(store_owner_id,customer_name,total_amount,subtotal,order_source,order_format_version,last_item_position) "
                f"VALUES ('{store}','Manual',0,0,'manual',1,99) RETURNING id", store=store) if positioned[0] else \
              q(f"INSERT INTO orders(store_owner_id,customer_name,total_amount,subtotal,order_source) VALUES ('{store}','Manual',0,0,'manual') RETURNING id", store=store)
        q(f"SELECT replace_manual_order_items('{oid}','{json.dumps(items)}'::jsonb)", store=store)
        return oid
    def rows(oid):
        return [r.split('|') for r in q(f"SELECT string_agg(concat_ws('|',coalesce(item_position::text,'-'),product_name,coalesce(variant_sku,''),quantity,trim_scale(subtotal)),';' ORDER BY item_position NULLS LAST, product_name, variant_sku) FROM order_items WHERE order_id='{oid}'").split(';')]
    def positions(oid):
        return q(f"SELECT string_agg(coalesce(item_position::text,'-'),',' ORDER BY item_position NULLS LAST) FROM order_items WHERE order_id='{oid}'")
    def version(oid):
        return q(f"SELECT coalesce(order_format_version::text,'legacy') FROM orders WHERE id='{oid}'")
    def snapshot():
        return q("SELECT md5(coalesce((SELECT string_agg(t::text, '' ORDER BY t::text) FROM (SELECT to_jsonb(o) - 'order_format_version' - 'last_item_position' t FROM orders o) x),'') || "
                 "coalesce((SELECT string_agg(t::text, '' ORDER BY t::text) FROM (SELECT to_jsonb(i) - 'item_position' t FROM order_items i) y),'') || "
                 "coalesce((SELECT string_agg(t::text, '' ORDER BY t::text) FROM (SELECT to_jsonb(m) - 'id' t FROM order_stock_movements m) z),'') || "
                 "(SELECT string_agg(id::text||stock, ',' ORDER BY id) FROM products) || (SELECT string_agg(id::text||stock_quantity, ',' ORDER BY id) FROM product_variants))")

    q(sql['base'])
    positioned = [False]
    # ---- Legacy orders created BEFORE the migration ----
    legacy_guest = checkout_once(MIXED)
    legacy_manual = manual_order(manual_items([('mel', 1), ('cha', 2)]), A)
    before = snapshot()
    q(sql['0088'])
    positioned[0] = True
    assert snapshot() == before, 'migration changed existing orders/items/stock'
    assert q("SELECT count(*) FROM orders WHERE order_format_version IS NOT NULL OR last_item_position IS NOT NULL") == '0'
    assert q("SELECT count(*) FROM order_items WHERE item_position IS NOT NULL") == '0'
    print('PASS legacy: migration updated no order, item or stock (positions/version stay empty)')
    q(f"UPDATE orders SET order_format_version=2, last_item_position=5, notes='x' WHERE id='{legacy_manual}'")
    q(f"SELECT update_manual_order('{legacy_manual}','{json.dumps({'customer_name':'Manual','notes':'editado','subtotal':56,'total_amount':56})}'::jsonb,'{json.dumps(manual_items([('mel', 1), ('cha', 2), ('oleo', 1)]))}'::jsonb)", store=A)
    assert version(legacy_manual) == 'legacy' and positions(legacy_manual) == '-,-,-'
    print('PASS legacy: forged version update ignored; editing a legacy order keeps it legacy (no positions)')

    # ---- New orders: every creation path ----
    guest = checkout_once(MIXED)
    expected = [['1', 'Sabonete', 'SAB-ACAI', '1', '12'], ['2', 'Óleo de Copaíba', '', '2', '60'], ['3', 'Sabonete', 'SAB-BURITI', '1', '12'],
                ['4', 'Chá', '', '3', '24'], ['5', 'Sabonete', 'SAB-BREU', '2', '24']]
    assert version(guest) == '2' and rows(guest) == expected, rows(guest)
    assert q(f"SELECT trim_scale(total_amount) FROM orders WHERE id='{guest}'") == str(MIXED_TOTAL)
    print('PASS guest checkout: version 2, positions 1..5 in cart order, prices/quantities/total unchanged')
    q(f"INSERT INTO profiles VALUES ('{U}')")
    auth = checkout_once(MIXED, customer=U)
    assert version(auth) == '2' and rows(auth) == expected
    print('PASS authenticated checkout: same deterministic positions')
    wa = checkout_once(MIXED, method='whatsapp')
    assert version(wa) == '2' and rows(wa) == expected and q(f"SELECT payment_status FROM orders WHERE id='{wa}'") == 'aguardando_combinar'
    print('PASS WhatsApp-finalized order: same deterministic positions')
    direct = json.loads(q(f"SELECT create_checkout_order(p_store_owner_id=>'{A}',p_customer_name=>'Direto',p_customer_phone=>'00000000000',p_payment_method=>'pix',p_subtotal=>{MIXED_TOTAL},p_total_amount=>{MIXED_TOTAL},p_items=>'{json.dumps(MIXED)}'::jsonb)"))['id']
    assert version(direct) == '2' and rows(direct) == expected
    print('PASS direct checkout RPC: same deterministic positions')
    manual = manual_order(manual_items([('sabonete', 1, 'acai', 77), ('oleo', 2), ('sabonete', 1, 'buriti'), ('cha', 3), ('sabonete', 2, 'breu')]))
    assert version(manual) == '2' and q(f"SELECT last_item_position FROM orders WHERE id='{manual}'") == '5'
    assert [r[0] for r in rows(manual)] == ['1', '2', '3', '4', '5']
    print('PASS manual order: forced version 2 (client values ignored), forged position ignored, positions 1..5')
    qid = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
    q(f"INSERT INTO quotes VALUES ('{qid}','{A}',NULL,'Orçamento','','0','',0,28,0,28,'','draft',NULL,NULL);"
      f"INSERT INTO quote_items(quote_id,product_id,name,unit_price,quantity,line_total) VALUES ('{qid}','{P['mel']}','Mel',20,1,20),('{qid}','{P['cha']}','Chá',8,1,8)")
    conv = json.loads(q(f"SELECT convert_quote_to_order('{qid}','pix')", store=A))['id']
    assert version(conv) == '2' and positions(conv) == '1,2'
    print('PASS quote conversion: version 2 with positions 1..2')

    # ---- Edit stability on a version-2 order ----
    stock_before = q(f"SELECT stock FROM products WHERE id='{P['oleo']}'")
    buriti_before = int(q(f"SELECT stock_quantity FROM product_variants WHERE id='{V['buriti']}'"))
    edit1 = manual_items([('sabonete', 1, 'acai', 1), ('oleo', 5, None, 2), ('cha', 3, None, 4), ('sabonete', 2, 'breu', 5), ('mel', 1)])  # remove pos 3, add Mel
    q(f"SELECT replace_manual_order_items('{manual}','{json.dumps(edit1)}'::jsonb)", store=A)
    assert positions(manual) == '1,2,4,5,6', positions(manual)
    assert q(f"SELECT quantity FROM order_items WHERE order_id='{manual}' AND item_position=2") == '5'
    assert int(q(f"SELECT stock FROM products WHERE id='{P['oleo']}'")) == int(stock_before) - 3
    assert q(f"SELECT stock_quantity FROM product_variants WHERE id='{V['buriti']}'") == str(buriti_before + 1)  # removed line returned once
    print('PASS edit: quantity change keeps position 2, removed 3 not renumbered, new item gets 6; stock moves as before')
    edit2 = manual_items([('sabonete', 1, 'acai', 1), ('oleo', 5, None, 2), ('cha', 3, None, 4), ('sabonete', 2, 'breu', 5), ('cha', 1, None, 3), ('mel', 1, None, 5), ('mel', 1, None, 999)])
    q(f"SELECT replace_manual_order_items('{manual}','{json.dumps(edit2)}'::jsonb)", store=A)
    assert positions(manual) == '1,2,4,5,7,8,9', positions(manual)
    print('PASS edit: removed position 6 and forged/duplicate positions (3, 5, 999) are never reused; they get 7, 8, 9')
    q(f"UPDATE orders SET order_format_version=NULL, last_item_position=0 WHERE id='{manual}'")
    assert version(manual) == '2' and q(f"SELECT last_item_position FROM orders WHERE id='{manual}'") == '9'
    print('PASS version and position counter cannot be reset by an order update')

    # ---- Isolation ----
    q(f"SELECT replace_manual_order_items('{manual}','{json.dumps(edit1)}'::jsonb)", ok=False, store=B)
    q(f"SELECT update_manual_order('{manual}','{{}}'::jsonb,'{json.dumps(edit1)}'::jsonb)", ok=False, store=B)
    assert positions(manual) == '1,2,4,5,7,8,9'
    print('PASS isolation: another store cannot edit or renumber this order')

    # ---- Cancellation still returns stock once ----
    s_before = q(f"SELECT stock FROM products WHERE id='{P['cha']}'")
    q(f"UPDATE orders SET status='cancelled' WHERE id='{direct}'"); q(f"UPDATE orders SET status='cancelled' WHERE id='{direct}'")
    assert int(q(f"SELECT stock FROM products WHERE id='{P['cha']}'")) == int(s_before) + 3
    assert positions(direct) == '1,2,3,4,5'
    print('PASS cancellation returns stock once and leaves positions intact')

def run():
    sql = {'base': FIXTURE + mig('0033') + mig('0034') +
           '\nCREATE TRIGGER validate_order_item_trigger BEFORE INSERT ON public.order_items FOR EACH ROW EXECUTE FUNCTION public.validate_order_item();\n'
           'CREATE TRIGGER stock_restore AFTER UPDATE OF status, payment_status ON public.orders FOR EACH ROW EXECUTE FUNCTION public.trg_orders_restore_variant_stock();\n' +
           mig('0066') + mig('0070') + mig('0071') + mig('0072') + SEED,
           '0088': mig('0088')}
    data = tempfile.mkdtemp(prefix='pgo-')
    if os.geteuid() == 0: shutil.chown(data, 'nobody')
    try:
        r = nobody('initdb', '-D', data, '-U', 'nobody', '--auth=trust'); assert r.returncode == 0, r.stderr
        r = nobody('pg_ctl', '-D', data, '-l', f'{data}/log', '-w', '-o', f'-p {PORT} -k /tmp -c listen_addresses=127.0.0.1', 'start'); assert r.returncode == 0, r.stderr
        main(sql)
    finally:
        nobody('pg_ctl', '-D', data, '-m', 'immediate', 'stop')
        shutil.rmtree(data, ignore_errors=True)

if __name__ == '__main__':
    run()
