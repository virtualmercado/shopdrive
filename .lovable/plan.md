## Diagnóstico

A migração de segurança `20260523233913_2c73ca3c-f657-4e37-9521-faf69f5e99e4.sql` (linhas 67–117) revogou `EXECUTE` de `anon, authenticated, PUBLIC` para um conjunto de funções `SECURITY DEFINER`, incluindo todas as RPCs do sistema de Templates por Marca:

- `apply_template_to_existing_store(uuid,uuid,boolean)`
- `sync_template_from_profile(uuid)`
- `complement_template_data(uuid,uuid)`
- `backfill_partner_templates()`
- `clone_template_to_store(uuid,uuid)`
- `link_template_to_profile(uuid,uuid)`

Essas RPCs são chamadas do client em:
- `src/pages/Register.tsx` → `clone_template_to_store` (usuário recém-criado)
- `src/contexts/TemplateEditorContext.tsx`, `src/hooks/useTemplateEditor.tsx`, `src/lib/templatePreviewSync.ts` → `sync_template_from_profile`
- `src/components/admin/TemplateMaintenanceTab.tsx` → `apply_template_to_existing_store`, `complement_template_data`, `backfill_partner_templates`

Resultado: todo o fluxo (cadastro via link, sincronizar, complementar, backfill, forçar) responde **permission denied for function**, deixando lojas em `pending`/`incomplete` e bloqueando retry.

O erro **"User already registered"** vem de tentativas repetidas no `Register.tsx`: o usuário do auth é criado com sucesso, mas o `clone_template_to_store` falha por permissão; quando o lojista repete o cadastro, o `signUp` rejeita porque o e-mail já existe — sem caminho de recuperação no front.

## Plano de correção

### 1. Migração: restaurar permissões com segurança por papel

Reaplicar `GRANT EXECUTE` nas funções de template, mas com **gate interno** dentro de cada função administrativa para impedir abuso por usuários comuns:

- `apply_template_to_existing_store`, `complement_template_data`, `backfill_partner_templates`, `link_template_to_profile`: adicionar no topo do corpo
  ```sql
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Acesso negado: requer papel admin';
  END IF;
  ```
  e `GRANT EXECUTE ... TO authenticated` (auth.uid() necessário para o check).
- `sync_template_from_profile(uuid)`: permitir admin **ou** o próprio dono do `source_profile_id` do template (lojista no modo template-editor). `GRANT EXECUTE ... TO authenticated`.
- `clone_template_to_store(uuid,uuid)`: permitir quando `auth.uid() = p_user_id` (auto-clone no cadastro) **ou** admin. `GRANT EXECUTE ... TO authenticated`.

Sem reabrir para `anon` — todas as chamadas hoje partem de sessão autenticada (signup já loga o usuário antes do `Register.tsx` chamar a RPC).

### 2. Migração: blindagem transacional das funções

Em `apply_template_to_existing_store`, `clone_template_to_store` e `complement_template_data`:

- Envolver o corpo em `BEGIN ... EXCEPTION WHEN OTHERS` (já existe) e gravar `template_apply_status`, `template_apply_error` e `template_applied_at` em **todos** os caminhos (sucesso, parcial, falha) — hoje alguns saem cedo sem atualizar status.
- Em `clone_template_to_store`: ao sair com `retry=true` (profile ainda não existe), **não** apagar nada e não marcar `applied`. OK como está; reforçar com `template_apply_status='pending'` explícito.
- Garantir que `apply_template_to_existing_store` com `p_force=true` execute `DELETE FROM products` dentro do mesmo bloco que chama `copy_template_products_to_store`, em uma sub-transação `SAVEPOINT`, para evitar perder produtos caso o copy falhe.

### 3. Migração: rotina de reparo idempotente

Criar `public.repair_incomplete_template_stores()` (`SECURITY DEFINER`, admin-only) que:

1. Seleciona profiles com `source_template_id IS NOT NULL` e (`template_apply_status IN ('pending','failed','incomplete')` **ou** falta de banners/produtos versus `brand_template_products`).
2. Para cada loja:
   - Se `template_applied = false` → chama `apply_template_to_existing_store(..., p_force := false)`.
   - Senão → chama `complement_template_data`.
3. Recalcula `template_apply_status` no final via checklist de integridade (ver §4).
4. Retorna `jsonb` com `processed`, `repaired`, `still_incomplete`, `details[]` por loja.

Nunca cria auth user nem duplica profile.

### 4. Migração: checklist de integridade

Criar `public.template_integrity_check(p_user_id uuid)` retornando `jsonb` com flags:
`has_banners_desktop`, `has_banners_mobile`, `has_mini_banners`, `has_benefit_banners`, `has_content_banner`, `has_products`, `has_brands`, `has_categories`, `has_about_us`, `has_colors`, `has_footer`, mais `missing[]`.

Chamar ao fim de `apply_template_to_existing_store`, `complement_template_data` e `repair_incomplete_template_stores` para definir `template_apply_status` como `applied` apenas se `missing[]` estiver vazio; caso contrário `incomplete` com `template_apply_error = 'Itens faltantes: ...'`.

### 5. Frontend: recuperar "User already registered"

Em `src/pages/Register.tsx`:

- Quando `signUp` retornar erro com código `user_already_exists` (ou mensagem equivalente) **e** houver `template` no contexto:
  1. Tentar `signInWithPassword` usando as mesmas credenciais.
  2. Se logar com sucesso, buscar o `profiles.template_apply_status` do usuário:
     - `pending`/`failed`/`incomplete` → seguir o mesmo loop de retry de `clone_template_to_store` já existente (recuperação).
     - `applied` → redirecionar direto para `/onboarding` ou `/gestor`.
  3. Se o sign-in falhar (senha errada), exibir mensagem clara orientando login/recuperação de senha, sem perder o `template` na URL.

- Adicionar telemetria de console (`[Register][recovery]`) em cada ramo para facilitar suporte.

### 6. Frontend: feedback dos botões admin

Em `src/components/admin/TemplateMaintenanceTab.tsx`:

- Mostrar mensagem explícita quando a RPC retornar `permission denied` (futuro proofing) sugerindo verificar papel admin.
- Após `apply`/`complement`/`backfill`, exibir o `jsonb` retornado (especialmente `missing[]` e contagem de produtos) num diálogo de resultado, para que o admin enxergue por que algo ficou `incomplete`.

### 7. Verificação pós-migração

1. Rodar `repair_incomplete_template_stores()` uma vez via `supabase--insert` para reparar lojas afetadas em produção.
2. Smoke test manual:
   - Novo cadastro via link de template → loja completa.
   - Repetir mesmo e-mail → recuperação automática.
   - "Forçar sincronização" no editor de template → 200.
   - "Complementar" e "Backfill" no painel admin → 200 + relatório.

## Detalhes técnicos

- Funções afetadas (todas em `public`, `SECURITY DEFINER`, `search_path=public`): ver §1.
- Tabelas tocadas: `profiles`, `products`, `product_brands`, `product_categories`, `brand_templates`, `brand_template_products`.
- Sem mudança de schema — apenas `CREATE OR REPLACE FUNCTION`, `GRANT`, novas funções de reparo/check, edits frontend em `Register.tsx` e `TemplateMaintenanceTab.tsx`.
- `has_role` já é `SECURITY DEFINER` e bypassa RLS para checar `user_roles`.
- Não reabre acesso a `anon`; mantém o ganho de segurança da migração anterior, corrigindo apenas o falso positivo.
