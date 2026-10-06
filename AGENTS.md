- Plan codes: free|pro|premium|marca; MARCA = Premium + brand capabilities (`PLAN_LIMITS`, `get_effective_store_plan`); sale gated by `is_plan_marca_enabled()` (fail-safe false). Why: MARCA never resolves to Free.
- Lojas próprias MARCA só em `brand_account_owned_stores` (slot 1 primary, 2 secondary); herança via `get_brand_inherited_plan`. Why: uma assinatura financia 2 lojas sem autoridade de rede à secondary.
- Front MARCA (Minha Rede, checkout `plano=marca`) só lê RPCs `get_my_*`; nunca envia valor nem decide estado. Why: backend é a autoridade.
- Resolver de plano ignora `past_due` com tolerância vencida. Why: assinatura antiga esquecida mantinha plano pago.
- Estoque (simples e variação) reservado só no servidor via `reserve_order_item_stock` na criação do pedido; devolvido uma vez em cancelamento/exclusão; Entregue não move estoque. Why: baixa no navegador não era atômica.
- Regras detalhadas de backend em `supabase/AGENTS.md`.
- Catálogo PDF clássico: texto, links públicos e imagens passam por `src/lib/catalogPdfClassic.ts` (compartilhado por prévia e PDF). Why: evita divergência e vazamento do host de preview nos PDFs.

- Catálogo PDF 2.0 vive isolado em `src/lib/catalog-v2/` (loader → normalizer → CatalogDocument → `composePages` → renderer jsPDF → preview pdf.js dos mesmos bytes); `CatalogPDF.tsx` só monta `src/components/catalog/editorial/` (estado e handlers próprios, sem publicar/compartilhar). Why: paginação única e preview fiel, sem regressão do Clássico.
- Editorial: acesso decidido no servidor por `get_my_catalog_editorial_access` (flag `ENABLE_CATALOG_EDITORIAL_V2` + liberação por loja em `catalog_editorial_access`, só via `admin_set_store_catalog_editorial`); publicação só por `begin_editorial_catalog_publication` → upload em caminho do servidor → `publish_editorial_catalog` (idempotente, recusa se o catálogo atual mudou), histórico em `catalog_publications`. Why: rollout por loja fail-closed e nenhuma substituição acidental do link público.
