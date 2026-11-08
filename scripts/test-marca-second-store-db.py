"""Run the real MARCA second-store creation migration (0080) in a disposable localhost PostgreSQL
cluster with synthetic rows only. Never reads managed credentials or connects to the hosted database.
Objects 0080 depends on mirror their production definitions (copied read-only)."""
import concurrent.futures, json, os, shutil, subprocess, time, uuid
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = Path("/tmp/marca-second-store-db"); PORT = "55443"
ENV = {k: v for k, v in os.environ.items() if not k.startswith("PG")}
_bins = sorted(Path("/nix/store").glob("*-postgresql-17*/bin/initdb"))
if _bins: ENV["PATH"] = str(_bins[0].parent) + ":" + ENV.get("PATH", "")
DSN = f"postgresql://nobody@127.0.0.1:{PORT}/marca2?sslmode=disable"
ADMIN = f"postgresql://nobody@127.0.0.1:{PORT}/postgres?sslmode=disable"

def as_nobody(*cmd):
    return subprocess.run(["runuser", "-u", "nobody", "--", "env", "PATH=" + ENV["PATH"], *cmd], env=ENV, capture_output=True, text=True)

if not (DATA / "PG_VERSION").exists():
    shutil.rmtree(DATA, ignore_errors=True); DATA.mkdir(parents=True); shutil.chown(DATA, "nobody")
    r = as_nobody("initdb", "-D", str(DATA), "-U", "nobody", "--auth=trust"); assert r.returncode == 0, r.stderr
if as_nobody("pg_ctl", "-D", str(DATA), "status").returncode != 0:
    r = as_nobody("pg_ctl", "-D", str(DATA), "-l", str(DATA / "server.log"), "-w", "-o", f"-p {PORT} -k /tmp -c listen_addresses=127.0.0.1", "start")
    assert r.returncode == 0, r.stderr
for _ in range(30):
    if subprocess.run(["psql", ADMIN, "-Atc", "select 1"], env=ENV, capture_output=True).returncode == 0: break
    time.sleep(0.2)

def sql(q, fail=False):
    p = subprocess.run(["psql", DSN, "-X", "-q", "-v", "ON_ERROR_STOP=1", "-At", "-c", q], env=ENV, capture_output=True, text=True)
    if fail:
        assert p.returncode != 0, "expected rejection: " + q; return p.stderr
    if p.returncode: raise AssertionError(p.stderr)
    return p.stdout.strip().splitlines()[-1] if p.stdout.strip() else ""

