CREATE TABLE public.catalog_editorial_drafts (
 store_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
 config jsonb,
 schema_version integer NOT NULL DEFAULT 1,
 draft_revision bigint NOT NULL DEFAULT 0,
 source_revision bigint NOT NULL DEFAULT 0,
 draft_updated_at timestamptz,
 preview_id uuid,
 preview_path text,
 preview_page_count integer,
 preview_generated_at timestamptz,
 preview_draft_revision bigint,
 preview_source_revision bigint,
 preview_publication_baseline jsonb,
 pending_preview_id uuid,
 pending_preview_path text,
 pending_draft_revision bigint,
 pending_source_revision bigint,
 pending_started_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT catalog_editorial_config_object CHECK (config IS NULL OR jsonb_typeof(config) = 'object'),
 CONSTRAINT catalog_editorial_positive_pages CHECK (preview_page_count IS NULL OR preview_page_count > 0)
);
GRANT SELECT ON public.catalog_editorial_drafts TO authenticated;
GRANT ALL ON public.catalog_editorial_drafts TO service_role;
ALTER TABLE public.catalog_editorial_drafts ENABLE ROW LEVEL SECURITY;
CREATE POLICY catalog_editorial_draft_owner_read ON public.catalog_editorial_drafts FOR SELECT TO authenticated USING (store_id = auth.uid() AND public._catalog_editorial_allowed(auth.uid()));
COMMENT ON TABLE public.catalog_editorial_drafts IS 'Private raw editor intent and last private preview; never consumed by public catalog routing. Writes only through owner-scoped revision-checked RPCs.';

CREATE FUNCTION public._catalog_draft_json(_store uuid) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
 SELECT jsonb_build_object('config',d.config,'schema_version',coalesce(d.schema_version,1),'draft_revision',coalesce(d.draft_revision,0),'source_revision',coalesce(d.source_revision,0),'draft_updated_at',d.draft_updated_at,'preview',CASE WHEN d.preview_path IS NULL THEN NULL ELSE jsonb_build_object('id',d.preview_id,'path',d.preview_path,'page_count',d.preview_page_count,'generated_at',d.preview_generated_at,'draft_revision',d.preview_draft_revision,'source_revision',d.preview_source_revision,'publication_baseline',d.preview_publication_baseline) END,'stale',coalesce(d.preview_path IS NOT NULL AND (d.preview_draft_revision IS DISTINCT FROM d.draft_revision OR d.preview_source_revision IS DISTINCT FROM d.source_revision),false)) FROM (SELECT _store AS id) s LEFT JOIN public.catalog_editorial_drafts d ON d.store_id=s.id
