# Roadmap — Custom Domains V2: provisionamento automático Cloudflare + ingress multi-hostname

Spec: IMPLEMENTAÇÃO ESTRUTURAL — CUSTOM DOMAINS V2 (upload 2026-10-31). Flags `feature_enabled`/`ingress_ready` permanecem `false`. AROMA não pode ser afetada.

- [ ] Migration: colunas de provisionamento em `merchant_domains` (external_created_at, external_last_check_at, external_error, provision_attempts, provision_next_retry_at) + RPCs server-side (begin/complete/fail provisioning, revoke interno + finalize) + token de job interno + cron 5min
- [ ] `_shared/customDomainProvisioning.ts`: lógica pura (decisão de estado, backoff, conflito de hostname, sanitização de erro)
- [ ] Edge Function `manage-custom-domain-hostname` (create/status/retry/delete; auth via auth.uid(); ownership+CNAME antes de criar; idempotente; para antes de chamada externa se `CLOUDFLARE_CUSTOM_HOSTNAMES_TOKEN` ausente)
- [ ] Edge Function `sync-custom-domain-provisioning` (job interno, lotes pequenos, só pendentes, backoff)
- [ ] Worker genérico multi-hostname (código entregue em `cloudflare/workers/`, sem deploy — credencial atual é somente leitura)
- [ ] Testes unitários da lógica de provisionamento (spec §19)
- [ ] Verificar build + testes; confirmar flags desligadas e AROMA intacta
- [ ] Entrega: instruções exatas da credencial e da route wildcard para o administrador
