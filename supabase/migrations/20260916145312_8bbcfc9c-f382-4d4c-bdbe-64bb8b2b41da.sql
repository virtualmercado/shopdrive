-- HOTFIX: storefronts must be resolvable by anonymous visitors.
-- The base table public.profiles stays private (owner + admin only). The public
-- surfaces below are column-allowlisted views that must run with the view
-- owner's privileges (security_invoker = off), otherwise anon reads return zero
-- rows and every storefront renders "Loja não encontrada".
-- Do NOT switch these views back to security_invoker = true without first
-- creating an equivalent public read surface.
ALTER VIEW public.public_store_profiles SET (security_invoker = off);
ALTER VIEW public.public_profiles SET (security_invoker = off);
ALTER VIEW public.correios_settings_public SET (security_invoker = off);
ALTER VIEW public.melhor_envio_settings_public SET (security_invoker = off);

COMMENT ON VIEW public.public_store_profiles IS
  'Public storefront surface. Column allowlist over profiles; runs as view owner (security_invoker=off) so anon visitors can resolve a store by store_slug. Never add private columns (email, documents, credentials, billing).';
COMMENT ON VIEW public.public_profiles IS
  'Public minimal store surface. Runs as view owner so anon visitors can resolve stores.';

GRANT SELECT ON public.public_store_profiles TO anon, authenticated;
GRANT SELECT ON public.public_profiles TO anon, authenticated;
GRANT SELECT ON public.correios_settings_public TO anon, authenticated;
GRANT SELECT ON public.melhor_envio_settings_public TO anon, authenticated;

-- Guest (anon) storefront/checkout RPCs lost EXECUTE during the 15/09 hardening.
GRANT EXECUTE ON FUNCTION public.get_melhor_envio_status(uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.resolve_catalog_share_code(text) TO anon;
GRANT EXECUTE ON FUNCTION public.get_public_quote_by_token(text) TO anon;