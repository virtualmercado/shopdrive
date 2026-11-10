"""Disposable-PostgreSQL regression for merchant manual edit of a customer's primary address.
Reuses the synthetic schema of test-marca-store-db.py, extends the customer stubs with the real
column/policy shapes, applies the real migrations 0076-0079 and then the address migration.
Synthetic rows only; never connects to the hosted database.
"""
import concurrent.futures
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
MIG = ROOT / "drizzle/migrations"
FIX = Path(sys.argv[1]) if len(sys.argv) > 1 else next(MIG.glob("*_merchant_customer_primary_address.sql"))
base = (ROOT / "scripts/test-marca-store-db.py").read_text()
setup = base.split("for migration in")[0].replace('"/tmp/marca-store-db"', '"/tmp/customer-address-db"').replace('"55441"', '"55446"')
exec(compile(setup, "test-marca-store-db.py(setup)", "exec"))

sql("""
CREATE TABLE public.customer_profiles(id uuid primary key default gen_random_uuid(), full_name text not null, email text, phone text, cpf text,
  is_guest_record boolean not null default false, updated_at timestamptz default now());
ALTER TABLE public.store_customers ADD COLUMN id uuid default gen_random_uuid(), ADD COLUMN is_active boolean default true;
ALTER TABLE public.customer_addresses ADD COLUMN id uuid primary key default gen_random_uuid(), ADD COLUMN recipient_name text not null default '',
  ADD COLUMN cep text not null default '', ADD COLUMN street text not null default '', ADD COLUMN number text not null default '',
  ADD COLUMN complement text, ADD COLUMN neighborhood text not null default '', ADD COLUMN city text not null default '',
  ADD COLUMN state text not null default '', ADD COLUMN is_default boolean default false, ADD COLUMN store_owner_id uuid,
  ADD COLUMN address_type text default 'delivery', ADD COLUMN created_at timestamptz not null default now(),
  ADD COLUMN updated_at timestamptz not null default now();
ALTER TABLE public.customer_addresses ADD FOREIGN KEY (customer_id) REFERENCES public.customer_profiles(id) ON DELETE CASCADE;
CREATE POLICY "Customers can view their own addresses" ON public.customer_addresses FOR SELECT TO authenticated USING (auth.uid()=customer_id);
CREATE POLICY "Customers can insert their own addresses" ON public.customer_addresses FOR INSERT TO authenticated WITH CHECK (auth.uid()=customer_id);
CREATE POLICY "Customers can update their own addresses" ON public.customer_addresses FOR UPDATE TO authenticated USING (auth.uid()=customer_id);
CREATE TABLE public.orders(id uuid primary key default gen_random_uuid(), store_owner_id uuid, customer_id uuid, customer_address text);
GRANT SELECT ON public.customer_profiles, public.orders TO authenticated;
""")
for migration in ["0076_marca_explicit_store_authorization", "0077_marca_recurrence_cancellation_single_flight",
                  "0078_marca_scoped_private_data_containment", "0079_marca_explicit_access_approval"]:
    sql(next(MIG.glob(f"{migration}.sql")).read_text())
sql(FIX.read_text())
print("PASS real migrations 0076-0079 + address migration applied to disposable PostgreSQL")

