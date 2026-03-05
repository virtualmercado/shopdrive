import { useState, useCallback } from "react";
import AdminLayout from "@/components/layout/AdminLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Play, CheckCircle2, XCircle, AlertTriangle, ImageIcon, Trash2, Wrench,
  Loader2, FileWarning, Ghost, Package, ChevronDown, Map, Copy, Database,
  Users, Palette, LayoutTemplate, Megaphone, FolderArchive,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

// ─── Types ───

interface ImageRef {
  entity: string;
  entityId: string;
  entityName: string;
  table: string;
  column: string;
  rowId?: string;
  url: string;
}

interface ValidationResult {
  url: string;
  objectKey: string;
  exists: boolean;
  size: number | null;
  contentType: string | null;
  error: string | null;
}

interface StorageObject {
  key: string;
  size: number;
  lastModified: string;
}

interface StorageMapEntry {
  table: string;
  column: string;
  type: string;
  entity: string;
  sample: string | null;
  count: number;
}

interface AuditReport {
  totalEntities: number;
  entitiesWithImages: number;
  entitiesWithoutImages: number;
  totalRefsInDb: number;
  totalRefsValid: number;
  brokenRefs: Array<ImageRef & { error?: string }>;
  base64Refs: ImageRef[];
  localRefs: ImageRef[];
  fullUrlRefs: ImageRef[];
  orphanObjects: StorageObject[];
  oversizedObjects: Array<{ ref: ImageRef; size: number }>;
  duplicateRefs: Array<{ url: string; refs: ImageRef[] }>;
  allStorageObjects: number;
  entityBreakdown: Record<string, { total: number; ok: number; problems: number }>;
}

const EMPTY_REPORT: AuditReport = {
  totalEntities: 0, entitiesWithImages: 0, entitiesWithoutImages: 0,
  totalRefsInDb: 0, totalRefsValid: 0, brokenRefs: [], base64Refs: [],
  localRefs: [], fullUrlRefs: [], orphanObjects: [], oversizedObjects: [],
  duplicateRefs: [], allStorageObjects: 0, entityBreakdown: {},
};

const MAX_SIZE_BYTES = 10 * 1024 * 1024;

// ─── Storage Map Definition ───

const STORAGE_MAP_DEFINITION: Array<{
  table: string; columns: Array<{ col: string; type: string }>; entity: string; entityIcon: React.ElementType;
  nameCol: string; idCol: string;
}> = [
  {
    table: "products", entity: "Produto", entityIcon: Package, nameCol: "name", idCol: "id",
    columns: [
      { col: "image_url", type: "text" },
      { col: "images", type: "jsonb (array)" },
    ],
  },
  {
    table: "product_images", entity: "Produto (galeria)", entityIcon: ImageIcon, nameCol: "product_id", idCol: "id",
    columns: [{ col: "image_url", type: "text" }],
  },
  {
    table: "product_brands", entity: "Marca", entityIcon: Palette, nameCol: "name", idCol: "id",
    columns: [{ col: "logo_url", type: "text" }],
  },
  {
    table: "profiles", entity: "Lojista", entityIcon: Users, nameCol: "store_name", idCol: "id",
    columns: [
      { col: "store_logo_url", type: "text" },
      { col: "banner_desktop_url", type: "text" },
      { col: "banner_desktop_urls", type: "jsonb (array)" },
      { col: "banner_mobile_url", type: "text" },
      { col: "banner_mobile_urls", type: "jsonb (array)" },
      { col: "banner_rect_1_url", type: "text" },
      { col: "banner_rect_2_url", type: "text" },
      { col: "minibanner_1_img2_url", type: "text" },
      { col: "minibanner_2_img2_url", type: "text" },
    ],
  },
  {
    table: "brand_templates", entity: "Template", entityIcon: LayoutTemplate, nameCol: "name", idCol: "id",
    columns: [
      { col: "logo_url", type: "text" },
      { col: "banner_desktop_urls", type: "jsonb" },
      { col: "banner_mobile_urls", type: "jsonb" },
    ],
  },
  {
    table: "cms_banners", entity: "CMS", entityIcon: Megaphone, nameCol: "name", idCol: "id",
    columns: [{ col: "media_url", type: "text" }],
  },
  {
    table: "media_files", entity: "Mídia", entityIcon: FolderArchive, nameCol: "original_name", idCol: "id",
    columns: [
      { col: "url", type: "text" },
      { col: "file_path", type: "text" },
    ],
  },
];

