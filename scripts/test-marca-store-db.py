"""Run the real MARCA store-authorization and cancellation migrations (0076-0079) in a
disposable localhost PostgreSQL cluster with synthetic rows only. Never reads managed
credentials and never connects to the hosted database.
"""
import concurrent.futures
import json
import os
import shutil
import subprocess
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = Path("/tmp/marca-store-db")
PORT = "55441"
ENV = {k: v for k, v in os.environ.items() if not k.startswith("PG")}
# Use the PostgreSQL installation's own binaries so initdb finds its extension libraries.
_bins = sorted(Path("/nix/store").glob("*-postgresql-17*/bin/initdb"))
if _bins:
    ENV["PATH"] = str(_bins[0].parent) + ":" + ENV.get("PATH", "")
DSN = f"postgresql://nobody@127.0.0.1:{PORT}/marca_test?sslmode=disable"
ADMIN = f"postgresql://nobody@127.0.0.1:{PORT}/postgres?sslmode=disable"


def as_nobody(*cmd):
    return subprocess.run(["runuser", "-u", "nobody", "--", "env", "PATH=" + ENV["PATH"], *cmd], env=ENV, capture_output=True, text=True)


def start_cluster():
    if not (DATA / "PG_VERSION").exists():
        shutil.rmtree(DATA, ignore_errors=True)
        DATA.mkdir(parents=True)
        shutil.chown(DATA, "nobody")
        result = as_nobody("initdb", "-D", str(DATA), "-U", "nobody", "--auth=trust")
        assert result.returncode == 0, result.stderr
    if as_nobody("pg_ctl", "-D", str(DATA), "status").returncode != 0:
        result = as_nobody("pg_ctl", "-D", str(DATA), "-l", str(DATA / "server.log"), "-w", "-o",
                           f"-p {PORT} -k /tmp -c listen_addresses=127.0.0.1", "start")
        assert result.returncode == 0, result.stderr
    for _ in range(30):
        if subprocess.run(["psql", ADMIN, "-Atc", "select 1"], env=ENV, capture_output=True).returncode == 0:
            return
        time.sleep(0.2)
    raise AssertionError("local cluster unavailable")


def sql(query, fail=False):
    p = subprocess.run(["psql", DSN, "-X", "-v", "ON_ERROR_STOP=1", "-At", "-c", query], env=ENV, capture_output=True, text=True)
    if fail:
        assert p.returncode != 0, "expected rejection: " + query
        return None
    if p.returncode:
        raise AssertionError(p.stderr)
    return p.stdout.strip().splitlines()[-1] if p.stdout.strip() else ""


start_cluster()
subprocess.run(["dropdb", "--if-exists", "--maintenance-db=" + ADMIN, "marca_test"], env=ENV, check=True, capture_output=True)
subprocess.run(["createdb", "--maintenance-db=" + ADMIN, "marca_test"], env=ENV, check=True, capture_output=True)

