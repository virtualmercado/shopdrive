CREATE OR REPLACE FUNCTION public._marca_assert_owner_eligible(p_uid uuid)
 RETURNS void LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE p record;
BEGIN
  SELECT id, is_template_profile, account_status, deleted_at INTO p FROM profiles WHERE id = p_uid;
  IF p.id IS NULL THEN RAISE EXCEPTION 'Perfil inválido.' USING ERRCODE='42501'; END IF;
  IF COALESCE(p.is_template_profile,false) THEN RAISE EXCEPTION 'Esta conta não pode contratar o Plano MARCA.' USING ERRCODE='42501'; END IF;
  IF p.deleted_at IS NOT NULL OR p.account_status IN ('excluida','exclusao_solicitada') THEN
    RAISE EXCEPTION 'Conta excluída ou em exclusão.' USING ERRCODE='42501'; END IF;
  IF EXISTS (SELECT 1 FROM account_deletion_requests WHERE merchant_id = p_uid AND status IN ('pending','in_review','approved')) THEN
    RAISE EXCEPTION 'Conta excluída ou em exclusão.' USING ERRCODE='42501'; END IF;
  -- Cliente real precisa do papel 'user'; 'admin' adicional não bloqueia; papéis operacionais bloqueiam.
  IF NOT EXISTS (SELECT 1 FROM user_roles WHERE user_id = p_uid AND role = 'user')
     OR EXISTS (SELECT 1 FROM user_roles WHERE user_id = p_uid AND role NOT IN ('user','admin')) THEN
    RAISE EXCEPTION 'Contas internas não podem contratar pelo painel do lojista.' USING ERRCODE='42501'; END IF;
  IF EXISTS (SELECT 1 FROM brand_account_owned_stores WHERE store_profile_id = p_uid AND store_role = 'secondary') THEN
    RAISE EXCEPTION 'A loja adicional não pode gerenciar a contratação.' USING ERRCODE='42501'; END IF;
END $function$;