// ─── Helpers ───

function classifyUrl(url: string): "base64" | "local" | "full_url" | "key_path" | "unknown" {
  if (!url || typeof url !== "string") return "unknown";
  if (url.startsWith("data:image")) return "base64";
  if (url.includes("localhost") || url.includes("127.0.0.1") || url.startsWith("blob:") || url.startsWith("file:") || url.startsWith("/uploads")) return "local";
  if (url.startsWith("http://") || url.startsWith("https://")) return "full_url";
  if (url.match(/^[a-zA-Z0-9_\-/]+\.[a-zA-Z]{2,5}$/)) return "key_path";
  return "unknown";
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(2) + " MB";
}

function truncate(str: string, max = 80): string {
  return str.length > max ? str.slice(0, max) + "…" : str;
}

// ─── Paginated fetch helper ───

async function fetchAll<T>(table: string, select: string): Promise<T[]> {
  const PAGE_SIZE = 500;
  const all: T[] = [];
  let page = 0;
  let hasMore = true;
  while (hasMore) {
    const { data, error } = await (supabase.from as any)(table).select(select).range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
    if (error) throw error;
    if (data) all.push(...(data as T[]));
    hasMore = (data?.length || 0) === PAGE_SIZE;
    page++;
  }
  return all;
}

// ─── Extract refs from a row ───

function extractRefs(
  row: Record<string, unknown>,
  tableDef: typeof STORAGE_MAP_DEFINITION[0],
): ImageRef[] {
  const refs: ImageRef[] = [];
  const entityId = String(row[tableDef.idCol] || "");
  const entityName = String(row[tableDef.nameCol] || "—");

  for (const colDef of tableDef.columns) {
    const val = row[colDef.col];
    if (!val) continue;

    if (colDef.type.includes("array") || colDef.type === "jsonb") {
      const arr = Array.isArray(val) ? val : [];
      for (const item of arr) {
        if (typeof item === "string" && item.trim()) {
          refs.push({
            entity: tableDef.entity, entityId, entityName,
            table: tableDef.table, column: colDef.col,
            rowId: tableDef.table === "product_images" ? entityId : undefined,
            url: item.trim(),
          });
        }
      }
    } else if (typeof val === "string" && val.trim()) {
      refs.push({
        entity: tableDef.entity, entityId, entityName,
        table: tableDef.table, column: colDef.col,
        rowId: tableDef.table === "product_images" ? entityId : undefined,
        url: val.trim(),
      });
    }
  }
  return refs;
}

// ─── Component ───

