import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Download, Loader2, RefreshCw, Search, ZoomIn, ZoomOut, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  buildCatalogDocument,
  loadCatalogSource,
  UNBRANDED_KEY,
  UNCATEGORIZED_KEY,
  type CatalogGrouping,
  type CatalogSource,
} from "@/lib/catalog-v2";
import {
  blockingIssues,
  createBrowserImageResolver,
  EDITORIAL_LIMITS,
  EditorialConfigError,
  generateEditorialPdf,
  normalizeEditorialConfig,
  renderPdfPreview,
  sectionImageUrls,
  type EditorialConfigInput,
  type EditorialIssue,
  type FeaturedPolicy,
  type SeparatorMode,
} from "@/lib/catalog-v2/editorial";
import { featuredInDocument, sectionImagesInDocument, toCatalogSelection, type EditorialSelectionMode } from "@/lib/catalog-v2/editorial/uiSelection";

const MAX_LIST = 150;

const Counter = ({ value, limit }: { value: string; limit: number }) => (
  <span className={`text-xs ${value.length > limit ? "text-destructive font-medium" : "text-muted-foreground"}`}>
    {value.length}/{limit}
  </span>
);

const FieldError = ({ msg }: { msg?: string }) => (msg ? <p className="text-xs text-destructive mt-1">{msg}</p> : null);

const issueMessage = (i: EditorialIssue): string => {
  if (i.code === "too_long") return `Texto com ${i.length} caracteres; o limite é ${i.limit}. Reduza o texto para continuar.`;
  if (i.code === "unknown_product") return "Há produto em destaque que não está no catálogo.";
  if (i.code === "unauthorized_image") return "Imagem indisponível; será usada a imagem padrão.";
  if (i.code === "empty") return "Preencha ao menos um campo ou desmarque esta opção.";
  return "Valor inválido.";
};

/** Miniaturas de imagens já autorizadas (pertencentes ao documento). Valor "" = automática. */
const ImagePicker = ({ urls, value, onChange, autoLabel = "Automática" }: { urls: string[]; value: string; onChange: (v: string) => void; autoLabel?: string }) => (
  <div className="flex flex-wrap gap-2">
    <button type="button" onClick={() => onChange("")} aria-pressed={value === ""}
      className={`h-14 px-3 rounded-md border text-xs ${value === "" ? "border-primary ring-2 ring-primary" : "border-border"}`}>{autoLabel}</button>
    {urls.slice(0, 24).map((u) => (
      <button key={u} type="button" onClick={() => onChange(u)} aria-pressed={value === u} aria-label="Selecionar imagem"
        className={`h-14 w-14 rounded-md border overflow-hidden bg-muted ${value === u ? "border-primary ring-2 ring-primary" : "border-border"}`}>
        <img src={u} alt="" loading="lazy" className="h-full w-full object-contain" />
      </button>
    ))}
  </div>
);

const IdChecklist = ({ items, selected, onChange }: { items: { id: string; name: string }[]; selected: string[]; onChange: (ids: string[]) => void }) => (
  <div className="max-h-56 overflow-y-auto space-y-1 rounded-md border border-border p-2">
    {items.length === 0 && <p className="text-xs text-muted-foreground p-2">Nenhum item disponível.</p>}
    {items.map((it) => (
      <label key={it.id} className="flex items-center gap-2 text-sm py-1 cursor-pointer">
        <Checkbox checked={selected.includes(it.id)} onCheckedChange={(c) => onChange(c ? [...selected, it.id] : selected.filter((x) => x !== it.id))} />
        <span className="truncate">{it.name}</span>
      </label>
    ))}
  </div>
);

