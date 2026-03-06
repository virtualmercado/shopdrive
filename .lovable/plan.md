

## Plano: Corrigir listagem de usuários em Configurações > Usuários e Permissões

### Diagnóstico

A tabela `admin_user_permissions` está **vazia**. Os usuários admin existem em `user_roles` (3 registros com role='admin') e `profiles`, mas nunca foram inseridos em `admin_user_permissions` pois foram criados antes dessa tabela existir.

A RLS está correta (`has_role(auth.uid(), 'admin')`), mas não há dados para retornar.

### Solução

Duas ações complementares:

**1. Migração: Popular `admin_user_permissions` com usuários admin existentes**

Inserir na tabela `admin_user_permissions` todos os usuários que já possuem role `admin` em `user_roles`, cruzando com `profiles` para obter nome e com `auth.users` para obter email. Definir `is_active = true`, `role = 'super_admin'` e permissões completas para esses usuários pré-existentes.

**2. Modificar `useAdminUsers.tsx`: fallback para user_roles + profiles**

Caso `admin_user_permissions` retorne vazio mas existam admins em `user_roles`, o hook deve fazer uma segunda query em `profiles` filtrando por IDs que tenham role admin, garantindo que a tela nunca fique vazia quando existem admins no sistema.

Alternativamente (e mais simples): apenas a migração de dados resolve o problema, pois o hook já funciona corretamente -- só faltam dados na tabela.

### Arquivos afetados

| Arquivo | Ação |
|---------|------|
| Migração SQL | INSERT dos admins existentes em `admin_user_permissions` |
| `src/hooks/useAdminUsers.tsx` | Adicionar fallback que sincroniza admins de `user_roles` caso tabela esteja desatualizada |

