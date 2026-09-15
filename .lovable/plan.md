# Conteúdo estruturado no Banner Principal

## Objetivo
Adicionar título, subtítulo e CTA opcionais sobre cada slide do Banner Principal, mantendo intactos os banners atuais, os limites de 4 imagens desktop e 3 mobile e os três layouts da loja.

## Implementação
1. **Dados por slide**
   - Adicionar ao perfil da loja um único campo JSON de metadados do Banner Principal, sem preencher registros existentes.
   - Vincular o conteúdo aos slides pelo índice já compartilhado entre Desktop e Mobile.
   - Validar no banco e na aplicação: posição `left|center|right`, textos nos limites definidos, cores HEX de 6 dígitos e URL apenas relativa, `http:` ou `https:`.
   - Expor somente esse campo adicional na leitura pública da loja, mantendo o isolamento e as regras atuais do perfil.

2. **Renderer reutilizável**
   - Criar um componente único de slide para imagem + conteúdo estruturado, usado na loja e na pré-visualização administrativa.
   - Renderizar a camada somente quando houver título, subtítulo ou CTA com destino válido; banner sem metadados continuará somente imagem, sem gradiente ou espaço adicional.
   - Manter proporções atuais, carregamento de imagens, transição e bolinhas do carrossel.
   - Aplicar alinhamento seguro, escala responsiva, proteção localizada de legibilidade e contraste automático preto/branco no texto do CTA.
   - Usar navegação interna da loja para caminhos relativos e abertura segura para links externos.

3. **Edição no painel**
   - Em cada slot desktop, adicionar uma área recolhível “Conteúdo do banner (opcional)” com título, subtítulo, CTA, destino, posição e seletores de cor.
   - Mostrar limites de caracteres, mensagem quando CTA não tiver destino válido e prévia com o mesmo renderer da loja.
   - Os slots Mobile continuarão editando somente a imagem e compartilharão o conteúdo do mesmo índice desktop.
   - Ao remover um slide, remover também os metadados daquele índice para impedir desalinhamento; substituir imagem não altera textos.

4. **Compatibilidade com templates**
   - Incluir os metadados no fluxo existente de sincronização e clonagem de templates para preservar os layouts Clássico, Conversão e Marca & Conteúdo.

5. **Validação**
   - Cobrir utilitários de URL, cor, contraste e normalização com testes automatizados.
   - Verificar os 27 cenários solicitados, incluindo quatro slides, rotação, mobile, segurança, remoção de conteúdo, multitenancy, prévia e os três layouts.
   - Conferir a loja pública em larguras desktop e mobile e validar que banners antigos permanecem visualmente iguais.

## Detalhes técnicos
- Estrutura prevista: array JSON opcional em `profiles`, com um objeto normalizado por índice; imagens permanecem nos arrays atuais.
- React continuará escapando título, subtítulo e CTA; não será usado HTML do usuário.
- Nenhuma biblioteca pesada, IA, cobrança ou outro módulo será alterado.
