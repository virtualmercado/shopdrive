
-- Switch public_store_profiles to definer-mode so it can serve safe columns to anon
ALTER VIEW public.public_store_profiles SET (security_invoker = false);
GRANT SELECT ON public.public_store_profiles TO anon, authenticated;

-- Remove the policy that exposed full profile rows (including email, phone, cpf_cnpj, address) to anyone
DROP POLICY IF EXISTS "Anyone can view public store data for stores with slugs" ON public.profiles;
