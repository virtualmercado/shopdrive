# Corrigir cotações guest do Melhor Envio

## Diagnóstico confirmado

No checkout real, deslogado, da loja `aromadaamazoniarevenda`, o CEP `69906-027` **não dispara** `calculate-melhor-envio`.

O primeiro ponto de falha é anterior ao cálculo: a leitura pública de `melhor_envio_settings_public` retorna HTTP `406 / PGRST116` com zero linhas, apesar de a configuração ativa existir no banco. Assim, `melhorEnvioEnabled` permanece `false`, o efeito de cotação encerra antes do request e `DeliveryColumn` recebe lista vazia. A causa é a ausência de permissão Data API para a view pública segura. Também foi encontrado um segundo defeito no mesmo gatilho: o checkout lê `merchant_cep`, mas a view fornece `merchant_reference_cep`.

## Implementação mínima

1. Conceder somente `SELECT` para `anon` e `authenticated` na view segura `public.melhor_envio_settings_public`, que expõe apenas `user_id`, `is_active` e `environment`; nenhuma credencial será exposta e nenhuma política/RLS será alterada.
2. Corrigir em `Checkout.tsx` a origem do CEP para usar `merchant_reference_cep`, preservando o fallback atual pelo endereço de retirada.
3. Preservar a validação pública, o serviço único de frete, o debounce de 500 ms, regras de Motoboy, retirada e cálculo atual.

## Validação

- Repetir no navegador o checkout guest real da Aroma com o mesmo carrinho e CEP `69906-027`, capturando request/payload/status/resposta e comprovando as opções renderizadas.
- Selecionar métodos disponíveis e conferir atualização do frete/total.
- Validar retirada e Motoboy sem regressão.
- Executar o caminho autenticado com a mesma loja/carrinho/CEP quando houver sessão de teste disponível; caso contrário, registrar explicitamente como não verificado.
- Validar build e logs finais.

## Rollback

Revogar os dois `SELECT` concedidos à view segura e restaurar a leitura anterior do CEP em `Checkout.tsx`.
