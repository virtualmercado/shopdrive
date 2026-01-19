-- Permitir que qualquer pessoa leia a public key de gateways ativos/default para carregar o SDK
CREATE POLICY "Anyone can read public key from active gateways"
ON public.master_payment_gateways
FOR SELECT
USING (is_active = true AND is_default = true);