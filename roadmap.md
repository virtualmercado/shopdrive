# Roadmap

## Piloto AROMA — um pagamento real manual com cartão Mercado Pago
- [x] Escopo registrado: somente um pagamento pequeno feito manualmente pelo usuário em https://www.redearoma.com.br; agente somente leitura, sem dados sensíveis, tentativas automáticas, correções ou publicação.
- [ ] Conferir fluxo existente, configuração pública sem secrets e linha de base de pedidos/pagamentos/estoque antes do teste.
- [ ] AGUARDANDO USUÁRIO: realizar a única tentativa manual e informar apenas número do pedido, valor, itens/variações/frete e resultado visível, sem dados do cartão; evidência de confirmação/refresh e painel do lojista deve ser sanitizada.
- [ ] Após conclusão manual, comparar retorno real e persistência, tenant AROMA, unicidade do pedido/pagamento e reserva de estoque, confirmação/refresh/painel e limites da auditoria de dados sensíveis; interromper sem correções em qualquer falha.

## Piloto AROMA — reteste final do Auth
- [x] Leitura efetiva de produção confirma https://www.redearoma.com.br/conta na lista de 13 retornos, com Site URL legado e demais entradas preservados; nenhuma configuração alterada.
- [x] Conferida disponibilidade: nenhum acesso seguro de cliente controlado fornecido/disponível; sem credenciais controladas nas variáveis de teste e nenhum mecanismo documentado. Não usar sessão de lojista nem selecionar cliente real arbitrário.
- [x] Navegador real em sessão nova sem login: /auth AROMA, /conta e pedido existente exigem login no www; query e sessionStorage adulterados mantêm somente UUID AROMA nas respostas observadas; path /lojadalulu/conta retorna página não encontrada. Zero erros JavaScript; gravações/telemetria bloqueadas pelo teste. Isso não comprova isolamento autenticado.
- [ ] BLOQUEADO: login por senha de cliente controlado, Minha Conta autenticada, lista/detalhe próprios, refresh autenticado, logout/novo login e acesso negado a pedidos de outros clientes/lojas — falta identificação e acesso seguro à conta de teste autorizada.
- [x] Segunda leitura efetiva confirma callback exato e Site URL/13 entradas preservados; estado final mantém piloto ativo, travas globais false, 179 pedidos totais/131 AROMA, zero pagamentos e #001222 existente. Nenhum e-mail/pedido/pagamento, alteração de código/configuração/infraestrutura ou publicação.

## Piloto AROMA — reteste controlado do Auth após inclusão manual
- [x] Usuário informou inclusão manual exclusiva de https://www.redearoma.com.br/conta, preservando Site URL e demais retornos; reteste somente leitura, sem aplicação/publicação/e-mails/pedidos/pagamentos.
- [x] Releitura hospedada do Auth em produção nesta etapa ainda apresenta as mesmas 12 URLs e não contém o callback exato www/conta; Site URL legado permanece preservado.
- [x] Callback exato confirmado na configuração efetiva no reteste final de 28/10/2026; nenhuma correção automática.
- [ ] BLOQUEADO: login de cliente controlado, Minha Conta, pedidos/detalhe, refresh, logout/novo login e isolamento autenticado — callback confirmado no reteste final, mas nenhum acesso seguro de cliente controlado disponibilizado; sessão de lojista não comprova login de cliente.
- [ ] BLOQUEADO: compatibilidade de templates de cadastro/recuperação segue não comprovada; não disparar e-mails para testar.

## Piloto AROMA — correção mínima do callback Auth
- [x] Releitura do Auth de produção: Site URL legado preservado, 12 URLs existentes e callback www/conta ausente; nenhuma alteração de configuração executada.
- [x] Cadastro/confirmação usam emailRedirectTo e recuperação usa redirectTo, ambos com window.location.origin + storePath('/conta'); /auth não é solicitado como callback por esses fluxos. Nenhuma mudança na aplicação.
- [ ] BLOQUEADO: conferir os links dos templates Auth efetivos em More → Emails → Auth emails — não há templates/hook locais nem ferramenta disponível de leitura da configuração hospedada dos templates; compatibilidade com RedirectTo/ConfirmationURL não comprovada, nenhuma alteração automática.
- [x] Usuário adicionou somente https://www.redearoma.com.br/conta; confirmação efetiva no reteste final preserva Site URL e demais retornos, sem alteração pelo agente.
- [x] Destino exato confirmado pela configuração hospedada no reteste final; nenhum cadastro/recuperação/e-mail enviado.

## Piloto AROMA — autenticação e área do cliente sem cobrança
- [x] Sessão nova abriu home, /auth e formulário de cadastro no www sem slug e sem erros JavaScript; leitura da configuração de autenticação de produção confirmou www.redearoma.com.br ausente da lista de retornos autorizados; execução interrompida antes de login/cadastro/recuperação.
- [x] Bloqueio do callback resolvido pela inclusão manual do usuário, confirmada na leitura efetiva no reteste final; endereço padrão legado preservado.
- [ ] BLOQUEADO: login real, Minha Conta, endereços, favoritos, pedidos/detalhe, refresh, logout/novo login e isolamento autenticado aguardam conta de cliente controlada com acesso seguro; callback já confirmado no reteste final. Endereço original não retestado nesta etapa.
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
