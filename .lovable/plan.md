# Incluir Cupons no bloqueio de Marketing

## Escopo
- Alterar somente a composição da página Marketing e a defesa das ações administrativas de cupons.
- Preservar integralmente aviso, texto, CTA, sticky, máscara, integrações, checkout, dados e regras comerciais.

## Implementação
1. Mover `CouponsSection` para dentro do contêiner já coberto pelo único `PlanGateOverlay` de Marketing.
2. Manter a fonte de verdade existente: `limits.canUseCoupons` é falso no Grátis e verdadeiro no PRO/PREMIUM.
3. Passar a permissão efetiva ao componente de Cupons e impedir abertura, edição, exclusão e alteração de status quando indisponível, sem apagar ou modificar dados.
4. Manter o `inert`, `aria-hidden` e bloqueio de ponteiro no contêiner protegido para impedir contorno por teclado ou clique.

## Validação
- Plano Grátis: Cupons visível sob a máscara, ações inacessíveis por clique e teclado, uma única mensagem sticky e CTA interno preservados.
- PRO e PREMIUM: Cupons sem máscara e ações existentes disponíveis.
- Confirmar compilação, console, responsividade e ausência de mudanças nos demais módulos de Marketing.

## Detalhes técnicos
- Causa: `CouponsSection` foi renderizado antes do `<div className="relative">` que contém o overlay e o conteúdo bloqueado.
- Não haverá migration, alteração de dados, backend, checkout, integração ou nova regra de plano.