subprocess.run(["dropdb", "--if-exists", "--maintenance-db=" + ADMIN, "marca2"], env=ENV, check=True, capture_output=True)
subprocess.run(["createdb", "--maintenance-db=" + ADMIN, "marca2"], env=ENV, check=True, capture_output=True)
sql("""
DO $$ BEGIN IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS; END IF; END $$;
CREATE SCHEMA auth; GRANT USAGE ON SCHEMA auth TO authenticated, anon, service_role; GRANT USAGE ON SCHEMA public TO authenticated, anon, service_role;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('test.actor',true),'')::uuid $$;
CREATE TABLE auth.users(id uuid primary key default gen_random_uuid(), email text unique, raw_user_meta_data jsonb, created_at timestamptz default now());
CREATE TYPE public.app_role AS ENUM ('admin','user','suporte');
CREATE TABLE public.profiles(id uuid primary key references auth.users(id) on delete cascade, full_name text, store_name text, store_slug text unique,
  deleted_at timestamptz, account_status text, is_template_profile boolean, source_template_id uuid, template_apply_status text);
CREATE TABLE public.user_roles(user_id uuid references auth.users(id) on delete cascade, role public.app_role);
CREATE TABLE public.account_deletion_requests(merchant_id uuid, status text);
CREATE TABLE public.audit_logs(user_id uuid, action text, entity_type text, entity_id uuid, metadata jsonb);
CREATE TABLE public.master_subscriptions(user_id uuid, plan_id text, status text, current_period_end timestamptz);
CREATE TABLE public.products(id uuid default gen_random_uuid(), user_id uuid, name text);
CREATE TABLE public.brand_accounts(id uuid primary key default gen_random_uuid(), display_name text not null default 'x', owner_profile_id uuid references profiles(id) on delete set null);
CREATE TABLE public.brand_account_owned_stores(id uuid primary key default gen_random_uuid(), brand_account_id uuid not null references brand_accounts(id) on delete cascade,
  store_profile_id uuid not null references profiles(id) on delete cascade, slot smallint not null check (slot in (1,2)), store_role text not null,
  link_origin text, created_by uuid, created_at timestamptz default now(),
  CONSTRAINT baos_account_slot_uq UNIQUE(brand_account_id, slot), CONSTRAINT baos_store_uq UNIQUE(store_profile_id),
  CONSTRAINT baos_slot_role_chk CHECK ((slot=1 AND store_role='primary') OR (slot=2 AND store_role='secondary')),
  CONSTRAINT brand_account_owned_stores_link_origin_check CHECK (link_origin IS NULL OR link_origin = ANY (ARRAY['owner_auto','admin_link','admin_clone'])));
CREATE TABLE public.merchant_store_memberships(id uuid primary key default gen_random_uuid(), user_id uuid not null, store_id uuid not null references profiles(id) on delete cascade,
  permission text not null default 'administrator' check (permission='administrator'), active boolean not null default true, created_at timestamptz default now(),
  created_by uuid, authorization_approved boolean not null default false, UNIQUE(user_id, store_id));
-- Mirrors the official handle_new_user provisioning trigger.
CREATE FUNCTION public.generate_store_slug(p text) RETURNS text LANGUAGE plpgsql AS $$ DECLARE b text:=trim(both '-' from lower(regexp_replace(p,'[^a-zA-Z0-9]+','-','g'))); f text; c int:=0;
 BEGIN IF b='' THEN b:='loja'; END IF; f:=b; WHILE EXISTS(SELECT 1 FROM profiles WHERE store_slug=f) LOOP c:=c+1; f:=b||'-'||c; END LOOP; RETURN f; END $$;
CREATE FUNCTION public.handle_new_user() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
 INSERT INTO profiles(id,full_name,store_name,store_slug) VALUES(NEW.id,coalesce(NEW.raw_user_meta_data->>'full_name',''),coalesce(NEW.raw_user_meta_data->>'store_name',''),
  CASE WHEN coalesce(NEW.raw_user_meta_data->>'store_name','')<>'' THEN generate_store_slug(NEW.raw_user_meta_data->>'store_name') END);
 INSERT INTO user_roles VALUES(NEW.id,'user'); RETURN NEW; END $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION handle_new_user();
CREATE FUNCTION public.get_brand_inherited_plan(p uuid) RETURNS text LANGUAGE sql STABLE AS $$ SELECT 'marca'::text FROM brand_account_owned_stores o JOIN brand_accounts b ON b.id=o.brand_account_id
 WHERE o.store_profile_id=p AND o.store_role='secondary' AND EXISTS(SELECT 1 FROM master_subscriptions s WHERE s.user_id=b.owner_profile_id AND s.status='active' AND s.plan_id='marca') $$;
CREATE FUNCTION public.get_effective_store_plan(p uuid) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT CASE WHEN get_brand_inherited_plan(p) IS NOT NULL THEN jsonb_build_object('plan','marca','planSource','inherited','unlimited',true)
  ELSE jsonb_build_object('plan',coalesce((SELECT plan_id FROM master_subscriptions WHERE user_id=p AND status='active' LIMIT 1),'free'),'planSource','direct') END $$;
CREATE FUNCTION public.propagate_brand_plan_to_secondaries(p uuid) RETURNS int LANGUAGE sql AS $$ SELECT 0 $$;
CREATE FUNCTION public._managed_store_json(p uuid) RETURNS jsonb LANGUAGE sql STABLE AS $$ SELECT jsonb_build_object('storeId',id,'storeSlug',store_slug) FROM profiles WHERE id=p $$;
""")
# Production definitions (read-only copies) of the authorization model and eligibility checks.
sql("""
CREATE FUNCTION public._marca_assert_owner_eligible(p_uid uuid) RETURNS void LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE p record; BEGIN
  SELECT id, is_template_profile, account_status, deleted_at INTO p FROM profiles WHERE id = p_uid;
  IF p.id IS NULL THEN RAISE EXCEPTION 'Perfil inválido.' USING ERRCODE='42501'; END IF;
  IF COALESCE(p.is_template_profile,false) THEN RAISE EXCEPTION 'x' USING ERRCODE='42501'; END IF;
  IF p.deleted_at IS NOT NULL OR p.account_status IN ('excluida','exclusao_solicitada') THEN RAISE EXCEPTION 'x' USING ERRCODE='42501'; END IF;
  IF EXISTS (SELECT 1 FROM account_deletion_requests WHERE merchant_id = p_uid AND status IN ('pending','in_review','approved')) THEN RAISE EXCEPTION 'x' USING ERRCODE='42501'; END IF;
  IF NOT EXISTS (SELECT 1 FROM user_roles WHERE user_id = p_uid AND role = 'user') OR EXISTS (SELECT 1 FROM user_roles WHERE user_id = p_uid AND role NOT IN ('user','admin')) THEN RAISE EXCEPTION 'x' USING ERRCODE='42501'; END IF;
  IF EXISTS (SELECT 1 FROM brand_account_owned_stores WHERE store_profile_id = p_uid AND store_role = 'secondary') THEN RAISE EXCEPTION 'x' USING ERRCODE='42501'; END IF;
END $function$;
CREATE FUNCTION public.can_actor_manage_marca_store(p_actor uuid, p_store_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$ SELECT p_actor IS NOT NULL AND(p_actor=p_store_id OR EXISTS(SELECT 1 FROM merchant_store_memberships m JOIN brand_account_owned_stores o ON o.store_profile_id=m.store_id JOIN brand_accounts b ON b.id=o.brand_account_id JOIN brand_account_owned_stores p ON p.brand_account_id=b.id AND p.slot=1 AND p.store_role='primary' AND p.store_profile_id=b.owner_profile_id JOIN profiles profile ON profile.id=m.store_id WHERE m.user_id=p_actor AND m.store_id=p_store_id AND m.active AND m.authorization_approved AND m.permission='administrator' AND b.owner_profile_id=p_actor AND profile.deleted_at IS NULL AND coalesce(profile.account_status,'active')='active' AND get_effective_store_plan(b.owner_profile_id)->>'plan'='marca' AND get_effective_store_plan(b.owner_profile_id)->>'planSource'='direct')) $function$;
CREATE FUNCTION public.get_my_managed_marca_stores() RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$ SELECT coalesce(jsonb_agg(_managed_store_json(o.store_profile_id) ORDER BY o.slot),'[]'::jsonb) FROM brand_account_owned_stores o WHERE can_actor_manage_marca_store(auth.uid(),o.store_profile_id) $function$;
""")
sql((ROOT / "drizzle/migrations/0080_marca_second_store_creation.sql").read_text())
print("PASS real migration 0080 applied to disposable PostgreSQL")

