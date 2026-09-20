# Corrigir bloqueio do suporte via WhatsApp

## Objetivo
Ajustar somente o bloco de WhatsApp da página **Suporte / Tickets**, preservando as regras de plano, tickets, Academia SD e o fluxo financeiro existente.

## Auditoria confirmada
- A página e o card estão em `Support.tsx`.
- O bloqueio usa `PlanGateOverlay`, posicionado de forma absoluta com `inset-0` sobre um pai `relative`.
- A permissão vigente é `limits.canUseWhatsAppSupport`: apenas PREMIUM possui acesso; Grátis e PRO permanecem bloqueados.
- O recorte decorre da combinação de `overflow-hidden` no card com um overlay cujo conteúdo vertical (ícone, mensagem, botão e espaçamentos) é maior que a altura natural do card de fundo.
- Sem destino explícito, o CTA do overlay usa `/#planos`, levando à página pública.
- A rota interna real é `/lojista/financeiro`; nela, **Meu Plano / Planos** já é a primeira seção, com suporte ao parâmetro `highlight=premium` para destacar diretamente o plano PREMIUM.

## Alteração localizada
1. No bloco de WhatsApp, aplicar altura mínima responsiva somente quando o recurso estiver bloqueado, mantendo altura natural para PREMIUM.
2. Manter o pai `relative` e o overlay `absolute inset-0`, para a máscara acompanhar automaticamente toda a altura.
3. Tornar o conteúdo de fundo semanticamente indisponível no estado bloqueado, removendo o botão do fluxo de teclado e impedindo interação.
4. Renderizar a mensagem com três linhas explícitas no desktop, com adaptação segura no mobile.
5. Passar ao CTA o destino interno `/lojista/financeiro?highlight=premium`, reutilizando o destaque já existente em **Meu Plano / Planos**.
6. Não alterar o componente compartilhado de bloqueio nem qualquer regra comercial.

## Validação
- Conferir compilação e erros de execução.
- Verificar desktop, notebook, tablet e mobile: enquadramento completo, máscara integral, texto/CTA visíveis, sem sobreposição com Academia SD.
- Validar teclado: botão de WhatsApp bloqueado não recebe foco; CTA recebe foco.
- Validar navegação do CTA para Financeiro com destaque PREMIUM e sessão preservada.
- Confirmar por código e, quando houver contas de teste disponíveis, por navegação autenticada, os comportamentos Grátis/PRO/PREMIUM.
