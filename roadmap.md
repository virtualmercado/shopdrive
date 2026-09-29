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

## Prompt 11 — Fluxo comercial MARCA (MARCA segue desligado)
- Decisão comercial: PRO/PREMIUM → MARCA "começa no vencimento" (MARCA só vale e cobra ao fim do período já pago; sem crédito/prorrata; recorrência antiga só é encerrada após pagamento MARCA confirmado)
- [x] Backend: prepare_my_marca_brand_account (testado, desfeito)
- [x] Backend: get_current_marca_contract + leitor seguro (testado, desfeito)
- [ ] Etapa 3 (bloqueada): auditoria da recorrência Mercado Pago antes de agendar troca paga
- [ ] Financeiro: card MARCA (flag), ciclo, empresa, contrato, aceite, checkout, estados
- [ ] Testes com mocks/transações revertidas

## Prompt 11.2 — Homologação técnica MP TESTE (em andamento)
- [x] Credenciais TESTE no cofre (MP_TEST_ACCESS_TOKEN/PUBLIC_KEY/BUYER_EMAIL); Fase 0 e Fase 1 OK
- [x] Fase 2: assinatura de teste criada com Visa oficial; start_date futuro provado (vira trial, sem cobrança antecipada); pausa/reativação/cancelamento/troca de valor validados; ambos os recursos de teste cancelados
- [x] Perguntas da recorrência respondidas (relatório: /mnt/documents/Relatorio_Prompt11_2_Homologacao.md); única lacuna: retry do MP em falha de cartão no dia da cobrança

## Prompt 11.3 — Troca PRO/PREMIUM → MARCA no vencimento
- [x] Fase A auditoria (/mnt/documents/Relatorio_Prompt11_3_FaseA.md)
- [x] PIX mensal e anual: agendamento, vencimento, expiração, ativação só com pagamento pago (testado, desfeito)
- [x] "Pausado" deixa de dar plano pago para sempre (tolerância 7/14 dias)
- [x] Checkout MARCA ligado à troca agendada (servidor + proteção única no banco; testado, desfeito)
- [ ] Página de pagamento (/gestor/checkout-assinatura) ainda não oferece o plano MARCA
- [ ] Cartão recorrente → MARCA (bloqueado: data confiável + assinatura real inadimplente)

- [ ] Prompt 11.5: testar a página MARCA no navegador (desktop/tablet/mobile) e as regras de cobrança diária com relógio simulado
