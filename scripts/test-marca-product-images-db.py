"""Disposable-PostgreSQL regression for MULTILOJA product-image Storage policies.
Reuses the synthetic schema of test-marca-store-db.py, adds a storage.objects stub with the
original product-images policies, applies the real migrations 0076-0079 and then 0081.
Never connects to the hosted database and uses synthetic rows only.
"""
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
FIX = Path(sys.argv[1]) if len(sys.argv) > 1 else next((ROOT / "drizzle/migrations").glob("0081_*.sql"))
base = (ROOT / "scripts/test-marca-store-db.py").read_text()
setup = base.split("for migration in")[0].replace('"/tmp/marca-store-db"', '"/tmp/marca-images-db"').replace('"55441"', '"55443"')
exec(compile(setup, "test-marca-store-db.py(setup)", "exec"))

sql("""
CREATE SCHEMA storage; GRANT USAGE ON SCHEMA storage TO authenticated, anon, service_role;
CREATE FUNCTION storage.foldername(name text) RETURNS text[] LANGUAGE sql IMMUTABLE AS $$
  SELECT (string_to_array(name,'/'))[1:array_length(string_to_array(name,'/'),1)-1] $$;
CREATE TABLE storage.objects(id uuid primary key default gen_random_uuid(), bucket_id text, name text, owner_id text default auth.uid()::text, unique(bucket_id,name));
GRANT SELECT,INSERT,UPDATE,DELETE ON storage.objects TO authenticated;
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can upload their own product images" ON storage.objects FOR INSERT WITH CHECK (bucket_id='product-images' AND auth.uid()::text=(storage.foldername(name))[1]);
CREATE POLICY "Users can update their own product images" ON storage.objects FOR UPDATE USING (bucket_id='product-images' AND auth.uid()::text=(storage.foldername(name))[1]);
CREATE POLICY "Users can delete their own product images" ON storage.objects FOR DELETE USING (bucket_id='product-images' AND auth.uid()::text=(storage.foldername(name))[1]);
CREATE POLICY "Users can upload brand logos" ON storage.objects FOR INSERT WITH CHECK (bucket_id='product-images' AND auth.uid() IS NOT NULL AND (storage.foldername(name))[1]='brands' AND (storage.foldername(name))[2]=auth.uid()::text);
CREATE POLICY "Users can update their brand logos" ON storage.objects FOR UPDATE USING (bucket_id='product-images' AND auth.uid() IS NOT NULL AND (storage.foldername(name))[1]='brands' AND (storage.foldername(name))[2]=auth.uid()::text);
CREATE POLICY "Users can delete their brand logos" ON storage.objects FOR DELETE USING (bucket_id='product-images' AND auth.uid() IS NOT NULL AND (storage.foldername(name))[1]='brands' AND (storage.foldername(name))[2]=auth.uid()::text);
CREATE POLICY "Owners and admins read public bucket objects" ON storage.objects FOR SELECT TO authenticated USING (bucket_id='product-images' AND (owner_id=auth.uid()::text OR has_role(auth.uid(),'admin')));
""")
for migration in ["0076_marca_explicit_store_authorization", "0077_marca_recurrence_cancellation_single_flight",
                  "0078_marca_scoped_private_data_containment", "0079_marca_explicit_access_approval"]:
    sql((ROOT / f"drizzle/migrations/{migration}.sql").read_text())

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


def put(a, path, store=None, fail=False, upsert=False):
    tail = " ON CONFLICT (bucket_id,name) DO UPDATE SET owner_id=excluded.owner_id" if upsert else ""
    return actor(a, f"WITH x AS (INSERT INTO storage.objects(bucket_id,name) VALUES('product-images','{path}'){tail} RETURNING name) SELECT coalesce(string_agg(name,','),'') FROM x", store, fail)


img = lambda store, n: f"brands/{store}/products/p1/{n}.jpg"
# Reproduce the reported failure before the fix.
put(A, img(B, "before"), B, fail=True)
assert put(B, img(B, "direct-before")) == img(B, "direct-before")
print("PASS reproduced: delegated upload to brands/<B>/products rejected before fix; direct owner accepted")

sql(FIX.read_text())

# Scenario 1 — direct owner (no header and header == own id).
assert put(B, img(B, "direct")) == img(B, "direct")
assert put(B, img(B, "direct-self"), B) == img(B, "direct-self")
assert put(B, img(B, "direct"), upsert=True) == img(B, "direct")
assert actor(B, f"WITH x AS (DELETE FROM storage.objects WHERE name='{img(B, 'direct-self')}' RETURNING name) SELECT coalesce(string_agg(name,','),'') FROM x") == img(B, "direct-self")
put(B, img(A, "direct-cross"), fail=True)
print("PASS direct owner: add, replace (upsert), remove own images; other store folder rejected")

# Scenario 2 — authorized MULTILOJA actor on the selected store.
assert put(A, img(B, "delegated"), B) == img(B, "delegated")
assert put(A, f"brands/{B}/products/draft/new.jpg", B) == f"brands/{B}/products/draft/new.jpg"
assert put(A, img(B, "delegated"), B, upsert=True) == img(B, "delegated")
assert actor(A, f"WITH x AS (DELETE FROM storage.objects WHERE name='{img(B, 'delegated')}' RETURNING name) SELECT coalesce(string_agg(name,','),'') FROM x", B) == img(B, "delegated")
assert put(A, img(A, "principal"), A) == img(A, "principal"), "principal store still works"
print("PASS delegated: create-with-image (draft), add, replace (upsert), remove in selected store; principal unaffected")

# Scenario 3 — isolation: forged store header, foreign path, foreign file.
put(A, img(C, "forged"), C, fail=True)
put(A, img(C, "foreign-path"), B, fail=True)
put(A, img(A, "wrong-folder"), B, fail=True)
sql(f"INSERT INTO storage.objects(bucket_id,name,owner_id) VALUES('product-images','{img(C, 'victim')}','{C}')")
assert actor(A, f"WITH x AS (DELETE FROM storage.objects WHERE name='{img(C, 'victim')}' RETURNING name) SELECT coalesce(string_agg(name,','),'') FROM x", B) == ""
assert actor(A, f"WITH x AS (UPDATE storage.objects SET owner_id='{A}' WHERE name='{img(C, 'victim')}' RETURNING name) SELECT coalesce(string_agg(name,','),'') FROM x", B) == ""
assert sql(f"SELECT count(*) FROM storage.objects WHERE name='{img(C, 'victim')}' AND owner_id='{C}'") == "1"
print("PASS cross-store: forged store_id, foreign Storage path and foreign files rejected/untouched")

# Scenario 4 — revocation is immediate.
sql(f"SET test.actor='{ADM}';SELECT admin_set_marca_store_membership('{A}','{B}',false)")
put(A, img(B, "revoked"), B, fail=True)
actor(A, f"DELETE FROM storage.objects WHERE name='{img(B, 'direct')}'", B, fail=True)
put(A, img(B, "revoked-nohdr"), fail=True)
print("PASS revoked authorization: upload/delete rejected immediately")

# Scenario 5 — unrelated authenticated user.
put(C, img(B, "intruder"), B, fail=True)
put(C, img(B, "intruder2"), fail=True)
assert actor(C, f"WITH x AS (DELETE FROM storage.objects WHERE name='{img(B, 'direct')}' RETURNING name) SELECT coalesce(string_agg(name,','),'') FROM x") == ""
assert put(C, img(C, "own")) == img(C, "own")
print("PASS unauthorized user cannot write store B images; still manages own store")
print("ALL PASS")
