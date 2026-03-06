

## Plano: Reorganização Administrativa do Painel Master

### Resumo

Remover "Usuários" do menu lateral, redirecionar `/gestor/usuarios` para `/gestor/configuracoes?tab=usuarios`, aprimorar a aba "Usuários e Permissões" com perfis, filtros e mais ações, e criar a nova aba "Templates de E-mail".

---

### 1. Remover "Usuários" do menu lateral

**Arquivo:** `src/components/layout/AdminLayout.tsx`
- Remover a linha 59: `{ icon: Users, label: "Usuários", path: "/gestor/usuarios" }`

### 2. Redirecionar rota antiga

**Arquivo:** `src/App.tsx`
- Substituir a rota `/gestor/usuarios` por um `Navigate` para `/gestor/configuracoes?tab=usuarios`
- O arquivo `AdminUsers.tsx` pode ser removido ou mantido apenas como redirect

### 3. Suportar query param `tab` em Configurações

**Arquivo:** `src/pages/admin/AdminPlatformSettings.tsx`
- Ler `?tab=` da URL para definir a aba ativa (defaultValue do `Tabs`)
- Adicionar a 6ª aba "Templates de E-mail" com ícone `Mail`
- Alterar grid de `grid-cols-5` para `grid-cols-6`

### 4. Aprimorar a aba "Usuários e Permissões"

**Arquivo:** `src/components/admin/settings/UsersPermissionsTab.tsx`

Melhorias:
- **Perfis/Funções**: Adicionar campo `role` ao formulário com opções: Super Admin, Admin, Operador, Suporte, Financeiro
- **Filtros**: Barra de busca por nome/email, filtro por perfil e status
- **Colunas da listagem**: Nome, E-mail, Perfil, Status, Data de criação, Ações
- **Ações expandidas**: Visualizar detalhes (dialog), Editar, Ativar/Desativar (toggle), Redefinir senha, Excluir
- **Modal de criação aprimorado**: Campos de nome, email, perfil, senha temporária ou "enviar convite por email", status inicial

**Arquivo:** `src/hooks/useAdminUsers.tsx`
- Adicionar campo `role` à interface `AdminUserPermissions`
- Função `createUser` passa a aceitar `role`

**Migração SQL**: Adicionar coluna `role` à tabela `admin_user_permissions` (text, default 'admin')

### 5. Nova aba: Templates de E-mail

**Novo arquivo:** `src/components/admin/settings/EmailTemplatesTab.tsx`

Conteúdo:
- **Listagem** dos 15 templates iniciais (boas-vindas, conta criada, convite, recuperação de senha, etc.)
- Cada template com: nome, evento/gatilho, assunto, status (ativo/inativo), última atualização, ações
- **Ações**: Editar, Preview, Duplicar, Restaurar padrão, Enviar teste
- **Editor modal** com: nome interno, assunto, pré-header, conteúdo HTML (textarea), versão texto simples, variáveis dinâmicas disponíveis, botão preview, botão envio teste
- **Seção de configuração de envio**: nome remetente, email remetente, email resposta, provedor/status
- **Variáveis dinâmicas**: `{{user_name}}`, `{{platform_name}}`, `{{reset_link}}`, etc.

**Nova tabela:** `email_templates` via migração SQL
- Campos: id, name, event_trigger, subject, pre_header, html_content, text_content, variables (jsonb), is_active, created_at, updated_at
- Seed com os 15 templates iniciais com conteúdo base ShopDrive

**Nova tabela:** `email_send_logs`
- Campos: id, template_id, recipient_email, status, error_message, created_at

**Novo hook:** `src/hooks/useEmailTemplates.tsx`
- CRUD para templates e logs de envio

### 6. Migração de banco de dados

Uma única migração SQL que:
1. Adiciona coluna `role` (text, default 'admin') em `admin_user_permissions`
2. Cria tabela `email_templates` com os 15 templates pré-cadastrados
3. Cria tabela `email_send_logs`
4. Aplica RLS adequada (somente admins podem ler/escrever)

### Arquivos afetados

| Arquivo | Ação |
|---------|------|
| `src/components/layout/AdminLayout.tsx` | Remover item "Usuários" |
| `src/App.tsx` | Redirecionar `/gestor/usuarios` |
| `src/pages/admin/AdminPlatformSettings.tsx` | Adicionar aba Templates de E-mail + suporte a query param |
| `src/components/admin/settings/UsersPermissionsTab.tsx` | Aprimorar com perfis, filtros, ações expandidas |
| `src/components/admin/settings/EmailTemplatesTab.tsx` | **Novo** - Aba completa de templates |
| `src/hooks/useAdminUsers.tsx` | Adicionar campo `role` |
| `src/hooks/useEmailTemplates.tsx` | **Novo** - Hook para templates de e-mail |
| Migração SQL | Novas tabelas e coluna |

