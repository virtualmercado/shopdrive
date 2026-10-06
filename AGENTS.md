- Plan codes: free|pro|premium|marca; MARCA = Premium + brand capabilities (`PLAN_LIMITS`, `get_effective_store_plan`); sale gated by `is_plan_marca_enabled()` (fail-safe false). Why: MARCA never resolves to Free.
- Lojas próprias MARCA só em `brand_account_owned_stores` (slot 1 primary, 2 secondary); herança via `get_brand_inherited_plan`. Why: uma assinatura financia 2 lojas sem autoridade de rede à secondary.
- Front MARCA (Minha Rede, checkout `plano=marca`) só lê RPCs `get_my_*`; nunca envia valor nem decide estado. Why: backend é a autoridade.
- Resolver de plano ignora `past_due` com tolerância vencida. Why: assinatura antiga esquecida mantinha plano pago.
- Estoque (simples e variação) reservado só no servidor via `reserve_order_item_stock` na criação do pedido; devolvido uma vez em cancelamento/exclusão; Entregue não move estoque. Why: baixa no navegador não era atômica.
- Regras detalhadas de backend em `supabase/AGENTS.md`.
- Catálogo PDF clássico: texto, links públicos e imagens passam por `src/lib/catalogPdfClassic.ts` (compartilhado por prévia e PDF). Why: evita divergência e vazamento do host de preview nos PDFs.

- Catálogo PDF 2.0 vive isolado em `src/lib/catalog-v2/` (loader → normalizer → CatalogDocument serializável), sem importar nem ser importado por `CatalogPDF.tsx`. Why: evolução sem regressão do Clássico e removível apagando a pasta.
