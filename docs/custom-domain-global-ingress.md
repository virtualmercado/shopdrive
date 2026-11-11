# Ingresso global de domínios próprios (Cloudflare for SaaS) — runbook

Estado registrado em 2026-11-11 (somente leitura, antes de qualquer mudança):

- Zona: `shopdrive.com.br` (nameservers Cloudflare).
- Custom Hostnames: 1 — `www.redearoma.com.br`, id `fd3cd405-657e-4da7-a2ce-6424dc865670`, hostname e SSL `active`
  (DV, validação TXT), sem custom origin e sem custom metadata. Protegido em
  `custom_domain_platform_config.protected_external_hostname_ids`.
- Fallback origin: `saas-origin.shopdrive.com.br`, status `active` (o próprio host responde 522 quando acessado direto).
- DNS público: `shopdrive.com.br` e `www.shopdrive.com.br` → `185.158.133.1` sem proxy (não passam por Workers da zona);
  `domains.shopdrive.com.br` (alvo CNAME dos lojistas) e `saas-origin.shopdrive.com.br` com proxy Cloudflare.
- Workers Scripts na conta: nenhum listado. Workers Routes, Origin Rules, rulesets e registros DNS: não legíveis pelas
  credenciais atuais (HTTP 403). O tráfego da AROMA não passa pelo Worker deste repositório (o cabeçalho anti-loop não
  provoca 508), então existe uma regra/rota específica configurada manualmente que precisa ser preservada.
- Flags: `feature_enabled=false`, `ingress_ready=false`, `cloudflare_writes_enabled=false`, `cloudflare_deletes_enabled=false`.

## Hostnames internos protegidos

Sufixos reservados (iguais no banco, nas funções do backend e no Worker):
`shopdrive.com.br` (inclui www, domains, saas-origin e qualquer subdomínio), `virtualmercado.com.br`, `lovable.app`
(publicado e preview), `lovable.dev`, `lovableproject.com`, `supabase.co`/`supabase.in`/`supabase.com` (backend, auth,
storage, funções). Nenhum deles pode virar domínio de lojista, ser criado na Cloudflare ou ser reescrito pelo Worker.

## Passo manual (admin, painel Cloudflare) — ainda não executado

1. Antes de mudar: anotar/printar Workers Routes e Rules > Origin Rules atuais da zona (base do rollback).
2. Publicar o Worker `shopdrive-custom-domain-router` com `cloudflare/workers/shopdrive-custom-domain-router.ts`
   (wrangler; o arquivo é TypeScript). Sem secrets, sem banco.
3. Adicionar a rota `*/*` → `shopdrive-custom-domain-router`. Não remover a rota/regra atual da AROMA.
4. Validar: `https://shopdrive.com.br`, `https://www.shopdrive.com.br`, `/login`, painel, uma loja padrão
   (`https://shopdrive.com.br/<slug>`), checkout abrindo, `https://www.redearoma.com.br` e ausência de loop/redirecionamento.
5. Avisar o agente para conferir (GET + HTTP) e só então marcar `ingress_ready=true`.

Custo: Workers cobra por requisição (plano Free 100 mil/dia; acima disso plano pago).

## Rollback

1. Remover somente a rota `*/*` (a rota/regra da AROMA continua).
2. `UPDATE custom_domain_platform_config SET ingress_ready=false, cloudflare_writes_enabled=false, cloudflare_deletes_enabled=false WHERE id;`
3. Não apagar Custom Hostnames, registros de lojas nem histórico.
