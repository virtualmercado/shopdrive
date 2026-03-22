import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Switch } from '@/components/ui/switch';
import { Loader2, Play, RefreshCw, AlertTriangle, CheckCircle2, XCircle, Eye } from 'lucide-react';
import { toast } from 'sonner';
import { useQuery } from '@tanstack/react-query';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

interface PendingStore {
  id: string;
  store_name: string | null;
  full_name: string | null;
  source_template_id: string;
  template_applied: boolean;
  template_apply_status: string | null;
  template_apply_error: string | null;
  template_applied_at: string | null;
  created_at: string;
  template_name?: string;
  // Completeness fields
  banner_desktop_urls: any;
  banner_rect_1_url: string | null;
  banner_rect_2_url: string | null;
  selected_benefit_banners: any;
  content_banner_enabled: boolean | null;
  primary_color: string | null;
  about_us_text: string | null;
  footer_bg_color: string | null;
  product_count?: number;
}

type CompletenessBlock = { label: string; ok: boolean };

function getCompletenessBlocks(store: PendingStore): CompletenessBlock[] {
  const hasBanners = store.banner_desktop_urls && store.banner_desktop_urls !== '[]' && store.banner_desktop_urls !== 'null';
  const hasMini1 = !!store.banner_rect_1_url;
  const hasMini2 = !!store.banner_rect_2_url;
  const hasBenefits = !!store.selected_benefit_banners;
  const hasContent = !!store.content_banner_enabled;
  const hasColors = !!store.primary_color && store.primary_color !== '#000000';
  const hasFooter = !!store.footer_bg_color;
  const hasAbout = !!store.about_us_text;
  const hasProducts = (store.product_count || 0) > 0;

  return [
    { label: 'Banners principais', ok: !!hasBanners },
    { label: 'Mini Banner 1', ok: hasMini1 },
    { label: 'Mini Banner 2', ok: hasMini2 },
    { label: 'Banner benefícios', ok: hasBenefits },
    { label: 'Banner conteúdo', ok: hasContent },
    { label: 'Cores', ok: hasColors },
    { label: 'Rodapé', ok: hasFooter },
    { label: 'Sobre nós', ok: hasAbout },
    { label: 'Produtos', ok: hasProducts },
  ];
}