# Minimal synthetic schema for the objects the real migrations reference.
sql("""
DO $$ BEGIN IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS; END IF; END $$;
CREATE SCHEMA auth; GRANT USAGE ON SCHEMA auth TO authenticated, anon, service_role;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('test.actor',true),'')::uuid $$;
CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('test.role',true),'') $$;
GRANT USAGE ON SCHEMA public TO authenticated, anon, service_role;
CREATE TYPE public.app_role AS ENUM ('admin','user');
CREATE TABLE public.profiles(id uuid primary key,store_name text,full_name text,store_slug text,deleted_at timestamptz,account_status text,email text,
 cpf_cnpj text,store_description text,store_logo_url text,primary_color text,secondary_color text,address text,address_city text,address_state text,
 address_number text,address_neighborhood text,address_complement text,address_zip_code text,phone text,whatsapp_number text,about_us_text text,
 about_us_title text,return_policy_text text,instagram_url text,facebook_url text,youtube_url text,x_url text,banner_desktop_url text,banner_mobile_url text,
 banner_desktop_urls text[],banner_mobile_urls text[],content_banners jsonb,main_banner_content jsonb,footer_bg_color text,footer_text_color text,
 font_family text,font_weight int,product_image_format text,product_border_style text,product_text_alignment text,product_button_display text,
 button_border_style text,button_bg_color text,button_text_color text,header_logo_position text,price_color text,title_color text,topbar_enabled boolean,
 topbar_bg_color text,topbar_text_color text,topbar_text text,topbar_link_type text,topbar_link_target text,store_model text,store_layout text,
 selected_benefit_banners jsonb,home_video_enabled boolean,home_video_id text,home_video_title text,home_video_description text,home_video_url_original text,
 is_maintenance_mode boolean,source_template_id uuid,banner_rect_1_url text,banner_rect_2_url text,minibanner_1_img2_url text,minibanner_2_img2_url text,
 content_banner_enabled boolean,content_banner_title text,content_banner_subtitle text,content_banner_title_color text,content_banner_subtitle_color text,
 content_banner_url text,content_banner_image_url text);
CREATE TABLE public.user_roles(user_id uuid, role public.app_role);
CREATE FUNCTION public.has_role(uuid,public.app_role) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$ SELECT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=$1 AND role=$2) $$;
CREATE FUNCTION public.assert_caller_is_admin() RETURNS void LANGUAGE plpgsql AS $$ BEGIN IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF; END $$;
CREATE TABLE public.brand_accounts(id uuid primary key,owner_profile_id uuid);
CREATE TABLE public.brand_account_owned_stores(id uuid default gen_random_uuid(),brand_account_id uuid,store_profile_id uuid,slot int,store_role text,created_by uuid);
CREATE TABLE public.master_subscriptions(id uuid primary key,user_id uuid,plan_id text,status text,gateway text,gateway_subscription_id text,
 current_period_end timestamptz,created_at timestamptz default now(),updated_at timestamptz default now(),billing_cycle text,payment_method text,
 no_charge boolean,card_token text);
CREATE TABLE public.master_subscription_logs(subscription_id uuid,user_id uuid,event_type text,event_description text,metadata jsonb);
CREATE TABLE public.payment_settings(id uuid primary key default gen_random_uuid(),user_id uuid,whatsapp_enabled boolean,whatsapp_number text,
 whatsapp_accepts_cash boolean,whatsapp_accepts_credit boolean,whatsapp_accepts_debit boolean,whatsapp_accepts_pix boolean,whatsapp_accepts_transfer boolean,
 mercadopago_enabled boolean,mercadopago_public_key text,mercadopago_access_token text,mercadopago_access_token_set boolean,mercadopago_webhook_secret_set boolean,
 pagbank_enabled boolean,pagbank_email text,pagbank_token_set boolean,pagbank_webhook_secret_set boolean,stone_ton_enabled boolean,stone_ton_public_key text,
 stone_ton_merchant_id text,stone_ton_secret_key_set boolean,infinitepay_enabled boolean,infinitepay_handle text,infinitepay_client_secret_set boolean,
 infinitepay_webhook_secret_set boolean,pix_enabled boolean,pix_provider text,pix_discount_percent int,credit_card_enabled boolean,credit_card_provider text,
 credit_card_installments_no_interest int,boleto_enabled boolean,boleto_provider text);
CREATE TABLE public.store_customers(customer_id uuid,store_owner_id uuid);
CREATE TABLE public.customer_addresses(customer_id uuid);
CREATE TABLE public.merchant_domains(id uuid,merchant_id uuid,released_at timestamptz,updated_at timestamptz,normalized_domain text,flow_version int,v2_state text,
 ownership_verified_at timestamptz,dns_verified_at timestamptz,routing_status text,ssl_status text,last_dns_check timestamptz,needs_reverification boolean);
CREATE FUNCTION public.get_my_custom_domain_v2() RETURNS jsonb LANGUAGE sql AS $$ SELECT '{}'::jsonb $$;
CREATE FUNCTION public._active_v2_store_hostname(uuid) RETURNS text LANGUAGE sql AS $$ SELECT NULL::text $$;
CREATE FUNCTION public.get_effective_store_plan(uuid) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER AS $$
 SELECT jsonb_build_object('plan',coalesce((SELECT plan_id FROM public.master_subscriptions WHERE user_id=$1 AND status='active' LIMIT 1),'free'),'planSource','direct') $$;
CREATE FUNCTION public.get_brand_inherited_plan(uuid) RETURNS text LANGUAGE sql STABLE AS $$ SELECT 'marca'::text FROM public.brand_account_owned_stores WHERE store_profile_id=$1 AND store_role='secondary' $$;
""")
for table, policies in {
    "profiles": [("Users can view their own profile", "SELECT", "auth.uid()=id"), ("Users can update their own profile", "UPDATE", "auth.uid()=id")],
    "master_subscriptions": [("Users can view their own subscriptions", "SELECT", "auth.uid()=user_id")],
    "payment_settings": [("Users can view their own payment settings", "SELECT", "auth.uid()=user_id"),
                         ("Users can insert their own payment settings", "INSERT", "auth.uid()=user_id"),
                         ("Users can update their own payment settings", "UPDATE", "auth.uid()=user_id"),
                         ("Users can delete their own payment settings", "DELETE", "auth.uid()=user_id")],
    "customer_addresses": [("Store owners can view customer addresses", "SELECT", "false")],
}.items():
    sql(f"ALTER TABLE public.{table} ENABLE ROW LEVEL SECURITY; GRANT SELECT,INSERT,UPDATE,DELETE ON public.{table} TO authenticated;")
    for name, command, expression in policies:
        clause = "WITH CHECK" if command == "INSERT" else "USING"
        sql(f'CREATE POLICY "{name}" ON public.{table} FOR {command} TO authenticated {clause} ({expression})')