def user(email, store, meta=None):
    m = {"full_name": "Fixture", "store_name": store, **(meta or {})}
    return sql(f"INSERT INTO auth.users(email,raw_user_meta_data) VALUES('{email}','{json.dumps(m)}') RETURNING id")

A = user("dono-a@example.invalid", "Loja Principal A")       # MARCA owner, 1 store
X = user("dono-x@example.invalid", "Loja Principal X")       # MARCA owner, already 2 stores
X2 = user("x2@example.invalid", "Loja X2")
F = user("free@example.invalid", "Loja Free")                # not MARCA
BA = sql(f"INSERT INTO brand_accounts(owner_profile_id) VALUES('{A}') RETURNING id")
BX = sql(f"INSERT INTO brand_accounts(owner_profile_id) VALUES('{X}') RETURNING id")
sql(f"""INSERT INTO master_subscriptions VALUES('{A}','marca','active','2099-01-01'),('{X}','marca','active','2099-01-01');
INSERT INTO brand_account_owned_stores(brand_account_id,store_profile_id,slot,store_role,link_origin) VALUES('{BA}','{A}',1,'primary','owner_auto'),
 ('{BX}','{X}',1,'primary','owner_auto'),('{BX}','{X2}',2,'secondary','admin_link');
INSERT INTO merchant_store_memberships(user_id,store_id,authorization_approved) VALUES('{X}','{X2}',true);
INSERT INTO products(user_id,name) VALUES('{A}','Produto A'),('{X}','Produto X');""")
before = sql("SELECT md5(string_agg(t::text, '|' ORDER BY t::text)) FROM (SELECT * FROM brand_account_owned_stores WHERE brand_account_id<>'%s' UNION ALL SELECT id,null,store_id,null,null,null,user_id,created_at FROM merchant_store_memberships) t" % BA)

