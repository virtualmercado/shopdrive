"""Run only against the disposable localhost MARCA fixtures; never managed credentials."""
import subprocess
D='postgresql://nobody@127.0.0.1:55441/marca_test?sslmode=disable'
def sql(q,fail=False):
 p=subprocess.run(['psql',D,'-X','-v','ON_ERROR_STOP=1','-At','-c',q],capture_output=True,text=True)
 if fail:assert p.returncode!=0;return
 if p.returncode:raise Exception(p.stderr)
 return p.stdout.strip().splitlines()[-1]
A='11111111-1111-4111-8111-111111111111';B='22222222-2222-4222-8222-222222222222';C='33333333-3333-4333-8333-333333333333'
header=f'''SET test.actor='{A}';SET request.headers='{{"x-shopdrive-store-id":"{B}"}}';SET ROLE authenticated;'''
assert sql(header+f"SELECT count(*) FROM profiles WHERE id='{B}'")=='0'
assert sql(header+'SELECT count(*) FROM merchant_store_profiles')=='1'
assert sql(header+'SELECT count(*) FROM payment_settings')=='0'
assert sql(header+'SELECT count(*) FROM merchant_store_payment_settings')=='1'
assert sql(header+"UPDATE merchant_store_profiles SET store_name='Updated B';SELECT store_name FROM merchant_store_profiles")=='Updated B'
assert sql(header+"UPDATE merchant_store_payment_settings SET pix_enabled=true;SELECT pix_enabled FROM merchant_store_payment_settings")=='t'
for q in ['SELECT mercadopago_access_token FROM merchant_store_payment_settings',"UPDATE merchant_store_profiles SET email='changed'","UPDATE merchant_store_profiles SET store_slug='changed'"]:
 sql(header+q,True)
sql(f'''SET test.actor='{C}';SET request.headers='{{"x-shopdrive-store-id":"{B}"}}';SET ROLE authenticated;SELECT * FROM merchant_store_profiles;''',True)
print('PASS private tables denied; operational projections scoped; secrets absent; account mutations denied; unapproved actor denied')
