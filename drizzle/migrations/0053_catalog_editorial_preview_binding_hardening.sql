ALTER TABLE public.catalog_editorial_drafts ADD COLUMN pending_publication_baseline jsonb;
CREATE OR REPLACE FUNCTION public.begin_my_catalog_preview(_expected_revision bigint) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE uid uuid:=auth.uid(); d public.catalog_editorial_drafts; pid uuid:=gen_random_uuid(); base jsonb;
BEGIN
 IF NOT public._catalog_editorial_allowed(uid) THEN RAISE EXCEPTION 'editorial not allowed'; END IF;
 SELECT * INTO d FROM public.catalog_editorial_drafts WHERE store_id=uid FOR UPDATE;
 IF NOT FOUND OR d.config IS NULL OR d.draft_revision IS DISTINCT FROM _expected_revision THEN RAISE EXCEPTION 'catalog draft conflict' USING ERRCODE='40001'; END IF;
 SELECT jsonb_build_object('updatedAt',catalog_updated_at,'hasCurrent',catalog_current_url IS NOT NULL) INTO base FROM public.profiles WHERE id=uid;
 UPDATE public.catalog_editorial_drafts SET pending_preview_id=pid,pending_preview_path=uid::text||'/'||pid::text||'.pdf',pending_draft_revision=d.draft_revision,pending_source_revision=d.source_revision,pending_started_at=clock_timestamp(),pending_publication_baseline=base WHERE store_id=uid;
 RETURN jsonb_build_object('id',pid,'path',uid::text||'/'||pid::text||'.pdf','draft_revision',d.draft_revision,'source_revision',d.source_revision,'publication_baseline',base);
END $$;
CREATE OR REPLACE FUNCTION public.complete_my_catalog_preview(_preview_id uuid,_page_count integer,_publication_baseline jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE uid uuid:=auth.uid(); d public.catalog_editorial_drafts; baseline jsonb;
BEGIN
 IF NOT public._catalog_editorial_allowed(uid) THEN RAISE EXCEPTION 'editorial not allowed'; END IF;
 SELECT * INTO d FROM public.catalog_editorial_drafts WHERE store_id=uid FOR UPDATE;
 IF FOUND AND d.preview_id=_preview_id THEN RETURN public._catalog_draft_json(uid); END IF;
 IF NOT FOUND OR d.pending_preview_id IS DISTINCT FROM _preview_id OR d.pending_started_at<now()-interval '1 hour' THEN RAISE EXCEPTION 'preview reservation expired'; END IF;
 IF d.pending_draft_revision IS DISTINCT FROM d.draft_revision OR d.pending_source_revision IS DISTINCT FROM d.source_revision THEN RAISE EXCEPTION 'catalog changed during preview' USING ERRCODE='40001'; END IF;
 IF _page_count IS NULL OR _page_count<1 OR _page_count>10000 THEN RAISE EXCEPTION 'invalid preview page count'; END IF;
 IF NOT EXISTS(SELECT 1 FROM storage.objects o WHERE o.bucket_id='catalog-editorial-previews' AND o.name=d.pending_preview_path AND o.metadata->>'mimetype'='application/pdf' AND coalesce((o.metadata->>'size')::bigint,0)>0 AND (o.metadata->>'size')::bigint<=52428800) THEN RAISE EXCEPTION 'preview file not found'; END IF;
 SELECT jsonb_build_object('updatedAt',catalog_updated_at,'hasCurrent',catalog_current_url IS NOT NULL) INTO baseline FROM public.profiles WHERE id=uid;
 IF d.pending_publication_baseline IS NULL OR baseline IS DISTINCT FROM d.pending_publication_baseline OR _publication_baseline IS DISTINCT FROM d.pending_publication_baseline THEN RAISE EXCEPTION 'publication changed during preview' USING ERRCODE='40001'; END IF;
 UPDATE public.catalog_editorial_drafts SET preview_id=_preview_id,preview_path=pending_preview_path,preview_page_count=_page_count,preview_generated_at=clock_timestamp(),preview_draft_revision=pending_draft_revision,preview_source_revision=pending_source_revision,preview_publication_baseline=baseline,pending_preview_id=NULL,pending_preview_path=NULL,pending_draft_revision=NULL,pending_source_revision=NULL,pending_started_at=NULL,pending_publication_baseline=NULL WHERE store_id=uid;
 RETURN public._catalog_draft_json(uid);
END $$;
CREATE TRIGGER catalog_source_variant_values AFTER INSERT OR UPDATE OR DELETE ON public.product_variant_values FOR EACH ROW EXECUTE FUNCTION public._track_catalog_source();
COMMENT ON COLUMN public.catalog_editorial_drafts.pending_publication_baseline IS 'Server-derived public state at preview reservation; never accepts a client-derived replacement.';