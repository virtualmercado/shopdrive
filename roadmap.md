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
- [x] Gate objetivo autorizado: teste de provisionamento fora do grafo de imports de produção; adições de domínio somente em tipos, com JavaScript emitido e `Constants` idênticos à revisão pública. Nenhuma alteração funcional de UI/domínio/Worker/provisionamento incluída no bundle; nenhum código alterado nesta etapa.
- [x] Publicado e confirmado: revisão `0eb19644a187e055d7559493606a018d1fcb97cc`, novo bundle `/assets/index-CPTehEbV.js` servido em ShopDrive e www AROMA. Produto real com aroma Açaí → carrinho → checkout guest → formulário de cartão editável → opção PIX abriram; zero erros de página/401/403/chamadas de pagamento e nenhum marcador sensível observado. Escritas interceptadas; nenhum pedido/QR/cobrança criado. Homologação autenticada anterior preservada, sem repetir testes ou autenticar conta real nesta etapa.

## Webhook Mercado Pago de assinaturas — 2026-11-05

- [x] Identificado: `master-subscription-webhook` lê `master_payment_gateways.mercadopago_webhook_secret`, não um secret de ambiente. Consulta agregada: um gateway ativo/padrão, Access Token configurado, chave webhook ausente. Nenhum valor secreto lido.
- [x] Revisão somente leitura: usa x-signature/x-request-id e HMAC-SHA256, porém assina body.data.id em vez de query data.id, não normaliza IDs alfanuméricos nem verifica tolerância temporal, e registra hashes na falha; dedup read-then-insert ignora erro de unicidade, não prova atualização única concorrente. Sem alterações de código ou deploy.
- [x] Corrigir HMAC oficial (ts/v1, query data.id case-preserved conforme SDK oficial PR #439 de 23/06/2026, manifesto, WebCrypto.verify, 401); nunca registrar payloads/segredos.
- [x] Migration 0074: receipts com lease/token, applications por pagamento e RPCs service-only; dedup após assinatura/parse e antes dos GETs; conciliação transacional com fatura exata, guardas MARCA existentes, renovações sem sobrescrever primeira fatura e eventos antigos sem rebaixar plano atual. Deploy somente `master-subscription-webhook`; sem executar DML financeiro no backend real.
- [x] 17 testes do handler real + banco PostgreSQL local: oito claims simultâneos, aprovação e invoice exatamente uma vez, eventos distintos, falhas atômicas e retry, renovações concorrentes, eventos antigos e recuperação de pagamento já paid incompleto; Deno check limpo, build OK. Novas tabelas em produção vazias, grants service-only confirmados; sem cobrança ou publicação frontend.
- [ ] BLOQUEADO (configuração manual): administrador deve configurar a chave autêntica do Mercado Pago em `master_payment_gateways.mercadopago_webhook_secret` do gateway ativo/padrão; o formulário Master atual não oferece esse campo e Secrets de ambiente não são lidos pela função.
