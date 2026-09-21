# Consolidar o bloqueio da página Marketing

## Escopo
- Alterar somente a apresentação e a navegação da comunicação de upgrade em Marketing.
- Preservar integralmente permissões por recurso, integrações, configurações salvas, planos e demais páginas.

## Implementação
1. Manter o bloqueio global já condicionado por `canUseMarketing`, substituindo seu uso de `fixed` pela opção aderente já disponível no overlay compartilhado.
2. Manter a máscara absoluta sobre a área de Marketing e posicionar somente cadeado, mensagem e CTA com `position: sticky`, respeitando o cabeçalho do painel e o fim do container.
3. Remover somente o overlay visual redundante do card de Avaliações; a permissão `canUseReviews` e a navegação existente não serão alteradas.
4. Exibir a nova mensagem com quatro quebras explícitas no desktop e adaptação natural em telas menores.
5. Direcionar “Fazer Upgrade” para `/lojista/financeiro?highlight=pro`, reutilizando “Meu Plano / Planos” e seu destaque contextual.

## Validação
- Conferir conta bloqueada: uma mensagem, um cadeado, um CTA, máscara íntegra e recursos cobertos inacessíveis.
- Conferir rolagem completa e reversa em desktop, notebook, tablet e mobile, incluindo contenção superior e inferior.
- Confirmar navegação interna para Financeiro, sessão preservada e apresentação do plano atual e das opções de upgrade.
- Conferir conta PRO/PREMIUM sem bloqueio indevido e sem alteração das integrações ou configurações.
- Verificar compilação, execução, console e ausência de regressão nos overlays de Personalizar e Suporte.

## Detalhes técnicos
- O scroll real é o documento/viewport; o `<main>` do painel não cria rolagem própria.
- O cabeçalho usa `sticky top-0 z-30`; será reutilizado o offset responsivo do modo `stickyContent` já validado em Personalizar.
- A contenção inferior será natural: o conteúdo sticky permanece descendente do overlay absoluto limitado pelo container relativo de Marketing.
- Nenhum listener de scroll, nova dependência, banco, RLS, função, integração ou regra comercial será alterado.