for migration in ["0076_marca_explicit_store_authorization", "0077_marca_recurrence_cancellation_single_flight",
                  "0078_marca_scoped_private_data_containment", "0079_marca_explicit_access_approval"]:
    sql((ROOT / f"drizzle/migrations/{migration}.sql").read_text())
print("PASS real migrations 0076-0079 applied to disposable PostgreSQL")

A, B, C = "11111111-1111-4111-8111-111111111111", "22222222-2222-4222-8222-222222222222", "33333333-3333-4333-8333-333333333333"
S, BR, ADM = "44444444-4444-4444-8444-444444444444", "55555555-5555-4555-8555-555555555555", "66666666-6666-4666-8666-666666666666"
sql(f"""INSERT INTO profiles(id,store_slug,store_name,email) VALUES('{A}','fixture-a','Loja A','a@example.invalid'),('{B}','fixture-b','Loja B','b@example.invalid'),('{C}','fixture-c','Loja C','c@example.invalid');
INSERT INTO user_roles VALUES('{ADM}','admin');
INSERT INTO brand_accounts VALUES('{BR}','{A}');
INSERT INTO brand_account_owned_stores(brand_account_id,store_profile_id,slot,store_role) VALUES('{BR}','{A}',1,'primary'),('{BR}','{B}',2,'secondary');
INSERT INTO master_subscriptions(id,user_id,plan_id,status,gateway,gateway_subscription_id,current_period_end,card_token) VALUES
 ('{A}','{A}','marca','active',null,null,'2099-01-01','synthetic-card-a'),('{S}','{B}','premium','active','mercadopago','fixture-reference','2026-11-20','synthetic-card-b');
INSERT INTO payment_settings(user_id,mercadopago_access_token,pix_enabled) VALUES('{B}','synthetic-secret',false);""")


def actor(a, query, store=None, fail=False):
    header = f"""SET request.headers='{{"x-shopdrive-store-id":"{store}"}}';""" if store else ""
    return sql(f"SET test.actor='{a}';{header}SET ROLE authenticated;{query}", fail)


# Ownership, financial link and explicit approval.
assert actor(A, f"SELECT can_manage_owned_store('{A}')") == "t"
assert actor(A, f"SELECT can_manage_owned_store('{B}')") == "f", "MARCA link alone must not authorize"
sql(f"INSERT INTO merchant_store_memberships(user_id,store_id) VALUES('{A}','{B}')")
assert actor(A, f"SELECT can_manage_owned_store('{B}')") == "f", "unapproved membership must not authorize"
actor(A, f"SELECT admin_set_marca_store_membership('{A}','{B}',true)", fail=True)
sql(f"SET test.actor='{ADM}';SELECT admin_set_marca_store_membership('{A}','{B}',true)")
assert actor(A, f"SELECT can_manage_owned_store('{B}')") == "t"
assert actor(C, f"SELECT can_manage_owned_store('{B}')") == "f"
print("PASS owner allowed; financial link and unapproved membership denied; only admin approves; unrelated actor denied")

# Selected-store header.
assert actor(A, "SELECT merchant_request_store_id()", B) == B
actor(C, "SELECT merchant_request_store_id()", B, fail=True)
actor(A, "SELECT merchant_request_store_id()", "not-a-uuid", fail=True)
assert actor(A, "SELECT auth.uid()", B) == A, "actor identity must remain intact"
assert json.loads(actor(A, "SELECT get_my_store_context(NULL)", B))["storeId"] == B
actor(C, f"SELECT get_my_store_context('{B}')", fail=True)
assert len(json.loads(actor(A, "SELECT get_my_managed_marca_stores()"))) == 2
assert len(json.loads(actor(C, "SELECT get_my_managed_marca_stores()"))) == 0
print("PASS manipulated store_id denied (403-equivalent); actor auth.uid() unchanged; store list only for authorized actor")

