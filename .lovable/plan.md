

# Atualizar `removeProductImage` para deletar arquivo no MinIO

## Resumo

Alterar a funcao `removeProductImage` para tambem chamar a Edge Function `media-delete`, removendo o arquivo fisico do MinIO alem do registro no banco. A chamada ao MinIO sera best-effort (nao quebra o fluxo se falhar).

## Alteracoes

### 1. `src/lib/productGallery.ts`

Substituir a funcao `removeProductImage` (linhas 65-72):

- **Antes:** recebe apenas `imageId: string`
- **Depois:** recebe um objeto `{ imageId: string; publicUrl?: string | null }`
- Remove o registro do banco primeiro (fonte de verdade)
- Se `publicUrl` estiver presente, chama `supabase.functions.invoke("media-delete")` em modo best-effort (erro apenas logado no console, nao lanca excecao)
- Mantém o import existente de `supabase` de `@/integrations/supabase/client` (nao usar `@/lib/supabase` como sugerido pelo usuario, pois o projeto usa o path padrao)

### 2. `src/components/ProductGalleryUploader.tsx`

Atualizar a chamada em `handleRemove` (linha 84):

- **Antes:** `await removeProductImage(imageId)`
- **Depois:** `await removeProductImage({ imageId, publicUrl: images.find(img => img.id === imageId)?.image_url })`

Isso garante que a URL publica correta e passada para a funcao de delecao no MinIO.

