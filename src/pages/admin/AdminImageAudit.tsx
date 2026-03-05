import { useState, useCallback } from "react";
import AdminLayout from "@/components/layout/AdminLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Play,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ImageIcon,
  Trash2,
  Wrench,
  Loader2,
  FileWarning,
  Ghost,
  Package,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

// ─── Types ───

interface ImageRef {
  productId: string;
  productName: string;
  source: "image_url" | "images_array" | "product_images";
  rowId?: string; // for product_images table
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

interface AuditReport {
  totalProducts: number;
  productsWithImages: number;
  productsWithoutImages: number;
  totalRefsInDb: number;
  totalRefsValid: number;
  brokenRefs: Array<ImageRef & { error?: string }>;
  base64Refs: ImageRef[];
  localRefs: ImageRef[];
  orphanObjects: StorageObject[];
  oversizedObjects: Array<{ ref: ImageRef; size: number }>;
  allStorageObjects: number;
}

const EMPTY_REPORT: AuditReport = {
  totalProducts: 0,
  productsWithImages: 0,
  productsWithoutImages: 0,
  totalRefsInDb: 0,
  totalRefsValid: 0,
  brokenRefs: [],
  base64Refs: [],
  localRefs: [],
  orphanObjects: [],
  oversizedObjects: [],
  allStorageObjects: 0,
};

const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

function classifyUrl(url: string): "base64" | "local" | "valid" | "unknown" {
  if (!url || typeof url !== "string") return "unknown";
  if (url.startsWith("data:image")) return "base64";
  if (
    url.includes("localhost") ||
    url.startsWith("blob:") ||
    url.startsWith("file:") ||
    url.startsWith("/uploads")
  )
    return "local";
  if (url.startsWith("http")) return "valid";
  return "unknown";
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(2) + " MB";
}

// ─── Component ───

const AdminImageAudit = () => {
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressLabel, setProgressLabel] = useState("");
  const [report, setReport] = useState<AuditReport | null>(null);
  const [confirmOrphans, setConfirmOrphans] = useState(false);
  const [fixing, setFixing] = useState(false);

