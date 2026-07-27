# Correção da duplicação de loja — clonagem integral + plano pendente

## Causa raiz do bug atual (por que só 20 produtos foram copiados)

A tabela `products` tem o trigger `trg_validate_product_activation_limit` (BEFORE INSERT OR UPDATE OF is_active) que executa `validate_product_activation_limit()`. Essa função:

1. Consulta `get_effective_store_plan(NEW.user_id)`.
2. Como a Edge Function `clone-store` insere os produtos **antes** de criar a `master_subscriptions`, a nova conta ainda não tem assinatura → plano efetivo = Grátis (limite 20).
3. Ao tentar inserir o 21º produto com `is_active = true`, o trigger lança `RAISE EXCEPTION 'Você atingiu o limite...'`.
4. O laço em `clone-store/index.ts` faz `if (prodErr || !insProd) continue;` — o erro é engolido silenciosamente e os 195 produtos restantes são perdidos. Nenhum log detalhado é gravado.

Consequência: clone com 20 produtos ativos, 0 inativos, e plano registrado como Grátis (porque a atribuição de plano acontece depois e a UI mostrou "Grátis" no teste).

## Correção — escopo mínimo, isolado ao fluxo de clonagem

### 1. Schema (migration)

Adicionar em `public.products`:
- `deactivation_reason text` (nullable). Valores usados: `pending_plan_limit`, `plan_downgrade`, `manual`, `overdue`. Sem CHECK constraint — validação em código.
- `was_active_before_plan_restriction boolean default false`.

Adicionar em `public.master_subscriptions`:
- `pending_plan_id text` (nullable) — plano pretendido aguardando pagamento.
- `source_profile_id uuid` (nullable) — auditoria: loja original quando criada por clonagem.

Ajustar `validate_product_activation_limit()`:
- Antes do `RAISE EXCEPTION`, verificar se a sessão está dentro do contexto de clonagem: usar um GUC `SET LOCAL app.cloning_in_progress = 'on'` que a Edge Function ativa antes do laço via `admin.rpc('set_config', ...)` (ou via chamada de uma função SECURITY DEFINER `begin_clone_context(target_user_id)`).
- Quando a flag estiver ligada **e** `NEW.user_id` coincidir com o alvo do contexto, permitir a inserção mesmo acima do limite, mas **forçar** `NEW.is_active := false`, `NEW.deactivation_reason := 'pending_plan_limit'`, `NEW.was_active_before_plan_restriction := (OLD source active state)`.
- Fora do contexto: comportamento atual permanece intacto (nenhum outro fluxo é afetado).

Nova função `reactivate_products_after_upgrade()` (já existe — vamos reutilizar/estender):
- Reativa apenas produtos com `deactivation_reason = 'pending_plan_limit'` **e** `was_active_before_plan_restriction = true`, respeitando o novo limite. Produtos com `deactivation_reason = 'manual'` (decisão do lojista) permanecem inativos.

### 2. Edge Function `supabase/functions/clone-store/index.ts`

Fluxo revisado (transacional-lógico, sem alterar o rollback já existente):

1. Criar user + profile clone (igual hoje).
2. **Criar a `master_subscriptions` ANTES dos produtos** com:
   - Se `plan = 'same'` e origem é Premium/Pro: `plan_id = 'gratis'`, `pending_plan_id = <plano origem>`, `status = 'pending_payment'`, `source_profile_id = sourceProfileId`.
   - Se `plan = 'gratis'`: nenhum pending, sem cobrança.
   - Se `plan = 'pro'|'premium'` explícito: `plan_id = 'gratis'`, `pending_plan_id = plan`, `status = 'pending_payment'`.
3. Abrir contexto de clonagem: `await admin.rpc('begin_clone_context', { p_user_id: newUserId })`. Idempotente por transação/sessão.
4. Copiar categorias, marcas, produtos, imagens (loop atual). Para cada produto:
   - Passar `deactivation_reason` conforme trigger decidir; NÃO filtrar por limite no código.
   - Registrar `was_active_before_plan_restriction = source.is_active` para todos.
   - Se o trigger inserir com `is_active=false` por limite: OK, tudo cadastrado.
5. Fechar contexto: `admin.rpc('end_clone_context')`.
6. **Nunca copiar** `payment_settings`, `master_subscriptions` da origem, tokens, credenciais Correios/Melhor Envio secretas, cartões, faturas, webhooks (já é o comportamento — reforçar comentário e remover a opção `copyPayments` do payload para evitar cópia indevida de credenciais; opção continua no modal mas ignorada com aviso).
7. Retornar `pendingPlan` e `checkoutUrl` (gerado via função existente `create-master-subscription` para o `pending_plan_id`) além dos dados atuais.