A, B, C = "11111111-1111-4111-8111-111111111111", "22222222-2222-4222-8222-222222222222", "33333333-3333-4333-8333-333333333333"
BR, ADM = "55555555-5555-4555-8555-555555555555", "66666666-6666-4666-8666-666666666666"
K_NONE, K_OWN, K_GUEST, K_AUTH, K_SHARED = ("a0000000-0000-4000-8000-00000000000" + str(i) for i in range(1, 6))
K_C = "c0000000-0000-4000-8000-000000000001"
sql(f"""INSERT INTO profiles(id,store_slug,store_name) VALUES('{A}','fixture-a','Loja A'),('{B}','fixture-b','Loja B'),('{C}','fixture-c','Loja C');
INSERT INTO user_roles VALUES('{ADM}','admin');
INSERT INTO brand_accounts VALUES('{BR}','{A}');
INSERT INTO brand_account_owned_stores(brand_account_id,store_profile_id,slot,store_role) VALUES('{BR}','{A}',1,'primary'),('{BR}','{B}',2,'secondary');
INSERT INTO master_subscriptions(id,user_id,plan_id,status,current_period_end) VALUES('{A}','{A}','marca','active','2099-01-01');
INSERT INTO customer_profiles(id,full_name,email,phone,cpf,is_guest_record) VALUES
 ('{K_NONE}','Sem Endereco','none@example.invalid','11','111',false),('{K_OWN}','Com Endereco','own@example.invalid','22','222',false),
 ('{K_GUEST}','Convidado','guest@example.invalid',null,null,true),('{K_AUTH}','Conta Propria','auth@example.invalid','44','444',false),
 ('{K_SHARED}','Cliente Compartilhado','shared@example.invalid',null,null,false),('{K_C}','Cliente Loja C','c@example.invalid',null,null,false);
INSERT INTO store_customers(store_owner_id,customer_id) VALUES('{A}','{K_NONE}'),('{A}','{K_OWN}'),('{A}','{K_GUEST}'),('{A}','{K_AUTH}'),
 ('{A}','{K_SHARED}'),('{C}','{K_SHARED}'),('{C}','{K_C}'),('{B}','{K_NONE}');
INSERT INTO customer_addresses(customer_id,store_owner_id,recipient_name,cep,street,number,complement,neighborhood,city,state,is_default) VALUES
 ('{K_OWN}','{A}','Com Endereco','69000000','Rua Um','10',null,'Centro','Manaus','AM',true),
 ('{K_AUTH}',null,'Conta Propria','01001000','Praca da Se','1',null,'Se','Sao Paulo','SP',true),
 ('{K_SHARED}','{C}','Cliente Compartilhado','20000000','Rua da Loja C','5',null,'Centro','Rio de Janeiro','RJ',true),
 ('{K_C}','{C}','Cliente Loja C','30000000','Rua C','7',null,'Centro','Belo Horizonte','MG',true);
INSERT INTO orders(store_owner_id,customer_id,customer_address) VALUES('{A}','{K_OWN}','Rua Um, 10 - Centro - Manaus/AM - CEP 69000000');
INSERT INTO merchant_store_memberships(user_id,store_id) VALUES('{A}','{B}');""")
sql(f"SET test.actor='{ADM}';SELECT admin_set_marca_store_membership('{A}','{B}',true)")


def actor(a, query, store=None, fail=False):
    header = f"""SET request.headers='{{"x-shopdrive-store-id":"{store}"}}';""" if store else ""
    return sql(f"SET test.actor='{a}';{header}SET ROLE authenticated;{query}", fail)


def save(a, customer, store=None, fail=False, **over):
    v = dict(recipient="", cep="69005-010", street="Av. Teste", number="100", complement="", neighborhood="Adrianopolis", city="Manaus", state="am")
    v.update(over)
    q = lambda s: "NULL" if s is None else "'" + s.replace("'", "''") + "'"
    call = (f"SELECT merchant_save_customer_primary_address('{customer}',{q(v['recipient'])},{q(v['cep'])},{q(v['street'])},{q(v['number'])},"
            f"{q(v['complement'])},{q(v['neighborhood'])},{q(v['city'])},{q(v['state'])})")
    out = actor(a, call, store, fail)
    return None if fail else json.loads(out)


def rows(customer):
    return sql(f"SELECT coalesce(jsonb_agg(to_jsonb(x) - 'created_at' ORDER BY x.store_owner_id NULLS FIRST, x.created_at),'[]') FROM (SELECT store_owner_id,street,number,complement,cep,state,is_default,recipient_name,created_at FROM customer_addresses WHERE customer_id='{customer}') x")


snapshot = lambda: sql("SELECT md5(string_agg(row_to_json(t)::text, ',' ORDER BY id)) FROM (SELECT id,full_name,email,phone,cpf FROM customer_profiles) t") + \
    sql("SELECT md5(string_agg(row_to_json(o)::text, ',' ORDER BY id)) FROM orders o") + sql("SELECT count(*) FROM store_customers")
