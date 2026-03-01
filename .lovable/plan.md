

# Atualizar assinatura de `setProductImagesOrder` para objeto de parametros

## Resumo

Alterar a assinatura da funcao `setProductImagesOrder` de parametros posicionais para um objeto `{ productId, orderedIds }`, e atualizar o caller no componente.

## Alteracoes

### 1. `src/lib/productGallery.ts` (linhas 94-103)

Substituir a assinatura atual:
```typescript
export async function setProductImagesOrder(
  productId: string,
  orderedIds: string[]
): Promise<void> {
```

Por:
```typescript
export async function setProductImagesOrder(params: {
  productId: string;
  orderedIds: string[];
}): Promise<void> {
  const { productId, orderedIds } = params;
```

O corpo da funcao (chamada ao RPC) permanece identico. Manter o import de `@/integrations/supabase/client` (nao `@/lib/supabase`).

### 2. `src/components/ProductGalleryUploader.tsx` (linhas 109-112)

Atualizar a chamada de:
```typescript
await setProductImagesOrder(
  productId,
  reordered.map((img) => img.id)
);
```

Para:
```typescript
await setProductImagesOrder({
  productId,
  orderedIds: reordered.map((img) => img.id),
});
```

