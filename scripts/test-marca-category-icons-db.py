"""Disposable-PostgreSQL regression for MULTILOJA category-icon Storage policies.
Reuses the synthetic schema of test-marca-store-db.py, adds a storage.objects stub with the
original category-icon and product-image policies plus a product_categories stub, applies the
real migrations 0076-0079, then 0081 and 0082. Never connects to the hosted database.
"""
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
MIG = ROOT / "drizzle/migrations"
FIX = Path(sys.argv[1]) if len(sys.argv) > 1 else next(MIG.glob("0082_*.sql"))
base = (ROOT / "scripts/test-marca-store-db.py").read_text()
setup = base.split("for migration in")[0].replace('"/tmp/marca-store-db"', '"/tmp/marca-cat-icons-db"').replace('"55441"', '"55444"')
exec(compile(setup, "test-marca-store-db.py(setup)", "exec"))

CAT = "bucket_id='product-images' AND auth.uid() IS NOT NULL AND (storage.foldername(name))[1]='categories' AND (storage.foldername(name))[2]=auth.uid()::text"
sql(f"""
CREATE SCHEMA storage; GRANT USAGE ON SCHEMA storage TO authenticated, anon, service_role;
CREATE FUNCTION storage.foldername(name text) RETURNS text[] LANGUAGE sql IMMUTABLE AS $$
  SELECT (string_to_array(name,'/'))[1:array_length(string_to_array(name,'/'),1)-1] $$;
CREATE TABLE storage.objects(id uuid primary key default gen_random_uuid(), bucket_id text, name text, owner_id text default auth.uid()::text, unique(bucket_id,name));
GRANT SELECT,INSERT,UPDATE,DELETE ON storage.objects TO authenticated;
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can view category icons" ON storage.objects FOR SELECT USING (bucket_id='product-images' AND (storage.foldername(name))[1]='categories');
CREATE POLICY "Users can upload category icons" ON storage.objects FOR INSERT WITH CHECK ({CAT});
CREATE POLICY "Users can update their category icons" ON storage.objects FOR UPDATE USING ({CAT});
CREATE POLICY "Users can delete their category icons" ON storage.objects FOR DELETE USING ({CAT});
CREATE POLICY "Users can upload brand logos" ON storage.objects FOR INSERT WITH CHECK (bucket_id='product-images' AND auth.uid() IS NOT NULL AND (storage.foldername(name))[1]='brands' AND (storage.foldername(name))[2]=auth.uid()::text);
CREATE POLICY "Users can update their brand logos" ON storage.objects FOR UPDATE USING (bucket_id='product-images' AND auth.uid() IS NOT NULL AND (storage.foldername(name))[1]='brands' AND (storage.foldername(name))[2]=auth.uid()::text);
CREATE POLICY "Users can delete their brand logos" ON storage.objects FOR DELETE USING (bucket_id='product-images' AND auth.uid() IS NOT NULL AND (storage.foldername(name))[1]='brands' AND (storage.foldername(name))[2]=auth.uid()::text);
CREATE POLICY "Owners and admins read public bucket objects" ON storage.objects FOR SELECT TO authenticated USING (bucket_id='product-images' AND (owner_id=auth.uid()::text OR has_role(auth.uid(),'admin')));
CREATE TABLE public.product_categories(id uuid primary key default gen_random_uuid(), user_id uuid not null, name text not null, icon_url text, unique(user_id,name));
GRANT SELECT,INSERT,UPDATE,DELETE ON public.product_categories TO authenticated;
ALTER TABLE public.product_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own categories" ON public.product_categories FOR SELECT TO authenticated USING (auth.uid()=user_id);
CREATE POLICY "Users can create their own categories" ON public.product_categories FOR INSERT TO authenticated WITH CHECK (auth.uid()=user_id);
CREATE POLICY "Users can update their own categories" ON public.product_categories FOR UPDATE TO authenticated USING (auth.uid()=user_id);
""")
for migration in ["0076_marca_explicit_store_authorization", "0077_marca_recurrence_cancellation_single_flight",
                  "0078_marca_scoped_private_data_containment", "0079_marca_explicit_access_approval",
                  "0081_marca_delegated_product_image_upload"]:
    sql(next(MIG.glob(f"{migration}.sql")).read_text())

A, B, C = "11111111-1111-4111-8111-111111111111", "22222222-2222-4222-8222-222222222222", "33333333-3333-4333-8333-333333333333"
BR, ADM = "55555555-5555-4555-8555-555555555555", "66666666-6666-4666-8666-666666666666"
sql(f"""INSERT INTO profiles(id,store_slug,store_name) VALUES('{A}','fixture-a','Loja A'),('{B}','fixture-b','Loja B'),('{C}','fixture-c','Loja C');
INSERT INTO user_roles VALUES('{ADM}','admin');
INSERT INTO brand_accounts VALUES('{BR}','{A}');
INSERT INTO brand_account_owned_stores(brand_account_id,store_profile_id,slot,store_role) VALUES('{BR}','{A}',1,'primary'),('{BR}','{B}',2,'secondary');
INSERT INTO master_subscriptions(id,user_id,plan_id,status,current_period_end) VALUES('{A}','{A}','marca','active','2099-01-01');
INSERT INTO merchant_store_memberships(user_id,store_id) VALUES('{A}','{B}');""")
sql(f"SET test.actor='{ADM}';SELECT admin_set_marca_store_membership('{A}','{B}',true)")


