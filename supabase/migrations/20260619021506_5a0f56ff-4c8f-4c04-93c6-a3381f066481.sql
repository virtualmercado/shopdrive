-- Fix: public store views must run as definer so anonymous visitors can resolve
-- public storefronts. Both views already restrict columns to public-safe fields
-- and filter by store_slug IS NOT NULL / public flags. Without this, RLS on the
-- underlying profiles table (which has no public SELECT policy) blocks anon
-- visitors and the storefront shows "Loja não encontrada".

ALTER VIEW public.public_store_profiles SET (security_invoker = off);
ALTER VIEW public.payment_settings_public SET (security_invoker = off);