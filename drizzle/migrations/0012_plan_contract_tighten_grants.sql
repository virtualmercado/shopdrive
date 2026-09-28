REVOKE ALL ON public.plan_contract_versions, public.plan_contract_settings, public.plan_contract_acceptances FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.plan_contract_versions, public.plan_contract_settings, public.plan_contract_acceptances FROM authenticated;
REVOKE UPDATE, DELETE, TRUNCATE ON public.plan_contract_acceptances FROM service_role;
GRANT SELECT ON public.plan_contract_versions, public.plan_contract_settings, public.plan_contract_acceptances TO authenticated;