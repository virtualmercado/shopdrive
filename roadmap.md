# Roadmap — Custom Domains V2: provisionamento automático Cloudflare + ingress multi-hostname

## Gerenciamento seguro multiloja MARCA — 2026-11-06

- [x] Auditoria: vínculo MARCA é financeiro, não membership; AuthContext, consultas, RLS e funções derivam tenant de auth.uid/user.id. Não existe contexto de loja ativa. Duas lojas e 217 produtos ativos em cada uma confirmados em leitura.
- [ ] Revisar o plano de autorização explícita e migração coordenada dos consumidores/RLS/RPCs/arquivos antes de habilitar troca; seletor isolado não é seguro. Nenhuma autorização/dado real alterado.
- [ ] Minha Rede → Minhas Lojas e cabeçalho Trocar loja somente para lojas legitimamente autorizadas; troca server-side, limpeza de estado/cache e Dashboard da loja escolhida.
- [ ] Garantir isolamento de produtos/pedidos/clientes/financeiro/gateway/configurações/domínio e Seu Link da loja ativa.
- [ ] Financeiro: aviso/planos/cartão preparados, mas InvoiceHistorySection ainda gera próxima fatura virtual/pagamento PREMIUM na secundária; ocultar renovação sem alterar registros. Cancelamento exige JWT e has_role(admin), preserva período/financeiro e não registra tokens; validar repetição sequencial e concorrência somente com fixtures.
- [ ] Executar somente testes necessários ao delta; não publicar, cobrar ou alterar infraestrutura/entitlements/registros financeiros.

## Migração controlada AROMA Varejo → segunda loja MARCA — 2026-11-06

- [x] Auditoria somente leitura: principal MARCA direto ativo (`d98b895f`, período até 11/11), conta `b1f7437d` com apenas slot 1; Varejo PREMIUM direto ativo (`825c1194`, até 20/11), preapproval `c4536ee702544c568b6179a514ab7b6d`; ambas com 217 produtos ativos, Varejo com 2 pedidos, perfis elegíveis sem origem de template.
- [ ] BLOQUEADO — vínculo: `validate_brand_owned_store` recusa a Varejo com assinatura própria PREMIUM ativa; `get_effective_store_plan` prioriza plano próprio e só herda MARCA se a base direta for free. O mecanismo atual não comprova MARCA na Varejo mantendo esse estado; requer definição/autorização de transição atômica no mecanismo existente, sem downgrade nem cancelamento externo antecipado.
- [ ] BLOQUEADO pelo vínculo — recorrência: não cancelar Mercado Pago nem encerrar assinatura interna antes da solução e confirmação MARCA; não há função de cancelamento de preapproval revisada no repositório (cancelamento de payments não encerra recorrência). Nenhuma chamada externa ou alteração financeira efetuada.
- [ ] BLOQUEADO — financeiro herdado: `Financeiro.tsx` lê assinatura própria e ainda expõe contratação Pro/Premium após herança; requer ajuste autorizado para mostrar MARCA herdado e suprimir contratação própria. Nenhum código funcional/publicação alterado, nenhum dado/pedido/produto/domínio/flag/Cloudflare modificado ou cobrança realizada.

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
- [x] Configuração manual confirmada por consulta agregada: um gateway Master ativo/padrão com chave webhook e Access Token configurados; nenhum valor secreto lido.

## Validação objetiva do webhook — 2026-11-06

- [x] Função implantada: duas requisições sem credenciais reais confirmaram 401 e resposta exata `Invalid signature` para ausência/assinatura inválida; sem claims, callbacks financeiros ou cobrança.
- [x] 17 testes existentes do handler real passaram com chave e transporte fictícios. Validação adicional integrada handler real → RPCs SQL reais locais passou: HMAC sintético aceito, duplicate com um GET/uma aplicação, approved com uma atualização da invoice/pagamento e evento distinto sem novos efeitos. Sucesso, falha de provider e falha de aplicação não expõem chaves, assinatura, token ou PII fictícios em logs/respostas.
- [x] PostgreSQL 17 descartável em localhost: dez cenários de SQL/concorrência passaram; oito claims/renovações simultâneos aplicam uma vez, rollback e eventos antigos preservam estado. Digests das quatro funções financeiras testadas iguais aos implantados. Cluster encerrado; nenhum dado financeiro real escrito.
- [x] Simulador oficial não executado: requer acesso à aplicação/conta Mercado Pago, indisponível sem usar credenciais reais. Aceitação assinada/reconciliação aprovadas apenas com fixtures isoladas, não por evento oficial em produção. Configuração e rejeições confirmadas na função real; logs consultados contêm só inicialização e nenhum segredo.
- [x] Comparação agregada antes/depois: pagamentos (32), invoices (32), assinaturas (34), receipts (0) e applications (0) mantiveram contagens/digests idênticos; nenhuma mudança de código funcional, deploy, configuração ou cobrança.

## Transição AROMA Varejo PREMIUM → 2ª loja MARCA — 2026-11-06
- [x] Regras de vínculo/precedência/desvinculação ajustadas (migration 0075); Varejo vinculada (vaga 2); PREMIUM próprio até 20/11, depois MARCA herdado (simulação desfeita confirmou MARCA, 0 produtos desativados, nova assinatura própria bloqueada).
- [x] Recorrência Mercado Pago cancelada após o vínculo (authorized → cancelled, reconsulta confirmou); faturas/pagamentos/histórico intactos.
- [x] Financeiro: loja vinculada vê aviso MARCA, sem planos/pagamento próprio; histórico de faturas mantido. Publicação do frontend pendente de autorização.
