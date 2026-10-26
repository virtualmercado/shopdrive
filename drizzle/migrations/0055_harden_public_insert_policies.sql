-- Hardening of public INSERT policies (7 risk tables). Read policies untouched.
-- ROLLBACK: recreate old policies "Anyone can create contact submissions" (INSERT public WITH CHECK true),
-- "Allow referral inserts" / "Allow anonymous click inserts" / "Anyone can insert store events" /
-- "Anyone can insert product views" / "Anyone can insert catalog clicks" (INSERT anon,authenticated WITH CHECK true),
-- "Anyone can create messages" (INSERT public WITH CHECK true), "Anyone can create landing page tickets"
-- (INSERT anon,authenticated WITH CHECK true); drop the new policies, trigger and the two helper functions.

CREATE OR REPLACE FUNCTION public.is_public_store_active(_store_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles p
    WHERE p.id = _store_id AND p.store_slug IS NOT NULL
      AND p.deleted_at IS NULL AND coalesce(p.account_status,'active') = 'active')
$$;

CREATE OR REPLACE FUNCTION public.is_public_product_of_store(_product_id uuid, _store_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.products pr
    WHERE pr.id = _product_id AND pr.user_id = _store_id AND pr.is_active = true)
$$;

REVOKE ALL ON FUNCTION public.is_public_store_active(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_public_product_of_store(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_public_store_active(uuid) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_public_product_of_store(uuid, uuid) TO anon, authenticated, service_role;

-- 1. contact_submissions (legacy, no caller): close direct insert
DROP POLICY IF EXISTS "Anyone can create contact submissions" ON public.contact_submissions;

-- 2. store_referrals: only create_store_referral (SECURITY DEFINER) inserts
DROP POLICY IF EXISTS "Allow referral inserts" ON public.store_referrals;

-- 3. template_click_events: only track_template_click (SECURITY DEFINER) inserts
DROP POLICY IF EXISTS "Allow anonymous click inserts" ON public.template_click_events;

-- 4. whatsapp_messages
DROP POLICY IF EXISTS "Anyone can create messages" ON public.whatsapp_messages;
CREATE POLICY "Public can message active stores" ON public.whatsapp_messages
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    public.is_public_store_active(store_owner_id)
    AND char_length(btrim(customer_name)) BETWEEN 1 AND 100
    AND char_length(btrim(customer_phone)) BETWEEN 8 AND 20
    AND char_length(btrim(message)) BETWEEN 1 AND 1000
  );

-- 5. store_events
DROP POLICY IF EXISTS "Anyone can insert store events" ON public.store_events;
CREATE POLICY "Public can insert events for active stores" ON public.store_events
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    public.is_public_store_active(store_id)
    AND event_type IN ('store_visit','product_view','add_to_cart','purchase')
    AND (product_id IS NULL OR public.is_public_product_of_store(product_id, store_id))
    AND (session_id IS NULL OR char_length(session_id) <= 100)
  );

-- 6. store_product_views
DROP POLICY IF EXISTS "Anyone can insert product views" ON public.store_product_views;
CREATE POLICY "Public can insert views of store products" ON public.store_product_views
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    public.is_public_store_active(store_id)
    AND public.is_public_product_of_store(product_id, store_id)
    AND event_type = 'product_view'
  );

-- 7. catalog_pdf_clicks
DROP POLICY IF EXISTS "Anyone can insert catalog clicks" ON public.catalog_pdf_clicks;
CREATE POLICY "Public can insert catalog clicks of store products" ON public.catalog_pdf_clicks
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    public.is_public_store_active(store_id)
    AND (product_id IS NULL OR public.is_public_product_of_store(product_id, store_id))
    AND origin = 'catalogo_pdf'
  );

-- 8. tickets_landing_page: keep public form, internal fields forced server-side
CREATE OR REPLACE FUNCTION public.enforce_landing_ticket_public_fields()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    NEW.status := 'novo';
    NEW.prioridade := 'media';
    NEW.responsavel := NULL;
    NEW.notas_internas := NULL;
    NEW.canal_origem := 'landing_page';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS enforce_landing_ticket_public_fields ON public.tickets_landing_page;
CREATE TRIGGER enforce_landing_ticket_public_fields
  BEFORE INSERT ON public.tickets_landing_page
  FOR EACH ROW EXECUTE FUNCTION public.enforce_landing_ticket_public_fields();

DROP POLICY IF EXISTS "Anyone can create landing page tickets" ON public.tickets_landing_page;
CREATE POLICY "Public can create landing page tickets" ON public.tickets_landing_page
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    char_length(btrim(nome)) BETWEEN 1 AND 200
    AND char_length(btrim(email)) BETWEEN 3 AND 255
    AND char_length(btrim(mensagem)) BETWEEN 1 AND 10000
  );