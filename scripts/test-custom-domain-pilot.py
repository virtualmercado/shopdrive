"""Test the actual candidate/applied migration in a disposable LOCAL PostgreSQL, never production.

Usage: python3 scripts/test-custom-domain-pilot.py --port 55439 --helpers /tmp/pilot-v2/functions.json --migration <path>
The helpers JSON must be captured by a read-only query; credentials/hosted data are not imported.
"""
import argparse
import json
import os
import subprocess
from pathlib import Path

parser = argparse.ArgumentParser()
parser.add_argument('--port', type=int, default=55439)
parser.add_argument('--helpers', required=True)
parser.add_argument('--migration', required=True)
args = parser.parse_args()
root = Path(__file__).resolve().parents[1]
helpers = json.loads(Path(args.helpers).read_text())
policies = """
CREATE POLICY "Admins read custom domain config" ON public.custom_domain_platform_config FOR SELECT TO authenticated USING(public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins read custom domain access" ON public.custom_domain_v2_access FOR SELECT TO authenticated USING(public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins can view all domains" ON public.merchant_domains FOR SELECT USING(public.has_role(auth.uid(),'admin'));
CREATE POLICY "Merchants can view their own domains" ON public.merchant_domains FOR SELECT USING(auth.uid()=merchant_id);
"""
sql = (root / 'supabase/tests/custom-domain-pilot.fixture.sql').read_text() + '\n'
sql += '\n'.join(helpers[k] for k in ['roles', 'admin', 'store_valid', 'reserved', 'normalize', 'setter'])
sql += policies + Path(args.migration).read_text() + (root / 'supabase/tests/custom-domain-pilot.sql').read_text()
# No managed connection credentials or settings reach this disposable local process.
local_env = {k: v for k, v in os.environ.items() if not k.startswith('PG')}
local_env['PGSSLMODE'] = 'disable'
database = 'pilot_validation'
base = ['psql', '-X', '-h', '127.0.0.1', '-p', str(args.port), '-U', 'nobody', '-v', 'ON_ERROR_STOP=1', '-q']
subprocess.run(base + ['-d', 'postgres', '-c', f'DROP DATABASE IF EXISTS {database};'], check=True, env=local_env)
subprocess.run(base + ['-d', 'postgres', '-c', f'CREATE DATABASE {database};'], check=True, env=local_env)
for role in ['anon', 'authenticated', 'service_role']:
    subprocess.run(base + ['-d', 'postgres', '-c', f'DROP ROLE IF EXISTS {role};'], check=True, env=local_env)
subprocess.run(['psql', '-X', '-h', '127.0.0.1', '-p', str(args.port), '-U', 'nobody', '-d', database,
                '-v', 'ON_ERROR_STOP=1', '-q'], input=sql, text=True, check=True, env=local_env)