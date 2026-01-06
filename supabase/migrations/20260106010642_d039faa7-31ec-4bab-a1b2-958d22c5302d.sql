-- Função que permite um usuário autenticado se auto-promover para admin
-- Usa SECURITY DEFINER para executar com privilégios elevados
CREATE OR REPLACE FUNCTION public.promote_to_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Inserir role admin para o usuário atual
  INSERT INTO public.user_roles (user_id, role)
  VALUES (auth.uid(), 'admin')
  ON CONFLICT (user_id, role) DO NOTHING;
  
  RETURN TRUE;
EXCEPTION
  WHEN OTHERS THEN
    RETURN FALSE;
END;
$$;