import { jsPDF } from "jspdf";
import { type CatalogImage } from "@/lib/catalogPdfClassic";
import type { CatalogDocument, CatalogImageRef } from "../types";
import { EditorialCanvas, type DrawnRect } from "./canvas";
import { composePages, type ComposeOptions, type PagePlan } from "./composer";
import type { RenderContext } from "./context";
import { renderBackCover } from "./renderBackCover";
import { renderCover } from "./renderCover";
import { renderProductsPage } from "./renderProducts";
import { renderSeparator } from "./renderSeparator";
import { renderInstitutional } from "./renderInstitutional";
import { renderCommercial } from "./renderCommercial";
import { renderFeaturedPage } from "./renderProducts";
import { blockingIssues, EditorialConfigError, normalizeEditorialConfig, type EditorialConfigInput, type EditorialIssue } from "./editorialConfig";
import { buildEditorialTheme, EDITORIAL_TEMPLATE_ID, EDITORIAL_TEMPLATE_VERSION } from "./theme";

/** Resolve uma imagem já reduzida; deve aplicar cache e timeout (ver createCatalogImageLoader). */
export type ImageResolver = (url: string, maxEdgePx: number, preserveTransparency: boolean) => Promise<CatalogImage | null>;

export interface EditorialOptions extends Omit<ComposeOptions, "editorial" | "wrapLines"> {
  resolveImage: ImageResolver;
  title?: string;
  subtitle?: string | null;
  /** Fase 4: configurações editoriais opcionais (dado não confiável, sempre normalizado). */
  editorial?: EditorialConfigInput;
  /** Andamento real: chamado antes de cada página (1-based) com o total do plano. */
  onProgress?: (page: number, total: number) => void;
}

export interface EditorialResult {
  bytes: ArrayBuffer;
  plan: PagePlan[];
  pageCount: number;
  rects: DrawnRect[];
  links: EditorialCanvas["links"];
  templateId: typeof EDITORIAL_TEMPLATE_ID;
  templateVersion: typeof EDITORIAL_TEMPLATE_VERSION;
  /** Avisos não bloqueantes (ex.: imagem não autorizada substituída pelo padrão). */
  issues: EditorialIssue[];
}

/** PDF digital: ~150 ppp no tamanho de uso (Clássico mantém o próprio orçamento). */
const editorialEdgePx = (mm: number): number => Math.max(160, Math.min(1400, Math.round(mm * 6)));

const imageEdge = (plan: PagePlan): number => {
  if (plan.kind === "cover") return editorialEdgePx(297);
  if (plan.kind === "separator") return editorialEdgePx(170);
  if (plan.kind === "products") return editorialEdgePx(({ 1: 170, 2: 110, 3: 80, 4: 80 } as const)[plan.layout]);
  if (plan.kind === "featured") return editorialEdgePx(170);
  if (plan.kind === "institutional") return editorialEdgePx(210);
  return 0;
};

const pageImageRefs = (plan: PagePlan, ctx: Pick<RenderContext, "product">): (CatalogImageRef | null)[] => {
  if (plan.kind === "cover") return [plan.heroImage];
  if (plan.kind === "separator") return [plan.image];
  if (plan.kind === "products") return plan.productIds.map((id) => ctx.product(id).primaryImage);
  if (plan.kind === "featured") return [ctx.product(plan.productId).primaryImage];
  if (plan.kind === "institutional") return [plan.image];
  return [];
};

/**
 * CatalogDocument → plano de páginas (único) → jsPDF → bytes.
 * As imagens são resolvidas página a página, então só as da página atual
 * ficam em memória decodificada; o jsPDF reaproveita imagens repetidas pelo alias.
 */