before = snapshot()

# 1. Customer without address: add -> one store-owned primary address.
r = save(A, K_NONE)
assert r["store_owner_id"] == A and r["is_default"] is True and r["cep"] == "69005010" and r["state"] == "AM" and r["recipient_name"] == "Sem Endereco", r
assert json.loads(rows(K_NONE))[0]["street"] == "Av. Teste" and len(json.loads(rows(K_NONE))) == 1
print("PASS add address to customer without address (store-owned primary, CEP digits, UF upper, recipient defaults to name)")

# 2. Edit number/complement -> same row updated, no duplicate.
own_id = sql(f"SELECT id FROM customer_addresses WHERE customer_id='{K_OWN}'")
r = save(A, K_OWN, number="250", complement="Apto 3", street="Rua Um")
assert r["id"] == own_id and r["number"] == "250" and r["complement"] == "Apto 3"
assert sql(f"SELECT count(*) FROM customer_addresses WHERE customer_id='{K_OWN}'") == "1"
r2 = save(A, K_OWN, number="251", complement="")
assert r2["id"] == own_id and r2["complement"] is None
print("PASS edit existing address updates the same row (no duplicate, blank complement cleared)")

# 3. Persistence: reread as the merchant through RLS.
seen = actor(A, f"SELECT number FROM customer_addresses WHERE id='{own_id}'")
assert seen == "251"
print("PASS saved address persists and reads back through merchant RLS")

# 4. Historic order snapshot untouched.
assert sql(f"SELECT customer_address FROM orders WHERE customer_id='{K_OWN}'") == "Rua Um, 10 - Centro - Manaus/AM - CEP 69000000"
print("PASS old order keeps the address used at purchase")

# 5. Guest record: address saved, no auth/profile change.
r = save(A, K_GUEST)
assert r["store_owner_id"] == A and sql(f"SELECT is_guest_record FROM customer_profiles WHERE id='{K_GUEST}'") == "t"
print("PASS guest customer gets a store address without becoming an account")

# 6. Customer with their own (no-store) address: never overwritten; store copy added, customer default kept.
r = save(A, K_AUTH, street="Rua Nova da Loja A")
auth_rows = json.loads(rows(K_AUTH))
assert auth_rows[0]["store_owner_id"] is None and auth_rows[0]["street"] == "Praca da Se" and auth_rows[0]["is_default"] is True
assert auth_rows[1]["store_owner_id"] == A and auth_rows[1]["street"] == "Rua Nova da Loja A" and auth_rows[1]["is_default"] is False
assert save(A, K_AUTH, number="2")["id"] == r["id"] and sql(f"SELECT count(*) FROM customer_addresses WHERE customer_id='{K_AUTH}'") == "2"
print("PASS logged-in customer's own address untouched; store edits its own copy only")

# 7. Multitenancy.
shared_c = sql(f"SELECT street FROM customer_addresses WHERE customer_id='{K_SHARED}' AND store_owner_id='{C}'")
save(A, K_SHARED, street="Rua da Loja A")
assert sql(f"SELECT street FROM customer_addresses WHERE customer_id='{K_SHARED}' AND store_owner_id='{C}'") == shared_c
assert sql(f"SELECT is_default FROM customer_addresses WHERE customer_id='{K_SHARED}' AND store_owner_id='{A}'") == "f"
print("PASS customer shared with store C: store C address unchanged, store A edits only its own copy")
c_before = rows(K_C)
save(A, K_C, fail=True)                       # customer of another store
save(A, K_C, store=C, fail=True)              # forged store header
save(A, K_C, store="not-a-uuid", fail=True)   # invalid header
save(B, K_C, fail=True)                       # another merchant
save(K_AUTH, K_AUTH, fail=True)               # a customer calling the function
sql(f"SET ROLE anon; SELECT merchant_save_customer_primary_address('{K_C}','x','69000000','r','1',null,'b','c','AM')", fail=True)
actor(A, f"UPDATE customer_addresses SET street='hack' WHERE customer_id='{K_C}' RETURNING id")
actor(A, f"UPDATE customer_addresses SET street='hack' WHERE customer_id='{K_OWN}' RETURNING id")
assert rows(K_C) == c_before and sql(f"SELECT street FROM customer_addresses WHERE id='{own_id}'") == "Rua Um"
print("PASS other store's customer, forged/invalid header, other merchant, customer, anon and direct table writes all rejected")

