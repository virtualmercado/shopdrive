"""Disposable localhost PostgreSQL only: concurrent revocation must win over stale DNS work."""
import json
import os
import subprocess
import threading
import time

env = {k: v for k, v in os.environ.items() if not k.startswith('PG')}
env['PGSSLMODE'] = 'disable'
base = ['psql', '-X', '-h', '127.0.0.1', '-p', '55439', '-U', 'nobody', '-d', 'pilot_validation', '-v', 'ON_ERROR_STOP=1', '-q', '-A', '-t']
def sql(query):
    return subprocess.run(base, input=query, text=True, check=True, capture_output=True, env=env).stdout.strip()

sql("""
INSERT INTO public.profiles(id,store_slug) VALUES('11111111-1111-4111-8111-111111111111','pilot-fixture'),('22222222-2222-4222-8222-222222222222','admin-fixture');
INSERT INTO public.user_roles(user_id,role) VALUES('22222222-2222-4222-8222-222222222222','admin');
INSERT INTO public.custom_domain_platform_config(id,feature_enabled,ingress_ready) VALUES(true,false,false);
INSERT INTO public.custom_domain_v2_access(store_id,enabled,pilot_hostname) VALUES('11111111-1111-4111-8111-111111111111',true,'www.redearoma.com.br');
INSERT INTO public.merchant_domains(merchant_id,normalized_domain,last_verification_result) VALUES('11111111-1111-4111-8111-111111111111','redearoma.com.br','{"pilotHostname":"www.redearoma.com.br"}');
""")
snapshot = json.loads(sql("""SELECT jsonb_build_object('access',to_jsonb(a),'config',to_jsonb(c),'id',d.id,'stamp',d.updated_at)
 FROM public.custom_domain_v2_access a,public.custom_domain_platform_config c,public.merchant_domains d;"""))
lock = subprocess.Popen(base, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, env=env)
lock.stdin.write("BEGIN; SET application_name='pilot_test_revoker'; UPDATE public.custom_domain_v2_access SET enabled=false;\n")
lock.stdin.flush()
for _ in range(100):
    if sql("SELECT count(*) FROM pg_stat_activity WHERE application_name='pilot_test_revoker' AND state='idle in transaction';") == '1':
        break
    time.sleep(0.05)
else:
    raise RuntimeError('Revocation barrier was not reached')
def quote(value):
    return "'" + json.dumps(value).replace("'", "''") + "'::jsonb"
result = {'checkedAt': sql('SELECT now();'), 'ownership': 'verified', 'root': 'not_required', 'www': 'ok',
          'pilotHostname': 'www.redearoma.com.br', 'nameservers': [], 'provider': None, 'observed': {'txt': 1}, 'notes': []}
apply_query = f"""SET application_name='pilot_test_verifier'; SELECT public.apply_custom_domain_verification(
 '22222222-2222-4222-8222-222222222222','{snapshot['id']}','{snapshot['stamp']}',
 {quote(snapshot['access'])},{quote(snapshot['config'])},{quote(result)},'active','www.redearoma.com.br');"""
output = {}
def verify():
    output['process'] = subprocess.run(base, input=apply_query, capture_output=True, text=True, env=env)
thread = threading.Thread(target=verify)
thread.start()
for _ in range(100):
    if sql("SELECT count(*) FROM pg_stat_activity WHERE application_name='pilot_test_verifier' AND wait_event_type='Lock';") == '1':
        break
    time.sleep(0.05)
else:
    raise RuntimeError('Verifier did not wait on the authorization lock')
lock.stdin.write('COMMIT;\n'); lock.stdin.close(); lock.wait(timeout=10)
thread.join(timeout=10)
assert not thread.is_alive(), 'Verification did not finish after revocation committed'
completed = output['process']
assert completed.returncode != 0 and 'verification_context_changed' in completed.stderr, completed.stderr
assert sql('SELECT count(*) FROM public.domain_verification_logs;') == '0'
assert sql("SELECT count(*) FROM public.resolve_public_store_by_domain('www.redearoma.com.br');") == '0'
assert sql('SELECT NOT feature_enabled AND NOT ingress_ready FROM public.custom_domain_platform_config;') == 't'
print('PASS: concurrent revocation blocks stale verification atomically; no logs or activation; flags false')