const AdminImageAudit = () => {
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressLabel, setProgressLabel] = useState("");
  const [report, setReport] = useState<AuditReport | null>(null);
  const [confirmOrphans, setConfirmOrphans] = useState(false);
  const [fixing, setFixing] = useState(false);
  const [storageMap, setStorageMap] = useState<StorageMapEntry[]>([]);
  const [mapOpen, setMapOpen] = useState(true);
  const [mapLoading, setMapLoading] = useState(false);

  // ── Load storage map samples ──
  const loadStorageMap = useCallback(async () => {
    setMapLoading(true);
    try {
      const entries: StorageMapEntry[] = [];
      for (const def of STORAGE_MAP_DEFINITION) {
        const selectCols = [def.idCol, ...def.columns.map(c => c.col)].join(", ");
        const { data, error, count } = await (supabase.from as any)(def.table)
          .select(selectCols, { count: "exact" })
          .limit(1);

        if (error) {
          for (const col of def.columns) {
            entries.push({ table: def.table, column: col.col, type: col.type, entity: def.entity, sample: null, count: 0 });
          }
          continue;
        }

        const row = data?.[0] as Record<string, unknown> | undefined;
        for (const col of def.columns) {
          let sample: string | null = null;
          if (row) {
            const v = row[col.col];
            if (typeof v === "string") sample = truncate(v, 60);
            else if (Array.isArray(v) && v.length > 0) sample = truncate(String(v[0]), 60);
            else if (v && typeof v === "object") sample = truncate(JSON.stringify(v), 60);
          }
          entries.push({ table: def.table, column: col.col, type: col.type, entity: def.entity, sample, count: count || 0 });
        }
      }
      setStorageMap(entries);
    } catch (err) {
      toast({ title: "Erro ao carregar mapa", description: String(err), variant: "destructive" });
    } finally {
      setMapLoading(false);
    }
  }, []);

  // ── Run full audit ──
  const runAudit = useCallback(async () => {
    setRunning(true);
    setProgress(0);

    try {
      const allRefs: ImageRef[] = [];
      const totalPhases = STORAGE_MAP_DEFINITION.length;

      // ── Phase 1-N: Fetch each table ──
      for (let idx = 0; idx < totalPhases; idx++) {
        const def = STORAGE_MAP_DEFINITION[idx];
        setProgressLabel(`Carregando ${def.entity}...`);
        setProgress(Math.round((idx / totalPhases) * 25));

        try {
          const selectCols = [def.idCol, def.nameCol, ...def.columns.map(c => c.col)]
            .filter((v, i, a) => a.indexOf(v) === i).join(", ");
          const rows = await fetchAll<Record<string, unknown>>(def.table, selectCols);
          for (const row of rows) {
            allRefs.push(...extractRefs(row, def));
          }
        } catch {
          // Table may not exist or have permission issues, skip
        }
      }

      setProgress(25);
      setProgressLabel("Classificando referências...");

      // ── Classify ──
      const base64Refs: ImageRef[] = [];
      const localRefs: ImageRef[] = [];
      const fullUrlRefs: ImageRef[] = [];
      const validUrls: ImageRef[] = [];

      for (const ref of allRefs) {
        const cls = classifyUrl(ref.url);
        if (cls === "base64") base64Refs.push(ref);
        else if (cls === "local") localRefs.push(ref);
        else if (cls === "full_url") { fullUrlRefs.push(ref); validUrls.push(ref); }
        else { validUrls.push(ref); }
      }

      // ── Duplicate detection ──
      const urlCount = new Map<string, ImageRef[]>();
      for (const ref of allRefs) {
        if (ref.url.startsWith("data:")) continue;
        const existing = urlCount.get(ref.url) || [];
        existing.push(ref);
        urlCount.set(ref.url, existing);
      }
      const duplicateRefs = Array.from(urlCount.entries())
        .filter(([, refs]) => refs.length > 1)
        .map(([url, refs]) => ({ url, refs }));

      // ── Entity breakdown ──
      const entityBreakdown: Record<string, { total: number; ok: number; problems: number }> = {};
      const entityIdSets = new Map<string, Set<string>>();
      for (const ref of allRefs) {
        if (!entityIdSets.has(ref.entity)) entityIdSets.set(ref.entity, new Set());
        entityIdSets.get(ref.entity)!.add(ref.entityId);
      }
      for (const [entity, ids] of entityIdSets) {
        entityBreakdown[entity] = { total: ids.size, ok: 0, problems: 0 };
      }

      setProgress(30);
      setProgressLabel("Validando URLs no storage...");

      // ── Validate via edge function ──
      const brokenRefs: Array<ImageRef & { error?: string }> = [];
      const oversized: Array<{ ref: ImageRef; size: number }> = [];
      const validatedKeys = new Set<string>();
      let validCount = 0;
      const BATCH_SIZE = 50;

      for (let i = 0; i < validUrls.length; i += BATCH_SIZE) {
        const batch = validUrls.slice(i, i + BATCH_SIZE);
        try {
          const { data, error } = await supabase.functions.invoke("audit-images", {
            body: { action: "validate_urls", urls: batch.map(r => r.url) },
          });
          if (error) throw error;
          const results: ValidationResult[] = data?.results || [];
          for (let j = 0; j < results.length; j++) {
            const res = results[j];
            if (res.objectKey) validatedKeys.add(res.objectKey);
            if (!res.exists) {
              brokenRefs.push({ ...batch[j], error: res.error || "not_found" });
            } else {
              validCount++;
              if (res.size && res.size > MAX_SIZE_BYTES) oversized.push({ ref: batch[j], size: res.size });
            }
          }
        } catch {
          for (const ref of batch) brokenRefs.push({ ...ref, error: "batch_error" });
        }
        setProgress(30 + Math.round(((i + BATCH_SIZE) / Math.max(validUrls.length, 1)) * 40));
        setProgressLabel(`Validando ${Math.min(i + BATCH_SIZE, validUrls.length)}/${validUrls.length} URLs...`);
      }

      setProgress(75);
      setProgressLabel("Buscando objetos no storage...");

      // ── Orphan detection ──
      let storageObjects: StorageObject[] = [];
      try {
        const { data, error } = await supabase.functions.invoke("audit-images", { body: { action: "list_storage_objects" } });
        if (!error && data?.objects) storageObjects = data.objects;
      } catch { /* non-critical */ }

      const orphanObjects = storageObjects.filter(obj => !validatedKeys.has(obj.key));

      // ── Entity breakdown counts ──
      const brokenEntityIds = new Set(brokenRefs.map(r => `${r.entity}:${r.entityId}`));
      const problemEntityIds = new Set([
        ...brokenRefs.map(r => `${r.entity}:${r.entityId}`),
        ...base64Refs.map(r => `${r.entity}:${r.entityId}`),
        ...localRefs.map(r => `${r.entity}:${r.entityId}`),
      ]);

      for (const [entity, data] of Object.entries(entityBreakdown)) {
        const ids = entityIdSets.get(entity)!;
        let problems = 0;
        for (const id of ids) {
          if (problemEntityIds.has(`${entity}:${id}`)) problems++;
        }
        data.problems = problems;
        data.ok = data.total - problems;
      }

      setProgress(100);
      setProgressLabel("Auditoria concluída!");

      setReport({
        totalEntities: allRefs.length > 0 ? new Set(allRefs.map(r => `${r.entity}:${r.entityId}`)).size : 0,
        entitiesWithImages: new Set(allRefs.map(r => `${r.entity}:${r.entityId}`)).size,
        entitiesWithoutImages: 0,
        totalRefsInDb: allRefs.length,
        totalRefsValid: validCount,
        brokenRefs, base64Refs, localRefs, fullUrlRefs,
        orphanObjects, oversizedObjects: oversized, duplicateRefs,
        allStorageObjects: storageObjects.length,
        entityBreakdown,
      });

      // Load storage map alongside
      if (storageMap.length === 0) await loadStorageMap();

    } catch (err) {
      toast({ title: "Erro na auditoria", description: String(err), variant: "destructive" });
    } finally {
      setRunning(false);
    }
  }, [storageMap.length, loadStorageMap]);

  const handleFixPaths = async () => {
    if (!report || report.fullUrlRefs.length === 0) {
      toast({ title: "Correção de paths", description: "Nenhuma URL completa encontrada para normalizar." });
      return;
    }
    setFixing(true);
    try {
      const fixes = report.fullUrlRefs.slice(0, 500).map(ref => ({
        table: ref.table === "product_images" ? "product_images" : ref.table,
        id: ref.rowId || ref.entityId,
        field: ref.column,
        oldValue: ref.url,
        newValue: ref.url, // edge function will extract key
      }));

      const { data, error } = await supabase.functions.invoke("audit-images", {
        body: { action: "fix_paths", urls: fixes },
      });
      if (error) throw error;
      toast({ title: "Paths corrigidos", description: `${data?.fixed || 0} referência(s) normalizada(s).` });
    } catch (err) {
      toast({ title: "Erro ao corrigir paths", description: String(err), variant: "destructive" });
    } finally {
      setFixing(false);
    }
  };

  const handleDeleteOrphans = async () => {
    if (!report || report.orphanObjects.length === 0) return;
    setFixing(true);
    try {
      const { data, error } = await supabase.functions.invoke("audit-images", {
        body: { action: "delete_orphans", orphanKeys: report.orphanObjects.map(o => o.key) },
      });
      if (error) throw error;
      toast({ title: "Órfãs removidas", description: `${data?.deleted || 0} arquivo(s) removido(s).` });
      setReport(prev => prev ? { ...prev, orphanObjects: [] } : prev);
    } catch (err) {
      toast({ title: "Erro ao remover órfãs", description: String(err), variant: "destructive" });
    } finally {
      setFixing(false);
      setConfirmOrphans(false);
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h2 className="text-xl font-semibold text-foreground">Auditoria de Imagens</h2>
            <p className="text-sm text-muted-foreground">
              Valida integridade entre referências no banco e arquivos no storage de imagens
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={loadStorageMap} disabled={mapLoading}>
              {mapLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Map className="h-4 w-4 mr-2" />}
              Mapa de Armazenamento
            </Button>
            <Button onClick={runAudit} disabled={running} size="lg">
              {running ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Play className="h-4 w-4 mr-2" />}
              {running ? "Executando..." : "Executar Auditoria"}
            </Button>
          </div>
        </div>

        {/* Storage Map */}
        {storageMap.length > 0 && (
          <Collapsible open={mapOpen} onOpenChange={setMapOpen}>
            <Card>
              <CollapsibleTrigger asChild>
                <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Database className="h-5 w-5 text-primary" />
                      <CardTitle className="text-base">Mapa de Armazenamento de Imagens</CardTitle>
                    </div>
                    <ChevronDown className={`h-4 w-4 transition-transform ${mapOpen ? "rotate-180" : ""}`} />
                  </div>
                  <CardDescription>
                    {storageMap.length} campos de imagem detectados em {new Set(storageMap.map(e => e.table)).size} tabelas
                  </CardDescription>
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent>
                  <div className="overflow-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Tabela</TableHead>
                          <TableHead>Coluna</TableHead>
                          <TableHead>Tipo</TableHead>
                          <TableHead>Entidade</TableHead>
                          <TableHead>Registros</TableHead>
                          <TableHead>Amostra</TableHead>
                          <TableHead>Formato</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {storageMap.map((entry, i) => {
                          const cls = entry.sample ? classifyUrl(entry.sample) : "unknown";
                          return (
                            <TableRow key={i}>
                              <TableCell className="font-mono text-xs">{entry.table}</TableCell>
                              <TableCell className="font-mono text-xs">{entry.column}</TableCell>
                              <TableCell><Badge variant="outline">{entry.type}</Badge></TableCell>
                              <TableCell>{entry.entity}</TableCell>
                              <TableCell>{entry.count}</TableCell>
                              <TableCell className="max-w-[200px] truncate text-xs font-mono text-muted-foreground">
                                {entry.sample || "—"}
                              </TableCell>
                              <TableCell>
                                <Badge variant={
                                  cls === "full_url" ? "secondary" :
                                  cls === "key_path" ? "default" :
                                  cls === "base64" ? "destructive" :
                                  cls === "local" ? "destructive" : "outline"
                                }>
                                  {cls === "full_url" ? "URL completa" :
                                   cls === "key_path" ? "key/path ✓" :
                                   cls === "base64" ? "base64 ⚠" :
                                   cls === "local" ? "local ⚠" : "—"}
                                </Badge>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>
        )}

        {/* Progress */}
        {running && (
          <Card>
            <CardContent className="pt-6">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{progressLabel}</span>
                  <span className="font-medium">{progress}%</span>
                </div>
                <Progress value={progress} />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Summary Cards */}
        {report && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <SummaryCard icon={Package} label="Total de Entidades" value={report.totalEntities} />
              <SummaryCard icon={ImageIcon} label="Referências no Banco" value={report.totalRefsInDb} />
              <SummaryCard icon={CheckCircle2} label="Confirmadas no Storage" value={report.totalRefsValid} variant="success" />
              <SummaryCard icon={XCircle} label="Referências Quebradas" value={report.brokenRefs.length} variant={report.brokenRefs.length > 0 ? "danger" : "success"} />
              <SummaryCard icon={FileWarning} label="Base64 / Local" value={report.base64Refs.length + report.localRefs.length} variant={report.base64Refs.length + report.localRefs.length > 0 ? "warning" : "success"} />
              <SummaryCard icon={AlertTriangle} label="URLs Completas" value={report.fullUrlRefs.length} variant={report.fullUrlRefs.length > 0 ? "warning" : "success"} />
              <SummaryCard icon={Ghost} label="Órfãs no Storage" value={report.orphanObjects.length} variant={report.orphanObjects.length > 0 ? "warning" : "success"} />
              <SummaryCard icon={Copy} label="Duplicadas" value={report.duplicateRefs.length} variant={report.duplicateRefs.length > 0 ? "warning" : "success"} />
            </div>

            {/* Entity breakdown */}
            {Object.keys(report.entityBreakdown).length > 0 && (
              <Card>
                <CardHeader><CardTitle className="text-base">Resumo por Entidade</CardTitle></CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                    {Object.entries(report.entityBreakdown).map(([entity, data]) => (
                      <div key={entity} className="flex items-center gap-2 p-3 rounded-lg border bg-card">
                        <div className="min-w-0 flex-1">
                          <p className="text-xs text-muted-foreground">{entity}</p>
                          <p className="text-sm font-medium">{data.total} total · <span className="text-green-600">{data.ok} OK</span>
                            {data.problems > 0 && <> · <span className="text-destructive">{data.problems} com problema</span></>}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Action buttons */}
            <div className="flex gap-3 flex-wrap">
              <Button variant="outline" onClick={handleFixPaths} disabled={fixing || report.fullUrlRefs.length === 0}>
                <Wrench className="h-4 w-4 mr-2" />
                Normalizar URLs ({report.fullUrlRefs.length})
              </Button>
              <Button variant="destructive" onClick={() => setConfirmOrphans(true)} disabled={fixing || report.orphanObjects.length === 0}>
                <Trash2 className="h-4 w-4 mr-2" />
                Remover Órfãs ({report.orphanObjects.length})
              </Button>
            </div>

            {/* Detail Tabs */}
            <Tabs defaultValue="broken" className="space-y-4">
              <TabsList className="flex-wrap h-auto gap-1">
                <TabsTrigger value="broken">Quebradas ({report.brokenRefs.length})</TabsTrigger>
                <TabsTrigger value="base64">Base64/Local ({report.base64Refs.length + report.localRefs.length})</TabsTrigger>
                <TabsTrigger value="fullurl">URLs Completas ({report.fullUrlRefs.length})</TabsTrigger>
                <TabsTrigger value="orphans">Órfãs ({report.orphanObjects.length})</TabsTrigger>
                <TabsTrigger value="duplicates">Duplicadas ({report.duplicateRefs.length})</TabsTrigger>
                <TabsTrigger value="oversized">Acima de 10 MB ({report.oversizedObjects.length})</TabsTrigger>
              </TabsList>

              <TabsContent value="broken">
                <DetailTable
                  title="Referências Quebradas"
                  empty="Nenhuma referência quebrada encontrada."
                  items={report.brokenRefs}
                  columns={["Entidade", "Nome", "Tabela.Coluna", "URL / Path", "Erro"]}
                  renderRow={(ref, i) => (
                    <TableRow key={i}>
                      <TableCell><Badge variant="outline">{ref.entity}</Badge></TableCell>
                      <TableCell className="font-medium max-w-[120px] truncate">{ref.entityName}</TableCell>
                      <TableCell className="text-xs font-mono">{ref.table}.{ref.column}</TableCell>
                      <TableCell className="max-w-[250px] truncate text-xs font-mono">{ref.url}</TableCell>
                      <TableCell><Badge variant="destructive">{ref.error}</Badge></TableCell>
                    </TableRow>
                  )}
                />
              </TabsContent>

              <TabsContent value="base64">
                <DetailTable
                  title="Base64 / URL Local"
                  empty="Nenhuma referência base64 ou local encontrada."
                  items={[...report.base64Refs, ...report.localRefs]}
                  columns={["Entidade", "Nome", "Tabela.Coluna", "Tipo", "Valor (truncado)"]}
                  renderRow={(ref, i) => (
                    <TableRow key={i}>
                      <TableCell><Badge variant="outline">{ref.entity}</Badge></TableCell>
                      <TableCell className="font-medium max-w-[120px] truncate">{ref.entityName}</TableCell>
                      <TableCell className="text-xs font-mono">{ref.table}.{ref.column}</TableCell>
                      <TableCell>
                        <Badge variant={ref.url.startsWith("data:") ? "destructive" : "secondary"}>
                          {ref.url.startsWith("data:") ? "base64" : "local"}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-[250px] truncate text-xs font-mono">{truncate(ref.url)}</TableCell>
                    </TableRow>
                  )}
                />
              </TabsContent>

              <TabsContent value="fullurl">
                <DetailTable
                  title="URLs Completas (para normalização)"
                  empty="Nenhuma URL completa encontrada."
                  items={report.fullUrlRefs.slice(0, 200)}
                  columns={["Entidade", "Nome", "Tabela.Coluna", "URL"]}
                  renderRow={(ref, i) => (
                    <TableRow key={i}>
                      <TableCell><Badge variant="outline">{ref.entity}</Badge></TableCell>
                      <TableCell className="font-medium max-w-[120px] truncate">{ref.entityName}</TableCell>
                      <TableCell className="text-xs font-mono">{ref.table}.{ref.column}</TableCell>
                      <TableCell className="max-w-[350px] truncate text-xs font-mono">{ref.url}</TableCell>
                    </TableRow>
                  )}
                />
              </TabsContent>

              <TabsContent value="orphans">
                <DetailTable
                  title="Órfãs no Storage de Imagens"
                  empty="Nenhuma imagem órfã encontrada."
                  items={report.orphanObjects}
                  columns={["Key / Path", "Tamanho", "Última modificação"]}
                  renderRow={(obj, i) => (
                    <TableRow key={i}>
                      <TableCell className="max-w-[400px] truncate text-xs font-mono">{obj.key}</TableCell>
                      <TableCell>{formatBytes(obj.size)}</TableCell>
                      <TableCell className="text-xs">{obj.lastModified ? new Date(obj.lastModified).toLocaleString("pt-BR") : "—"}</TableCell>
                    </TableRow>
                  )}
                />
              </TabsContent>

              <TabsContent value="duplicates">
                <Card>
                  <CardHeader><CardTitle className="text-base">URLs Duplicadas</CardTitle></CardHeader>
                  <CardContent>
                    {report.duplicateRefs.length === 0 ? (
                      <EmptyState message="Nenhuma URL duplicada encontrada." />
                    ) : (
                      <div className="overflow-auto max-h-[500px] space-y-4">
                        {report.duplicateRefs.slice(0, 50).map((dup, i) => (
                          <div key={i} className="border rounded-lg p-3 space-y-2">
                            <p className="text-xs font-mono text-muted-foreground truncate">{truncate(dup.url, 100)}</p>
                            <div className="flex flex-wrap gap-1">
                              {dup.refs.map((ref, j) => (
                                <Badge key={j} variant="secondary" className="text-xs">
                                  {ref.entity}: {ref.entityName} ({ref.table}.{ref.column})
                                </Badge>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="oversized">
                <DetailTable
                  title="Imagens acima de 10 MB"
                  empty="Nenhuma imagem acima do limite."
                  items={report.oversizedObjects}
                  columns={["Entidade", "Nome", "URL", "Tamanho"]}
                  renderRow={(item, i) => (
                    <TableRow key={i}>
                      <TableCell><Badge variant="outline">{item.ref.entity}</Badge></TableCell>
                      <TableCell className="font-medium max-w-[120px] truncate">{item.ref.entityName}</TableCell>
                      <TableCell className="max-w-[300px] truncate text-xs font-mono">{item.ref.url}</TableCell>
                      <TableCell><Badge variant="destructive">{formatBytes(item.size)}</Badge></TableCell>
                    </TableRow>
                  )}
                />
              </TabsContent>
            </Tabs>
          </>
        )}

        {/* Empty state */}
        {!report && !running && (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <ImageIcon className="h-12 w-12 text-muted-foreground/40 mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-1">Nenhuma auditoria executada</h3>
              <p className="text-sm text-muted-foreground max-w-md">
                Clique em "Executar Auditoria" para verificar a integridade de todas as imagens entre o banco de dados e o storage de imagens.
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Confirm orphan deletion */}
      <AlertDialog open={confirmOrphans} onOpenChange={setConfirmOrphans}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover imagens órfãs?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação removerá permanentemente <strong>{report?.orphanObjects.length || 0}</strong> arquivo(s) do storage que não estão referenciados no banco. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteOrphans} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {fixing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Trash2 className="h-4 w-4 mr-2" />}
              Confirmar Remoção
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminLayout>
  );
};

// ─── Sub-components ───

function SummaryCard({ icon: Icon, label, value, variant = "default" }: {
  icon: React.ElementType; label: string; value: number; variant?: "default" | "success" | "warning" | "danger";
}) {
  const colors = { default: "text-foreground", success: "text-green-600", warning: "text-amber-600", danger: "text-destructive" };
  return (
    <Card>
      <CardContent className="pt-4 pb-4 px-4">
        <div className="flex items-center gap-3">
          <Icon className={`h-5 w-5 ${colors[variant]} flex-shrink-0`} />
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground truncate">{label}</p>
            <p className={`text-xl font-bold ${colors[variant]}`}>{value}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex items-center gap-2 py-8 justify-center text-muted-foreground">
      <CheckCircle2 className="h-5 w-5 text-green-500" />
      <span className="text-sm">{message}</span>
    </div>
  );
}

function DetailTable<T>({ title, empty, items, columns, renderRow }: {
  title: string; empty: string; items: T[]; columns: string[]; renderRow: (item: T, i: number) => React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">{title}</CardTitle></CardHeader>
      <CardContent>
        {items.length === 0 ? <EmptyState message={empty} /> : (
          <div className="overflow-auto max-h-[500px]">
            <Table>
              <TableHeader>
                <TableRow>{columns.map(c => <TableHead key={c}>{c}</TableHead>)}</TableRow>
              </TableHeader>
              <TableBody>{items.map(renderRow)}</TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default AdminImageAudit;