  const runAudit = useCallback(async () => {
    setRunning(true);
    setProgress(0);
    setProgressLabel("Carregando produtos...");

    try {
      // ── Phase 1: Fetch products ──
      const allProducts: Array<{ id: string; name: string; image_url: string | null; images: unknown }> = [];
      let page = 0;
      const PAGE_SIZE = 500;
      let hasMore = true;

      while (hasMore) {
        const { data, error } = await supabase
          .from("products")
          .select("id, name, image_url, images")
          .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

        if (error) throw error;
        if (data) allProducts.push(...data);
        hasMore = data?.length === PAGE_SIZE;
        page++;
      }

      setProgress(10);
      setProgressLabel("Carregando tabela product_images...");

      // ── Phase 2: Fetch product_images ──
      const allProductImages: Array<{ id: string; product_id: string; image_url: string }> = [];
      page = 0;
      hasMore = true;

      while (hasMore) {
        const { data, error } = await supabase
          .from("product_images")
          .select("id, product_id, image_url")
          .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

        if (error) throw error;
        if (data) allProductImages.push(...data);
        hasMore = data?.length === PAGE_SIZE;
        page++;
      }

      setProgress(20);
      setProgressLabel("Classificando referências...");

      // ── Phase 3: Classify all refs ──
      const allRefs: ImageRef[] = [];
      const productNameMap = new Map<string, string>();

      for (const p of allProducts) {
        productNameMap.set(p.id, p.name);

        if (p.image_url) {
          allRefs.push({
            productId: p.id,
            productName: p.name,
            source: "image_url",
            url: p.image_url,
          });
        }

        if (p.images && Array.isArray(p.images)) {
          for (const img of p.images as string[]) {
            if (typeof img === "string" && img.trim()) {
              allRefs.push({
                productId: p.id,
                productName: p.name,
                source: "images_array",
                url: img,
              });
            }
          }
        }
      }

      for (const pi of allProductImages) {
        allRefs.push({
          productId: pi.product_id,
          productName: productNameMap.get(pi.product_id) || "—",
          source: "product_images",
          rowId: pi.id,
          url: pi.image_url,
        });
      }

      // Classify
      const base64Refs: ImageRef[] = [];
      const localRefs: ImageRef[] = [];
      const validUrls: ImageRef[] = [];

      for (const ref of allRefs) {
        const cls = classifyUrl(ref.url);
        if (cls === "base64") base64Refs.push(ref);
        else if (cls === "local") localRefs.push(ref);
        else if (cls === "valid") validUrls.push(ref);
        // unknown treated like valid for HEAD check
        else validUrls.push(ref);
      }

      // Products without any images
      const productIdsWithImages = new Set([
        ...allRefs.map((r) => r.productId),
      ]);
      const productsWithoutImages = allProducts.filter(
        (p) => !productIdsWithImages.has(p.id)
      );

      setProgress(30);
      setProgressLabel("Validando URLs no storage...");

      // ── Phase 4: Validate URLs via edge function ──
      const brokenRefs: Array<ImageRef & { error?: string }> = [];
      const oversized: Array<{ ref: ImageRef; size: number }> = [];
      const validatedKeys = new Set<string>();
      let validCount = 0;

      const BATCH_SIZE = 50;
      for (let i = 0; i < validUrls.length; i += BATCH_SIZE) {
        const batch = validUrls.slice(i, i + BATCH_SIZE);
        const urlStrings = batch.map((r) => r.url);

        try {
          const { data, error } = await supabase.functions.invoke("audit-images", {
            body: { action: "validate_urls", urls: urlStrings },
          });

          if (error) throw error;

          const results: ValidationResult[] = data?.results || [];

          for (let j = 0; j < results.length; j++) {
            const res = results[j];
            const ref = batch[j];

            if (res.objectKey) validatedKeys.add(res.objectKey);

            if (!res.exists) {
              brokenRefs.push({ ...ref, error: res.error || "not_found" });
            } else {
              validCount++;
              if (res.size && res.size > MAX_SIZE_BYTES) {
                oversized.push({ ref, size: res.size });
              }
            }
          }
        } catch (e) {
          // If batch fails, mark all as broken
          for (const ref of batch) {
            brokenRefs.push({ ...ref, error: "batch_error" });
          }
        }

        const pct = 30 + Math.round(((i + BATCH_SIZE) / Math.max(validUrls.length, 1)) * 40);
        setProgress(Math.min(pct, 70));
        setProgressLabel(
          `Validando ${Math.min(i + BATCH_SIZE, validUrls.length)}/${validUrls.length} URLs...`
        );
      }

      setProgress(75);
      setProgressLabel("Buscando objetos no storage...");

      // ── Phase 5: List storage objects for orphan detection ──
      let storageObjects: StorageObject[] = [];
      try {
        const { data, error } = await supabase.functions.invoke("audit-images", {
          body: { action: "list_storage_objects" },
        });
        if (!error && data?.objects) {
          storageObjects = data.objects;
        }
      } catch {
        // Non-critical
      }

      // Orphan detection: objects in storage not referenced in DB
      const orphanObjects = storageObjects.filter(
        (obj) => !validatedKeys.has(obj.key)
      );

      setProgress(100);
      setProgressLabel("Auditoria concluída!");

      const finalReport: AuditReport = {
        totalProducts: allProducts.length,
        productsWithImages: productIdsWithImages.size,
        productsWithoutImages: productsWithoutImages.length,
        totalRefsInDb: allRefs.length,
        totalRefsValid: validCount,
        brokenRefs,
        base64Refs,
        localRefs,
        orphanObjects,
        oversizedObjects: oversized,
        allStorageObjects: storageObjects.length,
      };

      setReport(finalReport);
    } catch (err) {
      toast({
        title: "Erro na auditoria",
        description: String(err),
        variant: "destructive",
      });
    } finally {
      setRunning(false);
    }
  }, []);

  const handleFixPaths = async () => {
    // Placeholder: currently no-op since URLs are stored as full URLs by design
    toast({ title: "Correção de paths", description: "Nenhuma correção necessária no momento." });
  };