$$;
REVOKE ALL ON FUNCTION public._catalog_draft_json(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public._catalog_draft_json(uuid) TO service_role;

CREATE FUNCTION public.get_my_catalog_draft() RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
 IF NOT public._catalog_editorial_allowed(auth.uid()) THEN RAISE EXCEPTION 'editorial not allowed'; END IF;
 RETURN public._catalog_draft_json(auth.uid());
END $$;
REVOKE ALL ON FUNCTION public.get_my_catalog_draft() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_my_catalog_draft() TO authenticated,service_role;

CREATE FUNCTION public._assert_catalog_draft_config(_config jsonb,_uid uuid) RETURNS void LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE k text; v jsonb; image_url text; folder text; path text; prefix constant text := 'https://nkoogfznnqlnragbauez.supabase.co/storage/v1/object/public/product-images/';
BEGIN
 IF _config IS NULL OR jsonb_typeof(_config) <> 'object' OR octet_length(_config::text)>262144 THEN RAISE EXCEPTION 'invalid catalog draft'; END IF;
 FOR k,v IN SELECT * FROM jsonb_each(_config) LOOP
  IF k NOT IN ('mode','categoryIds','brandIds','productIds','title','subtitle','coverImage','coverMode','showYear','showCount','typography','backImage','backMode','backTypography','grouping','separators','sectionImages','sectionCustom','showPrices','instEnabled','instTitle','instText','instImage','instMode','comEnabled','com','featEnabled','featured','featPolicy','excludeNoImage') THEN RAISE EXCEPTION 'unknown draft field'; END IF;
  IF k IN ('categoryIds','brandIds','productIds','featured') AND jsonb_typeof(v)<>'array' THEN RAISE EXCEPTION 'invalid draft ids'; END IF;
  IF k IN ('showYear','showCount','showPrices','instEnabled','comEnabled','featEnabled','excludeNoImage') AND jsonb_typeof(v)<>'boolean' THEN RAISE EXCEPTION 'invalid draft boolean'; END IF;
  IF k IN ('typography','backTypography','sectionImages','sectionCustom','com') AND jsonb_typeof(v)<>'object' THEN RAISE EXCEPTION 'invalid draft object'; END IF;
 END LOOP;
 IF _config->>'mode' NOT IN ('all','categories','brands','products') OR _config->>'grouping' NOT IN ('none','category','brand') OR _config->>'separators' NOT IN ('auto','full','compact') THEN RAISE EXCEPTION 'invalid draft mode'; END IF;
 FOR image_url,folder IN
  SELECT _config->>'coverImage','catalog-covers' UNION ALL SELECT _config->>'backImage','catalog-backcovers' UNION ALL SELECT _config->>'instImage','catalog-institutional' UNION ALL SELECT value,'catalog-sections' FROM jsonb_each_text(coalesce(_config->'sectionImages','{}'))
 LOOP
  IF coalesce(image_url,'')='' THEN CONTINUE; END IF;
  IF left(image_url,length(prefix||_uid::text||'/'||folder||'/'))<>prefix||_uid::text||'/'||folder||'/' THEN RAISE EXCEPTION 'unauthorized catalog image'; END IF;
  path:=substr(image_url,length(prefix)+1);
  IF substr(path,length(_uid::text||'/'||folder||'/')+1) !~* '^[A-Za-z0-9._-]+\.(jpe?g|png|webp)$' OR NOT EXISTS (SELECT 1 FROM storage.objects WHERE bucket_id='product-images' AND name=path) THEN RAISE EXCEPTION 'catalog image not found'; END IF;
 END LOOP;
END $$;
REVOKE ALL ON FUNCTION public._assert_catalog_draft_config(jsonb,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public._assert_catalog_draft_config(jsonb,uuid) TO service_role;

CREATE FUNCTION public.save_my_catalog_draft(_expected_revision bigint,_schema_version integer,_config jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid:=auth.uid(); d public.catalog_editorial_drafts;
BEGIN
 IF NOT public._catalog_editorial_allowed(uid) THEN RAISE EXCEPTION 'editorial not allowed'; END IF;
 IF _schema_version IS DISTINCT FROM 1 OR _expected_revision IS NULL OR _expected_revision<0 THEN RAISE EXCEPTION 'invalid draft version'; END IF;
 PERFORM public._assert_catalog_draft_config(_config,uid);
 INSERT INTO public.catalog_editorial_drafts(store_id) VALUES(uid) ON CONFLICT(store_id) DO NOTHING;
 SELECT * INTO d FROM public.catalog_editorial_drafts WHERE store_id=uid FOR UPDATE;
 -- A retry of the same acknowledged payload is safe even after a lost response.
 IF d.config IS NOT DISTINCT FROM _config AND d.schema_version=_schema_version THEN RETURN public._catalog_draft_json(uid); END IF;
 IF d.draft_revision<>_expected_revision THEN RAISE EXCEPTION 'catalog draft conflict' USING ERRCODE='40001'; END IF;
 UPDATE public.catalog_editorial_drafts SET config=_config,schema_version=_schema_version,draft_revision=draft_revision+1,draft_updated_at=clock_timestamp() WHERE store_id=uid;
 RETURN public._catalog_draft_json(uid);
END $$;
REVOKE ALL ON FUNCTION public.save_my_catalog_draft(bigint,integer,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.save_my_catalog_draft(bigint,integer,jsonb) TO authenticated,service_role;

CREATE FUNCTION public.begin_my_catalog_preview(_expected_revision bigint) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid:=auth.uid(); d public.catalog_editorial_drafts; pid uuid:=gen_random_uuid(); base jsonb;
BEGIN
 IF NOT public._catalog_editorial_allowed(uid) THEN RAISE EXCEPTION 'editorial not allowed'; END IF;
 SELECT * INTO d FROM public.catalog_editorial_drafts WHERE store_id=uid FOR UPDATE;
 IF NOT FOUND OR d.config IS NULL OR d.draft_revision IS DISTINCT FROM _expected_revision THEN RAISE EXCEPTION 'catalog draft conflict' USING ERRCODE='40001'; END IF;
 SELECT jsonb_build_object('updatedAt',catalog_updated_at,'hasCurrent',catalog_current_url IS NOT NULL) INTO base FROM public.profiles WHERE id=uid;
 UPDATE public.catalog_editorial_drafts SET pending_preview_id=pid,pending_preview_path=uid::text||'/'||pid::text||'.pdf',pending_draft_revision=d.draft_revision,pending_source_revision=d.source_revision,pending_started_at=clock_timestamp() WHERE store_id=uid;
 RETURN jsonb_build_object('id',pid,'path',uid::text||'/'||pid::text||'.pdf','draft_revision',d.draft_revision,'source_revision',d.source_revision,'publication_baseline',base);
END $$;
REVOKE ALL ON FUNCTION public.begin_my_catalog_preview(bigint) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.begin_my_catalog_preview(bigint) TO authenticated,service_role;

CREATE FUNCTION public.complete_my_catalog_preview(_preview_id uuid,_page_count integer,_publication_baseline jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid:=auth.uid(); d public.catalog_editorial_drafts; baseline jsonb;
BEGIN
 IF NOT public._catalog_editorial_allowed(uid) THEN RAISE EXCEPTION 'editorial not allowed'; END IF;
 SELECT * INTO d FROM public.catalog_editorial_drafts WHERE store_id=uid FOR UPDATE;
 IF d.preview_id=_preview_id THEN RETURN public._catalog_draft_json(uid); END IF;
 IF NOT FOUND OR d.pending_preview_id IS DISTINCT FROM _preview_id OR d.pending_started_at<now()-interval '1 hour' THEN RAISE EXCEPTION 'preview reservation expired'; END IF;
 IF d.pending_draft_revision IS DISTINCT FROM d.draft_revision OR d.pending_source_revision IS DISTINCT FROM d.source_revision THEN RAISE EXCEPTION 'catalog changed during preview' USING ERRCODE='40001'; END IF;
 IF _page_count IS NULL OR _page_count<1 OR _page_count>10000 THEN RAISE EXCEPTION 'invalid preview page count'; END IF;
 IF NOT EXISTS(SELECT 1 FROM storage.objects o WHERE o.bucket_id='catalog-editorial-previews' AND o.name=d.pending_preview_path AND o.metadata->>'mimetype'='application/pdf' AND coalesce((o.metadata->>'size')::bigint,0)>0 AND (o.metadata->>'size')::bigint<=52428800) THEN RAISE EXCEPTION 'preview file not found'; END IF;
 -- Public baseline is server-derived; the submitted value is checked rather than trusted.
 SELECT jsonb_build_object('updatedAt',catalog_updated_at,'hasCurrent',catalog_current_url IS NOT NULL) INTO baseline FROM public.profiles WHERE id=uid;
 IF baseline IS DISTINCT FROM _publication_baseline THEN RAISE EXCEPTION 'publication changed during preview' USING ERRCODE='40001'; END IF;
 UPDATE public.catalog_editorial_drafts SET preview_id=_preview_id,preview_path=pending_preview_path,preview_page_count=_page_count,preview_generated_at=clock_timestamp(),preview_draft_revision=pending_draft_revision,preview_source_revision=pending_source_revision,preview_publication_baseline=baseline,pending_preview_id=NULL,pending_preview_path=NULL,pending_draft_revision=NULL,pending_source_revision=NULL,pending_started_at=NULL WHERE store_id=uid;
 RETURN public._catalog_draft_json(uid);
END $$;
REVOKE ALL ON FUNCTION public.complete_my_catalog_preview(uuid,integer,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.complete_my_catalog_preview(uuid,integer,jsonb) TO authenticated,service_role;

CREATE FUNCTION public.discard_my_catalog_preview(_preview_id uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
 IF NOT public._catalog_editorial_allowed(auth.uid()) THEN RAISE EXCEPTION 'editorial not allowed'; END IF;
 UPDATE public.catalog_editorial_drafts SET pending_preview_id=NULL,pending_preview_path=NULL,pending_draft_revision=NULL,pending_source_revision=NULL,pending_started_at=NULL WHERE store_id=auth.uid() AND pending_preview_id=_preview_id;
END $$;
REVOKE ALL ON FUNCTION public.discard_my_catalog_preview(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.discard_my_catalog_preview(uuid) TO authenticated,service_role;

CREATE FUNCTION public._catalog_preview_file_allowed(_path text,_operation text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
 SELECT auth.uid() IS NOT NULL AND public._catalog_editorial_allowed(auth.uid()) AND _path ~ ('^'||auth.uid()::text||'/[0-9a-f-]{36}\.pdf$') AND CASE _operation
 WHEN 'read' THEN true
 WHEN 'insert' THEN EXISTS(SELECT 1 FROM public.catalog_editorial_drafts WHERE store_id=auth.uid() AND pending_preview_path=_path AND pending_started_at>now()-interval '1 hour')
 WHEN 'delete' THEN NOT EXISTS(SELECT 1 FROM public.catalog_editorial_drafts WHERE store_id=auth.uid() AND (preview_path=_path OR (pending_preview_path=_path AND pending_started_at>now()-interval '1 hour')))
 ELSE false END
$$;
REVOKE ALL ON FUNCTION public._catalog_preview_file_allowed(text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public._catalog_preview_file_allowed(text,text) TO authenticated,service_role;
CREATE POLICY catalog_editorial_preview_read ON storage.objects FOR SELECT TO authenticated USING (bucket_id='catalog-editorial-previews' AND public._catalog_preview_file_allowed(name,'read'));
CREATE POLICY catalog_editorial_preview_insert ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id='catalog-editorial-previews' AND public._catalog_preview_file_allowed(name,'insert'));
CREATE POLICY catalog_editorial_preview_delete ON storage.objects FOR DELETE TO authenticated USING (bucket_id='catalog-editorial-previews' AND public._catalog_preview_file_allowed(name,'delete'));

-- Revision counters are scoped to stores already enrolled in Editorial; they never write products/profile data.
CREATE FUNCTION public._bump_catalog_source(_store uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
 IF _store IS NULL OR NOT EXISTS(SELECT 1 FROM public.catalog_editorial_access WHERE store_id=_store AND enabled) OR NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=_store) THEN RETURN; END IF;
 INSERT INTO public.catalog_editorial_drafts(store_id,source_revision) VALUES(_store,1) ON CONFLICT(store_id) DO UPDATE SET source_revision=catalog_editorial_drafts.source_revision+1;
END $$;
REVOKE ALL ON FUNCTION public._bump_catalog_source(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public._bump_catalog_source(uuid) TO service_role;
CREATE FUNCTION public._track_catalog_source() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE old_store uuid; new_store uuid; old_row jsonb; new_row jsonb; cols text[];
BEGIN
 IF TG_OP<>'INSERT' THEN old_row:=to_jsonb(OLD); END IF;
 IF TG_OP<>'DELETE' THEN new_row:=to_jsonb(NEW); END IF;
 IF TG_TABLE_NAME='products' THEN
  cols:=ARRAY['user_id','name','description','price','promotional_price','image_url','images','category_id','brand_id','inventory_mode','is_active','is_featured','is_new','weight','shipping_weight','height','width','length'];
 ELSIF TG_TABLE_NAME='profiles' THEN
  cols:=ARRAY['store_name','store_slug','store_logo_url','primary_color','secondary_color','button_bg_color','button_text_color','price_color','whatsapp_number','email','instagram_url','facebook_url','youtube_url','x_url','about_us_title','about_us_text','address','address_number','address_neighborhood','address_city','address_state'];
 ELSE
  cols:=ARRAY(SELECT DISTINCT key FROM jsonb_object_keys(coalesce(old_row,'{}')||coalesce(new_row,'{}')) key WHERE key NOT IN ('updated_at','stock_quantity'));
 END IF;
 IF TG_OP='UPDATE' AND NOT EXISTS(SELECT 1 FROM unnest(cols) k WHERE old_row->k IS DISTINCT FROM new_row->k) THEN RETURN NEW; END IF;
 IF TG_TABLE_NAME='profiles' THEN old_store:=(old_row->>'id')::uuid; new_store:=(new_row->>'id')::uuid;
 ELSIF TG_TABLE_NAME='product_images' THEN
  SELECT user_id INTO old_store FROM public.products WHERE id=(old_row->>'product_id')::uuid;
  SELECT user_id INTO new_store FROM public.products WHERE id=(new_row->>'product_id')::uuid;
 ELSE old_store:=coalesce(old_row->>'user_id',old_row->>'store_id')::uuid; new_store:=coalesce(new_row->>'user_id',new_row->>'store_id')::uuid;
 END IF;
 PERFORM public._bump_catalog_source(old_store);
 IF new_store IS DISTINCT FROM old_store THEN PERFORM public._bump_catalog_source(new_store); END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END $$;
REVOKE ALL ON FUNCTION public._track_catalog_source() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER catalog_source_products AFTER INSERT OR UPDATE OR DELETE ON public.products FOR EACH ROW EXECUTE FUNCTION public._track_catalog_source();
CREATE TRIGGER catalog_source_product_images AFTER INSERT OR UPDATE OR DELETE ON public.product_images FOR EACH ROW EXECUTE FUNCTION public._track_catalog_source();
CREATE TRIGGER catalog_source_categories AFTER INSERT OR UPDATE OR DELETE ON public.product_categories FOR EACH ROW EXECUTE FUNCTION public._track_catalog_source();
CREATE TRIGGER catalog_source_brands AFTER INSERT OR UPDATE OR DELETE ON public.product_brands FOR EACH ROW EXECUTE FUNCTION public._track_catalog_source();
CREATE TRIGGER catalog_source_variants AFTER INSERT OR UPDATE OR DELETE ON public.product_variants FOR EACH ROW EXECUTE FUNCTION public._track_catalog_source();
CREATE TRIGGER catalog_source_option_groups AFTER INSERT OR UPDATE OR DELETE ON public.product_option_groups FOR EACH ROW EXECUTE FUNCTION public._track_catalog_source();
CREATE TRIGGER catalog_source_option_values AFTER INSERT OR UPDATE OR DELETE ON public.product_option_values FOR EACH ROW EXECUTE FUNCTION public._track_catalog_source();
CREATE TRIGGER catalog_source_profile AFTER UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public._track_catalog_source();