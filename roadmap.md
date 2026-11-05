# Roadmap — Custom Domains V2: provisionamento automático Cloudflare + ingress multi-hostname

Spec: IMPLEMENTAÇÃO ESTRUTURAL — CUSTOM DOMAINS V2 (upload 2026-10-31). Flags `feature_enabled`/`ingress_ready` permanecem `false`. AROMA não pode ser afetada.

- [x] Migration 0069: colunas de provisionamento + 6 RPCs service-role + token de job interno + cron 5min
- [x] `_shared/customDomainProvisioning.ts`: lógica pura (estado, backoff, conflito, sanitização)
- [x] Edge Function `manage-custom-domain-hostname` (create/status/retry/delete; ownership+CNAME antes de criar; idempotente; 503 `credential_not_configured` sem o secret)
- [x] Edge Function `sync-custom-domain-provisioning` (job interno, lotes de 10, só pendentes, backoff)
- [x] Worker genérico multi-hostname entregue em `cloudflare/workers/` (sem deploy — credencial atual é somente leitura)
- [x] 35 testes novos da lógica de provisionamento (spec §19); suíte completa 520 passando
- [x] Verificado: flags desligadas, AROMA intacta (active), cron agendado, funções rejeitam anon (401), build OK
- [ ] BLOQUEADO (ação manual do admin): criar secret `CLOUDFLARE_CUSTOM_HOSTNAMES_TOKEN` (SSL and Certificates: Edit na zona shopdrive.com.br) e publicar o Worker + route wildcard `*/*`

## Hotfix checkout guest — 2026-11-05

- [ ] Auditar autorização existente, criação/retry, PIX e estoque.
- [ ] Implementar autorização guest segura e tentativa lógica única no servidor.
- [ ] Integrar cartão/PIX confirmado e reconciliação de resultado ambíguo sem nova cobrança.
- [ ] Integrar checkout persistente e mensagens distintas, preservando clientes autenticados.
- [ ] Reauditar #001238/#001239 somente em leitura; manter #001240 intacto.
- [ ] Executar testes sintéticos de segurança, retry, estoque, cartão/PIX e fluxo visual; verificar compilação automática.
- [ ] Relatar entrega e bloqueios, sem cobrança real ou publicação automática.