def slots(actor): return json.loads(sql(f"SET test.actor='{actor}';SET ROLE authenticated;SELECT get_my_marca_store_slots()"))
def begin(actor, key, email="nova@example.invalid", store="Loja Nova"):
    return json.loads(sql(f"SET ROLE service_role;SELECT begin_marca_second_store_creation('{actor}','{key}','{email}','Responsavel Nova','{store}')"))

assert slots(A) == {"eligible": True, "used": 1, "limit": 2, "canCreate": True, "pending": False}, slots(A)
assert slots(X)["canCreate"] is False and slots(X)["used"] == 2
assert slots(F)["eligible"] is False
print("PASS slots: MARCA with 1 store can create; MARCA with 2 stores shows limit; non-MARCA hidden")

# Direct access is closed to merchants.
sql(f"SET test.actor='{A}';SET ROLE authenticated;SELECT begin_marca_second_store_creation('{A}','{uuid.uuid4()}','e@example.invalid','Nome Ok','Loja Ok')", fail=True)
sql(f"SET test.actor='{A}';SET ROLE authenticated;SELECT count(*) FROM marca_store_creation_requests", fail=True)
assert begin(F, uuid.uuid4())["state"] == "ineligible"
assert begin(X, uuid.uuid4())["state"] == "limit_reached"
assert begin(X2, uuid.uuid4())["state"] == "ineligible", "secondary store must not create"
assert begin(A, uuid.uuid4(), email="dono-x@example.invalid")["state"] == "email_unavailable"
print("PASS merchants cannot call service RPCs; non-MARCA/secondary ineligible; 2-store account blocked; existing e-mail refused")

# Concurrent begins (different keys) -> exactly one claim.
keys = [str(uuid.uuid4()) for _ in range(8)]
with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:
    results = list(pool.map(lambda k: begin(A, k), keys))
claimed = [r for r in results if r["state"] == "claimed"]
assert len(claimed) == 1 and all(r["state"] == "in_progress" for r in results if r["state"] != "claimed"), results
c = claimed[0]; key = keys[results.index(c)]
assert begin(A, key)["state"] == "in_progress", "same-key replay while running must not claim again"
assert slots(A)["pending"] is True
print("PASS 8 concurrent requests -> 1 claim, 7 in_progress; same-key replay does not re-claim")

