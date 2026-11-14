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

## Ativação global — 2026-11-14

- Worker global (deployment `2bd4b3cf`) e rota wildcard publicados e validados manualmente pelo admin.
- Flags atuais: `feature_enabled=true`, `ingress_ready=true`, `cloudflare_writes_enabled=true`, `cloudflare_deletes_enabled=false`.
- Elegibilidade (somente servidor, `_custom_domain_store_eligible`): loja ativa com slug + plano efetivo Premium ou MARCA
  (`get_effective_store_plan`) + sem bloqueio individual. Bloqueio individual = linha em `custom_domain_v2_access` com
  `enabled=false` (switch do Master). Sem linha = permitido. A linha piloto da AROMA (`enabled=true` + `pilot_hostname`)
  mantém a semântica antiga e não depende de plano.
- DNS do lojista: só `CNAME www → domains.shopdrive.com.br` + TXT `_shopdrive-verification`. Sem alvo para a raiz
  (`root_record_value` nulo), a verificação exige o escopo exato `wwwOnlyHostname = www.<domínio>`; a raiz não é roteada.
- Criação do Custom Hostname: somente quando o lojista clica em "Verificar" e o DNS fica `dns_verified`; o painel chama
  `manage-custom-domain-hostname` (`create`, consulta antes do POST, idempotente). Ligar flags não cria nada sozinho.
- Desconexão de domínio já criado: o resolver é revogado na hora; com DELETE desligado a remoção externa fica pendente
  (`external_error = external_removal_pending:<motivo>`, `routing_status=removing`) para ação explícita do admin.
  A loja não pode cadastrar outro domínio enquanto houver remoção pendente. A AROMA (id protegido) recusa desconexão automática.
- Observação sanitizada da Cloudflare (status, método SSL, erros redigidos) em `merchant_domains.external_observation`.
- Contagem de Custom Hostnames antes e depois da ativação: 1 (AROMA, ativo).

## Hostnames internos protegidos

Sufixos reservados (iguais no banco, nas funções do backend e no Worker):
`shopdrive.com.br` (inclui www, domains, saas-origin e qualquer subdomínio), `virtualmercado.com.br`, `lovable.app`
(publicado e preview), `lovable.dev`, `lovableproject.com`, `supabase.co`/`supabase.in`/`supabase.com` (backend, auth,
storage, funções). Nenhum deles pode virar domínio de lojista, ser criado na Cloudflare ou ser reescrito pelo Worker.

## Worker global (`cloudflare/workers/shopdrive-custom-domain-router.js`)

Estado informado pelo admin em 2026-11-13: o Worker `shopdrive-custom-domain-router` já existe, ligado só à rota
`www.redearoma.com.br/*`, com o código piloto (hostname fixo da AROMA, deployment anterior `a241104b`).

O arquivo do repositório é JavaScript puro (colar direto no editor do painel). Comportamento:

- Hostname = `new URL(request.url).hostname`, normalizado (minúsculas, sem ponto final, nome DNS válido); IP/inválido → 400.
- Hosts internos (lista acima) → `fetch(request)` sem alteração, sem consulta de loja.
- `*.workers.dev` → 421.
- Métodos: GET, HEAD, POST, PUT, PATCH, DELETE, OPTIONS (iguais ao piloto); outros → 405 com `Allow`.
- Demais hosts: consulta `resolve_public_store_by_domain` (mesma regra usada pela loja no navegador, chave pública
  publicável, sem segredo). Exatamente uma loja → permitido; zero/ambíguo → 421; backend indisponível → 503, exceto
  host confirmado ativo há menos de 5 min. Decisões ficam em memória 60 s (permitido) / 30 s (negado).
- Proxy só para `https://shopdrive.com.br`, mantendo caminho, query, método e corpo; repassa só cabeçalhos da lista
  (nunca cookie/Authorization/x-forwarded-* do visitante) e define `x-forwarded-host` com o hostname validado.
- Resposta: remove `Set-Cookie`; redirect absoluto para `shopdrive.com.br`/`www.shopdrive.com.br` vira o hostname atual
  (https); redirects relativos e externos ficam iguais.
- Logs: só hostname, status, duração e código técnico.

## Passo manual 1 (admin) — publicar o código global no MESMO Worker

1. Workers & Pages → `shopdrive-custom-domain-router` → Deployments: anotar o deployment ativo (`a241104b`).
2. Edit code → apagar todo o conteúdo → colar o arquivo `.js` → Deploy. Não mexer em rotas, DNS, fallback origin nem
   Custom Hostnames.
3. Avisar o agente para validar a AROMA (home, categoria, produto, carrinho, checkout até antes de gravar). Rollback:
   Deployments → deployment `a241104b` → Rollback.

## Passo manual 2 (admin) — rotas, somente após o passo 1 validado

Alvo CNAME oficial dos lojistas: `domains.shopdrive.com.br` (`CUSTOM_HOSTNAME_TARGET`). Fallback origin:
`saas-origin.shopdrive.com.br`. Upstream do Worker: `https://shopdrive.com.br` (DNS sem proxy → hospedagem do app).

Sem reentrada: (1) `shopdrive.com.br`/`www` são DNS-only, então nenhuma rota da zona roda para eles; (2) a Cloudflare
documenta que subrequisições `fetch()` para a mesma zona vão direto à origem e nunca reexecutam Workers de rota;
(3) o caminho é atribuído a uma URL já fixa no upstream (nunca `new URL(path, origin)`), então `//outro.host` não troca
o destino.

Ordem (anotar/printar Workers Routes antes; não remover nada existente):

| Padrão | Worker | Finalidade |
| --- | --- | --- |
| `www.redearoma.com.br/*` | shopdrive-custom-domain-router | já existe; manter |
| `shopdrive.com.br/*` | Nenhum | defesa caso o proxy seja ligado no futuro |
| `www.shopdrive.com.br/*` | Nenhum | idem |
| `*/*` | shopdrive-custom-domain-router | todos os domínios de lojistas (com ou sem proxy Cloudflare do cliente) |

Não criar `*.shopdrive.com.br/*`, `domains.shopdrive.com.br/*` nem `saas-origin.shopdrive.com.br/*` como Nenhum: com
proxy laranja do cliente a Cloudflare casa a rota pelo alvo CNAME e essa exclusão tiraria a loja do Worker (522).
Backend/login/pagamentos ficam em outras zonas (supabase.co, lovable.app, Mercado Pago) e não precisam de rota.

Validar depois: `https://shopdrive.com.br`, `https://www.shopdrive.com.br`, `/login`, painel, uma loja padrão
(`https://shopdrive.com.br/<slug>`), checkout abrindo, `https://www.redearoma.com.br` e ausência de loop. Avisar o
agente para conferir (GET + HTTP) e só então marcar `ingress_ready=true`.

Custo: Workers cobra por requisição (plano Free 100 mil/dia; acima disso plano pago).

## Rollback

1. Remover somente a rota `*/*` (a rota/regra da AROMA continua).
2. `UPDATE custom_domain_platform_config SET feature_enabled=false, ingress_ready=false, cloudflare_writes_enabled=false, cloudflare_deletes_enabled=false WHERE id;`
   (a AROMA segue pela linha piloto; lojas genéricas deixam de resolver na hora).
3. Não apagar Custom Hostnames, registros de lojas nem histórico.
