"""Disposable-PostgreSQL regression: manual customer signup + primary address (migration 0083 reused)
and order address immutability. Reuses the fixtures of test-customer-address-db.py; synthetic rows only,
never connects to the hosted database.
"""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
src = (ROOT / "scripts/test-customer-address-db.py").read_text()
setup = src.split("# 1. Customer without address")[0].replace('"/tmp/customer-address-db"', '"/tmp/customer-signup-db"').replace('"55446"', '"55447"')
setup = setup.replace('(ROOT / "scripts/test-marca-store-db.py").read_text()',
                      '(ROOT / "scripts/test-marca-store-db.py").read_text().replace(\'"/tmp/marca-store-db"\', \'"/tmp/customer-address-db"\').replace(\'"55441"\', \'"55446"\')')
exec(compile(setup.replace("__file__", repr(str(ROOT / "scripts/test-customer-address-db.py"))), "address-db(setup)", "exec"))

# Real production definition of the existing manual-signup RPC (unchanged by this fix).
sql("ALTER TABLE public.store_customers ADD COLUMN IF NOT EXISTS origin text")
sql(r"""
CREATE OR REPLACE FUNCTION public.create_manual_store_customer(p_full_name text, p_email text, p_phone text DEFAULT NULL::text, p_cpf text DEFAULT NULL::text)
 RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE
  v_owner uuid := public.merchant_request_store_id();
  v_id uuid;
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_name text := btrim(coalesce(p_full_name, ''));
BEGIN
  IF v_owner IS NULL THEN RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501'; END IF;
  IF v_name = '' OR v_email = '' THEN RAISE EXCEPTION 'Nome e e-mail são obrigatórios' USING ERRCODE = '22023'; END IF;
  IF v_email !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' THEN RAISE EXCEPTION 'E-mail inválido' USING ERRCODE = '22023'; END IF;
  SELECT id INTO v_id FROM public.customer_profiles WHERE lower(email) = v_email LIMIT 1;
  IF v_id IS NULL THEN
    v_id := gen_random_uuid();
    INSERT INTO public.customer_profiles (id, full_name, email, phone, cpf)
    VALUES (v_id, left(v_name, 200), v_email, nullif(btrim(coalesce(p_phone, '')), ''), nullif(regexp_replace(coalesce(p_cpf, ''), '\D', '', 'g'), ''));
  END IF;
  INSERT INTO public.store_customers (store_owner_id, customer_id, is_active, origin) VALUES (v_owner, v_id, true, 'manual') ON CONFLICT DO NOTHING;
  RETURN v_id;
END; $function$;
GRANT EXECUTE ON FUNCTION public.create_manual_store_customer(text,text,text,text) TO authenticated;
""")
sql("CREATE UNIQUE INDEX IF NOT EXISTS store_customers_uniq ON public.store_customers(store_owner_id, customer_id)")


def create(a, email, store=None, fail=False):
    return actor(a, f"SELECT create_manual_store_customer('Cliente Manual','{email}','92999990000','123.456.789-00')", store, fail)


count = lambda q: int(sql(f"SELECT count(*) FROM {q}"))

# A. Signup with address: one customer, one store link, one store-owned primary address; reads back.
cid = create(A, "manual-a@example.invalid")
r = save(A, cid, recipient="", street="Rua Cadastro", number="12", complement="Casa 2")
assert r["store_owner_id"] == A and r["is_default"] is True and r["recipient_name"] == "Cliente Manual", r
assert count(f"customer_profiles WHERE email='manual-a@example.invalid'") == 1
assert count(f"store_customers WHERE customer_id='{cid}' AND store_owner_id='{A}'") == 1
assert count(f"customer_addresses WHERE customer_id='{cid}'") == 1
assert actor(A, f"SELECT street FROM customer_addresses WHERE customer_id='{cid}'") == "Rua Cadastro"
print("PASS A: manual signup saves customer once and address once, owned by the current store, readable on reopen")

# B. Signup without saving an address never creates an empty address row.
cid_b = create(A, "manual-b@example.invalid")
assert count(f"customer_addresses WHERE customer_id='{cid_b}'") == 0
print("PASS B: no address submitted -> no empty address record")

# C. Address fails after the customer was created: customer kept once; retry saves only the address.
sql("CREATE FUNCTION public._fail_ins() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'synthetic failure'; END $$;"
    "CREATE TRIGGER _fail_ins BEFORE INSERT ON public.customer_addresses FOR EACH ROW EXECUTE FUNCTION public._fail_ins();")
cid_c = create(A, "manual-c@example.invalid")
save(A, cid_c, fail=True)
assert count(f"customer_profiles WHERE email='manual-c@example.invalid'") == 1 and count(f"customer_addresses WHERE customer_id='{cid_c}'") == 0
sql("DROP TRIGGER _fail_ins ON public.customer_addresses")
save(A, cid_c)                                   # UI retry: address only
assert create(A, "manual-c@example.invalid") == cid_c  # even a repeated signup reuses the same customer
save(A, cid_c, number="13")
assert count(f"customer_profiles WHERE email='manual-c@example.invalid'") == 1
assert count(f"store_customers WHERE customer_id='{cid_c}'") == 1
assert count(f"customer_addresses WHERE customer_id='{cid_c}'") == 1
print("PASS C: address failure keeps the customer (not deleted, not duplicated); retry stores exactly one address")

# D/E. Order snapshot immutable; new orders take the current address.
sql(f"INSERT INTO orders(store_owner_id,customer_id,customer_address) VALUES('{A}','{cid}','Rua A, 1, Bairro A, Manaus - AM, CEP: 69000-001')")
save(A, cid, street="Rua B", number="2", neighborhood="Bairro B")
assert sql(f"SELECT customer_address FROM orders WHERE customer_id='{cid}'") == "Rua A, 1, Bairro A, Manaus - AM, CEP: 69000-001"
cur = json.loads(sql(f"SELECT row_to_json(a) FROM customer_addresses a WHERE customer_id='{cid}'"))
new_snapshot = f"{cur['street']}, {cur['number']}, {cur['neighborhood']}, {cur['city']} - {cur['state']}, CEP: {cur['cep']}"
sql(f"INSERT INTO orders(store_owner_id,customer_id,customer_address) VALUES('{A}','{cid}','{new_snapshot}')")
assert count(f"orders WHERE customer_id='{cid}' AND customer_address LIKE 'Rua A,%'") == 1
assert count(f"orders WHERE customer_id='{cid}' AND customer_address LIKE 'Rua B,%'") == 1
print("PASS D/E: editing the registration keeps the old order on address A; a new order uses address B")

# F. Multitenancy + MULTILOJA: created through B lands in B; store C cannot touch it.
cid_f = create(A, "manual-f@example.invalid", store=B)
assert save(A, cid_f, store=B)["store_owner_id"] == B
assert count(f"store_customers WHERE customer_id='{cid_f}' AND store_owner_id='{A}'") == 0
save(C, cid_f, fail=True)
save(C, cid, fail=True)
create(A, "manual-x@example.invalid", store=C, fail=True)
assert count(f"customer_addresses WHERE customer_id='{cid_f}'") == 1
print("PASS F: MULTILOJA signup lands in the selected store; other stores and forged selection rejected")
print("ALL PASS")