const EditorialCatalogConfigurator = () => {
  const { user } = useAuth();
  const [source, setSource] = useState<CatalogSource | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Produtos
  const [mode, setMode] = useState<EditorialSelectionMode>("all");
  const [categoryIds, setCategoryIds] = useState<string[]>([]);
  const [brandIds, setBrandIds] = useState<string[]>([]);
  const [productIds, setProductIds] = useState<string[]>([]);
  const [productSearch, setProductSearch] = useState("");
  // Capa
  const [title, setTitle] = useState("Catálogo de produtos");
  const [subtitle, setSubtitle] = useState("");
  const [coverImage, setCoverImage] = useState("");
  const [showYear, setShowYear] = useState(true);
  const [showCount, setShowCount] = useState(true);
  // Organização
  const [grouping, setGrouping] = useState<CatalogGrouping>("none");
  const [separators, setSeparators] = useState<SeparatorMode>("auto");
  const [sectionImages, setSectionImages] = useState<Record<string, string>>({});
  const [showPrices, setShowPrices] = useState(true);
  // Institucional
  const [instEnabled, setInstEnabled] = useState(false);
  const [instTitle, setInstTitle] = useState("");
  const [instText, setInstText] = useState("");
  const [instImage, setInstImage] = useState("");
  // Comercial
  const [comEnabled, setComEnabled] = useState(false);
  const [com, setCom] = useState({ title: "", intro: "", payment: "", delivery: "", minimumOrder: "", notes: "" });
  // Destaques
  const [featEnabled, setFeatEnabled] = useState(false);
  const [featured, setFeatured] = useState<string[]>([]);
  const [featPolicy, setFeatPolicy] = useState<FeaturedPolicy>("keep_in_section");
  const [featSearch, setFeatSearch] = useState("");

  // Prévia
  const [bytes, setBytes] = useState<ArrayBuffer | null>(null);
  const [pageCount, setPageCount] = useState(0);
  const [page, setPage] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const [lastKey, setLastKey] = useState<string | null>(null);
  const reqId = useRef(0);
  const renderId = useRef(0);
  const canvasHost = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user) return;
    let alive = true;
    loadCatalogSource(supabase, user.id)
      .then((s) => alive && setSource(s))
      .catch(() => alive && setLoadError("Não foi possível carregar os produtos da loja. Tente novamente."));
    return () => { alive = false; };
  }, [user]);

  const selection = useMemo(() => toCatalogSelection({ mode, categoryIds, brandIds, productIds }), [mode, categoryIds, brandIds, productIds]);

  const doc = useMemo(() => {
    if (!source || !selection) return null;
    return buildCatalogDocument(source, { selection, presentation: { grouping, showPrices } });
  }, [source, selection, grouping, showPrices]);

  const editorialInput: EditorialConfigInput | null = useMemo(() => {
    if (!doc) return null;
    return {
      cover: { title, subtitle, imageUrl: coverImage || null, showYear, showCount },
      institutional: instEnabled ? { enabled: true, title: instTitle, text: instText, useStoreAbout: false, imageUrl: instImage || null } : undefined,
      commercial: comEnabled ? { enabled: true, ...com } : undefined,
      separators,
      sectionImages: sectionImagesInDocument(doc, sectionImages),
      featured: featEnabled ? { productIds: featuredInDocument(doc, featured), policy: featPolicy } : undefined,
    };
  }, [doc, title, subtitle, coverImage, showYear, showCount, instEnabled, instTitle, instText, instImage, comEnabled, com, separators, sectionImages, featEnabled, featured, featPolicy]);

  const issues = useMemo(() => (doc && editorialInput ? normalizeEditorialConfig(doc, editorialInput).issues : []), [doc, editorialInput]);
  const errorOf = (field: string) => { const i = issues.find((x) => x.field === field && x.code !== "unauthorized_image"); return i ? issueMessage(i) : undefined; };
  const blocking = [...blockingIssues(issues), ...issues.filter((i) => i.code === "empty")];
  const configKey = useMemo(() => JSON.stringify({ selection, grouping, showPrices, editorialInput }), [selection, grouping, showPrices, editorialInput]);
  const stale = !!bytes && lastKey !== configKey;

  const allImages = useMemo(() => {
    if (!doc) return [];
    const s = new Set<string>();
    if (doc.identity.logoUrl) s.add(doc.identity.logoUrl);
    doc.products.forEach((p) => p.primaryImage && s.add(p.primaryImage.url));
    return Array.from(s);
  }, [doc]);

  const refreshPreview = useCallback(async () => {
    if (!doc || !editorialInput || blocking.length || doc.products.length === 0) return;
    const id = ++reqId.current;
    const key = configKey;
    setGenerating(true);
    setGenError(null);
    try {
      const r = await generateEditorialPdf(doc, { resolveImage: createBrowserImageResolver(), editorial: editorialInput });
      if (id !== reqId.current) return; // resultado obsoleto
      setBytes(r.bytes);
      setPageCount(r.pageCount);
      setPage(1);
      setLastKey(key);
    } catch (e) {
      if (id !== reqId.current) return;
      setGenError(e instanceof EditorialConfigError ? "Há campos inválidos. Corrija os itens destacados." : "Não foi possível gerar a prévia. Tente novamente.");
    } finally {
      if (id === reqId.current) setGenerating(false);
    }
  }, [doc, editorialInput, blocking.length, configKey]);

  // Renderiza a página atual a partir dos bytes reais do PDF (pdf.js).
  useEffect(() => {
    const host = canvasHost.current;
    if (!bytes || !host) return;
    const id = ++renderId.current;
    renderPdfPreview(bytes, { pages: [page], scale: 1.5 * zoom })
      .then(([canvas]) => {
        if (id !== renderId.current || !canvas) return;
        canvas.style.width = "100%";
        canvas.style.height = "auto";
        canvas.setAttribute("aria-label", `Página ${page} de ${pageCount}`);
        host.replaceChildren(canvas);
      })
      .catch(() => id === renderId.current && setGenError("Não foi possível exibir a página."));
  }, [bytes, page, zoom, pageCount]);

  const downloadTest = () => {
    if (!bytes) return;
    const url = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "catalogo-editorial-teste.pdf";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  if (loadError) return <Card><CardContent className="py-10 text-center text-sm text-destructive">{loadError}</CardContent></Card>;
  if (!source) return <Card><CardContent className="py-10 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></CardContent></Card>;

  const activeProducts = source.products.filter((p) => p.is_active && p.user_id === source.storeId);
  const hasUncategorized = activeProducts.some((p) => !p.category_id);
  const hasUnbranded = activeProducts.some((p) => !p.brand_id);
  const cats = [...source.categories.map((c) => ({ id: c.id, name: c.name })), ...(hasUncategorized ? [{ id: UNCATEGORIZED_KEY, name: "Sem categoria" }] : [])];
  const brs = [...source.brands.map((b) => ({ id: b.id, name: b.name })), ...(hasUnbranded ? [{ id: UNBRANDED_KEY, name: "Sem marca" }] : [])];
  const q = productSearch.trim().toLowerCase();
  const productMatches = activeProducts.filter((p) => !q || p.name.toLowerCase().includes(q)).sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  const fq = featSearch.trim().toLowerCase();
  const featMatches = (doc?.products ?? []).filter((p) => !fq || p.name.toLowerCase().includes(fq));
  const featCount = doc ? featuredInDocument(doc, featured).length : 0;
  const aboutText = source.profile.about_us_text ?? "";

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 min-w-0">
      <Card className="min-w-0">
        <CardHeader>
          <CardTitle className="text-lg">Configurar catálogo Editorial</CardTitle>
          <p className="text-sm text-muted-foreground">{doc ? `${doc.products.length} produto(s) selecionado(s)` : "Selecione ao menos um item."}</p>
        </CardHeader>
        <CardContent>
          <Accordion type="single" collapsible defaultValue="produtos">
            <AccordionItem value="produtos">
              <AccordionTrigger>1. Produtos</AccordionTrigger>
              <AccordionContent className="space-y-3">
                <RadioGroup value={mode} onValueChange={(v) => setMode(v as EditorialSelectionMode)} className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {([["all", "Todos os produtos ativos"], ["categories", "Categorias específicas"], ["brands", "Marcas específicas"], ["products", "Produtos específicos"]] as const).map(([v, l]) => (
                    <label key={v} className="flex items-center gap-2 text-sm cursor-pointer"><RadioGroupItem value={v} />{l}</label>
                  ))}
                </RadioGroup>
                {mode === "categories" && <IdChecklist items={cats} selected={categoryIds} onChange={setCategoryIds} />}
                {mode === "brands" && <IdChecklist items={brs} selected={brandIds} onChange={setBrandIds} />}
                {mode === "products" && (
                  <div className="space-y-2">
                    <div className="relative">
                      <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input value={productSearch} onChange={(e) => setProductSearch(e.target.value)} placeholder="Pesquisar produto" className="pl-8" aria-label="Pesquisar produto" />
                    </div>
                    <IdChecklist items={productMatches.slice(0, MAX_LIST)} selected={productIds} onChange={setProductIds} />
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>{productIds.length} selecionado(s){productMatches.length > MAX_LIST ? ` · mostrando ${MAX_LIST} de ${productMatches.length}, refine a pesquisa` : ""}</span>
                      {productIds.length > 0 && <button type="button" className="underline" onClick={() => setProductIds([])}>Limpar</button>}
                    </div>
                  </div>
                )}
                {!selection && <p className="text-xs text-destructive">Marque ao menos um item para este modo.</p>}
                {doc && doc.products.length === 0 && <p className="text-xs text-destructive">Nenhum produto ativo corresponde à seleção.</p>}
                <div className="flex items-center justify-between pt-2">
                  <Label htmlFor="ed-prices">Mostrar preços</Label>
                  <Switch id="ed-prices" checked={showPrices} onCheckedChange={setShowPrices} />
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="capa">
              <AccordionTrigger>2. Capa e identidade</AccordionTrigger>
              <AccordionContent className="space-y-3">
                <div>
                  <div className="flex justify-between"><Label htmlFor="ed-title">Título do catálogo</Label><Counter value={title} limit={EDITORIAL_LIMITS.coverTitle} /></div>
                  <Input id="ed-title" value={title} onChange={(e) => setTitle(e.target.value)} />
                  <FieldError msg={errorOf("cover.title")} />
                </div>
                <div>
                  <div className="flex justify-between"><Label htmlFor="ed-sub">Subtítulo (opcional)</Label><Counter value={subtitle} limit={EDITORIAL_LIMITS.coverSubtitle} /></div>
                  <Input id="ed-sub" value={subtitle} onChange={(e) => setSubtitle(e.target.value)} />
                  <FieldError msg={errorOf("cover.subtitle")} />
                </div>
                <div className="space-y-1">
                  <Label>Imagem da capa</Label>
                  <ImagePicker urls={allImages} value={coverImage} onChange={setCoverImage} autoLabel="Padrão" />
                </div>
                <div className="flex items-center justify-between"><Label htmlFor="ed-year">Mostrar ano</Label><Switch id="ed-year" checked={showYear} onCheckedChange={setShowYear} /></div>
                <div className="flex items-center justify-between"><Label htmlFor="ed-count">Mostrar quantidade de produtos</Label><Switch id="ed-count" checked={showCount} onCheckedChange={setShowCount} /></div>
                <p className="text-xs text-muted-foreground">Cores e logotipo vêm da identidade já cadastrada na loja.</p>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="organizacao">
              <AccordionTrigger>3. Organização e layout</AccordionTrigger>
              <AccordionContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Organizar produtos por</Label>
                  <RadioGroup value={grouping} onValueChange={(v) => setGrouping(v as CatalogGrouping)} className="flex flex-wrap gap-4">
                    {([["none", "Sem agrupamento"], ["category", "Categoria"], ["brand", "Marca"]] as const).map(([v, l]) => (
                      <label key={v} className="flex items-center gap-2 text-sm cursor-pointer"><RadioGroupItem value={v} />{l}</label>
                    ))}
                  </RadioGroup>
                </div>
                {grouping !== "none" && (
                  <>
                    <div className="space-y-2">
                      <Label>Apresentação das seções</Label>
                      <RadioGroup value={separators} onValueChange={(v) => setSeparators(v as SeparatorMode)} className="space-y-2">
                        {([["auto", "Automática — recomendada", "Seções com até dois produtos usam cabeçalho compacto; maiores ganham página de abertura."], ["full", "Completa", "Cada seção tem uma página de abertura própria."], ["compact", "Compacta", "O título da seção aparece na primeira página de produtos."]] as const).map(([v, l, d]) => (
                          <label key={v} className="flex items-start gap-2 text-sm cursor-pointer"><RadioGroupItem value={v} className="mt-0.5" /><span><span className="font-medium">{l}</span><span className="block text-xs text-muted-foreground">{d}</span></span></label>
                        ))}
                      </RadioGroup>
                    </div>
                    <div className="space-y-3">
                      <Label>Imagem de cada seção</Label>
                      {doc?.sections.map((s) => (
                        <div key={s.id} className="space-y-1">
                          <p className="text-xs font-medium">{s.title} <span className="text-muted-foreground">({s.productIds.length})</span></p>
                          <ImagePicker urls={Array.from(sectionImageUrls(doc, s.id))} value={sectionImages[s.id] ?? ""}
                            onChange={(v) => setSectionImages((m) => ({ ...m, [s.id]: v }))} />
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="institucional">
              <AccordionTrigger>4. Apresentação institucional</AccordionTrigger>
              <AccordionContent className="space-y-3">
                <label className="flex items-center gap-2 text-sm cursor-pointer"><Checkbox checked={instEnabled} onCheckedChange={(c) => setInstEnabled(!!c)} />Incluir apresentação da loja</label>
                {instEnabled && (
                  <>
                    <div className="flex flex-wrap gap-2">
                      <Button type="button" size="sm" variant="outline" disabled={!aboutText}
                        onClick={() => { setInstText(aboutText); if (!instTitle && source.profile.about_us_title) setInstTitle(source.profile.about_us_title); }}>
                        Utilizar texto Sobre nós da minha loja
                      </Button>
                      <Button type="button" size="sm" variant="ghost" onClick={() => setInstText("")}>Escrever apresentação personalizada</Button>
                    </div>
                    {!aboutText && <p className="text-xs text-muted-foreground">Sua loja não tem texto “Sobre nós” cadastrado.</p>}
                    <div>
                      <div className="flex justify-between"><Label htmlFor="ed-it">Título</Label><Counter value={instTitle} limit={EDITORIAL_LIMITS.institutionalTitle} /></div>
                      <Input id="ed-it" value={instTitle} onChange={(e) => setInstTitle(e.target.value)} placeholder="Bem-vindo à nossa loja" />
                      <FieldError msg={errorOf("institutional.title")} />
                    </div>
                    <div>
                      <div className="flex justify-between"><Label htmlFor="ed-itx">Texto institucional</Label><Counter value={instText} limit={EDITORIAL_LIMITS.institutionalText} /></div>
                      <Textarea id="ed-itx" rows={6} value={instText} onChange={(e) => setInstText(e.target.value)} />
                      <FieldError msg={errorOf("institutional.text") ?? errorOf("institutional")} />
                    </div>
                    <div className="space-y-1"><Label>Imagem (opcional)</Label><ImagePicker urls={allImages} value={instImage} onChange={setInstImage} autoLabel="Sem imagem" /></div>
                  </>
                )}
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="comercial">
              <AccordionTrigger>5. Condições comerciais</AccordionTrigger>
              <AccordionContent className="space-y-3">
                <label className="flex items-center gap-2 text-sm cursor-pointer"><Checkbox checked={comEnabled} onCheckedChange={(c) => setComEnabled(!!c)} />Incluir condições comerciais</label>
                {comEnabled && (
                  <>
                    <p className="text-xs text-muted-foreground">Todos os campos são opcionais; só os preenchidos aparecem no catálogo.</p>
                    {([["title", "Título", EDITORIAL_LIMITS.commercialTitle, false], ["intro", "Introdução", EDITORIAL_LIMITS.commercialIntro, true], ["payment", "Condições de pagamento", EDITORIAL_LIMITS.commercialField, true], ["delivery", "Condições de entrega", EDITORIAL_LIMITS.commercialField, true], ["minimumOrder", "Pedido mínimo", EDITORIAL_LIMITS.commercialField, true], ["notes", "Observações adicionais", EDITORIAL_LIMITS.commercialField, true]] as const).map(([k, l, lim, multi]) => (
                      <div key={k}>
                        <div className="flex justify-between"><Label htmlFor={`ed-c-${k}`}>{l}</Label><Counter value={com[k]} limit={lim} /></div>
                        {multi
                          ? <Textarea id={`ed-c-${k}`} rows={2} value={com[k]} onChange={(e) => setCom((c) => ({ ...c, [k]: e.target.value }))} />
                          : <Input id={`ed-c-${k}`} value={com[k]} onChange={(e) => setCom((c) => ({ ...c, [k]: e.target.value }))} placeholder="Condições comerciais" />}
                        <FieldError msg={errorOf(`commercial.${k}`)} />
                      </div>
                    ))}
                    <FieldError msg={errorOf("commercial")} />
                  </>
                )}
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="destaques">
              <AccordionTrigger>6. Produtos em destaque</AccordionTrigger>
              <AccordionContent className="space-y-3">
                <label className="flex items-center gap-2 text-sm cursor-pointer"><Checkbox checked={featEnabled} onCheckedChange={(c) => setFeatEnabled(!!c)} />Incluir páginas de produtos em destaque</label>
                {featEnabled && (
                  <>
                    <Input value={featSearch} onChange={(e) => setFeatSearch(e.target.value)} placeholder="Pesquisar entre os selecionados" aria-label="Pesquisar destaque" />
                    <IdChecklist items={featMatches.slice(0, MAX_LIST).map((p) => ({ id: p.id, name: p.name }))} selected={featured} onChange={setFeatured} />
                    <p className="text-xs text-muted-foreground">{featCount} destacado(s) · máximo {EDITORIAL_LIMITS.featured}</p>
                    <FieldError msg={errorOf("featured.productIds")} />
                    <Label>Como exibir produtos destacados?</Label>
                    <RadioGroup value={featPolicy} onValueChange={(v) => setFeatPolicy(v as FeaturedPolicy)} className="space-y-2">
                      <label className="flex items-center gap-2 text-sm cursor-pointer"><RadioGroupItem value="keep_in_section" />Repetir na seção original</label>
                      <label className="flex items-center gap-2 text-sm cursor-pointer"><RadioGroupItem value="featured_only" />Exibir somente como destaque</label>
                    </RadioGroup>
                  </>
                )}
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </CardContent>
      </Card>

      <Card className="min-w-0">
        <CardHeader className="space-y-3">
          <CardTitle className="text-lg">7. Pré-visualização</CardTitle>
          <div className="flex flex-wrap gap-2">
            <Button onClick={refreshPreview} disabled={generating || !doc || doc.products.length === 0 || blocking.length > 0} className="gap-2">
              {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              {bytes ? "Atualizar prévia" : "Gerar prévia"}
            </Button>
            <Button variant="outline" onClick={downloadTest} disabled={!bytes || stale || generating} className="gap-2">
              <Download className="h-4 w-4" /> Baixar PDF de teste
            </Button>
          </div>
          {blocking.length > 0 && <p className="text-xs text-destructive flex gap-1"><AlertTriangle className="h-4 w-4 shrink-0" />Corrija os campos destacados para gerar a prévia.</p>}
          {stale && <p className="text-xs text-muted-foreground">As configurações mudaram — clique em “Atualizar prévia”.</p>}
          {genError && <p className="text-xs text-destructive">{genError}</p>}
          <p className="text-xs text-muted-foreground">Prévia de homologação: nada é publicado nem compartilhado.</p>
        </CardHeader>
        <CardContent className="space-y-3">
          {!bytes && !generating && <div className="aspect-[210/297] rounded-md border border-dashed border-border flex items-center justify-center text-sm text-muted-foreground p-6 text-center">Configure o catálogo e clique em “Gerar prévia”.</div>}
          {generating && !bytes && <div className="aspect-[210/297] rounded-md border border-border flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>}
          {bytes && (
            <>
              <div className="flex items-center justify-between gap-2">
                <Button size="icon" variant="outline" aria-label="Página anterior" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}><ChevronLeft className="h-4 w-4" /></Button>
                <span className="text-sm">Página {page} de {pageCount}</span>
                <Button size="icon" variant="outline" aria-label="Próxima página" disabled={page >= pageCount} onClick={() => setPage((p) => p + 1)}><ChevronRight className="h-4 w-4" /></Button>
                <div className="flex gap-1">
                  <Button size="icon" variant="ghost" aria-label="Reduzir" disabled={zoom <= 1} onClick={() => setZoom((z) => z - 0.5)}><ZoomOut className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" aria-label="Ampliar" disabled={zoom >= 2} onClick={() => setZoom((z) => z + 0.5)}><ZoomIn className="h-4 w-4" /></Button>
                </div>
              </div>
              <div className={`relative overflow-auto rounded-md border border-border bg-muted ${generating ? "opacity-60" : ""}`}>
                <div ref={canvasHost} style={{ width: `${zoom * 100}%` }} />
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default EditorialCatalogConfigurator;
