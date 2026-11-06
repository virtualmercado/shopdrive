# Gerenciamento seguro das lojas MARCA

## Situação confirmada

- A conta AROMA possui exatamente duas lojas vinculadas; ambas continuam com 217 produtos ativos.
- A principal recebe MARCA e a Varejo permanece PREMIUM no período já pago, com vínculo secundário MARCA preservado.
- O vínculo atual financia a segunda loja, mas **não concede permissão para administrá-la**. Não existe um cadastro de administradores por loja nem um contexto de loja ativa.
- Produtos, pedidos, clientes, gateway, configurações e domínio ainda usam a identidade de quem está conectado como identidade da loja. Um seletor isolado não seria seguro nem funcional.
- O Financeiro preparado oculta planos e cartão próprio, mas o histórico ainda pode criar uma próxima fatura virtual PREMIUM com botão de pagamento. Esse caminho precisa ser ocultado na loja vinculada, sem alterar faturas reais.

## O que implementar

### 1. Autorização explícita e loja ativa

- Manter a identidade e a sessão reais do usuário; nunca entrar na conta da segunda loja nem substituir o usuário por seu proprietário.
- Criar o vínculo administrativo mínimo para o responsável principal administrar suas próprias lojas MARCA. Concedê-lo por uma operação validada no servidor, separadamente do vínculo de plano.
- Confirmar a permissão e o vínculo vigente em cada acesso; a escolha enviada pelo navegador não concede autorização.
- Disponibilizar operações protegidas para listar as lojas autorizadas e resolver a loja escolhida. Contas sem permissão não podem listar ou acessar a segunda loja, inclusive com URL manipulada.

### 2. Consultas e alterações isoladas

- Separar “usuário conectado” de “loja ativa” nas telas e serviços do painel.
- Adequar a autorização de produtos, pedidos, clientes, financeiro, gateway, configurações, arquivos e domínio ao contexto de loja validado, preservando as regras para usuários com uma loja.
- Manter permissões Master/admin vinculadas ao usuário real, nunca à loja escolhida.
- Não habilitar a troca enquanto algum desses caminhos ainda usar indevidamente a loja anterior.

### 3. Minha Rede e cabeçalho

- Usar exclusivamente o menu existente Minha Rede; adicionar Minhas Lojas no topo.
- Mostrar nome, endereço público preferencial, status, posição, plano e Acessar painel apenas das lojas administrativamente autorizadas.
- Exibir Trocar loja somente quando houver mais de uma loja autorizada e destacar a atual.
- Ao selecionar: validar no servidor, respeitar salvamentos pendentes do catálogo, cancelar consultas antigas, limpar estados e caches, abrir sempre o Dashboard e recarregar o contexto completo da loja escolhida.
- Dashboard, Produtos, Pedidos e Clientes continuam mostrando uma única loja; métricas consolidadas permanecem exclusivas de Minha Rede e não ganham novas permissões na secundária.
- Principal: `https://www.redearoma.com.br`. Varejo: `https://shopdrive.com.br/aromanaturaldaamazoniavarejo`. Seu Link acompanha a loja ativa, sem herança de domínio.

### 4. Financeiro e cancelamento

- Preservar o aviso “Esta loja está vinculada ao Plano MARCA da empresa.” e o histórico PREMIUM.
- Ocultar contratação própria, renovação, cartão recorrente e próxima fatura virtual da secundária, sem modificar registros financeiros nem períodos pagos.
- Testar a função administrativa de cancelamento com autenticação, role Master/admin validada no servidor, recusa de lojista comum e proprietário sem role, repetição sem novo cancelamento e ausência de tokens em logs/respostas. Não executar cancelamento real.

## Validação necessária

- Usar identidades e dados fictícios, com todas as escritas e cobranças reais bloqueadas.
- Testar a autorização no servidor: duas lojas permitidas, segunda loja negada a usuário sem acesso, seleção manipulada, revogação e preservação das permissões Master/admin.
- Testar no navegador o painel real: alternância nas duas direções, retorno ao Dashboard, ausência de produtos/pedidos/clientes anteriores, Seu Link correto e Financeiro secundário somente com histórico.
- Testar que contas Grátis/PRO/PREMIUM com uma loja não recebem alterações visuais desnecessárias e que MARCA com uma loja não exibe seletor vazio.
- Executar somente testes do delta; acompanhar a compilação automática. Confirmar em leitura que os 217 produtos e o vínculo de duas lojas permanecem intactos.

## Limites

Nenhuma cobrança, publicação automática, mudança de Cloudflare ou domínio global, alteração de entitlement, produtos, clientes, pedidos, faturas reconciliadas ou assinaturas existentes. O seletor não será disponibilizado como uma troca apenas visual.

## Detalhes técnicos

- Mudança aditiva de autorização: membership separado dos slots MARCA, com GRANTs explícitos, RLS e operações `get_my_*`; nenhuma alteração em tabelas gerenciadas de autenticação.
- Contexto de tenant validado contra usuário autenticado, membership e vínculo atual; UUID escolhido no cliente nunca é fonte de autoridade.
- Refatoração coordenada dos consumidores do painel, RPCs, políticas, arquivos e funções que hoje pressupõem `auth.uid() = store_owner_id`; identidade usada em auditoria e roles permanece a real.
- Remontagem do painel por loja e proteção contra respostas atrasadas, preservando os mecanismos existentes de identidade e salvamento do catálogo.
- Reutilização do resolvedor de endereço preferencial e do plano existente, sem alterar provisionamento ou resolução pública de domínios.