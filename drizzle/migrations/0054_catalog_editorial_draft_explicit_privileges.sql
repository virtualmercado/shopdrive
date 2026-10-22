REVOKE ALL ON TABLE public.catalog_editorial_drafts FROM anon, authenticated;
GRANT SELECT ON TABLE public.catalog_editorial_drafts TO authenticated;
GRANT ALL ON TABLE public.catalog_editorial_drafts TO service_role;
COMMENT ON TABLE public.catalog_editorial_drafts IS 'Private versioned editor intent and last private preview. Authenticated access is owner-scoped read-only; all writes use revision-checked RPCs. No public catalog consumer.';