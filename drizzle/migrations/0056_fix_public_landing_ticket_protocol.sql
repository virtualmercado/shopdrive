-- Hotfix: public contact form creates tickets via a dedicated RPC that returns only the protocol.
-- ROLLBACK: DROP FUNCTION public.create_public_landing_ticket(text,text,text,text,text,text,text,text);
--   CREATE POLICY "Public can create landing page tickets" ON public.tickets_landing_page FOR INSERT TO anon, authenticated
--   WITH CHECK (char_length(btrim(nome)) BETWEEN 1 AND 200 AND char_length(btrim(email)) BETWEEN 3 AND 255 AND char_length(btrim(mensagem)) BETWEEN 1 AND 10000);

CREATE OR REPLACE FUNCTION public.create_public_landing_ticket(
  p_categoria text, p_nome text, p_email text, p_mensagem text,
  p_loja_url_ou_nome text DEFAULT NULL, p_tipo_problema text DEFAULT NULL,
  p_cpf_cnpj text DEFAULT NULL, p_empresa text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_nome text := btrim(coalesce(p_nome,''));
  v_email text := lower(btrim(coalesce(p_email,'')));
  v_msg text := btrim(coalesce(p_mensagem,''));
  v_loja text := nullif(btrim(coalesce(p_loja_url_ou_nome,'')),'');
  v_tipo text := nullif(btrim(coalesce(p_tipo_problema,'')),'');
  v_doc text := nullif(btrim(coalesce(p_cpf_cnpj,'')),'');
  v_emp text := nullif(btrim(coalesce(p_empresa,'')),'');
  v_protocol text;
  v_try int := 0;
BEGIN
  IF p_categoria IS NULL OR p_categoria NOT IN ('suporte_lojista','financeiro_cobrancas','lgpd_privacidade','comercial_parcerias')
     OR char_length(v_nome) NOT BETWEEN 1 AND 200
     OR char_length(v_email) NOT BETWEEN 3 AND 255
     OR v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'
     OR char_length(v_msg) NOT BETWEEN 1 AND 10000
     OR coalesce(char_length(v_loja),0) > 255
     OR coalesce(char_length(v_tipo),0) > 50
     OR coalesce(char_length(v_doc),0) > 18
     OR coalesce(char_length(v_emp),0) > 100 THEN
    RAISE EXCEPTION 'invalid_ticket' USING ERRCODE = '22023';
  END IF;

  LOOP
    BEGIN
      INSERT INTO public.tickets_landing_page
        (categoria, nome, email, mensagem, loja_url_ou_nome, tipo_problema, cpf_cnpj, empresa,
         status, prioridade, responsavel, notas_internas, canal_origem)
      VALUES
        (p_categoria, v_nome, v_email, v_msg, v_loja, v_tipo, v_doc, v_emp,
         'novo', 'media', NULL, NULL, 'landing_page')
      RETURNING protocolo INTO v_protocol;
      EXIT;
    EXCEPTION WHEN unique_violation THEN
      v_try := v_try + 1;
      IF v_try >= 3 THEN RAISE; END IF;
    END;
  END LOOP;

  RETURN jsonb_build_object('protocol', v_protocol);
END;
$$;

REVOKE ALL ON FUNCTION public.create_public_landing_ticket(text,text,text,text,text,text,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_public_landing_ticket(text,text,text,text,text,text,text,text) TO anon, authenticated, service_role;

-- Only caller of direct inserts (ContactPage) now uses the RPC: close direct public insert.
DROP POLICY IF EXISTS "Public can create landing page tickets" ON public.tickets_landing_page;