

# Usar RPC `reorder_product_images` para reordenar imagens

## Resumo

Substituir o loop sequencial de UPDATEs na funcao `setProductImagesOrder` por uma unica chamada ao RPC `reorder_product_images` que ja existe no banco de dados.

## Alteracao

### `src/lib/productGallery.ts`

Substituir o corpo da funcao `setProductImagesOrder` (linhas 89-101):

**Antes:** Loop sequencial com N chamadas UPDATE individuais.

**Depois:** Uma unica chamada:
```typescript
const { error } = await supabase.rpc("reorder_product_images", {
  p_product_id: productId,
  p_ids: orderedIds,
});
if (error) throw new Error(`Erro ao reordenar imagens: ${error.message}`);
```

Isso reduz N queries para 1, usando a funcao SQL `reorder_product_images` que ja faz o UPDATE em batch via `unnest` + `generate_series`.

