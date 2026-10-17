# Roadmap

## Etapa 3 — Comunicação → Campanhas de E-mail
- [ ] Migration: `email_campaigns` + `email_campaign_recipients` (grants, RLS admin-only, índices)
- [ ] Trigger: email_queue status → atualiza recipient + counters + conclusão automática
- [ ] RPCs admin-only: criar/editar rascunho, contagem de público (reusa lógica admin_list_subscribers), confirmar+snapshot+enqueue idempotente, cancelar, listar campanhas, listar destinatários paginado
- [ ] Frontend: aba "Campanhas de E-mail" em AdminCommunication (admin-only), wizard 5 etapas, listagem, detalhes, cards
- [ ] Testes sem envio real em massa (itens 1–24 da spec)
- [ ] Build/typecheck + relatório final
- [ ] BLOQUEADO: teste real controlado — aguarda endereço autorizado pelo admin (não enviar a lojistas reais)
