# Roadmap

## Piloto AROMA — routing/SSL reais sem ativação
- [x] Cloudflare em GET confirmou um único www.redearoma.com.br, ID fd3cd405-657e-4da7-a2ce-6424dc865670, hostname active e SSL active com certificados emitidos.
- [x] HTTPS real 200 manteve www, carregou ShopDrive e exibiu domínio indisponível sem selecionar tenant; registradas somente evidências de routing/SSL/ID/provedor e last_ssl_check às 2026-10-28 02:33:33.242718 UTC.
- [x] Após persistência: v2_state=dns_verified, is_active=false, activated_at=NULL, travas false, zero V2 ativos; resolvedor anônimo vazio para www/raiz/loja e navegador sem erros/redirecionamento; nenhuma alteração externa ou publicação.

## Piloto AROMA — verificação real sem ativação
- [x] Executar o mecanismo V2 real: TXT existente confirmado e CNAME exclusivo www → domains.shopdrive.com.br confirmado; raiz not_required.
- [x] Conferir persistência às 2026-10-27 22:06:42.548 UTC: propriedade/DNS verificados, v2_state=dns_verified, routing not_started, SSL pending, is_active=false, activated_at=NULL, travas false e resolvedor anônimo vazio para www/raiz/loja; nenhuma ativação ou publicação.

## Piloto V2 — mecanismo estrutural sem ativação
- [x] Adicionar autorização administrativa exata store+hostname em custom_domain_v2_access, preservando RPC e unicidade canônica.
- [x] Endurecer resolvedor único com acesso individual, estados completos, revogação e exceção exata sem habilitação global.
- [x] Preparar verificação DNS somente do hostname piloto autorizado, preservando TXT ShopDrive e fluxo normal raiz+www; persistência transacional e escopo preservado.
- [x] Executar 428 testes unitários, 62 regras SQL, revogação concorrente e 18 regressões no navegador; painéis conectados e flags false/zero ativações confirmados, rollback local aprovado e relatório entregue sem publicação.

## Hotfix isolado — hostname da prévia Lovable
- [x] Diagnosticar hostname real pela telemetria do navegador: origem interna deste projeto em lovableproject.com, diferente do link compartilhável.
- [x] Ajustar somente a classificação central e testes, com padrão oficial estrito e origem interna exata; sem wildcard Lovable.
- [x] Validar com fixtures no hostname observado: 397 testes, 18 regressões e 7 verificações específicas; fail-closed preservado, sem publicação/infraestrutura; relatório entregue.
- [x] Resultado automático separado de typecheck confirmado exit 0 e painéis autenticados verificados no localhost; prévia real no editor já confirmada pelo usuário na validação anterior, sem publicação.

## Hostname runtime — implementação estrutural sem ativação
- [x] Centralizar identidade por hostname com allowlist explícita e resolução fail-closed pela RPC existente.
- [x] Compartilhar páginas, isolamento e URLs internas entre modo plataforma e domínio próprio sem slug.
- [x] Validar rotas, troca de tenant bloqueada, busca, carrinho, produtos e checkout com mocks sem operações reais — 368 testes unitários e 18 verificações de navegador aprovados.
- [x] Entregar relatório, registrar lacunas de revogação/ingress/SEO/telemetria e decidir publicação conservadora — não publicado; pronto para homologação controlada, não para piloto real.

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