# Official provisioning path creates the owner/profile; completion links atomically.
N = user("nova@example.invalid", c["storeName"], {"full_name": c["ownerName"], "marca_store_request_id": c["requestId"]})
assert N != A
sql(f"SET ROLE service_role;SELECT complete_marca_second_store_creation('{c['requestId']}','{uuid.uuid4()}','{N}')", fail=True)  # forged fence
done = json.loads(sql(f"SET ROLE service_role;SELECT complete_marca_second_store_creation('{c['requestId']}','{c['attemptToken']}','{N}')"))
assert done["storeId"] == N and done["storeSlug"] == "loja-nova"
assert sql(f"SELECT slot||store_role||link_origin FROM brand_account_owned_stores WHERE store_profile_id='{N}'") == "2secondaryowner_created"
assert sql(f"SELECT count(*) FROM merchant_store_memberships WHERE store_id='{N}'") == "1"
assert sql(f"SELECT user_id||active::text||authorization_approved::text||permission FROM merchant_store_memberships WHERE store_id='{N}'") == f"{A}truetrueadministrator"
assert sql(f"SELECT get_effective_store_plan('{N}')->>'plan'") == "marca"
assert sql(f"SELECT can_actor_manage_marca_store('{A}','{N}')") == "t"
assert sql(f"SELECT can_actor_manage_marca_store('{X}','{N}')") == "f"
assert sql(f"SELECT can_actor_manage_marca_store('{N}','{A}')") == "f", "new owner gains no access to the principal"
assert len(json.loads(sql(f"SET test.actor='{A}';SET ROLE authenticated;SELECT get_my_managed_marca_stores()"))) == 2
assert sql(f"SELECT count(*) FROM products WHERE user_id='{N}'") == "0", "nothing copied"
print("PASS forged fence refused; new store_id/owner/slug; slot 2 + one approved membership; inherits MARCA; listed for owner only; no data copied")

# Replay and third-store attempts.
assert begin(A, key) == {"state": "completed", "storeId": N}
assert begin(A, uuid.uuid4(), email="terceira@example.invalid")["state"] == "limit_reached"
assert slots(A)["canCreate"] is False
sql(f"SET ROLE service_role;SELECT complete_marca_second_store_creation('{c['requestId']}','{c['attemptToken']}','{N}')", fail=True)
print("PASS same-key replay returns same store; third store blocked; completion cannot run twice")

# Expired attempt is fenced; its unlinked owner is handed over for removal; the stale fence cannot complete.
B = user("dono-b@example.invalid", "Loja Principal B")
BB = sql(f"INSERT INTO brand_accounts(owner_profile_id) VALUES('{B}') RETURNING id")
sql(f"INSERT INTO master_subscriptions VALUES('{B}','marca','active','2099-01-01');INSERT INTO brand_account_owned_stores(brand_account_id,store_profile_id,slot,store_role) VALUES('{BB}','{B}',1,'primary')")
s1 = begin(B, uuid.uuid4(), email="b2@example.invalid", store="Loja B Dois")
O = user("b2@example.invalid", "Loja B Dois", {"marca_store_request_id": s1["requestId"]})
sql(f"UPDATE marca_store_creation_requests SET lease_expires_at=now()-interval '1 second' WHERE id='{s1['requestId']}'")
s2 = begin(B, uuid.uuid4(), email="b3@example.invalid", store="Loja B Tres")
assert s2["state"] == "claimed" and s2["cleanupUserId"] == O, s2
sql(f"SET ROLE service_role;SELECT complete_marca_second_store_creation('{s1['requestId']}','{s1['attemptToken']}','{O}')", fail=True)
sql(f"DELETE FROM auth.users WHERE id='{s2['cleanupUserId']}'")  # what the handler does
assert sql(f"SELECT count(*) FROM profiles WHERE id='{O}'") == "0"
assert sql(f"SELECT fail_marca_second_store_creation('{s2['requestId']}','{s2['attemptToken']}','creation_failed')") == "t"
assert sql(f"SELECT fail_marca_second_store_creation('{s2['requestId']}','{s2['attemptToken']}','creation_failed')") == "f"
assert sql(f"SELECT count(*) FROM brand_account_owned_stores WHERE brand_account_id='{BB}'") == "1"
print("PASS expired attempt fenced out, its unlinked account released and removed; failures are fenced and idempotent; no partial link")

after = sql("SELECT md5(string_agg(t::text, '|' ORDER BY t::text)) FROM (SELECT * FROM brand_account_owned_stores WHERE brand_account_id NOT IN ('%s','%s') UNION ALL SELECT id,null,store_id,null,null,null,user_id,created_at FROM merchant_store_memberships WHERE store_id<>'%s') t" % (BA, BB, N))
assert before == after, "pre-existing links/memberships changed"
print("PASS pre-existing 2-store account links and memberships unchanged")
