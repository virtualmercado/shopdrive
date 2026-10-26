# Roadmap

## Auditoria pré-piloto do roteamento por domínio — somente leitura
- [x] Auditar resolução instalada por hostname, rotas/links, métodos HTTP e isolamento sem alterar aplicação ou dados.
- [x] Conferir versão publicada, assets/SPA e domínio fictício no navegador, bloqueando toda gravação e preservando V2 desligado.
- [x] Entregar relatório de 11 itens: NÃO PRONTO — integração de hostname/rotas e autorização necessárias antes do piloto; POST de telemetria documentado.

## Diagnóstico Cloudflare somente leitura
- [x] Criar diagnóstico administrativo autenticado, limitado a GET e sem exposição de secrets.
- [x] Validar bloqueio anônimo/inválido na função instalada, não-admin em teste controlado, leitura administrativa real da API (HTTP 200, zero hostnames) e V2 desligado sem alteração de lojas.
- [x] Entregar relatório sanitizado; 65 testes, build e typecheck aprovados; não avançar para hostname piloto.

## Persistência segura do Catálogo Editorial
- [x] Auditar configurações, prévia, publicação, produtos e isolamento existentes antes de alterar código ou banco.
- [x] Implementar rascunho versionado, autosave seguro e última prévia privada sem modificar a versão pública.
- [x] Recuperar configurações/prévia ao retornar e atualizar explicitamente com produtos atuais.
- [x] Validar isolamento, concorrência, erros, persistência, produtos e navegação com fixtures locais desktop/mobile; entregar relatório e procedimento de rollback não destrutivo.
- [ ] BLOQUEADO: homologação autenticada com uma loja autorizada — testes atuais não podem usar credenciais reais nem alterar lojas reais; AROMA/SHARON permanecem intocadas.

## Atalho Primeira página — prévia do catálogo
- [x] Auditar estado one-based e reutilizar a navegação existente.
- [x] Acrescentar somente o atalho acessível antes de Página anterior.
- [x] Validar saltos diretos 49→1 e 74→1, total atualizado 68, página única, zoom e cinco larguras; relatório técnico concluído.

## Atalho Última página — prévia do catálogo
- [x] Auditar navegação, indexação e atualização do total existente.
- [x] Acrescentar somente o atalho acessível e preservar controles e geração.
- [x] Validar 74 páginas, total atualizado, retorno, zoom e telas menores; relatar resultados.

## Gestão segura das campanhas
- [x] Exclusão, arquivamento, restauração e auditoria administrativa no servidor.
- [x] Filtro independente e paginação padrão de 50 registros na interface.
- [x] Testes transacionais e fluxo Master sem envio; relatório final.

## Refinamento visual das imagens de campanhas
- [x] Orientação e aviso informativo por proporção na Etapa 3.
- [x] Limites visuais no renderer compartilhado, sem alterar histórico ou biblioteca.
- [x] Validar regras, desktop/mobile e regressões sem enviar e-mails.

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

## Custom Domains V2 (fundação)
- [x] Remover simulação, flag fail-closed, exclusividade global, TXT, DNS real, tutoriais, Master.
- [ ] BLOQUEADO (externo): provisionamento automático de hostname + SSL + roteamento — hospedagem atual não oferece API.
- [ ] Rotina periódica de revalidação agendada — aguarda infraestrutura (sem domínios V2 ativos).
