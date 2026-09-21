# Ajustar o bloqueio da página Personalizar

## Escopo
- Manter intactos o bloqueio por plano, os recursos de personalização e os dados já salvos.
- Alterar somente a apresentação do aviso de upgrade em Personalizar e seu destino interno.

## Implementação
1. Estender o overlay compartilhado com uma opção específica de conteúdo aderente durante a rolagem, preservando o comportamento padrão usado em Suporte e Marketing.
2. Em Personalizar, manter a máscara absoluta cobrindo todo o conteúdo e posicionar apenas cadeado, mensagem e CTA com `position: sticky`, abaixo do cabeçalho aderente do painel e limitado pelo fim do container.
3. Renderizar a mensagem em quatro linhas explícitas no desktop, com quebra responsiva natural em telas menores.
4. Direcionar “Ver Planos” para `/lojista/financeiro?highlight=pro`, reutilizando a página “Meu Plano / Planos” e seu destaque contextual já existentes.
5. Preservar a regra atual: somente o plano Grátis vê este overlay; PRO e PREMIUM continuam com os controles liberados.

## Validação
- Conferir visualmente abertura, rolagem completa e retorno ao topo em desktop e mobile.
- Confirmar que os controles ao fundo não recebem clique ou foco no plano bloqueado.
- Confirmar navegação interna para Financeiro, plano atual e opções de upgrade.
- Confirmar que Suporte/Tickets e os demais consumidores do overlay mantêm o comportamento atual.
- Verificar compilação, erros de execução e console.

## Detalhes técnicos
- Scroll real: documento/viewport; o conteúdo principal do painel não cria um scroll interno.
- Cabeçalho do painel: `sticky top-0 z-30`; o aviso usará offset responsivo compatível com a altura observada desse cabeçalho, sem `position: fixed` ou listeners.
- Contenção inferior: o elemento sticky permanecerá descendente do overlay absoluto limitado pelo container relativo de Personalizar.
- Nenhuma alteração em banco, planos, assinaturas, pagamentos, loja pública ou persistência.