const TemplateMaintenanceTab = () => {
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('all');
  const [isRunningBackfill, setIsRunningBackfill] = useState(false);
  const [backfillResult, setBackfillResult] = useState<any>(null);
  const [applyingStoreId, setApplyingStoreId] = useState<string | null>(null);
  const [forceMode, setForceMode] = useState(false);

  const { data: templates } = useQuery({
    queryKey: ['maintenance-templates'],
    queryFn: async () => {
      const { data } = await supabase
        .from('brand_templates')
        .select('id, name')
        .order('name');
      return data || [];
    },
  });

  const { data: pendingStores, isLoading, refetch } = useQuery({
    queryKey: ['pending-template-stores', selectedTemplateId],
    queryFn: async () => {
      let query = supabase
        .from('profiles')
        .select('id, store_name, full_name, source_template_id, template_applied, template_apply_status, template_apply_error, template_applied_at, created_at, banner_desktop_urls, banner_rect_1_url, banner_rect_2_url, selected_benefit_banners, content_banner_enabled, primary_color, about_us_text, footer_bg_color')
        .not('source_template_id', 'is', null)
        .order('created_at', { ascending: false });

      if (selectedTemplateId !== 'all') {
        query = query.eq('source_template_id', selectedTemplateId);
      }

      const { data, error } = await query;
      if (error) throw error;

      const templateIds = [...new Set((data || []).map(s => s.source_template_id))];
      const { data: templateNames } = await supabase
        .from('brand_templates')
        .select('id, name')
        .in('id', templateIds);
      const nameMap = new Map((templateNames || []).map(t => [t.id, t.name]));

      // Get product counts
      const storeIds = (data || []).map(s => s.id);
      const productCounts = new Map<string, number>();
      if (storeIds.length > 0) {
        for (const sid of storeIds) {
          const { count } = await supabase
            .from('products')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', sid);
          productCounts.set(sid, count || 0);
        }
      }

      return (data || []).map(s => ({
        ...s,
        template_name: nameMap.get(s.source_template_id) || 'Desconhecido',
        product_count: productCounts.get(s.id) || 0,
      })) as PendingStore[];
    },
  });

  const handleApplyToStore = async (storeId: string, templateId: string) => {
    setApplyingStoreId(storeId);
    try {
      const { data, error } = await supabase.rpc('apply_template_to_existing_store', {
        p_user_id: storeId,
        p_template_id: templateId,
        p_force: forceMode,
      });
      if (error) { toast.error(`Erro: ${error.message}`); return; }
      const result = data as any;
      if (result?.success) {
        toast.success(`Template aplicado! ${result.products_cloned} produtos clonados.`);
        refetch();
      } else {
        toast.error(`Falha: ${result?.error || 'Erro desconhecido'}`);
      }
    } catch { toast.error('Erro inesperado'); } finally { setApplyingStoreId(null); }
  };

  const handleRunBackfill = async () => {
    setIsRunningBackfill(true);
    setBackfillResult(null);
    try {
      const { data, error } = await supabase.rpc('backfill_partner_templates');
      if (error) { toast.error(`Erro no backfill: ${error.message}`); return; }
      setBackfillResult(data);
      const result = data as any;
      toast.success(`Backfill concluído: ${result?.success || 0} sucesso, ${result?.failed || 0} falhas, ${result?.skipped || 0} ignoradas`);
      refetch();
    } catch { toast.error('Erro inesperado no backfill'); } finally { setIsRunningBackfill(false); }
  };

  const pendingCount = pendingStores?.filter(s => !s.template_applied || s.template_apply_status !== 'applied').length || 0;
  const appliedCount = pendingStores?.filter(s => s.template_applied && s.template_apply_status === 'applied').length || 0;
  const failedCount = pendingStores?.filter(s => s.template_apply_status === 'failed').length || 0;
  const incompleteCount = pendingStores?.filter(s => {
    if (!s.template_applied) return false;
    const blocks = getCompletenessBlocks(s);
    return blocks.some(b => !b.ok);
  }).length || 0;

  const getStatusBadge = (store: PendingStore) => {
    if (store.template_applied && store.template_apply_status === 'applied') {
      const blocks = getCompletenessBlocks(store);
      const missing = blocks.filter(b => !b.ok);
      if (missing.length > 0) {
        return <Badge className="bg-yellow-100 text-yellow-800"><AlertTriangle className="h-3 w-3 mr-1" /> Incompleto ({missing.length})</Badge>;
      }
      return <Badge className="bg-green-100 text-green-800"><CheckCircle2 className="h-3 w-3 mr-1" /> Completo</Badge>;
    }
    if (store.template_apply_status === 'failed') {
      return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" /> Falhou</Badge>;
    }
    return <Badge variant="secondary"><AlertTriangle className="h-3 w-3 mr-1" /> Pendente</Badge>;
  };

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card><CardContent className="pt-6"><div className="text-2xl font-bold text-yellow-600">{pendingCount}</div><p className="text-sm text-muted-foreground">Pendentes / Falhas</p></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="text-2xl font-bold text-green-600">{appliedCount}</div><p className="text-sm text-muted-foreground">Templates aplicados</p></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="text-2xl font-bold text-red-600">{failedCount}</div><p className="text-sm text-muted-foreground">Falhas</p></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="text-2xl font-bold text-orange-600">{incompleteCount}</div><p className="text-sm text-muted-foreground">Incompletos</p></CardContent></Card>
      </div>

      {/* Batch Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Correção em Lote</CardTitle>
          <CardDescription>Aplicar templates retroativamente em contas pendentes (modo seguro — não sobrescreve dados existentes)</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <Button onClick={handleRunBackfill} disabled={isRunningBackfill || pendingCount === 0}>
              {isRunningBackfill ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Processando...</> : <><Play className="h-4 w-4 mr-2" /> Executar Backfill ({pendingCount} pendentes)</>}
            </Button>
            <Button variant="outline" onClick={() => refetch()}><RefreshCw className="h-4 w-4 mr-2" /> Atualizar</Button>
          </div>
          {backfillResult && (
            <Alert><AlertDescription>
              <p><strong>Resultado do backfill:</strong></p>
              <p>Total processado: {backfillResult.total_processed}</p>
              <p className="text-green-600">Sucesso: {backfillResult.success}</p>
              <p className="text-red-600">Falhas: {backfillResult.failed}</p>
              <p className="text-yellow-600">Ignoradas: {backfillResult.skipped}</p>
            </AlertDescription></Alert>
          )}
        </CardContent>
      </Card>

      {/* Store List */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Lojas com Template Vinculado</CardTitle>
          <CardDescription>Gerencie a aplicação de templates individualmente</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
              <SelectTrigger className="w-full sm:w-[250px]"><SelectValue placeholder="Filtrar por template" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os templates</SelectItem>
                {templates?.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <div className="flex items-center gap-2">
              <Switch checked={forceMode} onCheckedChange={setForceMode} />
              <Label className="text-sm">Modo forçado (sobrescreve dados existentes)</Label>
            </div>
          </div>

          {forceMode && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>Modo forçado ativado: a reaplicação substituirá produtos e configurações existentes.</AlertDescription>
            </Alert>
          )}

          {isLoading ? (
            <div className="flex items-center justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : (
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Loja</TableHead>
                    <TableHead>Template</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Integridade</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead>Erro</TableHead>
                    <TableHead className="text-right">Ação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(!pendingStores || pendingStores.length === 0) ? (
                    <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Nenhuma loja encontrada</TableCell></TableRow>
                  ) : (
                    pendingStores.map((store) => {
                      const blocks = getCompletenessBlocks(store);
                      const okCount = blocks.filter(b => b.ok).length;
                      return (
                        <TableRow key={store.id}>
                          <TableCell>
                            <p className="font-medium">{store.store_name || store.full_name || '—'}</p>
                            <p className="text-xs text-muted-foreground">{store.id.slice(0, 8)}...</p>
                          </TableCell>
                          <TableCell className="text-sm">{store.template_name}</TableCell>
                          <TableCell>{getStatusBadge(store)}</TableCell>
                          <TableCell>
                            <Popover>
                              <PopoverTrigger asChild>
                                <Button variant="ghost" size="sm" className="gap-1">
                                  <Eye className="h-3 w-3" />
                                  {okCount}/{blocks.length}
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-56 p-3">
                                <p className="text-sm font-medium mb-2">Checklist de integridade</p>
                                <ul className="space-y-1">
                                  {blocks.map((b, i) => (
                                    <li key={i} className="flex items-center gap-2 text-xs">
                                      {b.ok ? <CheckCircle2 className="h-3 w-3 text-green-600" /> : <XCircle className="h-3 w-3 text-red-500" />}
                                      {b.label}
                                    </li>
                                  ))}
                                </ul>
                              </PopoverContent>
                            </Popover>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">{new Date(store.created_at).toLocaleDateString('pt-BR')}</TableCell>
                          <TableCell className="text-xs text-red-600 max-w-[200px] truncate">{store.template_apply_error || '—'}</TableCell>
                          <TableCell className="text-right">
                            {store.template_applied && store.template_apply_status === 'applied' && !forceMode ? (
                              <Badge variant="outline">Já aplicado</Badge>
                            ) : (
                              <Button size="sm" variant="outline" onClick={() => handleApplyToStore(store.id, store.source_template_id)} disabled={applyingStoreId === store.id}>
                                {applyingStoreId === store.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <>{forceMode ? 'Forçar' : 'Aplicar'}</>}
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default TemplateMaintenanceTab;
