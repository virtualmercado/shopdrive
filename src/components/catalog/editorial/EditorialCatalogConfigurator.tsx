import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronsLeft, ChevronRight, ChevronsRight, Download, Loader2, RefreshCw, Search, ZoomIn, ZoomOut, AlertTriangle, Send, Copy, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { buildCanonicalCatalogUrl } from "@/lib/catalogShareLink";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
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
  coverStoragePath,
  AUTO_COMPACT_MAX,
  SECTION_FOLDER,
  COVER_FOLDER,
  INSTITUTIONAL_FOLDER,
  BACK_COVER_FOLDER,
  type EditorialUploadFolder,
  type EditorialConfigInput,
  type EditorialIssue,
  type FeaturedPolicy,
  type SeparatorMode,
  publishEditorialCatalog,
  productsWithoutImage,
  type PublishStep,
} from "@/lib/catalog-v2/editorial";
import { featuredInDocument, sectionImagesInDocument, type EditorialSelectionMode } from "@/lib/catalog-v2/editorial/uiSelection";
import { BACK_TEXT_ELEMENTS, COVER_FONTS, COVER_TEXT_ELEMENTS, COVER_WEIGHTS, isValidHex, type BackTextKey, type BackTypographyInput, type CoverTextKey, type CoverTextStyle, type CoverTypographyInput } from "@/lib/catalog-v2/editorial/coverTypography";
import { INSTITUTIONAL_BAND } from "@/lib/catalog-v2/editorial/renderInstitutional";
import { SEPARATOR_BAND } from "@/lib/catalog-v2/editorial/renderSeparator";
import { buildDraftDocument, draftConfigKey, draftEditorialInput, effectiveDraftSelection, parseDraftConfig, PREVIEW_BUCKET, type CatalogDraftConfig, type CatalogDraftRecord, type PreviewReservation } from "@/lib/catalog-v2/editorial/draftConfig";
import { useCatalogDraftPersistence } from "./useCatalogDraftPersistence";

// Recomendação derivada da faixa real do renderer (mm → px).
const mmToPx = (mm: number, dpi: number) => Math.round((mm / 25.4) * dpi);
const INST_REC = { w: mmToPx(INSTITUTIONAL_BAND.w, 300), h: mmToPx(INSTITUTIONAL_BAND.h, 300) };
const INST_MIN = { w: mmToPx(INSTITUTIONAL_BAND.w, 150), h: mmToPx(INSTITUTIONAL_BAND.h, 150) };
const INST_RATIO = (INSTITUTIONAL_BAND.w / INSTITUTIONAL_BAND.h).toFixed(1).replace(".", ",");

