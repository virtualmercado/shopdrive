"""Global-ingress resolver/kill-switch rules in a disposable LOCAL PostgreSQL cluster (never production).

Usage: python3 scripts/test-custom-domain-ingress-db.py --functions /tmp/pgi/functions.json
The functions JSON holds live definitions captured by a read-only query; no hosted data or credentials are used.
"""
import argparse, json, os, shutil, subprocess, tempfile
from pathlib import Path

ap = argparse.ArgumentParser()
ap.add_argument('--functions', required=True)
ap.add_argument('--port', type=int, default=55447)
a = ap.parse_args()
root = Path(__file__).resolve().parents[1]
fns = json.loads(Path(a.functions).read_text())
order = ['is_reserved_custom_domain', 'normalize_custom_domain', 'normalize_custom_domain_hostname', 'resolve_public_store_by_domain']
sql = (root / 'supabase/tests/custom-domain-pilot.fixture.sql').read_text() + '\n'
sql += '\n'.join(fns[k].rstrip() + ';' for k in order) + '\n'
sql += (root / 'drizzle/migrations/0084_custom_hostname_write_kill_switch.sql').read_text().replace('--> statement-breakpoint', '') + '\n'
sql += (root / 'supabase/tests/custom-domain-ingress.sql').read_text()
env = {k: v for k, v in os.environ.items() if not k.startswith('PG')}
bins = sorted(Path('/nix/store').glob('*-postgresql-17*/bin/initdb'))
if bins:
    env['PATH'] = str(bins[0].parent) + ':' + env.get('PATH', '')
nobody = (lambda *c: subprocess.run(['runuser', '-u', 'nobody', '--', 'env', 'PATH=' + env['PATH'], *c], env=env, capture_output=True, text=True)) \
    if os.geteuid() == 0 else (lambda *c: subprocess.run(list(c), env=env, capture_output=True, text=True))
data = tempfile.mkdtemp(prefix='pgi-')
if os.geteuid() == 0:
    shutil.chown(data, 'nobody')
try:
    r0 = nobody('initdb', '-D', data, '-U', 'nobody', '--auth=trust')
    assert r0.returncode == 0, r0.stderr
    r0 = nobody('pg_ctl', '-D', data, '-l', f'{data}/log', '-w', '-o', f'-p {a.port} -k /tmp -c listen_addresses=127.0.0.1', 'start')
    assert r0.returncode == 0, r0.stderr
    r = subprocess.run(['psql', '-X', '-h', '127.0.0.1', '-p', str(a.port), '-U', 'nobody', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-q'],
                       input=sql, text=True, env=env, capture_output=True)
    print(r.stderr.replace('psql:<stdin>', '').strip())
    raise SystemExit(r.returncode)
finally:
    nobody('pg_ctl', '-D', data, '-m', 'immediate', 'stop')
    shutil.rmtree(data, ignore_errors=True)