Idempotência:
- Header `Idempotency-Key` opcional; a Edge Function grava em `store_clone_logs.idempotency_key` e retorna o resultado anterior se a mesma chave já teve `status = success`.
- Frontend gera UUID por abertura do modal.

### 3. Webhook de pagamento

`supabase/functions/master-subscription-webhook/index.ts` — no evento de pagamento confirmado:
- Se a assinatura tem `pending_plan_id` e `status = 'pending_payment'`:
  - `plan_id := pending_plan_id`, `pending_plan_id := NULL`, `status := 'active'`.
  - Chamar `reactivate_products_after_upgrade(user_id)`.
- Idempotência já existente por `webhook_events` — só reutilizar.

### 4. Frontend

`src/components/admin/CloneStoreModal.tsx`:
- Ao sucesso com `pendingPlan`, mostrar aviso: "Loja duplicada. Plano <X> aguardando pagamento." + botão "Copiar link de checkout" com `checkoutUrl`.
- Enviar `Idempotency-Key`.

`src/pages/dashboard/Products.tsx` + `useMerchantPlan`:
- Quando `subscription_status = 'pending_payment'` e `pending_plan_id` existir, exibir banner: "Plano <X> aguardando pagamento. Ative para liberar todos os produtos." com CTA para checkout.
- Toggle `is_active` bloqueado para produtos com `deactivation_reason = 'pending_plan_limit'` (tooltip explicando).

Nenhuma outra tela é alterada. Cadastro pela landing, templates por marca, downgrade/inadimplência, lojas existentes: intocados.

### 5. Correção retroativa da loja Aroma duplicada no teste

Script único (rodado uma vez via `insert` tool após confirmação do ID do clone):
1. Identificar o clone (buscar em `store_clone_logs` a última entrada com `source_profile_id` = Aroma).
2. Comparar `products` de origem × clone via `cloned_from_product_id`.
3. Inserir apenas os ausentes, com `is_active = false`, `deactivation_reason = 'pending_plan_limit'`, `was_active_before_plan_restriction = <origem>.is_active`, dentro do contexto de clonagem.
4. Atualizar `master_subscriptions` do clone: `pending_plan_id = 'premium'`, `status = 'pending_payment'`.
5. Não duplicar (chave = `cloned_from_product_id`).

## Arquivos afetados

- **Migration**: adiciona 2 colunas em `products`, 2 em `master_subscriptions`, cria `begin_clone_context`/`end_clone_context` (SECURITY DEFINER), ajusta `validate_product_activation_limit`, ajusta `reactivate_products_after_upgrade`. GRANTs revalidados.
- `supabase/functions/clone-store/index.ts` — reordenação: assinatura antes dos produtos; abertura/fechamento do contexto; sem filtro por limite; retorno de `pendingPlan`/`checkoutUrl`; idempotency-key.
- `supabase/functions/master-subscription-webhook/index.ts` — resolver `pending_plan_id` na confirmação.
- `src/components/admin/CloneStoreModal.tsx` — idempotency-key, exibição do checkout.
- `src/pages/dashboard/Products.tsx` — banner de plano pendente + bloqueio de toggle.
- (Opcional) `src/hooks/useMerchantPlan.tsx` — expor `pendingPlanId` e `subscriptionStatus`.

## Fora de escopo (não será tocado)

Landing/cadastro público, templates por marca, fluxo de downgrade após 7 dias, regras globais de inadimplência, planos de lojas já existentes, loja pública (que já filtra `is_active`), produtos de outras contas, limite do plano Grátis.

## Testes que serão executados

A. Clone Aroma (215) com "Mesmo da origem" → 215 cadastrados, ≤20 ativos, Premium pendente.
B. Webhook Premium confirmado → produtos originalmente ativos reativados; manualmente inativos permanecem inativos.
C. Pagamento não concluído → dados preservados, sem Premium.
D. Clone com "Grátis" → 215 cadastrados, 20 ativos, sem cobrança.
E. Falha meio do caminho → rollback (delete do auth user) já existente permanece.
F. Webhook repetido → sem duplicar produtos nem reativar duas vezes (idempotência via `webhook_events`).

Confirma para eu executar a migration e os ajustes?
