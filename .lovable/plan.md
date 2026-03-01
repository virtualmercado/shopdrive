

# Edge Function `media-presign`

## Resumo

Criar uma Edge Function que gera URLs pre-assinadas (presigned PUT) para upload direto ao MinIO S3, sem salvar nada no banco.

## O que sera criado

### 1. Arquivo `supabase/functions/media-presign/index.ts`

Edge Function POST que:
- Recebe `{ product_id, mime_type, size_bytes }`
- Valida mime_type (jpeg/png/webp) e size_bytes (max 10MB)
- Gera objectKey: `products/{product_id}/{yyyy}/{mm}/{uuid}.{ext}`
- Usa AWS SDK v3 (`npm:@aws-sdk/client-s3` + `npm:@aws-sdk/s3-request-presigner`) via specifier npm do Deno
- Gera presigned PUT URL com expiracao de 5 minutos
- Retorna `{ ok, uploadUrl, publicUrl, bucket, objectKey, headers }`
- CORS completo com handler OPTIONS

### 2. Configuracao em `supabase/config.toml`

Adicionar entrada `[functions.media-presign]` com `verify_jwt = false`.

### 3. Secrets necessarios

Solicitar ao usuario que configure os seguintes secrets:
- `MINIO_ENDPOINT` (https://s3storage.shopdrive.com.br)
- `MINIO_REGION` (eu-south)
- `MINIO_ACCESS_KEY` (credencial de acesso)
- `MINIO_SECRET_KEY` (chave secreta)
- `MINIO_BUCKET_PUBLIC` (media-public)
- `PUBLIC_MEDIA_BASE_URL` (https://s3storage.shopdrive.com.br)

### Detalhes tecnicos

**Validacoes (retorna 400):**
- `product_id` obrigatorio
- `mime_type` deve ser `image/jpeg`, `image/png` ou `image/webp`
- `size_bytes` deve ser <= 10.485.760 (10MB)

**ObjectKey:**
```text
products/{product_id}/2026/03/{crypto.randomUUID()}.jpeg
```

**Resposta sucesso (200):**
```json
{
  "ok": true,
  "uploadUrl": "<presigned-put-url>",
  "publicUrl": "https://s3storage.shopdrive.com.br/media-public/products/...",
  "bucket": "media-public",
  "objectKey": "products/...",
  "headers": { "Content-Type": "image/jpeg" }
}
```

**Resposta erro (400/500):**
```json
{ "ok": false, "error": "descricao do erro" }
```

**Dependencias:** AWS SDK v3 importado via `npm:` specifier nativo do Deno (sem necessidade de esm.sh).

### Como chamar do frontend

```typescript
const { data, error } = await supabase.functions.invoke("media-presign", {
  body: {
    product_id: "uuid-do-produto",
    mime_type: "image/jpeg",
    size_bytes: 500000
  }
});
// data.uploadUrl -> usar com fetch PUT para enviar o arquivo
```

