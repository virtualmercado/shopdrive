"""Execute actual checkout SQL in a disposable local PostgreSQL only (no hosted data)."""
import subprocess, concurrent.futures
from pathlib import Path
ROOT=Path(__file__).resolve().parent.parent
DSN='postgresql://nobody@localhost:55432/guest_checkout_test?sslmode=disable'
subprocess.run(['dropdb','--if-exists','--maintenance-db=postgresql://nobody@localhost:55432/postgres?sslmode=disable','guest_checkout_test'],check=True,capture_output=True)
subprocess.run(['createdb','--maintenance-db=postgresql://nobody@localhost:55432/postgres?sslmode=disable','guest_checkout_test'],check=True,capture_output=True)
def sql(query, ok=True):
 p=subprocess.run(['psql',DSN,'-X','-v','ON_ERROR_STOP=1','-At','-c',query],text=True,capture_output=True)
 if ok and p.returncode: raise AssertionError(p.stderr)
 if not ok: assert p.returncode!=0, 'Expected server rejection'
 return p.stdout.strip()
sql('''DO $$ BEGIN IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS; END IF; END $$;
CREATE SCHEMA auth; CREATE SCHEMA extensions; CREATE EXTENSION pgcrypto WITH SCHEMA extensions;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT nullif(current_setting('test.uid',true),'')::uuid $$;
CREATE TABLE public.profiles(id uuid primary key);
CREATE TABLE public.products(id uuid primary key,user_id uuid,price numeric,promotional_price numeric,name text,is_active boolean,stock int,inventory_mode text default 'simple');
CREATE TABLE public.payment_settings(user_id uuid,pix_discount_percent numeric);
CREATE TABLE public.coupons(user_id uuid,is_active boolean,discount_type text,discount_value numeric,min_order_value numeric);
CREATE TABLE public.orders(id uuid primary key default gen_random_uuid(),store_owner_id uuid,customer_id uuid,customer_name text,customer_email text,customer_phone text,customer_address text,delivery_method text,payment_method text,subtotal numeric,delivery_fee numeric,total_amount numeric,status text,payment_status text,notes text,order_source text,checkout_origin text,is_guest_order boolean,card_payment_id text,pix_payment_id uuid,pix_payment_status text,pix_qr_code text,pix_qr_code_base64 text,pix_expires_at timestamptz,created_at timestamptz default now());
CREATE TABLE public.order_items(id uuid primary key default gen_random_uuid(),order_id uuid,product_id uuid,product_name text,product_price numeric,quantity int,subtotal numeric,variations jsonb,variant_id uuid,variant_sku text);
CREATE TABLE public.order_stock_movements(id uuid primary key default gen_random_uuid(),store_id uuid,order_id uuid,order_item_id uuid,variant_id uuid,product_id uuid,quantity int,kind text,reason text,unique(order_item_id,kind));
CREATE TABLE public.pix_payments(id uuid primary key default gen_random_uuid(),order_id uuid,store_owner_id uuid,gateway text,external_payment_id text,amount numeric,status text,qr_code text,qr_code_base64 text,expires_at timestamptz,updated_at timestamptz,paid_at timestamptz);
CREATE TABLE public.product_variants(id uuid,store_id uuid,stock_quantity int);
CREATE FUNCTION public.is_active_store(uuid) RETURNS boolean LANGUAGE sql AS $$ SELECT exists(select 1 from public.profiles where id=$1) $$;
CREATE FUNCTION public.has_role(uuid,text) RETURNS boolean LANGUAGE sql AS $$ SELECT false $$;
CREATE FUNCTION public.reserve_order_item_variant(uuid,uuid,uuid,uuid,int,OUT o_sku text,OUT o_snapshot jsonb) RETURNS record LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'unused'; END $$;''')
base=(ROOT/'drizzle/migrations/0033_unified_order_stock_reservation.sql').read_text()
sql(base[base.index('CREATE OR REPLACE FUNCTION public.reserve_order_item_stock'):base.index('-- Checkout:')])
sql((ROOT/'drizzle/migrations/0066_checkout_order_trusted_pricing.sql').read_text())
a=base.index('CREATE OR REPLACE FUNCTION public.trg_orders_restore_variant_stock');b=base.index('-- Deleting items/orders')
sql(base[a:b]);sql('CREATE TRIGGER stock_restore BEFORE UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.trg_orders_restore_variant_stock();')
sql((ROOT/'drizzle/migrations/0070_secure_checkout_attempts.sql').read_text());sql((ROOT/'drizzle/migrations/0071_checkout_capability_privileges.sql').read_text());sql((ROOT/'drizzle/migrations/0072_checkout_payment_recovery_guards.sql').read_text())
A='11111111-1111-4111-8111-111111111111';B='22222222-2222-4222-8222-222222222222';P='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';U='dddddddd-dddd-4ddd-8ddd-dddddddddddd'
sql(f"insert into profiles values ('{A}'),('{B}'); insert into products(id,user_id,price,name,is_active,stock) values ('{P}','{A}',10,'Fictício',true,100);")
import json
cap=json.loads(sql(f"select public.begin_checkout_attempt('{A}',null)"));tid=cap['attemptId'];token=cap['guestPaymentToken']
payload={'p_store_owner_id':A,'p_customer_id':None,'p_customer_name':'Fictício','p_customer_phone':'00000000000','p_customer_email':'fixture@example.invalid','p_payment_method':'cartao_credito','p_subtotal':10,'p_delivery_fee':0,'p_total_amount':10,'p_items':[{'product_id':P,'quantity':1}]}
def create(payload=payload): return f"select public.create_checkout_order_once('{tid}','{token}','{json.dumps(payload)}'::jsonb)"
with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool: results=list(pool.map(lambda _:json.loads(sql(create()))['id'],range(8)))
order=results[0];assert len(set(results))==1;assert sql('select count(*) from orders')=='1';assert sql('select count(*) from order_stock_movements')=='1';assert sql('select stock from products')=='99'
print('PASS concurrent retries: one order, one stock reservation')
changed={**payload,'p_items':[{'product_id':P,'quantity':2}]};sql(create(changed),False)
print('PASS changed cart content rejected server-side')
hash_expr=f"encode(extensions.digest('{token}','sha256'),'hex')"
auth=lambda oid=order,uid='NULL',digest=hash_expr:f"select authorize_checkout_payment('{oid}',{uid},{digest},'cartao_credito')"
sql(auth(digest='NULL'),False);sql(auth(digest="repeat('0',64)"),False);sql(auth(uid=f"'{U}'"),False);sql(auth(uid=f"'{B}'"),False);sql(auth())
print('PASS missing token, wrong token and cross-tenant callers rejected')
second=json.loads(sql(f"select begin_checkout_attempt('{A}',null)"));other=json.loads(sql(f"select create_checkout_order_once('{second['attemptId']}','{second['guestPaymentToken']}','{json.dumps(payload)}')"))['id'];sql(auth(oid=other),False)
sql(f"update checkout_payment_attempts set expires_at=now()-interval '1 second' where order_id='{order}'");sql(auth(),False);sql(f"update checkout_payment_attempts set expires_at=now()+interval '1 hour' where order_id='{order}'")
print('PASS token bound to order and expiry')
claim=f"select claim_checkout_payment('{order}',NULL,{hash_expr},'cartao_credito','mercadopago',false)"
with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool: claims=list(pool.map(lambda _:json.loads(sql(claim)),range(8)))
assert sum(c['charge'] for c in claims)==1;assert all(c['idempotencyKey']=='order-'+order for c in claims)
sql(f"update orders set status='cancelled' where id='{order}'",False)
sql(f"select record_checkout_payment_result('{order}','unknown')");assert json.loads(sql(claim))['charge'] is False
sql(f"delete from order_items where order_id='{order}'",False)
sql(f"update checkout_payment_attempts set expires_at=now()-interval '1 second' where order_id='{order}'");sql(f"select authorize_checkout_payment_status('{order}',NULL,{hash_expr},'cartao_credito')");sql(auth(),False);sql(f"update checkout_payment_attempts set expires_at=now()+interval '1 hour' where order_id='{order}'")
print('PASS single-flight; unknown retry/item deletion blocked; expired token permits only reconciliation')
sql(f"select record_checkout_payment_result('{order}','rejected','fixture-payment'); select apply_checkout_payment_result('{order}'); select apply_checkout_payment_result('{order}');")
assert sql(f"select count(*) from order_stock_movements where order_id='{order}' and kind='restore'")=='1'
assert sql('select stock from products')=='99' # other order still reserved
sql(f"select close_checkout_attempt('{tid}','{token}')")
print('PASS rejected payment restores once and safe close requires final persisted outcome')
capauth=json.loads(sql(f"set test.uid='{U}';select begin_checkout_attempt('{A}','{U}')").splitlines()[-1]);authpayload={**payload,'p_customer_id':U}
authorder=json.loads(sql(f"set test.uid='{U}';select create_checkout_order_once('{capauth['attemptId']}','{capauth['guestPaymentToken']}','{json.dumps(authpayload)}')").splitlines()[-1])['id']
sql(auth(oid=authorder,uid=f"'{U}'",digest='NULL'))
print('PASS authenticated customer retained')
assert sql("select has_table_privilege('anon','checkout_payment_attempts','select')")=='f';assert sql("select has_function_privilege('anon','claim_checkout_payment(uuid,uuid,text,text,text,boolean)','execute')")=='f'
print('PASS capability table and privileged RPC access denied to public roles')
