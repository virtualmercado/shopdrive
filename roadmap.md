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

- [x] Auditar autorização existente, criação/retry, PIX e estoque.
- [x] Implementar autorização guest segura e tentativa lógica única no servidor.
- [x] Integrar cartão/PIX e conciliação no mesmo pedido; sem nova cobrança em estado desconhecido.
- [x] Integrar checkout persistente e mensagens distintas; validar cliente autenticado com fixture.
- [x] Reauditar dados locais #001238/#001239 somente em leitura; manter #001240 intacto.
- [x] Testes locais SQL concorrentes, handlers reais com transporte sintético, checkout visual desktop/mobile e compilação automática OK.
- [x] Reconsulta real somente leitura ao Mercado Pago (04–05/11): #001238/#001239/#001240 sem pagamento vinculado; R$ 585,38 é 'Link de pagamento' sem referência — revisão manual.
- [x] Homologação PIX guest/legado (handlers + navegador), compatibilidade do frontend publicado, expiração de tentativas abandonadas antes do gateway (migration 0073, cron horário), typecheck/build/testes.
- [ ] Operação manual do lojista: cancelar #001239 pelo fluxo normal; conciliar R$ 585,38 com #001240.
- [x] Relatar implementação parcial e bloqueios, sem cobrança real ou publicação automática.

## Publicação controlada do hotfix guest — 2026-11-05

- [x] Conferir delta frontend contra a versão realmente publicada: HTML público identifica commit `1ad6619966996e0099569149dcca23a151230170`; candidato `0e5d970dc70acaa3a9f163a4d96c5917fc8df08d`. Cartão/PIX sintéticos (11 cenários) e 26 testes específicos passaram; build OK.
- [ ] BLOQUEADO — autorização restrita ao hotfix: delta inclui `src/lib/customDomainProvisioning.test.ts` e definições de provisionamento/revogação de domínio em `src/integrations/supabase/types.ts`, não relacionadas ao checkout. Não publicado; precisa de autorização explícita sobre esse escopo adicional ou candidato restrito, sem alterar automaticamente arquivos protegidos.
- [ ] BLOQUEADO pela publicação: validar versão pública e checkout/carrinho AROMA www, cartão/PIX guest e cliente autenticado, sem cobranças nem dados sensíveis.
