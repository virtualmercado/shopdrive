-- Rollback-only checks; no real user, store, object or public catalog is modified.
BEGIN;
DO $tests$
DECLARE v_uid uuid := '55555555-5555-4555-8555-555555555555'; v_config jsonb := '{"mode":"all","grouping":"none","separators":"auto"}';
BEGIN
 IF NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id='catalog-editorial-previews' AND public=false AND file_size_limit=52428800) THEN RAISE EXCEPTION 'private_preview_bucket_required'; END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_class WHERE oid='public.catalog_editorial_drafts'::regclass AND relrowsecurity) THEN RAISE EXCEPTION 'draft_rls_required'; END IF;
 IF has_table_privilege('authenticated','public.catalog_editorial_drafts','INSERT') OR has_table_privilege('authenticated','public.catalog_editorial_drafts','UPDATE') OR has_table_privilege('authenticated','public.catalog_editorial_drafts','DELETE') THEN RAISE EXCEPTION 'direct_draft_writes_forbidden'; END IF;
 IF has_function_privilege('anon','public.get_my_catalog_draft()','EXECUTE') THEN RAISE EXCEPTION 'anonymous_draft_rpc_forbidden'; END IF;
 IF has_function_privilege('authenticated','public._catalog_draft_json(uuid)','EXECUTE') THEN RAISE EXCEPTION 'arbitrary_store_helper_forbidden'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid='public.product_variant_values'::regclass AND tgname='catalog_source_variant_values') THEN RAISE EXCEPTION 'variant_revision_trigger_required'; END IF;
 PERFORM public._assert_catalog_draft_config(v_config,v_uid);
 BEGIN
  PERFORM public._assert_catalog_draft_config(v_config||'{"coverImage":"blob:temporary"}',v_uid);
  RAISE EXCEPTION 'temporary_image_accepted';
 EXCEPTION WHEN others THEN IF SQLERRM <> 'unauthorized catalog image' THEN RAISE; END IF; END;
 BEGIN
  PERFORM public._assert_catalog_draft_config(v_config||'{"coverImage":"https://example.invalid/storage/v1/object/public/product-images/other/catalog-covers/image.jpg"}',v_uid);
  RAISE EXCEPTION 'foreign_image_accepted';
 EXCEPTION WHEN others THEN IF SQLERRM <> 'unauthorized catalog image' THEN RAISE; END IF; END;
 BEGIN
  PERFORM public._assert_catalog_draft_config(v_config||'{"unexpected":true}',v_uid);
  RAISE EXCEPTION 'unknown_field_accepted';
 EXCEPTION WHEN others THEN IF SQLERRM <> 'unknown draft field' THEN RAISE; END IF; END;
 PERFORM set_config('request.jwt.claim.sub',v_uid::text,true);
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',v_uid,'role','authenticated')::text,true);
 IF public._catalog_editorial_allowed(v_uid) THEN RAISE EXCEPTION 'unknown_store_access_accepted'; END IF;
 IF public._catalog_preview_file_allowed(v_uid::text||'/66666666-6666-4666-8666-666666666666.pdf','read') THEN RAISE EXCEPTION 'unknown_store_file_access_accepted'; END IF;
 BEGIN
  PERFORM public.save_my_catalog_draft(0,1,v_config);
  RAISE EXCEPTION 'unauthorized_save_accepted';
 EXCEPTION WHEN others THEN IF SQLERRM <> 'editorial not allowed' THEN RAISE; END IF; END;
 RAISE NOTICE '12 catalog draft safety checks passed; no store or object changed.';
END $tests$;
ROLLBACK;