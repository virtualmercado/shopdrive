# Fase 2 — infraestrutura Asaas BaaS em Sandbox

## Escopo

Implementar somente a infraestrutura server-side autorizada no documento, usando secrets diretos do backend e sem vincular o conector recusado. Não haverá alterações de frontend, checkout, pedidos, gateways, tabelas da Fase 1 ou registros nessas tabelas.

## Implementação

1. Criar `supabase/functions/_shared/asaasClient.ts`:
   - resolver explícito e fail-closed para `sandbox` e `production`;
   - permitir chamadas somente em Sandbox nesta fase, sem fallback;
   - URLs fixas oficiais, sem aceitar URL arbitrária;
   - API Key pai Sandbox ou credencial de subconta somente no servidor;
   - headers oficiais, timeout, parser seguro, erros classificados e redaction;
   - suporte a idempotência futura, sem retry automático de POST.

2. Criar `supabase/functions/_shared/asaasCrypto.ts`:
   - AES-256-GCM via WebCrypto, nonce aleatório de 96 bits e tag de 128 bits;
   - payload versionado `v1.<iv>.<ciphertext>.<authTag>` em Base64URL;
   - fingerprint SHA-256, sem fragmentos da credencial;
   - token de Webhook com 32 bytes aleatórios, persistência apenas como SHA-256;
   - comparação de tokens por hashes e diferença acumulada de bytes, sem comparação direta dos valores brutos.

3. Criar a função administrativa isolada `asaas-sandbox-diagnostic`:
   - JWT válido e `has_role(..., 'admin')` obrigatórios, com falha fechada;
   - acesso negado a anônimo, lojista, cliente e delegado sem papel admin;
   - uma única chamada externa `GET https://api-sandbox.asaas.com/v3/myAccount/status`;
   - resposta sanitizada contendo somente sucesso, ambiente e autenticação;
   - logs mínimos `[ASAAS_DIAGNOSTIC_STARTED]`, `[ASAAS_DIAGNOSTIC_SUCCESS]` e `[ASAAS_DIAGNOSTIC_FAILED]`;
   - nenhuma inserção no banco e nenhuma escrita no Asaas.

4. Preparar secrets sem expor valores:
   - gerar `ASAAS_SUBACCOUNT_ENCRYPTION_KEY` diretamente no cofre com material aleatório forte;
   - solicitar `ASAAS_SANDBOX_API_KEY` somente pela interface segura, depois de implantar a função;
   - não criar nem solicitar `ASAAS_PRODUCTION_API_KEY`.

5. Adicionar testes Deno junto à função:
   - criptografia, integridade, chave incorreta, payload inválido e ausência de secrets em erros;
   - resolução/bloqueio de ambientes e prevenção de mistura Sandbox/Produção;
   - redaction de API Key, Authorization e token de Webhook;
   - timeout, resposta inválida, classificação HTTP e ausência de retry em POST;
   - autorização admin e confirmação de que o diagnóstico executa somente GET Sandbox.

6. Implantar somente `asaas-sandbox-diagnostic` para o teste técnico. Após o secret Sandbox ser configurado, executar uma única chamada real somente leitura e conferir que as quatro tabelas da Fase 1 continuam vazias e inalteradas.

## Limites

Não criar subconta, cliente, cobrança, boleto, Split ou Webhook no Asaas. Não chamar Produção. Não publicar frontend. Não iniciar a Fase 3.
