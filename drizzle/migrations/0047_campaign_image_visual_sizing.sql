CREATE FUNCTION public._campaign_image_display_width(p_width numeric, p_height numeric)
RETURNS integer LANGUAGE sql IMMUTABLE SET search_path=public
AS $$ SELECT CASE WHEN p_width IS NULL OR p_height IS NULL OR p_width<=0 OR p_height<=0 THEN 552 WHEN p_width/p_height>=1.7 THEN 552 WHEN p_width/p_height>=0.85 THEN 360 ELSE 300 END $$;
REVOKE ALL ON FUNCTION public._campaign_image_display_width(numeric,numeric) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public._campaign_image_display_width(numeric,numeric) TO service_role;

-- Presentation only: no campaign records, media, saved HTML or queue changes.
DO $migration$
DECLARE d text; old_image text; new_image text;
BEGIN
 d:=pg_get_functiondef('public.render_email_campaign_html(text,text,text,text,text,uuid,text,text)'::regprocedure);
 old_image:=$old$v_image:='<img src="'||public._ecr_escape(m.url)||'" alt="'||public._ecr_escape(coalesce(nullif(btrim(p_image_alt),''),p_subject))||'" width="552" style="display:block;width:100%;max-width:552px;height:auto;border:0;margin:0 0 16px">';$old$;
 new_image:=$new$v_image_width:=public._campaign_image_display_width(m.width,m.height);
    v_image:='<img src="'||public._ecr_escape(m.url)||'" alt="'||public._ecr_escape(coalesce(nullif(btrim(p_image_alt),''),p_subject))||'" width="'||v_image_width||'" style="display:block;width:100%;max-width:'||v_image_width||'px;height:auto;border:0;margin:0 auto">';$new$;
 IF position(old_image IN d)=0 OR position('m public.media_files;' IN d)=0 THEN RAISE EXCEPTION 'campaign_visual_renderer_patch_failed'; END IF;
 d:=replace(d,'m public.media_files;','m public.media_files; v_image_width integer;');
 d:=replace(d,old_image,new_image);
 d:=replace(d,'  END IF;'||chr(10)||'  v_footer :=','    v_image:=''<div style="width:100%;max-width:''||v_image_width||''px;margin:0 auto 16px">''||v_image||''</div>'';'||chr(10)||'  END IF;'||chr(10)||'  v_footer :=');
 IF position('margin:0 auto 16px' IN d)=0 THEN RAISE EXCEPTION 'campaign_visual_centering_patch_failed'; END IF;
 EXECUTE d;
END $migration$;
REVOKE ALL ON FUNCTION public.render_email_campaign_html(text,text,text,text,text,uuid,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.render_email_campaign_html(text,text,text,text,text,uuid,text,text) TO service_role;