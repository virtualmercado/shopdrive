

## Plano: Área de Gerenciamento de Usuários no Painel Master

### Situação Atual
A gestão de usuários do Painel Master já existe como uma aba ("Usuários e Permissões") dentro de **Configurações da Plataforma**. O hook `useAdminUsers` e o componente `UsersPermissionsTab` já possuem CRUD completo (criar, editar, excluir usuários com permissões modulares). O objetivo é promover isso para uma **página dedicada** no menu lateral.

### O que será feito

**1. Nova página `AdminUsers.tsx`**
- Criar `/gestor/usuarios` como página independente
- Reutilizar o componente `UsersPermissionsTab` existente (ou extrair seu conteúdo para a nova página com layout aprimorado)
- Manter toda a lógica existente do `useAdminUsers` sem alterações

**2. Adicionar rota no `App.tsx`**
- Nova rota protegida: `/gestor/usuarios` com `AdminRoute`

**3. Adicionar item no menu lateral (`AdminLayout.tsx`)**
- Novo item "Usuários" com ícone `Users` posicionado após "Logs e Segurança" (ou antes de "Configurações")
- Path: `/gestor/usuarios`

**4. Manter a aba em Configurações**
- A aba "Usuários e Permissões" em Configurações continuará funcionando normalmente como acesso alternativo

### Arquivos afetados
- `src/pages/admin/AdminUsers.tsx` (novo)
- `src/App.tsx` (nova rota)
- `src/components/layout/AdminLayout.tsx` (novo item no menu)