  const handleDeleteOrphans = async () => {
    if (!report || report.orphanObjects.length === 0) return;
    setFixing(true);

    try {
      const keys = report.orphanObjects.map((o) => o.key);
      const { data, error } = await supabase.functions.invoke("audit-images", {
        body: { action: "delete_orphans", orphanKeys: keys },
      });

      if (error) throw error;

      toast({
        title: "Órfãs removidas",
        description: `${data?.deleted || 0} arquivo(s) removido(s) do storage.`,
      });

      // Update report
      setReport((prev) => (prev ? { ...prev, orphanObjects: [] } : prev));
    } catch (err) {
      toast({
        title: "Erro ao remover órfãs",
        description: String(err),
        variant: "destructive",
      });
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
            <h2 className="text-xl font-semibold text-foreground">
              Auditoria de Imagens
            </h2>
            <p className="text-sm text-muted-foreground">
              Valida integridade entre referências no banco e arquivos no storage
            </p>
          </div>
          <Button onClick={runAudit} disabled={running} size="lg">
            {running ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Play className="h-4 w-4 mr-2" />
            )}
            {running ? "Executando..." : "Executar Auditoria"}
          </Button>
        </div>

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
              <SummaryCard
                icon={Package}
                label="Total de Produtos"
                value={report.totalProducts}
              />
              <SummaryCard
                icon={CheckCircle2}
                label="Produtos com Imagens OK"
                value={report.productsWithImages}
                variant="success"
              />
              <SummaryCard
                icon={ImageIcon}
                label="Referências no Banco"
                value={report.totalRefsInDb}
              />
              <SummaryCard
                icon={CheckCircle2}
                label="Confirmadas no Storage"
                value={report.totalRefsValid}
                variant="success"
              />
              <SummaryCard
                icon={XCircle}
                label="Referências Quebradas"
                value={report.brokenRefs.length}
                variant={report.brokenRefs.length > 0 ? "danger" : "success"}
              />
              <SummaryCard
                icon={FileWarning}
                label="Base64 / URL Local"
                value={report.base64Refs.length + report.localRefs.length}
                variant={
                  report.base64Refs.length + report.localRefs.length > 0
                    ? "warning"
                    : "success"
                }
              />
              <SummaryCard
                icon={Ghost}
                label="Órfãs no Storage"
                value={report.orphanObjects.length}
                variant={report.orphanObjects.length > 0 ? "warning" : "success"}
              />
              <SummaryCard
                icon={AlertTriangle}
                label="Acima de 10 MB"
                value={report.oversizedObjects.length}
                variant={report.oversizedObjects.length > 0 ? "warning" : "success"}
              />
            </div>

            {/* Action buttons */}
            <div className="flex gap-3 flex-wrap">
              <Button variant="outline" onClick={handleFixPaths} disabled={fixing}>
                <Wrench className="h-4 w-4 mr-2" />
                Corrigir Paths
              </Button>
              <Button
                variant="destructive"
                onClick={() => setConfirmOrphans(true)}
                disabled={fixing || report.orphanObjects.length === 0}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Remover Órfãs ({report.orphanObjects.length})
              </Button>
            </div>

            {/* Detail Tabs */}
            <Tabs defaultValue="broken" className="space-y-4">
              <TabsList className="flex-wrap h-auto gap-1">
                <TabsTrigger value="broken">
                  Quebradas ({report.brokenRefs.length})
                </TabsTrigger>
                <TabsTrigger value="base64">
                  Base64/Local ({report.base64Refs.length + report.localRefs.length})
                </TabsTrigger>
                <TabsTrigger value="orphans">
                  Órfãs ({report.orphanObjects.length})
                </TabsTrigger>
                <TabsTrigger value="oversized">
                  Acima de 10 MB ({report.oversizedObjects.length})
                </TabsTrigger>
                <TabsTrigger value="noimage">
                  Sem Imagens ({report.productsWithoutImages})
                </TabsTrigger>
              </TabsList>

              {/* Broken refs */}
              <TabsContent value="broken">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Referências Quebradas</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {report.brokenRefs.length === 0 ? (
                      <EmptyState message="Nenhuma referência quebrada encontrada." />
                    ) : (
                      <div className="overflow-auto max-h-[500px]">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Produto</TableHead>
                              <TableHead>Fonte</TableHead>
                              <TableHead>URL / Path</TableHead>
                              <TableHead>Erro</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {report.brokenRefs.map((ref, i) => (
                              <TableRow key={i}>
                                <TableCell className="font-medium max-w-[150px] truncate">
                                  {ref.productName}
                                </TableCell>
                                <TableCell>
                                  <Badge variant="outline">{ref.source}</Badge>
                                </TableCell>
                                <TableCell className="max-w-[300px] truncate text-xs font-mono">
                                  {ref.url}
                                </TableCell>
                                <TableCell>
                                  <Badge variant="destructive">{ref.error}</Badge>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Base64 / Local */}
              <TabsContent value="base64">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Base64 / URL Local</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {report.base64Refs.length + report.localRefs.length === 0 ? (
                      <EmptyState message="Nenhuma referência base64 ou local encontrada." />
                    ) : (
                      <div className="overflow-auto max-h-[500px]">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Produto</TableHead>
                              <TableHead>Fonte</TableHead>
                              <TableHead>Tipo</TableHead>
                              <TableHead>Valor (truncado)</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {[...report.base64Refs, ...report.localRefs].map(
                              (ref, i) => (
                                <TableRow key={i}>
                                  <TableCell className="font-medium max-w-[150px] truncate">
                                    {ref.productName}
                                  </TableCell>
                                  <TableCell>
                                    <Badge variant="outline">{ref.source}</Badge>
                                  </TableCell>
                                  <TableCell>
                                    <Badge
                                      variant={
                                        ref.url.startsWith("data:")
                                          ? "destructive"
                                          : "secondary"
                                      }
                                    >
                                      {ref.url.startsWith("data:") ? "base64" : "local"}
                                    </Badge>
                                  </TableCell>
                                  <TableCell className="max-w-[300px] truncate text-xs font-mono">
                                    {ref.url.slice(0, 80)}…
                                  </TableCell>
                                </TableRow>
                              )
                            )}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Orphans */}
              <TabsContent value="orphans">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">
                      Órfãs no Storage de Imagens
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {report.orphanObjects.length === 0 ? (
                      <EmptyState message="Nenhuma imagem órfã encontrada." />
                    ) : (
                      <div className="overflow-auto max-h-[500px]">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Key / Path</TableHead>
                              <TableHead>Tamanho</TableHead>
                              <TableHead>Última modificação</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {report.orphanObjects.map((obj, i) => (
                              <TableRow key={i}>
                                <TableCell className="max-w-[400px] truncate text-xs font-mono">
                                  {obj.key}
                                </TableCell>
                                <TableCell>{formatBytes(obj.size)}</TableCell>
                                <TableCell className="text-xs">
                                  {obj.lastModified
                                    ? new Date(obj.lastModified).toLocaleString("pt-BR")
                                    : "—"}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Oversized */}
              <TabsContent value="oversized">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">
                      Imagens acima de 10 MB
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {report.oversizedObjects.length === 0 ? (
                      <EmptyState message="Nenhuma imagem acima do limite." />
                    ) : (
                      <div className="overflow-auto max-h-[500px]">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Produto</TableHead>
                              <TableHead>URL</TableHead>
                              <TableHead>Tamanho</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {report.oversizedObjects.map((item, i) => (
                              <TableRow key={i}>
                                <TableCell className="font-medium max-w-[150px] truncate">
                                  {item.ref.productName}
                                </TableCell>
                                <TableCell className="max-w-[300px] truncate text-xs font-mono">
                                  {item.ref.url}
                                </TableCell>
                                <TableCell>
                                  <Badge variant="destructive">
                                    {formatBytes(item.size)}
                                  </Badge>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* No images */}
              <TabsContent value="noimage">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Produtos sem Imagens</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {report.productsWithoutImages === 0 ? (
                      <EmptyState message="Todos os produtos possuem pelo menos uma imagem." />
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        {report.productsWithoutImages} produto(s) sem nenhuma imagem
                        referenciada no banco.
                      </p>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </>
        )}

        {/* Empty state before first run */}
        {!report && !running && (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <ImageIcon className="h-12 w-12 text-muted-foreground/40 mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-1">
                Nenhuma auditoria executada
              </h3>
              <p className="text-sm text-muted-foreground max-w-md">
                Clique em "Executar Auditoria" para verificar a integridade de todas as
                imagens de produtos entre o banco de dados e o storage de imagens.
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Confirm orphan deletion dialog */}
      <AlertDialog open={confirmOrphans} onOpenChange={setConfirmOrphans}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover imagens órfãs?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação removerá permanentemente{" "}
              <strong>{report?.orphanObjects.length || 0}</strong> arquivo(s) do storage
              que não estão referenciados no banco. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteOrphans}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {fixing ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4 mr-2" />
              )}
              Confirmar Remoção
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminLayout>
  );
};

// ─── Sub-components ───

function SummaryCard({
  icon: Icon,
  label,
  value,
  variant = "default",
}: {
  icon: React.ElementType;
  label: string;
  value: number;
  variant?: "default" | "success" | "warning" | "danger";
}) {
  const colors = {
    default: "text-foreground",
    success: "text-green-600",
    warning: "text-amber-600",
    danger: "text-destructive",
  };

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

export default AdminImageAudit;
