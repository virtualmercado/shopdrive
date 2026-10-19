ALTER TABLE public.email_campaigns
 ADD COLUMN media_id uuid NULL REFERENCES public.media_files(id) ON DELETE RESTRICT,
 ADD COLUMN image_url text NULL,
 ADD COLUMN image_alt text NULL,
 ADD COLUMN image_link_url text NULL;
CREATE INDEX idx_email_campaign_media ON public.email_campaigns(media_id) WHERE media_id IS NOT NULL;

CREATE FUNCTION public._campaign_master_image(p_media_id uuid, p_alt text, p_link text)
RETURNS public.media_files LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=public
AS $$ DECLARE m public.media_files; o record; BEGIN
 IF char_length(coalesce(p_alt,'')) > 200 THEN RAISE EXCEPTION 'invalid_image_alt'; END IF;
 IF nullif(btrim(p_link),'') IS NOT NULL AND (char_length(p_link)>2000 OR p_link !~ '^https://[^[:space:]"''<>]+$') THEN RAISE EXCEPTION 'invalid_image_link'; END IF;
 IF p_media_id IS NULL THEN RETURN NULL; END IF;
 SELECT * INTO m FROM public.media_files WHERE id=p_media_id FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'invalid_master_media'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('campaign-media:'||m.file_path,0));
 SELECT metadata INTO o FROM storage.objects WHERE bucket_id='media-library' AND name=m.file_path;
 IF NOT FOUND OR m.file_type <> 'image' OR m.mime_type NOT IN ('image/jpeg','image/png','image/webp')
 OR m.size NOT BETWEEN 1 AND 1572864
 OR m.file_path !~ '^uploads/[A-Za-z0-9_-]+\.(jpg|jpeg|png|webp)$'
 OR m.url <> 'https://nkoogfznnqlnragbauez.supabase.co/storage/v1/object/public/media-library/'||m.file_path
 OR o.metadata->>'mimetype' NOT IN ('image/jpeg','image/png','image/webp')
 OR (o.metadata->>'size')::bigint NOT BETWEEN 1 AND 1572864
 THEN RAISE EXCEPTION 'invalid_master_campaign_image'; END IF;
 RETURN m;
END $$;
REVOKE ALL ON FUNCTION public._campaign_master_image(uuid,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public._campaign_master_image(uuid,text,text) TO service_role;

CREATE FUNCTION public._campaign_image_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public
AS $$ DECLARE m public.media_files; BEGIN
 IF TG_OP='UPDATE' AND OLD.status NOT IN ('draft','ready') AND
 (NEW.media_id,NEW.image_url,NEW.image_alt,NEW.image_link_url) IS DISTINCT FROM (OLD.media_id,OLD.image_url,OLD.image_alt,OLD.image_link_url)
 THEN RAISE EXCEPTION 'campaign_image_immutable'; END IF;
 IF NEW.media_id IS NULL THEN
 IF NEW.image_url IS NOT NULL THEN RAISE EXCEPTION 'image_requires_master_media'; END IF;
 NEW.image_alt:=NULL; NEW.image_link_url:=NULL;
 ELSE
 m:=public._campaign_master_image(NEW.media_id,NEW.image_alt,NEW.image_link_url);
 NEW.image_url:=m.url; NEW.image_alt:=nullif(btrim(NEW.image_alt),''); NEW.image_link_url:=nullif(btrim(NEW.image_link_url),'');
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER guard_campaign_image BEFORE INSERT OR UPDATE OF media_id,image_url,image_alt,image_link_url ON public.email_campaigns FOR EACH ROW EXECUTE FUNCTION public._campaign_image_guard();

CREATE FUNCTION public._campaign_media_retention() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public
AS $$ BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended('campaign-media:'||OLD.file_path,0));
 IF EXISTS(SELECT 1 FROM public.email_campaigns WHERE media_id=OLD.id) THEN
 IF TG_OP='DELETE' OR (NEW.url,NEW.file_path,NEW.mime_type,NEW.size,NEW.width,NEW.height) IS DISTINCT FROM (OLD.url,OLD.file_path,OLD.mime_type,OLD.size,OLD.width,OLD.height)
 THEN RAISE EXCEPTION 'Este arquivo está sendo usado em conteúdos ativos ou históricos de campanhas e não pode ser excluído ou substituído.'; END IF;
 END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF; RETURN NEW;
END $$;
CREATE TRIGGER retain_campaign_media BEFORE DELETE OR UPDATE ON public.media_files FOR EACH ROW EXECUTE FUNCTION public._campaign_media_retention();

CREATE FUNCTION public.campaign_master_asset_mutable(p_path text) RETURNS boolean LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=public
AS $$ BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended('campaign-media:'||p_path,0));
 RETURN NOT EXISTS(SELECT 1 FROM public.email_campaigns c JOIN public.media_files m ON m.id=c.media_id WHERE m.file_path=p_path);
