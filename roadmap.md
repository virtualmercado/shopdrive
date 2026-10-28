# Roadmap

## Piloto AROMA — correção mínima do callback Auth
- [x] Releitura do Auth de produção: Site URL legado preservado, 12 URLs existentes e callback www/conta ausente; nenhuma alteração de configuração executada.
- [ ] Auditar os retornos reais de cadastro/recuperação e fontes dos links nos templates, sem envio de e-mail.
- [ ] BLOQUEADO: adicionar somente https://www.redearoma.com.br/conta preservando Site URL e todos os retornos existentes — alteração de Redirect URLs disponível apenas ao usuário em More → Users → Auth settings → Advanced.
- [ ] BLOQUEADO: confirmar pela configuração hospedada que o destino exato passou a ser autorizado, após adição pelo usuário; nenhum cadastro/recuperação/login ou publicação nesta etapa.

## Piloto AROMA — autenticação e área do cliente sem cobrança
- [x] Sessão nova abriu home, /auth e formulário de cadastro no www sem slug e sem erros JavaScript; leitura da configuração de autenticação de produção confirmou www.redearoma.com.br ausente da lista de retornos autorizados; execução interrompida antes de login/cadastro/recuperação.
- [ ] BLOQUEADO: cadastro/recuperação solicitam https://www.redearoma.com.br/conta, mas o hostname não está autorizado; endereço padrão atual https://virtualmercado.lovable.app. Nenhuma correção executada.
- [ ] BLOQUEADO: login real, Minha Conta, endereços, favoritos, pedidos/detalhe, refresh, logout/novo login e isolamento autenticado aguardam solução expressamente autorizada do callback e conta de cliente controlada; nenhuma credencial controlada disponível. Endereço original não retestado nesta etapa após a interrupção.
- [x] Estado final preservado: piloto ativo, feature_enabled=false, ingress_ready=false, 131 pedidos e três clientes registrados AROMA; #001222 mantido. Nenhum pagamento/e-mail/cadastro, mudança de aplicação/infraestrutura ou publicação; relatório entregue.

## Piloto AROMA — um pedido guest sem cobrança
- [x] Conferir fluxo WhatsApp existente sem cobrança e linha de base; nenhuma mudança na aplicação ou infraestrutura.
- [x] Criado somente #001222 (0ada9acd-3633-487f-a9bc-2287591b7d31) às 03:02:47 UTC, guest TESTE, 2 Açaí × R$ 3,46, retirada grátis, aguardando_combinar; pedido e reserva de estoque preservados.
- [x] Pedido/cliente persistidos e visíveis em painéis autenticados AROMA; itens/frete/isolamento conferidos no banco, confirmação e refresh com snapshot real passaram no www, flags false/acesso exclusivo preservados, nenhum pagamento criado; relatório entregue sem correções/publicação.
- [ ] BLOQUEADO: comprovar recebimento no WhatsApp do pedido #001222 já existente — fluxo abre mensagem para envio manual, não envia automaticamente; nenhuma evidência de recebimento disponível. Não criar novo pedido.

## Piloto AROMA — reativação e reteste final autorizados
- [x] Pré-condições reais rechecadas; somente registro piloto reativado às 2026-10-28 02:46:19.465091 UTC, status/v2_state active, is_active=true, acesso www exato e travas globais false preservados.
- [x] Sessão nova no www: 11 verificações passaram, incluindo Açaí obrigatório, mini-carrinho com um item isolado, checkout/refresh, categoria/refresh, busca/refresh e retorno interno; nenhum erro JavaScript ou transação.
- [x] Resolvedor anônimo real aceitou somente UUID/slug AROMA no www e rejeitou sete hostnames; raiz e loja não resolvem publicamente. Endereço original passou dez verificações, perfis e nove outros domínios idênticos à linha de base, config/acesso/evidências preservados. Piloto mantido ativo; nenhuma publicação ou alteração externa.

## Piloto AROMA — ativação final exclusiva
- [x] Reconfirmar condições e Cloudflare em GET; ativar somente o registro AROMA às 2026-10-28 02:37:58.613403 UTC com travas globais false.
- [x] Resolvedor retornou UUID/slug exatos só para www, oito hostnames diferentes vazios; home/produto/refresh no piloto passaram. Validação parou no carrinho por opção de aroma obrigatória não selecionada no teste, sem defeito da loja demonstrado.
- [x] Reverter imediatamente apenas ativação às 02:39:58.443456 UTC; estado dns_verified/is_active=false/activated_at=NULL, reserva e evidências preservadas, demais domínios/config/acessos inalterados, resolvedor público vazio e nenhum pedido/cobrança/publicação/alteração externa.
- [x] Validar endereço ShopDrive original com Açaí selecionado: home, produto/refresh, carrinho, checkout/refresh, categoria/refresh e busca/refresh passaram sem erros ou transações.
- [x] Nova ativação e repetição integral com seleção Açaí autorizadas em 28/10/2026; execução no reteste final acima.

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