const SEC_REC = { w: mmToPx(SEPARATOR_BAND.w, 300), h: mmToPx(SEPARATOR_BAND.h, 300) };
const SEC_MIN = { w: mmToPx(SEPARATOR_BAND.w, 150), h: mmToPx(SEPARATOR_BAND.h, 150) };
const SEC_RATIO = (SEPARATOR_BAND.w / SEPARATOR_BAND.h).toFixed(2).replace(".", ",");

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
  const [coverMode, setCoverMode] = useState<"default" | "custom">("default");
  const [coverUploading, setCoverUploading] = useState(false);
  const [coverWarn, setCoverWarn] = useState<string | null>(null);
  const coverInput = useRef<HTMLInputElement>(null);
  /** Upload compartilhado (capa e apresentação): mesma validação, bucket e pasta isolada por loja. */
  const uploadEditorialImage = async (file: File, folder: EditorialUploadFolder, min: { w: number; h: number }, setBusy: (b: boolean) => void, onDone: (url: string, lowRes: boolean) => void) => {
    if (!user) return;
    const owner = user.id;
    const ext = ({ "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" } as Record<string, string>)[file.type];
    if (!ext) { toast.error("Formato não permitido. Use JPG, PNG ou WebP."); return; }
    if (file.size > 10 * 1024 * 1024) { toast.error("Arquivo excede o limite de 10 MB."); return; }
    const dims = await new Promise<{ w: number; h: number } | null>((res) => {
      const u = URL.createObjectURL(file); const im = new Image();
      im.onload = () => { res({ w: im.naturalWidth, h: im.naturalHeight }); URL.revokeObjectURL(u); };
      im.onerror = () => { res(null); URL.revokeObjectURL(u); };
      im.src = u;
    });
    if (!dims || !dims.w || !dims.h) { toast.error("Arquivo de imagem inválido."); return; }
    if (currentOwner.current !== owner) return;
    setBusy(true);
    try {
      const path = coverStoragePath(user.id, ext, folder);
      const { error } = await supabase.storage.from("product-images").upload(path, file, { contentType: file.type, upsert: false });
      if (error) throw error;
      if (currentOwner.current !== owner) return;
      onDone(supabase.storage.from("product-images").getPublicUrl(path).data.publicUrl, dims.w < min.w || dims.h < min.h);
    } catch { toast.error("Não foi possível enviar a imagem. Tente novamente."); }
    finally { setBusy(false); }
  };
  const LOW_RES = "Esta imagem possui resolução baixa e poderá perder qualidade no PDF.";
  const uploadCover = (file: File) => uploadEditorialImage(file, COVER_FOLDER, { w: 1240, h: 1754 }, setCoverUploading, (url, low) => { setCoverImage(url); setCoverWarn(low ? LOW_RES : null); });
  const [showYear, setShowYear] = useState(true);
  const [showCount, setShowCount] = useState(true);
  const [typography, setTypography] = useState<CoverTypographyInput>({});
  // Cor digitada: só vai para a configuração quando o HEX é válido.
  const [hexDraft, setHexDraft] = useState<Partial<Record<CoverTextKey, string>>>({});
  const setTypo = (key: CoverTextKey, patch: Partial<CoverTextStyle>) => setTypography((t) => ({ ...t, [key]: { ...t[key], ...patch } }));
  // Contracapa
  const [backImage, setBackImage] = useState("");
  const [backMode, setBackMode] = useState<"default" | "custom">("default");
  const [backUploading, setBackUploading] = useState(false);
  const [backWarn, setBackWarn] = useState<string | null>(null);
  const backInput = useRef<HTMLInputElement>(null);
  const uploadBack = (file: File) => uploadEditorialImage(file, BACK_COVER_FOLDER, { w: 1240, h: 1754 }, setBackUploading, (url, low) => { setBackImage(url); setBackWarn(low ? LOW_RES : null); });
  const [backTypography, setBackTypography] = useState<BackTypographyInput>({});
  const [backHexDraft, setBackHexDraft] = useState<Partial<Record<BackTextKey, string>>>({});
  const setBackTypo = (key: BackTextKey, patch: Partial<CoverTextStyle>) => setBackTypography((t) => ({ ...t, [key]: { ...t[key], ...patch } }));
  // Organização
  const [grouping, setGrouping] = useState<CatalogGrouping>("none");
  const [separators, setSeparators] = useState<SeparatorMode>("auto");
  const [sectionImages, setSectionImages] = useState<Record<string, string>>({});
  const [sectionCustom, setSectionCustom] = useState<Record<string, boolean>>({});
  const [sectionBusy, setSectionBusy] = useState<string | null>(null);
  const [sectionWarn, setSectionWarn] = useState<Record<string, string | null>>({});
  const sectionInput = useRef<HTMLInputElement>(null);
  const sectionTarget = useRef<string | null>(null);
  const setSectionDefault = (sid: string) => {
    setSectionImages((m) => { const n = { ...m }; delete n[sid]; return n; });
    setSectionCustom((m) => ({ ...m, [sid]: false }));
    setSectionWarn((m) => ({ ...m, [sid]: null }));
  };
  const uploadSection = (sid: string, file: File) => uploadEditorialImage(file, SECTION_FOLDER, SEC_MIN, (b) => setSectionBusy(b ? sid : null), (url, low) => {
    setSectionImages((m) => ({ ...m, [sid]: url }));
    setSectionWarn((m) => ({ ...m, [sid]: low ? "Esta imagem possui resolução baixa e poderá perder qualidade no PDF." : null }));
  });
  const [showPrices, setShowPrices] = useState(true);
  // Institucional
  const [instEnabled, setInstEnabled] = useState(false);
  const [instTitle, setInstTitle] = useState("");
  const [instText, setInstText] = useState("");
  const [instImage, setInstImage] = useState("");
  const [instMode, setInstMode] = useState<"default" | "custom">("default");
  const [instUploading, setInstUploading] = useState(false);
  const [instWarn, setInstWarn] = useState<string | null>(null);
  const instInput = useRef<HTMLInputElement>(null);
  const uploadInst = (file: File) => uploadEditorialImage(file, INSTITUTIONAL_FOLDER, INST_MIN, setInstUploading, (url, low) => { setInstImage(url); setInstWarn(low ? LOW_RES : null); });
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
  const [progress, setProgress] = useState<string | null>(null);
  const [excludeNoImage, setExcludeNoImage] = useState(false);
  // Estado do catálogo público visto na prévia: o servidor recusa se mudar até a confirmação.
  const [baseline, setBaseline] = useState<{ updatedAt: string | null; hasCurrent: boolean } | null>(null);
  const [publishKey, setPublishKey] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [publishedUrl, setPublishedUrl] = useState<string | null>(null);
  const reqId = useRef(0);
  const renderId = useRef(0);
  const canvasHost = useRef<HTMLDivElement>(null);

  const draftConfig = useMemo<CatalogDraftConfig>(() => ({ mode, categoryIds, brandIds, productIds, title, subtitle, coverImage, coverMode, showYear, showCount, typography, backImage, backMode, backTypography, grouping, separators, sectionImages, sectionCustom, showPrices, instEnabled, instTitle, instText, instImage, instMode, comEnabled, com, featEnabled, featured, featPolicy, excludeNoImage }), [mode, categoryIds, brandIds, productIds, title, subtitle, coverImage, coverMode, showYear, showCount, typography, backImage, backMode, backTypography, grouping, separators, sectionImages, sectionCustom, showPrices, instEnabled, instTitle, instText, instImage, instMode, comEnabled, com, featEnabled, featured, featPolicy, excludeNoImage]);
  const hydrateDraft = useCallback((c: CatalogDraftConfig, saved: CatalogDraftRecord) => {
    setMode(c.mode); setCategoryIds(c.categoryIds); setBrandIds(c.brandIds); setProductIds(c.productIds);
    setTitle(c.title); setSubtitle(c.subtitle); setCoverImage(c.coverImage); setCoverMode(c.coverMode);
    setShowYear(c.showYear); setShowCount(c.showCount); setTypography(c.typography);
    setBackImage(c.backImage); setBackMode(c.backMode); setBackTypography(c.backTypography);
    setGrouping(c.grouping); setSeparators(c.separators); setSectionImages(c.sectionImages); setSectionCustom(c.sectionCustom);
    setShowPrices(c.showPrices); setExcludeNoImage(c.excludeNoImage);
    setInstEnabled(c.instEnabled); setInstTitle(c.instTitle); setInstText(c.instText); setInstImage(c.instImage); setInstMode(c.instMode);
    setComEnabled(c.comEnabled); setCom(c.com); setFeatEnabled(c.featEnabled); setFeatured(c.featured); setFeatPolicy(c.featPolicy);
    setLastKey(saved.config === null ? null : draftConfigKey(parseDraftConfig(saved.config, saved.schema_version)));
  }, []);
  const persistence = useCatalogDraftPersistence(user?.id, draftConfig, hydrateDraft);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewLoadAttempt, setPreviewLoadAttempt] = useState(0);
  const restoredPreviewId = useRef<string | null>(null);
  const generationLock = useRef(false);
  const currentOwner = useRef(user?.id);
  currentOwner.current = user?.id;
  const [freshnessError, setFreshnessError] = useState(false);

  useEffect(() => {
    reqId.current++; renderId.current++;
    setBytes(null); setPageCount(0); setPage(1); setSource(null);
    setLastKey(null); setBaseline(null); setPublishKey(null); setPublishedUrl(null);
    setGenerating(false); setPreviewLoading(false); setGenError(null); setLoadError(null);
    restoredPreviewId.current = null;
  }, [user?.id]);

  useEffect(() => {
    const metadata = persistence.record?.preview;
    if (!persistence.ready || !metadata || restoredPreviewId.current === metadata.id) return;
    let active = true;
    setPreviewLoading(true);
    void supabase.storage.from(PREVIEW_BUCKET).download(metadata.path).then(async ({ data, error }) => {
      if (error || !data) throw error ?? new Error("preview unavailable");
      const restored = await data.arrayBuffer();
      if (!active) return;
      setBytes(restored); setPageCount(metadata.page_count); setPage(1);
      setBaseline(metadata.publication_baseline); setPublishKey(crypto.randomUUID());
      restoredPreviewId.current = metadata.id;
      setGenError(null);
    }).catch(() => { if (active) setGenError("Não foi possível carregar a última prévia. Tente novamente."); })
      .finally(() => { if (active) setPreviewLoading(false); });
    return () => { active = false; };
  }, [persistence.ready, persistence.record?.preview?.id, previewLoadAttempt]);

  useEffect(() => {
    if (!persistence.ready) return;
    let active = true;
    const check = () => { if (document.visibilityState !== "visible") return; void persistence.checkCurrent().then(() => { if (active) setFreshnessError(false); }).catch(() => { if (active) setFreshnessError(true); }); };
    window.addEventListener("focus", check);
    const timer = window.setInterval(check, 30000);
    return () => { active = false; window.clearInterval(timer); window.removeEventListener("focus", check); };
  }, [persistence.ready, persistence.checkCurrent]);

  useEffect(() => {
    if (!user) return;
    let alive = true;
    loadCatalogSource(supabase, user.id)
      .then((s) => alive && setSource(s))
      .catch(() => alive && setLoadError("Não foi possível carregar os produtos da loja. Tente novamente."));
    return () => { alive = false; };
  }, [user]);

  const selection = useMemo(() => source ? effectiveDraftSelection(source, draftConfig) : null, [source, draftConfig]);

  const fullDoc = useMemo(() => {
    if (!source || !selection) return null;
    return buildCatalogDocument(source, { selection, presentation: { grouping, showPrices } });
  }, [source, selection, grouping, showPrices]);
  const noImageIds = useMemo(() => (fullDoc ? productsWithoutImage(fullDoc) : []), [fullDoc]);
  // Exclusão só da composição deste catálogo; o cadastro do produto não é tocado.
  const doc = useMemo(() => {
    if (!fullDoc || !source || !excludeNoImage || noImageIds.length === 0) return fullDoc;
    return buildDraftDocument(source, draftConfig);
  }, [fullDoc, source, excludeNoImage, noImageIds, draftConfig]);

  const editorialInput: EditorialConfigInput | null = useMemo(() => {
    if (!doc) return null;
    return {
      cover: { title, subtitle, imageUrl: coverImage || null, showYear, showCount, typography },
      institutional: instEnabled ? { enabled: true, title: instTitle, text: instText, useStoreAbout: false, imageUrl: instImage || null } : undefined,
      commercial: comEnabled ? { enabled: true, ...com } : undefined,
      separators,
      sectionImages: sectionImagesInDocument(doc, sectionImages),
      featured: featEnabled ? { productIds: featuredInDocument(doc, featured), policy: featPolicy } : undefined,
      backCover: { imageUrl: backImage || null, typography: backTypography },
    };
  }, [doc, title, subtitle, coverImage, showYear, showCount, typography, instEnabled, instTitle, instText, instImage, comEnabled, com, separators, sectionImages, featEnabled, featured, featPolicy, backImage, backTypography]);

  const issues = useMemo(() => (doc && editorialInput ? normalizeEditorialConfig(doc, editorialInput).issues : []), [doc, editorialInput]);
  const errorOf = (field: string) => { const i = issues.find((x) => x.field === field && x.code !== "unauthorized_image"); return i ? issueMessage(i) : undefined; };
  const blocking = [...blockingIssues(issues), ...issues.filter((i) => i.code === "empty")];
  const configKey = useMemo(() => draftConfigKey(draftConfig), [draftConfig]);
  const stale = !!bytes && (lastKey !== configKey || !!persistence.record?.stale || freshnessError || persistence.record?.preview?.id !== restoredPreviewId.current);


  const refreshPreview = useCallback(async () => {
    if (!user || !persistence.ready || generationLock.current || blocking.length || !doc?.products.length) return;
    generationLock.current = true;
    const id = ++reqId.current;
    const key = configKey;
    const savedConfig = draftConfig;
    const stillCurrent = () => id === reqId.current && user.id === currentOwner.current;
    setGenerating(true);
    setGenError(null);
    setPublishError(null);
    setPublishedUrl(null);
    setProgress("Salvando configurações…");
    let reservation: PreviewReservation | null = null;
    try {
      if (!await persistence.flush()) throw new Error("draft save failed");
      if (!stillCurrent()) return;
      // The captured render must agree with the actually flushed editor intent.
      const checked = await persistence.checkCurrent();
      if (draftConfigKey(checked.config) !== key) throw new Error("catalog changed before preview");
      if (!stillCurrent()) return;
      const { data: pending, error: beginError } = await supabase.rpc("begin_my_catalog_preview", { _expected_revision: persistence.getRevision() });
      if (beginError || !pending) throw beginError ?? new Error("preview reservation failed");
      reservation = pending as unknown as PreviewReservation;
      if (!stillCurrent()) return;
      const freshSource = await loadCatalogSource(supabase, user.id);
      if (!stillCurrent()) return;
      const freshDoc = buildDraftDocument(freshSource, savedConfig);
      if (!freshDoc?.products.length) throw new Error("no eligible catalog products");
      const freshInput = draftEditorialInput(freshDoc, savedConfig);
      const validation = normalizeEditorialConfig(freshDoc, freshInput).issues;
      if (blockingIssues(validation).length || validation.some((i) => i.code === "empty")) throw new EditorialConfigError(validation);
      setSource(freshSource);
      setProgress(`Preparando ${freshDoc.products.length} produtos…`);
      const r = await generateEditorialPdf(freshDoc, {
        resolveImage: createBrowserImageResolver(),
        editorial: freshInput,
        onProgress: (p, t) => id === reqId.current && setProgress(`Processando imagens e gerando página ${p} de ${t}…`),
      });
      if (!stillCurrent()) return; // resultado obsoleto
      const fallback = r.issues.filter((i) => i.code === "font_fallback");
      if (r.issues.some((i) => i.code === "image_failed")) toast.warning("Não foi possível carregar a imagem de uma seção; foi usada a abertura Padrão.");
      if (fallback.length) toast.warning(`Não foi possível carregar a fonte ${fallback.map((i) => (i as { font: string }).font).join(", ")}; foi usada a fonte padrão do catálogo.`);
      setProgress("Salvando última prévia…");
      const { error: uploadError } = await supabase.storage.from(PREVIEW_BUCKET).upload(reservation.path, new Blob([r.bytes], { type: "application/pdf" }), { contentType: "application/pdf", upsert: false });
      if (uploadError) throw uploadError;
      if (!stillCurrent()) return;
      const { data: completed, error: completeError } = await supabase.rpc("complete_my_catalog_preview", { _preview_id: reservation.id, _page_count: r.pageCount, _publication_baseline: reservation.publication_baseline });
      if (completeError || !completed) throw completeError ?? new Error("preview persistence failed");
      if (!stillCurrent()) return;
      const saved = completed as unknown as CatalogDraftRecord;
      restoredPreviewId.current = reservation.id;
      persistence.setRecord(saved);
      setBaseline(reservation.publication_baseline);
      setPublishKey(crypto.randomUUID());
      setBytes(r.bytes);
      setPageCount(r.pageCount);
      setPage(1);
      setLastKey(key);
      setFreshnessError(false);
      // Private objects only: current/reserved files are protected by server policies.
      void supabase.storage.from(PREVIEW_BUCKET).list(user.id, { limit: 1000 }).then(async ({ data }) => {
        const obsolete = (data ?? []).filter((file) => file.name.endsWith(".pdf") && `${user.id}/${file.name}` !== reservation?.path).map((file) => `${user.id}/${file.name}`);
        for (const path of obsolete) await supabase.storage.from(PREVIEW_BUCKET).remove([path]);
      }).catch(() => console.warn("[CatalogPreview] cleanup postponed"));
    } catch (e) {
      console.warn("[CatalogPreview] update failed; keeping last valid preview");
      if (reservation && stillCurrent()) {
        try {
          await supabase.rpc("discard_my_catalog_preview", { _preview_id: reservation.id });
          await supabase.storage.from(PREVIEW_BUCKET).remove([reservation.path]);
        } catch { console.warn("[CatalogPreview] failed reservation cleanup postponed"); }
      }
      if (!stillCurrent()) return;
      setGenError(e instanceof EditorialConfigError ? "Há campos inválidos. Corrija os itens destacados." : "Não foi possível atualizar a prévia. A última prévia válida foi preservada. Tente novamente.");
    } finally {
      generationLock.current = false;
      if (id === reqId.current) { setGenerating(false); setProgress(null); }
    }
  }, [user, doc, blocking.length, configKey, draftConfig, persistence]);

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

  const STEP_LABEL: Record<PublishStep, string> = { uploading: "Enviando arquivo…", publishing: "Publicando catálogo…", sharing: "Confirmando link de compartilhamento…" };

  const publish = async () => {
    if (!bytes || stale || !baseline || !publishKey || publishing) return;
    setConfirmOpen(false);
    setPublishing(true);
    setPublishError(null);
    try {
      if (!await persistence.flush()) { setPublishError("Salve as alterações antes de publicar."); return; }
      const checked = await persistence.checkCurrent();
      if (currentOwner.current !== user?.id) return;
      if (checked.stale || checked.preview?.id !== restoredPreviewId.current) { setPublishError("Há alterações desde a última prévia. Atualize a prévia antes de publicar."); return; }
      const outcome = await publishEditorialCatalog(bytes, publishKey, baseline.updatedAt, {
        begin: async (key, expected) => {
          const { data, error } = await supabase.rpc("begin_editorial_catalog_publication", { _idempotency_key: key, _expected_updated_at: expected as string });
          if (error) throw error;
          return data as { publication_id: string; storage_path: string; status: string };
        },
        upload: async (path, b) => {
          const { error } = await supabase.storage.from("product-images").upload(path, new Blob([b], { type: "application/pdf" }), { contentType: "application/pdf", upsert: false });
          if (error) throw error;
        },
        publish: async (pid) => {
          const { data, error } = await supabase.rpc("publish_editorial_catalog", { _publication_id: pid });
          if (error) throw error;
          return data as { status: string; share_code?: string | null; replayed?: boolean };
        },
      }, (s) => setProgress(STEP_LABEL[s]));
      if ("shareCode" in outcome) {
        const url = buildCanonicalCatalogUrl(outcome.shareCode);
        setPublishedUrl(url);
        setBaseline(null); // nova publicação exige nova prévia
        toast.success("Catálogo Editorial publicado.");
      } else {
        setPublishError((outcome as { message: string }).message);
        if ((outcome as { reason: string }).reason === "stale") setBaseline(null);
      }
    } catch {
      console.warn("[CatalogPublication] confirmation failed");
      setPublishError("Não foi possível confirmar a publicação. O catálogo público anterior foi preservado.");
    } finally {
      setPublishing(false);
      setProgress(null);
    }
  };

  if (loadError) return <Card><CardContent className="py-10 text-center text-sm text-destructive">{loadError}</CardContent></Card>;
  if (persistence.loadError) return <Card><CardContent className="py-10 space-y-3 text-center"><p className="text-sm text-destructive">Não foi possível carregar as configurações salvas. Nenhuma configuração foi substituída.</p><Button variant="outline" onClick={persistence.retryLoad}><RefreshCw className="mr-2 h-4 w-4" />Tentar novamente</Button></CardContent></Card>;
  if (!source || !persistence.ready) return <Card><CardContent className="py-10 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></CardContent></Card>;

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
          <div role="status" aria-live="polite" className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span>{persistence.status === "saved" ? "Alterações salvas" : persistence.status === "saving" ? "Salvando…" : persistence.status === "pending" ? "Alterações pendentes" : persistence.status === "conflict" ? "Este rascunho foi alterado em outra aba. Suas alterações locais foram preservadas." : "Não foi possível salvar as alterações."}</span>
            {persistence.status === "error" && <Button size="sm" variant="outline" onClick={() => void persistence.flush()}><RefreshCw className="mr-1 h-3 w-3" />Tentar novamente</Button>}
            {persistence.status === "conflict" && <>
              <Button size="sm" variant="outline" onClick={() => { const url = URL.createObjectURL(new Blob([JSON.stringify(draftConfig, null, 2)], { type: "application/json" })); const a = document.createElement("a"); a.href = url; a.download = "catalogo-alteracoes-locais.json"; a.click(); URL.revokeObjectURL(url); }}><Download className="mr-1 h-3 w-3" />Guardar alterações locais</Button>
              <Button size="sm" variant="outline" onClick={() => { if (window.confirm("Carregar o rascunho salvo na outra aba? Guarde suas alterações locais antes de continuar; elas não serão aplicadas.")) persistence.reloadSaved(); }}>Carregar rascunho salvo</Button>
            </>}
          </div>
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
                  <RadioGroup value={coverImage ? "custom" : coverMode} onValueChange={(v) => { if (v === "default") { setCoverImage(""); setCoverWarn(null); } setCoverMode(v as "default" | "custom"); }} className="grid grid-cols-2 gap-2">
                    <Label className="flex items-center gap-2 rounded-md border border-border p-2 cursor-pointer text-sm font-normal"><RadioGroupItem value="default" />Padrão</Label>
                    <Label className="flex items-center gap-2 rounded-md border border-border p-2 cursor-pointer text-sm font-normal"><RadioGroupItem value="custom" />Imagem personalizada</Label>
                  </RadioGroup>
                  {(coverImage ? "custom" : coverMode) === "default" ? (
                    <p className="text-xs text-muted-foreground">Fundo branco com a logo da loja centralizada.</p>
                  ) : (
                    <div className="space-y-2">
                      <input ref={coverInput} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void uploadCover(f); }} />
                      {coverImage ? (
                        <div className="flex items-start gap-3">
                          <img src={coverImage} alt="Capa personalizada" className="h-28 aspect-[210/297] object-cover rounded-md border border-border" />
                          <div className="flex flex-col gap-2">
                            <Button type="button" size="sm" variant="outline" disabled={coverUploading} onClick={() => coverInput.current?.click()}>Trocar imagem</Button>
                            <Button type="button" size="sm" variant="ghost" disabled={coverUploading} onClick={() => { setCoverImage(""); setCoverWarn(null); setCoverMode("default"); }}>Remover imagem</Button>
                          </div>
                        </div>
                      ) : (
                        <Button type="button" size="sm" variant="outline" disabled={coverUploading} onClick={() => coverInput.current?.click()}>
                          {coverUploading && <Loader2 className="h-4 w-4 animate-spin" />} Enviar imagem
                        </Button>
                      )}
                      {coverWarn && <p className="text-xs text-destructive flex gap-1 items-center"><AlertTriangle className="h-3 w-3" />{coverWarn}</p>}
                      <div className="text-xs text-muted-foreground rounded-md bg-muted p-2 space-y-0.5">
                        <p className="font-medium text-foreground">Imagem recomendada para capa</p>
                        <p>Formato: A4 vertical · Proporção: 1:1,414</p>
                        <p>Recomendado: <b>2480 × 3508 px — 300 dpi</b></p>
                        <p>Mínimo recomendado: <b>1240 × 1754 px — 150 dpi</b></p>
                        <p>Formatos: <b>JPG, PNG ou WebP</b> (até 10 MB)</p>
                        <p>Mantenha textos, logos e elementos importantes afastados das bordas.</p>
                        <p>Imagens fora da proporção A4 poderão ser recortadas automaticamente para preencher toda a capa.</p>
                      </div>
                    </div>
                  )}
                </div>
                <div className="flex items-center justify-between"><Label htmlFor="ed-year">Mostrar ano</Label><Switch id="ed-year" checked={showYear} onCheckedChange={setShowYear} /></div>
                <div className="flex items-center justify-between"><Label htmlFor="ed-count">Mostrar quantidade de produtos</Label><Switch id="ed-count" checked={showCount} onCheckedChange={setShowCount} /></div>
                <Accordion type="single" collapsible className="rounded-md border border-border px-3">
                  <AccordionItem value="tipografia" className="border-b-0">
                    <AccordionTrigger className="py-2 text-sm">Tipografia da capa</AccordionTrigger>
                    <AccordionContent className="space-y-4">
                      <p className="text-xs text-muted-foreground">"Padrão" mantém a aparência atual. As escolhas aparecem na prévia, no download e na publicação.</p>
                      {COVER_TEXT_ELEMENTS.filter((el) => (el.key !== "year" || showYear) && (el.key !== "productCount" || showCount)).map((el) => {
                        const st = typography[el.key] ?? {};
                        const fam = st.fontFamily ?? "default";
                        const wt = st.fontWeight ?? "default";
                        const draft = hexDraft[el.key] ?? st.color ?? "";
                        const btn = (sel: boolean) => `rounded-md border px-2 py-1 text-xs ${sel ? "border-primary bg-primary/10 text-primary font-semibold" : "border-input"}`;
                        return (
                          <div key={el.key} className="space-y-2 border-t border-border pt-3 first:border-t-0 first:pt-0">
                            <p className="text-sm font-medium">{el.label}</p>
                            <div className="space-y-1">
                              <Label className="text-xs text-muted-foreground">Estilo da fonte</Label>
                              <div className="grid grid-cols-3 sm:grid-cols-5 gap-1">
                                <button type="button" className={btn(fam === "default")} onClick={() => setTypo(el.key, { fontFamily: "default" })}>Padrão</button>
                                {COVER_FONTS.map((f) => <button key={f.id} type="button" className={btn(fam === f.id)} onClick={() => setTypo(el.key, { fontFamily: f.id })}>{f.label}</button>)}
                              </div>
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs text-muted-foreground">Peso</Label>
                              <div className="grid grid-cols-3 sm:grid-cols-6 gap-1">
                                <button type="button" className={btn(wt === "default")} onClick={() => setTypo(el.key, { fontWeight: "default" })}>Padrão</button>
                                {COVER_WEIGHTS.map((w) => <button key={w.value} type="button" className={btn(wt === w.value)} style={{ fontWeight: w.value }} onClick={() => setTypo(el.key, { fontWeight: w.value })}>{w.label}</button>)}
                              </div>
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs text-muted-foreground">Cor do texto</Label>
                              <div className="flex gap-2">
                                <Input type="color" aria-label={`Cor: ${el.label}`} value={st.color ?? (coverImage ? "#FFFFFF" : "#111827")} onChange={(e) => { setTypo(el.key, { color: e.target.value.toUpperCase() }); setHexDraft((d) => ({ ...d, [el.key]: e.target.value.toUpperCase() })); }} className="h-9 w-14 p-1 cursor-pointer" />
                                <Input type="text" placeholder="Padrão" value={draft} maxLength={7} onChange={(e) => { const v = e.target.value.trim(); setHexDraft((d) => ({ ...d, [el.key]: v })); if (!v) setTypo(el.key, { color: null }); else if (isValidHex(v)) setTypo(el.key, { color: v.toUpperCase() }); }} className="flex-1" />
                                <Button type="button" size="sm" variant="ghost" onClick={() => { setTypo(el.key, { color: null }); setHexDraft((d) => ({ ...d, [el.key]: "" })); }}>Padrão</Button>
                              </div>
                              {draft && !isValidHex(draft) && <p className="text-xs text-destructive">Use o formato #RRGGBB (ex.: #FFFFFF).</p>}
                            </div>
                          </div>
                        );
                      })}
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
                <p className="text-xs text-muted-foreground">O logotipo vem da identidade já cadastrada na loja.</p>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="contracapa">
              <AccordionTrigger>Contracapa</AccordionTrigger>
              <AccordionContent className="space-y-3">
                <p className="text-xs text-muted-foreground">Logo, nome, contatos (WhatsApp, loja online, e-mail e endereço cadastrados) e QR Code da sua loja ficam sempre nas mesmas posições.</p>
                <div className="space-y-1">
                  <Label>Fundo da contracapa</Label>
                  <RadioGroup value={backImage ? "custom" : backMode} onValueChange={(v) => { if (v === "default") { setBackImage(""); setBackWarn(null); } setBackMode(v as "default" | "custom"); }} className="grid grid-cols-2 gap-2">
                    <Label className="flex items-center gap-2 rounded-md border border-border p-2 cursor-pointer text-sm font-normal"><RadioGroupItem value="default" />Padrão</Label>
                    <Label className="flex items-center gap-2 rounded-md border border-border p-2 cursor-pointer text-sm font-normal"><RadioGroupItem value="custom" />Imagem personalizada</Label>
                  </RadioGroup>
                  {(backImage ? "custom" : backMode) === "default" ? (
                    <p className="text-xs text-muted-foreground">Fundo branco com detalhes discretos na cor da loja.</p>
                  ) : (
                    <div className="space-y-2">
                      <input ref={backInput} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void uploadBack(f); }} />
                      {backImage ? (
                        <div className="flex items-start gap-3">
                          <img src={backImage} alt="Contracapa personalizada" className="h-28 aspect-[210/297] object-cover rounded-md border border-border" />
                          <div className="flex flex-col gap-2">
                            <Button type="button" size="sm" variant="outline" disabled={backUploading} onClick={() => backInput.current?.click()}>Trocar imagem</Button>
                            <Button type="button" size="sm" variant="ghost" disabled={backUploading} onClick={() => { setBackImage(""); setBackWarn(null); setBackMode("default"); }}>Remover imagem</Button>
                          </div>
                        </div>
                      ) : (
                        <Button type="button" size="sm" variant="outline" disabled={backUploading} onClick={() => backInput.current?.click()}>
                          {backUploading && <Loader2 className="h-4 w-4 animate-spin" />} Enviar imagem
                        </Button>
                      )}
                      {backWarn && <p className="text-xs text-destructive flex gap-1 items-center"><AlertTriangle className="h-3 w-3" />{backWarn}</p>}
                      <div className="text-xs text-muted-foreground rounded-md bg-muted p-2 space-y-0.5">
                        <p className="font-medium text-foreground">Imagem recomendada para contracapa</p>
                        <p>Formato: A4 vertical · Proporção: 1:1,414</p>
                        <p>Recomendado: <b>2480 × 3508 px — 300 dpi</b></p>
                        <p>Mínimo recomendado: <b>1240 × 1754 px — 150 dpi</b></p>
                        <p>Formatos: <b>JPG, PNG ou WebP</b> (até 10 MB)</p>
                        <p>Mantenha textos, logos e elementos importantes afastados das bordas.</p>
                        <p>Imagens fora da proporção A4 poderão ser recortadas automaticamente para preencher toda a página.</p>
                      </div>
                    </div>
                  )}
                </div>
                <Accordion type="single" collapsible className="rounded-md border border-border px-3">
                  <AccordionItem value="tipografia-back" className="border-b-0">
                    <AccordionTrigger className="py-2 text-sm">Tipografia da contracapa</AccordionTrigger>
                    <AccordionContent className="space-y-4">
                      <p className="text-xs text-muted-foreground">"Padrão" mantém a aparência do modelo. As escolhas aparecem na prévia, no download e na publicação.</p>
                      {BACK_TEXT_ELEMENTS.map((el) => {
                        const st = backTypography[el.key] ?? {};
                        const fam = st.fontFamily ?? "default";
                        const wt = st.fontWeight ?? "default";
                        const draft = backHexDraft[el.key] ?? st.color ?? "";
                        const btn = (sel: boolean) => `rounded-md border px-2 py-1 text-xs ${sel ? "border-primary bg-primary/10 text-primary font-semibold" : "border-input"}`;
                        return (
                          <div key={el.key} className="space-y-2 border-t border-border pt-3 first:border-t-0 first:pt-0">
                            <p className="text-sm font-medium">{el.label}</p>
                            <div className="space-y-1">
                              <Label className="text-xs text-muted-foreground">Estilo da fonte</Label>
                              <div className="grid grid-cols-3 sm:grid-cols-5 gap-1">
                                <button type="button" className={btn(fam === "default")} onClick={() => setBackTypo(el.key, { fontFamily: "default" })}>Padrão</button>
                                {COVER_FONTS.map((f) => <button key={f.id} type="button" className={btn(fam === f.id)} onClick={() => setBackTypo(el.key, { fontFamily: f.id })}>{f.label}</button>)}
                              </div>
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs text-muted-foreground">Peso</Label>
                              <div className="grid grid-cols-3 sm:grid-cols-6 gap-1">
                                <button type="button" className={btn(wt === "default")} onClick={() => setBackTypo(el.key, { fontWeight: "default" })}>Padrão</button>
                                {COVER_WEIGHTS.map((w) => <button key={w.value} type="button" className={btn(wt === w.value)} style={{ fontWeight: w.value }} onClick={() => setBackTypo(el.key, { fontWeight: w.value })}>{w.label}</button>)}
                              </div>
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs text-muted-foreground">Cor do texto</Label>
                              <div className="flex gap-2">
                                <Input type="color" aria-label={`Cor: ${el.label}`} value={st.color ?? (backImage ? "#FFFFFF" : "#111827")} onChange={(e) => { setBackTypo(el.key, { color: e.target.value.toUpperCase() }); setBackHexDraft((d) => ({ ...d, [el.key]: e.target.value.toUpperCase() })); }} className="h-9 w-14 p-1 cursor-pointer" />
                                <Input type="text" placeholder="Padrão" value={draft} maxLength={7} onChange={(e) => { const v = e.target.value.trim(); setBackHexDraft((d) => ({ ...d, [el.key]: v })); if (!v) setBackTypo(el.key, { color: null }); else if (isValidHex(v)) setBackTypo(el.key, { color: v.toUpperCase() }); }} className="flex-1" />
                                <Button type="button" size="sm" variant="ghost" onClick={() => { setBackTypo(el.key, { color: null }); setBackHexDraft((d) => ({ ...d, [el.key]: "" })); }}>Padrão</Button>
                              </div>
                              {draft && !isValidHex(draft) && <p className="text-xs text-destructive">Use o formato #RRGGBB (ex.: #FFFFFF).</p>}
                            </div>
                          </div>
                        );
                      })}
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
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
                    {separators !== "compact" && doc && (() => {
                      // Só seções que realmente ganham página de abertura (mesmo critério do compositor).
                      const full = doc.sections.filter((s) => separators === "full" || s.productIds.length > AUTO_COMPACT_MAX);
                      if (!full.length) return null;
                      return (
                        <div className="space-y-3">
                          <Label>Imagem de cada seção</Label>
                          <input ref={sectionInput} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; const sid = sectionTarget.current; if (f && sid) void uploadSection(sid, f); }} />
                          {full.map((s) => {
                            const url = sectionImages[s.id] ?? "";
                            const custom = !!url || !!sectionCustom[s.id];
                            const busy = sectionBusy === s.id;
                            const pick = () => { sectionTarget.current = s.id; sectionInput.current?.click(); };
                            return (
                              <div key={s.id} className="space-y-2 rounded-md border border-border p-2">
                                <p className="text-xs font-medium">{s.title} <span className="text-muted-foreground">({s.productIds.length} {s.productIds.length === 1 ? "produto" : "produtos"})</span></p>
                                <RadioGroup value={custom ? "custom" : "default"} onValueChange={(v) => v === "default" ? setSectionDefault(s.id) : setSectionCustom((m) => ({ ...m, [s.id]: true }))} className="grid grid-cols-2 gap-2">
                                  <Label className="flex items-center gap-2 rounded-md border border-border p-2 cursor-pointer text-sm font-normal"><RadioGroupItem value="default" />Padrão</Label>
                                  <Label className="flex items-center gap-2 rounded-md border border-border p-2 cursor-pointer text-sm font-normal"><RadioGroupItem value="custom" />Imagem personalizada</Label>
                                </RadioGroup>
                                {!custom ? (
                                  <p className="text-xs text-muted-foreground">Fundo branco com a logo da loja discreta no canto superior esquerdo.</p>
                                ) : url ? (
                                  <div className="flex items-start gap-3">
                                    <img src={url} alt={`Imagem da seção ${s.title}`} className="h-16 object-cover rounded-md border border-border" style={{ aspectRatio: `${SEPARATOR_BAND.w}/${SEPARATOR_BAND.h}` }} />
                                    <div className="flex flex-col gap-2">
                                      <Button type="button" size="sm" variant="outline" disabled={busy} onClick={pick}>{busy && <Loader2 className="h-4 w-4 animate-spin" />}Trocar imagem</Button>
                                      <Button type="button" size="sm" variant="ghost" disabled={busy} onClick={() => setSectionDefault(s.id)}>Remover imagem</Button>
                                    </div>
                                  </div>
                                ) : (
                                  <Button type="button" size="sm" variant="outline" disabled={busy} onClick={pick}>{busy && <Loader2 className="h-4 w-4 animate-spin" />} Enviar imagem</Button>
                                )}
                                {custom && sectionWarn[s.id] && <p className="text-xs text-destructive flex gap-1 items-center"><AlertTriangle className="h-3 w-3" />{sectionWarn[s.id]}</p>}
                              </div>
                            );
                          })}
                          {full.some((s) => sectionImages[s.id] || sectionCustom[s.id]) && (
                            <div className="text-xs text-muted-foreground rounded-md bg-muted p-2 space-y-0.5">
                              <p className="font-medium text-foreground">Imagem recomendada para abertura da seção</p>
                              <p>Formato: horizontal · Proporção: {SEC_RATIO}:1</p>
                              <p>Recomendado: <b>{SEC_REC.w} × {SEC_REC.h} px — 300 dpi</b></p>
                              <p>Mínimo recomendado: <b>{SEC_MIN.w} × {SEC_MIN.h} px — 150 dpi</b></p>
                              <p>Formatos: <b>JPG, PNG ou WebP</b> (até 10 MB)</p>
                              <p>Mantenha textos, logos e elementos importantes afastados das bordas.</p>
                              <p>Imagens fora da proporção recomendada poderão ser recortadas automaticamente para preencher a área.</p>
                            </div>
                          )}
                        </div>
                      );
                    })()}
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
                    <div className="space-y-1">
                      <Label>Imagem da apresentação</Label>
                      <RadioGroup value={instImage ? "custom" : instMode} onValueChange={(v) => { if (v === "default") { setInstImage(""); setInstWarn(null); } setInstMode(v as "default" | "custom"); }} className="grid grid-cols-2 gap-2">
                        <Label className="flex items-center gap-2 rounded-md border border-border p-2 cursor-pointer text-sm font-normal"><RadioGroupItem value="default" />Padrão</Label>
                        <Label className="flex items-center gap-2 rounded-md border border-border p-2 cursor-pointer text-sm font-normal"><RadioGroupItem value="custom" />Imagem personalizada</Label>
                      </RadioGroup>
                      {(instImage ? "custom" : instMode) === "default" ? (
                        <p className="text-xs text-muted-foreground">Fundo branco com a logo da loja discreta no canto superior esquerdo.</p>
                      ) : (
                        <div className="space-y-2">
                          <input ref={instInput} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void uploadInst(f); }} />
                          {instImage ? (
                            <div className="flex items-start gap-3">
                              <img src={instImage} alt="Imagem da apresentação" className="h-16 object-cover rounded-md border border-border" style={{ aspectRatio: `${INSTITUTIONAL_BAND.w}/${INSTITUTIONAL_BAND.h}` }} />
                              <div className="flex flex-col gap-2">
                                <Button type="button" size="sm" variant="outline" disabled={instUploading} onClick={() => instInput.current?.click()}>Trocar imagem</Button>
                                <Button type="button" size="sm" variant="ghost" disabled={instUploading} onClick={() => { setInstImage(""); setInstWarn(null); setInstMode("default"); }}>Remover imagem</Button>
                              </div>
                            </div>
                          ) : (
                            <Button type="button" size="sm" variant="outline" disabled={instUploading} onClick={() => instInput.current?.click()}>
                              {instUploading && <Loader2 className="h-4 w-4 animate-spin" />} Enviar imagem
                            </Button>
                          )}
                          {instWarn && <p className="text-xs text-destructive flex gap-1 items-center"><AlertTriangle className="h-3 w-3" />{instWarn}</p>}
                          <div className="text-xs text-muted-foreground rounded-md bg-muted p-2 space-y-0.5">
                            <p className="font-medium text-foreground">Imagem recomendada para apresentação</p>
                            <p>Formato: horizontal · Proporção: {INST_RATIO}:1</p>
                            <p>Recomendado: <b>{INST_REC.w} × {INST_REC.h} px — 300 dpi</b></p>
                            <p>Mínimo recomendado: <b>{INST_MIN.w} × {INST_MIN.h} px — 150 dpi</b></p>
                            <p>Formatos: <b>JPG, PNG ou WebP</b> (até 10 MB)</p>
                            <p>Mantenha logos, textos e elementos importantes afastados das bordas.</p>
                            <p>Imagens fora da proporção recomendada poderão ser recortadas automaticamente para preencher a área.</p>
                          </div>
                        </div>
                      )}
                    </div>
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
            <Button onClick={refreshPreview} disabled={generating || previewLoading || persistence.status === "conflict" || !doc || doc.products.length === 0 || blocking.length > 0} className="gap-2">
              {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              {bytes || persistence.record?.preview ? "Atualizar prévia" : "Gerar prévia"}
            </Button>
            <Button variant="outline" onClick={downloadTest} disabled={!bytes || stale || generating} className="gap-2">
              <Download className="h-4 w-4" /> Baixar PDF
            </Button>
            <Button variant="secondary" onClick={() => setConfirmOpen(true)} disabled={!bytes || stale || generating || publishing || !baseline} className="gap-2">
              {publishing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Publicar catálogo
            </Button>
          </div>
          {noImageIds.length > 0 && (
            <div className="rounded-md border border-border p-2 text-xs space-y-2">
              <p className="flex gap-1"><AlertTriangle className="h-4 w-4 shrink-0 text-muted-foreground" />{noImageIds.length} produto(s) selecionado(s) sem nenhuma imagem cadastrada. Eles aparecem com a imagem padrão.</p>
              <label className="flex items-center gap-2 cursor-pointer">
                <Checkbox checked={excludeNoImage} onCheckedChange={(c) => setExcludeNoImage(!!c)} />
                Deixar esses produtos fora deste catálogo (o cadastro não é alterado)
              </label>
            </div>
          )}
          {progress && <p className="text-xs text-muted-foreground flex gap-1 items-center"><Loader2 className="h-3 w-3 animate-spin" />{progress}</p>}
          {publishError && <p className="text-xs text-destructive">{publishError}</p>}
          {publishedUrl && (
            <div className="rounded-md border border-border p-2 text-xs space-y-1">
              <p className="flex gap-1 items-center font-medium"><CheckCircle2 className="h-4 w-4 text-primary" />Publicado. O link da sua loja já abre este catálogo:</p>
              <div className="flex gap-2 items-center">
                <code className="truncate">{publishedUrl}</code>
                <Button size="icon" variant="ghost" aria-label="Copiar link" onClick={() => navigator.clipboard.writeText(publishedUrl).then(() => toast.success("Link copiado!"))}><Copy className="h-4 w-4" /></Button>
              </div>
            </div>
          )}
          <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{baseline?.hasCurrent ? "Substituir o catálogo publicado?" : "Publicar o primeiro catálogo?"}</AlertDialogTitle>
                <AlertDialogDescription>
                  {baseline?.hasCurrent
                    ? "Este catálogo substituirá o catálogo atualmente acessado pelo link compartilhável da sua loja. Deseja continuar?"
                    : "Esta será a primeira publicação de catálogo da sua loja. Ela passará a ser aberta pelo link compartilhável da loja. Deseja continuar?"}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={publish}>Publicar</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          {blocking.length > 0 && <p className="text-xs text-destructive flex gap-1"><AlertTriangle className="h-4 w-4 shrink-0" />Corrija os campos destacados para gerar a prévia.</p>}
          {stale && <p className="text-xs text-muted-foreground">Há alterações desde a última prévia. Atualize a prévia para visualizar as alterações mais recentes.</p>}
          {freshnessError && <p className="text-xs text-destructive">Não foi possível verificar as alterações dos produtos. Atualize a prévia antes de publicar.</p>}
          {genError && <p className="text-xs text-destructive">{genError}</p>}
          {persistence.record?.preview && !bytes && !previewLoading && <Button size="sm" variant="outline" onClick={() => setPreviewLoadAttempt((n) => n + 1)}>Carregar última prévia</Button>}
          {previewLoading && <p className="text-xs text-muted-foreground">Carregando última prévia…</p>}
          {persistence.record?.preview && <p className="text-xs text-muted-foreground">Última prévia: {new Date(persistence.record.preview.generated_at).toLocaleString("pt-BR")}</p>}
          <p className="text-xs text-muted-foreground">Prévia e download não alteram o catálogo público. Só “Publicar catálogo” atualiza o link da loja.</p>
        </CardHeader>
        <CardContent className="space-y-3">
          {!bytes && !generating && <div className="aspect-[210/297] rounded-md border border-dashed border-border flex items-center justify-center text-sm text-muted-foreground p-6 text-center">Configure o catálogo e clique em “Gerar prévia”.</div>}
          {generating && !bytes && <div className="aspect-[210/297] rounded-md border border-border flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>}
          {bytes && (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex min-w-0 flex-1 basis-60 items-center gap-1">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button size="icon" variant="outline" aria-label="Ir para a primeira página" disabled={!Number.isInteger(pageCount) || pageCount <= 0 || page <= 1} onClick={() => { if (Number.isInteger(pageCount) && pageCount > 0) setPage(1); }}>
                      <ChevronsLeft className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Ir para a primeira página</TooltipContent>
                </Tooltip>
                <Button size="icon" variant="outline" aria-label="Página anterior" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}><ChevronLeft className="h-4 w-4" /></Button>
                <span className="min-w-0 flex-1 text-center text-sm">Página {page} de {pageCount}</span>
                <Button size="icon" variant="outline" aria-label="Próxima página" disabled={page >= pageCount} onClick={() => setPage((p) => p + 1)}><ChevronRight className="h-4 w-4" /></Button>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button size="icon" variant="outline" aria-label="Ir para a última página" disabled={!Number.isInteger(pageCount) || pageCount <= 0 || page >= pageCount} onClick={() => { if (Number.isInteger(pageCount) && pageCount > 0) setPage(pageCount); }}>
                      <ChevronsRight className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Ir para a última página</TooltipContent>
                </Tooltip>
                </div>
                <div className="ml-auto flex shrink-0 gap-1">
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