# MULTILOJA: A manages B only through the approved selection, and only B's customers.
r = save(A, K_NONE, store=B, street="Rua da Loja B")
assert r["store_owner_id"] == B
assert sql(f"SELECT street FROM customer_addresses WHERE customer_id='{K_NONE}' AND store_owner_id='{A}'") == "Av. Teste"
save(A, K_OWN, store=B, fail=True)
sql(f"SET test.actor='{ADM}';SELECT admin_set_marca_store_membership('{A}','{B}',false)")
save(A, K_NONE, store=B, fail=True)
print("PASS MULTILOJA edits only the selected store's customer; revocation denies immediately")

# 8. Validation: nothing saved.
own_before = rows(K_OWN)
for bad in [dict(cep=""), dict(cep="6900"), dict(street="  "), dict(number=""), dict(neighborhood=""), dict(city=""),
            dict(state=""), dict(state="XX"), dict(state="Amazonas"), dict(street="x" * 201)]:
    save(A, K_OWN, fail=True, **bad)
assert rows(K_OWN) == own_before
print("PASS missing/invalid CEP, street, number, neighborhood, city, UF and oversized fields rejected without changes")

# 9. Failure mid-save keeps previous data (transaction rolls back).
sql("CREATE FUNCTION public._fail_addr() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'synthetic failure'; END $$;"
    "CREATE TRIGGER _fail_addr AFTER UPDATE ON public.customer_addresses FOR EACH ROW EXECUTE FUNCTION public._fail_addr();")
save(A, K_OWN, fail=True, number="999")
sql("DROP TRIGGER _fail_addr ON public.customer_addresses")
assert rows(K_OWN) == own_before
print("PASS backend failure leaves the existing address intact")

# Concurrency: 8 simultaneous first saves -> exactly one row.
sql(f"INSERT INTO customer_profiles(id,full_name) VALUES('a0000000-0000-4000-8000-000000000009','Concorrente');"
    f"INSERT INTO store_customers(store_owner_id,customer_id) VALUES('{A}','a0000000-0000-4000-8000-000000000009')")
with concurrent.futures.ThreadPoolExecutor(8) as pool:
    list(pool.map(lambda n: save(A, "a0000000-0000-4000-8000-000000000009", number=str(n)), range(8)))
assert sql("SELECT count(*) FROM customer_addresses WHERE customer_id='a0000000-0000-4000-8000-000000000009'") == "1"
print("PASS 8 concurrent saves create exactly one address")

# Never touches profiles, orders or store links; no new customers.
assert int(sql("SELECT count(*) FROM store_customers")) == int(before[64:]) + 1  # only the fixture added above
assert sql("SELECT md5(string_agg(row_to_json(t)::text, ',' ORDER BY id)) FROM (SELECT id,full_name,email,phone,cpf FROM customer_profiles WHERE full_name<>'Concorrente') t") \
    == before[:32]
prof = sql("SELECT string_agg(full_name||'|'||coalesce(email,'')||'|'||coalesce(phone,'')||'|'||coalesce(cpf,''), ';' ORDER BY id) FROM customer_profiles WHERE full_name<>'Concorrente'")
assert "Sem Endereco|none@example.invalid|11|111" in prof and "Com Endereco|own@example.invalid|22|222" in prof and "Conta Propria|auth@example.invalid|44|444" in prof
assert sql("SELECT md5(string_agg(row_to_json(o)::text, ',' ORDER BY id)) FROM orders o") == before[32:64]
print("PASS customer name/e-mail/phone/CPF and orders unchanged; no customer created or duplicated")
print("ALL PASS")