export async function generateEditorialPdf(doc: CatalogDocument, opts: EditorialOptions): Promise<EditorialResult> {
  const { config, issues } = normalizeEditorialConfig(doc, opts.editorial);
  const blocking = blockingIssues(issues);
  if (blocking.length) throw new EditorialConfigError(blocking);
  const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait", compress: true });
  const theme = buildEditorialTheme(doc.identity);
  // Paginação institucional usa a MESMA medição do renderer (jsPDF + fonte do tema).
  const wrapLines = (text: string, width: number, size: number) => { pdf.setFont(theme.font, "normal"); pdf.setFontSize(size); return pdf.splitTextToSize(text, width) as string[]; };
  const plan = composePages(doc, { ...opts, editorial: opts.editorial ? config : undefined, wrapLines });
  const title = config.cover.title ?? opts.title ?? "Catálogo de produtos";
  const subtitle = config.cover.subtitle ?? (config.cover.title ? null : opts.subtitle ?? null);
  pdf.setProperties({ title: `${config.cover.title ?? opts.title ?? "Catálogo"} — ${doc.identity.storeName}`, creator: `ShopDrive ${EDITORIAL_TEMPLATE_ID} ${EDITORIAL_TEMPLATE_VERSION}` });
  const cv = new EditorialCanvas(pdf, theme);

  const products = new Map(doc.products.map((p) => [p.id, p]));
  const cats = new Map(doc.categories.map((c) => [c.id, c.name]));
  const brands = new Map(doc.brands.map((b) => [b.id, b.name]));
  const logo = doc.identity.logoUrl ? await opts.resolveImage(doc.identity.logoUrl, editorialEdgePx(48), true) : null;

  let current = new Map<string, CatalogImage | null>();
  const ctx: RenderContext = {
    doc,
    theme,
    title,
    subtitle,
    showPrices: doc.presentation.showPrices,
    product: (id) => {
      const p = products.get(id);
      if (!p) throw new Error(`Produto ${id} não pertence ao documento`);
      return p;
    },
    categoryName: (id) => (id ? cats.get(id) ?? null : null),
    brandName: (id) => (id ? brands.get(id) ?? null : null),
    image: (ref) => (ref ? current.get(ref.url) ?? null : null),
    logo,
    totalPages: plan.length,
    coverOptions: { showLogo: config.cover.showLogo, showMeta: config.cover.showMeta, showYear: config.cover.showYear, showCount: config.cover.showCount },
  };

  for (let i = 0; i < plan.length; i++) {
    const page = plan[i];
    opts.onProgress?.(i + 1, plan.length);
    if (i > 0) cv.newPage();
    const edge = imageEdge(page);
    const refs = pageImageRefs(page, ctx).filter((r): r is CatalogImageRef => !!r);
    const load = (rs: CatalogImageRef[]) => Promise.all(rs.map(async (r) => [r.url, await opts.resolveImage(r.url, edge, false).catch(() => null)] as const));
    current = new Map(await load(refs));
    // Foto principal inválida: tenta só a primeira imagem adicional do próprio produto.
    if (page.kind === "products" || page.kind === "featured") {
      const ids = page.kind === "products" ? page.productIds : [page.productId];
      const fallbacks = ids.map(ctx.product)
        .filter((p) => !(p.primaryImage && current.get(p.primaryImage.url)) && p.additionalImages[0])
        .map((p) => p.additionalImages[0]);
      (await load(fallbacks)).forEach(([u, img]) => current.set(u, img));
    }
    if (page.kind === "cover") renderCover(cv, ctx, page);
    else if (page.kind === "separator") renderSeparator(cv, ctx, page);
    else if (page.kind === "products") renderProductsPage(cv, ctx, page);
    else if (page.kind === "featured") renderFeaturedPage(cv, ctx, page);
    else if (page.kind === "institutional") renderInstitutional(cv, ctx, page);
    else if (page.kind === "commercial") renderCommercial(cv, ctx, page);
    else renderBackCover(cv, ctx);
  }

  return {
    bytes: pdf.output("arraybuffer"),
    plan,
    pageCount: pdf.getNumberOfPages(),
    rects: cv.rects,
    links: cv.links,
    templateId: EDITORIAL_TEMPLATE_ID,
    templateVersion: EDITORIAL_TEMPLATE_VERSION,
    issues,
  };
}