END $$;
REVOKE ALL ON FUNCTION public.campaign_master_asset_mutable(text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.campaign_master_asset_mutable(text) TO authenticated,service_role;
CREATE POLICY "Retain campaign Master image on delete" ON storage.objects AS RESTRICTIVE FOR DELETE TO authenticated USING(bucket_id<>'media-library' OR public.campaign_master_asset_mutable(name));
CREATE POLICY "Retain campaign Master image on update" ON storage.objects AS RESTRICTIVE FOR UPDATE TO authenticated USING(bucket_id<>'media-library' OR public.campaign_master_asset_mutable(name)) WITH CHECK(bucket_id<>'media-library' OR public.campaign_master_asset_mutable(name));

CREATE FUNCTION public.admin_save_email_campaign(p_id uuid,p_name text,p_subject text,p_content text,p_cta_label text,p_cta_url text,p_filters jsonb,p_media_id uuid,p_image_alt text,p_image_link_url text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public
AS $$ DECLARE v_id uuid; m public.media_files; BEGIN
 PERFORM public.assert_caller_is_admin();
 m:=public._campaign_master_image(p_media_id,p_image_alt,p_image_link_url);
 v_id:=public.admin_save_email_campaign(p_id,p_name,p_subject,p_content,p_cta_label,p_cta_url,p_filters);
 UPDATE public.email_campaigns SET media_id=p_media_id,image_url=m.url,image_alt=p_image_alt,image_link_url=p_image_link_url WHERE id=v_id;
 RETURN v_id;
END $$;
REVOKE ALL ON FUNCTION public.admin_save_email_campaign(uuid,text,text,text,text,text,jsonb,uuid,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.admin_save_email_campaign(uuid,text,text,text,text,text,jsonb,uuid,text,text) TO authenticated;

-- Extend the existing renderer; old 5-argument calls remain unchanged.
DO $migration$ DECLARE d text; BEGIN
 d:=pg_get_functiondef('public.render_email_campaign_html(text,text,text,text,text)'::regprocedure);
 d:=replace(d,'p_unsubscribe_url text)','p_unsubscribe_url text, p_media_id uuid, p_image_alt text, p_image_link_url text)');
 d:=replace(d,' STABLE',' VOLATILE');
 d:=replace(d,'  v_footer text;','  v_footer text; v_image text := ''''; m public.media_files;');
 d:=replace(d,'  v_footer :=', $splice$
  m:=public._campaign_master_image(p_media_id,p_image_alt,p_image_link_url);
  IF m.id IS NOT NULL THEN
    v_image:='<img src="'||public._ecr_escape(m.url)||'" alt="'||public._ecr_escape(coalesce(nullif(btrim(p_image_alt),''),p_subject))||'" width="552" style="display:block;width:100%;max-width:552px;height:auto;border:0;margin:0 0 16px">';
    IF nullif(btrim(p_image_link_url),'') IS NOT NULL THEN v_image:='<a href="'||public._ecr_escape(btrim(p_image_link_url))||'">'||v_image||'</a>'; END IF;
  END IF;
  v_footer :=$splice$);
 d:=replace(d,'v_body || v_cta','v_body || v_image || v_cta');
 IF position('v_image || v_cta' in d)=0 THEN RAISE EXCEPTION 'renderer_patch_failed'; END IF;
 EXECUTE d;
END $migration$;
REVOKE ALL ON FUNCTION public.render_email_campaign_html(text,text,text,text,text,uuid,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.render_email_campaign_html(text,text,text,text,text,uuid,text,text) TO service_role;

CREATE FUNCTION public.admin_preview_email_campaign(p_subject text,p_content text,p_cta_label text,p_cta_url text,p_media_id uuid,p_image_alt text,p_image_link_url text)
RETURNS text LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=public
AS $$ BEGIN
 PERFORM public.assert_caller_is_admin();
 PERFORM public._assert_email_campaign_content(p_subject,p_content,p_cta_label,p_cta_url);
 RETURN public.render_email_campaign_html(p_subject,p_content,nullif(btrim(p_cta_label),''),nullif(btrim(p_cta_url),''),'https://shopdrive.com.br/descadastro?token=PREVIEW_PREVIA_PREVIA_PREVIA123',p_media_id,p_image_alt,p_image_link_url);
END $$;
REVOKE ALL ON FUNCTION public.admin_preview_email_campaign(text,text,text,text,uuid,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.admin_preview_email_campaign(text,text,text,text,uuid,text,text) TO authenticated;

DO $migration$ DECLARE d text; BEGIN
 d:=pg_get_functiondef('public.admin_confirm_email_campaign(uuid)'::regprocedure);
 IF position('|| v_token);' in d)=0 THEN RAISE EXCEPTION 'confirm_patch_failed'; END IF;
 d:=replace(d,'|| v_token);','|| v_token, v_c.media_id, v_c.image_alt, v_c.image_link_url);');
 EXECUTE d;
 d:=pg_get_functiondef('public.admin_get_email_campaign(uuid)'::regprocedure);
 d:=replace(d,'''cta_label'', c.cta_label,','''media_id'',c.media_id,''image_url'',c.image_url,''image_alt'',c.image_alt,''image_link_url'',c.image_link_url,''image_name'',(SELECT name FROM public.media_files WHERE id=c.media_id),''cta_label'', c.cta_label,');
 EXECUTE d;
END $migration$;
REVOKE ALL ON FUNCTION public._campaign_image_guard(),public._campaign_media_retention() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public._campaign_image_guard(),public._campaign_media_retention() TO service_role;