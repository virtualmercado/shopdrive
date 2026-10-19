-- Read-only assertions: no fixture records, queue calls or SMTP.
BEGIN;
DO $$
DECLARE m public.media_files; h text; preview text; legacy text; expected_width integer;
BEGIN
 IF public._campaign_image_display_width(1200,600)<>552 THEN RAISE EXCEPTION 'horizontal_1200_600'; END IF;
 IF public._campaign_image_display_width(1140,600)<>552 THEN RAISE EXCEPTION 'near_2_to_1'; END IF;
 IF public._campaign_image_display_width(651,651)<>360 THEN RAISE EXCEPTION 'square_651_651'; END IF;
 IF public._campaign_image_display_width(600,1200)<>300 THEN RAISE EXCEPTION 'vertical'; END IF;
 IF public._campaign_image_display_width(1700,1000)<>552 THEN RAISE EXCEPTION 'horizontal_boundary'; END IF;
 IF public._campaign_image_display_width(850,1000)<>360 THEN RAISE EXCEPTION 'square_boundary'; END IF;
 IF public._campaign_image_display_width(849,1000)<>300 THEN RAISE EXCEPTION 'vertical_boundary'; END IF;
 IF public._campaign_image_display_width(NULL,NULL)<>552 OR public._campaign_image_display_width(0,600)<>552 THEN RAISE EXCEPTION 'legacy_dimensions'; END IF;
 legacy:=public.render_email_campaign_html('Subject','Message','Open','https://shopdrive.com.br','https://shopdrive.com.br/descadastro?token=PREVIEW_PREVIA_PREVIA_PREVIA123');
 h:=public.render_email_campaign_html('Subject','Message','Open','https://shopdrive.com.br','https://shopdrive.com.br/descadastro?token=PREVIEW_PREVIA_PREVIA_PREVIA123',NULL,NULL,NULL);
 IF h IS DISTINCT FROM legacy THEN RAISE EXCEPTION 'no_image_regression'; END IF;
 PERFORM set_config('request.jwt.claim.sub',(SELECT user_id::text FROM public.user_roles WHERE role='admin' ORDER BY user_id LIMIT 1),true);
 FOR m IN SELECT f.* FROM public.media_files f JOIN storage.objects o ON o.bucket_id='media-library' AND o.name=f.file_path WHERE f.mime_type IN ('image/jpeg','image/png','image/webp') AND f.size BETWEEN 1 AND 1572864 AND f.file_path ~ '^uploads/[A-Za-z0-9_-]+\.(jpg|jpeg|png|webp)$' LOOP
   expected_width:=public._campaign_image_display_width(m.width,m.height);
   preview:=public.admin_preview_email_campaign('Subject','Message','Open','https://shopdrive.com.br',m.id,'Alt','https://shopdrive.com.br');
   h:=public.render_email_campaign_html('Subject','Message','Open','https://shopdrive.com.br','https://shopdrive.com.br/descadastro?token=PREVIEW_PREVIA_PREVIA_PREVIA123',m.id,'Alt','https://shopdrive.com.br');
   IF preview IS DISTINCT FROM h THEN RAISE EXCEPTION 'preview_send_parity'; END IF;
   IF position('max-width:'||expected_width||'px' IN h)=0 OR position('height:auto' IN h)=0 OR position('margin:0 auto 16px' IN h)=0 OR position('object-fit' IN h)>0 THEN RAISE EXCEPTION 'presentation_failed'; END IF;
   IF position('>Open</a>' IN h)=0 OR position('Não quero receber comunicações comerciais' IN h)=0 OR position('https://shopdrive.com.br/descadastro?token=' IN h)=0 THEN RAISE EXCEPTION 'cta_footer_unsubscribe_regression'; END IF;
 END LOOP;
 RAISE NOTICE 'Campaign presentation assertions passed, without record changes or sends.';
END $$;
ROLLBACK;