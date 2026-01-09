-- Criar política RLS para permitir acesso público às configurações de pagamento de lojas públicas
CREATE POLICY "Anyone can view payment settings for public stores" 
ON payment_settings
FOR SELECT
USING (is_public_store(user_id));