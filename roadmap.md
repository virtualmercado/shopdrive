# Roadmap

## Refinamento visual das imagens de campanhas
- [ ] Orientação e aviso informativo por proporção na Etapa 3.
- [ ] Limites visuais no renderer compartilhado, sem alterar histórico ou biblioteca.
- [ ] Validar regras, desktop/mobile e regressões sem enviar e-mails.

## Imagem opcional nas campanhas
- [x] Verificar Biblioteca Master, URLs permanentes e isolamento de assets.
- [x] Integrar seleção, persistência, prévia e proteção de referências históricas.
- [x] Validar regras e fluxo sem envio real; relatar resultados.

## Etapa 3 — Comunicação → Campanhas de E-mail
- [x] Migration: `email_campaigns` + `email_campaign_recipients` (grants, RLS admin-only, índices)
- [x] Trigger: email_queue status → atualiza recipient + counters + conclusão automática
- [x] RPCs admin-only: criar/editar rascunho, contagem de público, confirmar+snapshot+enqueue idempotente, cancelar, listar campanhas, listar destinatários paginado
- [x] Frontend: aba "Campanhas de E-mail" em AdminCommunication (admin-only), wizard 5 etapas, listagem, detalhes, cards
- [x] Testes simulados sem envio real (T1–T18 no banco, transação desfeita; build/typecheck/179 testes OK)
- [ ] BLOQUEADO: teste real controlado (item 40) — suspenso pela instrução atual de não enviar e-mails reais.

## Hotfix pré-publicação — Campanhas
- [x] Centralizar destinatário comercial válido → conta válida → inelegível, somente marketing.
- [x] Permitir rascunho parcial e exigir validação no conteúdo/prévia/confirmação.
- [x] Executar testes sem envio real e relatar resultados sem secrets.
