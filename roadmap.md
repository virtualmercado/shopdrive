# Roadmap

- [x] Auditar overlay, scroll, acesso por plano e fluxo interno de planos.
- [x] Implementar aviso aderente e CTA interno somente em Personalizar.
- [x] Validar plano bloqueado, plano elegível, desktop, mobile e regressões.
- [x] Consolidar em uma única comunicação o bloqueio visual de Marketing.
- [x] Tornar o aviso de Marketing aderente e corrigir seu destino interno.
- [x] Validar Marketing em planos bloqueado e elegível, desktop e mobile.
- [x] Incluir Cupons no contêiner protegido de Marketing sem alterar o overlay existente.
- [x] Validar bloqueio de Cupons no Grátis e acesso normal no PRO/PREMIUM.

## Matriz de variantes com estoque por combinação (2026-09-24)
- [x] Tabelas de atributos/valores/variantes + RLS + SKU estável (V001…)
- [x] Editor "Combinações e estoque" no ProductForm (opcional, não destrutivo)
- [x] Loja pública: seletores separados + indisponibilidade por combinação
- [x] Carrinho/checkout/pedido com variant_id, variant_sku e snapshot
- [x] Baixa atômica ao criar pedido (inclui WhatsApp/guest), estorno automático em cancelado/expirado/recusado/invalidado, idempotente, sem negativo; produtos simples mantêm regra atual
- [x] WhatsApp/PDF com variações; clonagem de loja
- [x] Teste visual no navegador (editor mobile, loja pública, PDF multipágina) — pendente de validação manual

## Variantes — fechamento de lacunas (em andamento)
- [x] Ver pedido: mostrar atributos + SKU da variante por item
- [x] PDF/recibo (1 página e multipágina) com variantes
- [x] Pedido manual (Incluir Pedido) exige combinação completa, usa variant_id/estoque da variante
- [x] Cópia de produtos de templates copia variantes com novos IDs/SKUs
- [x] Busca do painel por SKU da variante
- [x] Matriz PASS/FAIL A–X