# Private account data and secrets are never delegated.
assert actor(A, f"SELECT count(*) FROM profiles WHERE id='{B}'", B) == "0"
assert actor(A, "SELECT count(*) FROM payment_settings", B) == "0"
assert actor(A, f"SELECT count(*) FROM master_subscriptions WHERE user_id='{B}'", B) == "0"
assert actor(A, "SELECT store_name FROM merchant_store_profiles", B) == "Loja B"
assert actor(A, "SELECT count(*) FROM merchant_store_payment_settings", B) == "1"
assert actor(A, "SELECT plan_id FROM merchant_store_subscriptions", B) == "premium"
actor(A, "SELECT mercadopago_access_token FROM merchant_store_payment_settings", B, fail=True)
actor(A, "SELECT card_token FROM merchant_store_subscriptions", B, fail=True)
actor(A, "UPDATE merchant_store_profiles SET email='changed@example.invalid'", B, fail=True)
actor(A, "UPDATE merchant_store_profiles SET store_slug='changed'", B, fail=True)
assert actor(A, "UPDATE merchant_store_profiles SET store_name='Loja B editada';SELECT store_name FROM merchant_store_profiles", B) == "Loja B editada"
assert actor(A, "UPDATE merchant_store_payment_settings SET pix_enabled=true;SELECT pix_enabled FROM merchant_store_payment_settings", B) == "t"
assert actor(C, "SELECT count(*) FROM merchant_store_profiles", B, fail=True) is None
assert sql(f"SELECT store_name FROM profiles WHERE id='{A}'") == "Loja A"
print("PASS raw profile/payment/subscription rows hidden; secrets/card token unreadable; email/slug immutable; operational settings scoped to B")

# Revocation.
sql(f"SET test.actor='{ADM}';SELECT admin_set_marca_store_membership('{A}','{B}',false)")
actor(A, "SELECT count(*) FROM merchant_store_profiles", B, fail=True)
sql(f"SET test.actor='{ADM}';SELECT admin_set_marca_store_membership('{A}','{B}',true)")
print("PASS revocation is immediate")

# Cancellation single-flight.
claim_query = f"SET test.role='service_role';SELECT claim_marca_recurrence_cancellation('{ADM}','{B}','{S}')"
with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:
    claims = [json.loads(r) for r in pool.map(lambda _: sql(claim_query), range(8))]
assert sum(1 for c in claims if c.get("claimed")) == 1, claims
token = next(c["token"] for c in claims if c.get("claimed"))
sql(f"SET test.role='service_role';SELECT mark_marca_recurrence_cancellation_sent('{S}','{token}')")
sql(f"SET test.role='service_role';SELECT fail_marca_recurrence_cancellation('{S}','{token}')")
assert sql(f"SELECT state FROM marca_recurrence_cancellations WHERE subscription_id='{S}'") == "unknown"
sql(f"UPDATE marca_recurrence_cancellations SET claimed_at=now()-interval '2 minutes' WHERE subscription_id='{S}'")
retry = json.loads(sql(claim_query))
assert retry["claimed"] and retry["reconcile_only"], "ambiguous send must only reconcile"
sql(f"SET test.role='service_role';SELECT mark_marca_recurrence_cancellation_sent('{S}','{retry['token']}')", fail=True)
sql(f"SET test.role='service_role';SELECT complete_marca_recurrence_cancellation('{S}','{retry['token']}','authorized','cancelled')")
assert json.loads(sql(claim_query))["completed"] is True
assert sql("SELECT count(*) FROM master_subscription_logs") == "1"
assert sql(f"SELECT status||':'||current_period_end::date FROM master_subscriptions WHERE id='{S}'") == "active:2026-11-20"
sql(f"SET test.role='authenticated';SELECT claim_marca_recurrence_cancellation('{ADM}','{B}','{S}')", fail=True)
sql(f"SET test.role='service_role';SELECT claim_marca_recurrence_cancellation('{A}','{B}','{S}')", fail=True)
print("PASS 8 concurrent claims -> 1 worker; unknown outcome reconciles without new PUT; completed returns idempotently; "
      "one log; paid period preserved; service role + Master/admin required")