def actor(a, query, store=None, fail=False):
    header = f"""SET request.headers='{{"x-shopdrive-store-id":"{store}"}}';""" if store else ""
    return sql(f"SET test.actor='{a}';{header}SET ROLE authenticated;{query}", fail)


def ret(stmt):
    return f"WITH x AS ({stmt} RETURNING name) SELECT coalesce(string_agg(name,','),'<none>') FROM x"


def put(a, path, store=None, fail=False, upsert=False):
    tail = " ON CONFLICT (bucket_id,name) DO UPDATE SET owner_id=excluded.owner_id" if upsert else ""
    return actor(a, ret(f"INSERT INTO storage.objects(bucket_id,name) VALUES('product-images','{path}'){tail}"), store, fail)


def rm(a, path, store=None):
    return actor(a, ret(f"DELETE FROM storage.objects WHERE name='{path}'"), store)


icon = lambda store, n: f"categories/{store}/{n}.png"
img = lambda store, n: f"brands/{store}/products/p1/{n}.jpg"

# Reproduce the reported failure before the fix.
put(A, icon(B, "before"), B, fail=True)
assert put(B, icon(B, "direct-before")) == icon(B, "direct-before")
print("PASS reproduced: delegated upload to categories/<B> rejected before fix; direct owner accepted")

sql(FIX.read_text())

# 1 — direct owner keeps add / replace / remove on own folder only.
assert put(B, icon(B, "direct")) == icon(B, "direct")
assert put(B, icon(B, "direct-self"), B) == icon(B, "direct-self")
assert put(B, icon(B, "direct"), upsert=True) == icon(B, "direct")
assert rm(B, icon(B, "direct-self")) == icon(B, "direct-self")
put(B, icon(A, "direct-cross"), fail=True)
print("PASS direct owner: add, replace (upsert), remove own icons; other store folder rejected")

# 2-6 — authorized MULTILOJA actor on the selected store; icon bound to that store's category.
assert put(A, icon(B, "delegated"), B) == icon(B, "delegated")
assert put(A, icon(B, "delegated"), B, upsert=True) == icon(B, "delegated")
assert put(A, icon(B, "delegated-2"), B) == icon(B, "delegated-2")
cat = actor(A, f"WITH x AS (INSERT INTO product_categories(user_id,name,icon_url) VALUES('{B}','Cat B','{icon(B, 'delegated')}') RETURNING id) SELECT id FROM x", B)
assert actor(A, f"WITH x AS (UPDATE product_categories SET icon_url='{icon(B, 'delegated-2')}' WHERE id='{cat}' RETURNING user_id) SELECT user_id FROM x", B) == B
assert rm(A, icon(B, "delegated"), B) == icon(B, "delegated")
assert actor(A, f"WITH x AS (UPDATE product_categories SET icon_url=NULL WHERE id='{cat}' RETURNING icon_url) SELECT coalesce(icon_url,'<null>') FROM x", B) == "<null>"
actor(A, f"INSERT INTO product_categories(user_id,name) VALUES('{A}','Wrong store')", B, fail=True)
assert sql(f"SELECT name FROM storage.objects WHERE name LIKE 'categories/{B}/delegated%' ORDER BY name") == icon(B, "delegated-2")
assert put(A, icon(A, "principal"), A) == icon(A, "principal"), "principal store still works"
print("PASS delegated: upload, replace, remove icon in categories/<B>; category row bound to store B; principal unaffected")

# 8-9 — isolation: forged store header, foreign path, foreign file, principal folder while B selected.
put(A, icon(C, "forged"), C, fail=True)
put(A, icon(C, "foreign-path"), B, fail=True)
put(A, icon(A, "wrong-folder"), B, fail=True)
put(A, icon("not-a-uuid", "bad"), "not-a-uuid", fail=True)
sql(f"INSERT INTO storage.objects(bucket_id,name,owner_id) VALUES('product-images','{icon(C, 'victim')}','{C}')")
assert rm(A, icon(C, "victim"), B) == "<none>"
assert actor(A, ret(f"UPDATE storage.objects SET owner_id='{A}' WHERE name='{icon(C, 'victim')}'"), B) == "<none>"
assert rm(A, icon(A, "principal"), B) == "<none>"
assert sql(f"SELECT count(*) FROM storage.objects WHERE name IN ('{icon(C, 'victim')}','{icon(A, 'principal')}')") == "2"
print("PASS cross-store: forged/invalid store_id, foreign/principal folders and foreign files rejected/untouched")

# 12 — product images (0081) still behave.
assert put(A, img(B, "prod"), B) == img(B, "prod")
put(A, img(C, "prod"), B, fail=True)
assert put(B, img(B, "prod-direct")) == img(B, "prod-direct")
print("PASS no regression: product image uploads still scoped to the selected store")

# 10 — revocation is immediate.
sql(f"SET test.actor='{ADM}';SELECT admin_set_marca_store_membership('{A}','{B}',false)")
put(A, icon(B, "revoked"), B, fail=True)
actor(A, f"DELETE FROM storage.objects WHERE name='{icon(B, 'delegated-2')}'", B, fail=True)
put(A, icon(B, "revoked-nohdr"), fail=True)
print("PASS revoked authorization: upload/delete rejected immediately")

# 11 — unrelated authenticated user.
put(C, icon(B, "intruder"), B, fail=True)
put(C, icon(B, "intruder2"), fail=True)
assert rm(C, icon(B, "delegated-2")) == "<none>"
assert put(C, icon(C, "own")) == icon(C, "own")
print("PASS unauthorized user cannot write store B icons; still manages own store")
print("ALL PASS")
