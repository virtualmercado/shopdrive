import { useEffect, useMemo, useState } from 'react';
import { ExternalLink, Eye, Info, Lock, RefreshCw, Search } from 'lucide-react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { PlanGateOverlay } from '@/components/plan';
import { AdminPagination } from '@/components/admin/AdminPagination';
import { NetworkChart } from '@/components/network/NetworkChart';
import { NetworkTemplateCard } from '@/components/network/NetworkTemplateCard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useMerchantPlan } from '@/hooks/useMerchantPlan';
import {
  useBrandNetworkActivationDetail, useBrandNetworkActivations, useBrandNetworkDashboard, usePlanMarcaFlag,
  type ActivationFilters,
} from '@/hooks/useBrandNetwork';
import {
  NETWORK_PAGE_SIZE, classifyNetworkError, customRange, formatCount, formatDate, formatPercent, planLabel,
  presetRange, resolveNetworkAccess, type NetworkActivation, type PeriodPreset,
} from '@/lib/brandNetwork';

const Header = () => (
  <div>
    <h1 className="text-2xl font-bold text-foreground">Minha Rede</h1>
    <p className="text-muted-foreground">Acompanhe o crescimento das lojas criadas pelos seus Templates por Marca.</p>
  </div>
);

const Notice = ({ title, text }: { title: string; text: string }) => (
  <Card><CardContent className="py-10 text-center space-y-2">
    <Lock className="h-8 w-8 mx-auto text-muted-foreground" />
    <p className="font-semibold text-foreground">{title}</p>
    <p className="text-sm text-muted-foreground max-w-md mx-auto">{text}</p>
  </CardContent></Card>
);

const SituationBadge = ({ ready }: { ready: boolean }) => (
  <Badge variant={ready ? 'default' : 'secondary'}>{ready ? 'Pronta' : 'Em configuração'}</Badge>
);

const StoreLink = ({ path }: { path: string | null }) =>
  path ? (
    <a href={path} target="_blank" rel="noopener noreferrer"
      className="inline-flex items-center gap-1 text-sm text-primary hover:underline">
      Abrir loja <ExternalLink className="h-3 w-3" />
    </a>
  ) : <span className="text-sm text-muted-foreground">Indisponível</span>;

const Kpi = ({ title, value, sub, loading, tip }: { title: string; value: string; sub: string; loading: boolean; tip?: string }) => (
  <Card><CardContent className="p-5">
    {loading ? (<><Skeleton className="h-4 w-24 mb-3" /><Skeleton className="h-8 w-20 mb-2" /><Skeleton className="h-3 w-32" /></>) : (<>
      <div className="flex items-center gap-1">
        <p className="text-sm font-medium text-muted-foreground">{title}</p>
        {tip && (
          <Tooltip><TooltipTrigger asChild>
            <button type="button" aria-label={`Sobre ${title}`} className="text-muted-foreground"><Info className="h-3.5 w-3.5" /></button>
          </TooltipTrigger><TooltipContent className="max-w-xs">{tip}</TooltipContent></Tooltip>
        )}
      </div>
      <p className="text-3xl font-bold text-foreground mt-1">{value}</p>
      <p className="text-xs text-muted-foreground mt-1">{sub}</p>
    </>)}
  </CardContent></Card>
);

const NetworkContent = () => {
  const [preset, setPreset] = useState<PeriodPreset>('30d');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [templateId, setTemplateId] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState('');
  const [filters, setFilters] = useState<ActivationFilters>({ page: 1, templateId: null, status: 'all', plan: null, search: '' });
  const [detailKey, setDetailKey] = useState<string | null>(null);
  const [denied, setDenied] = useState(false);

  const range = useMemo(
    () => (preset === 'custom' ? customRange(customStart, customEnd) : presetRange(preset)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [preset, customStart, customEnd],
  );
  const customInvalid = preset === 'custom' && !!customStart && !!customEnd && !range;

  const scope = { enabled: !denied };
  const dash = useBrandNetworkDashboard(range, templateId, scope);
  const list = useBrandNetworkActivations(filters, scope);
  const detail = useBrandNetworkActivationDetail(detailKey, scope);

  useEffect(() => {
    const t = setTimeout(() => setFilters((f) => (f.search === searchInput ? f : { ...f, search: searchInput, page: 1 })), 400);
    return () => clearTimeout(t);
  }, [searchInput]);

  // 42501 em qualquer chamada: descarta tudo o que foi renderizado.
  useEffect(() => {
    if ([dash.error, list.error, detail.error].some((e) => e && classifyNetworkError(e) === 'denied')) {
      setDenied(true);
      setDetailKey(null);
    }
  }, [dash.error, list.error, detail.error]);

  if (denied) {
    return <Notice title="Acesso indisponível" text="Não foi possível confirmar o acesso ao Minha Rede para esta conta." />;
  }

  const setFilter = (patch: Partial<ActivationFilters>) => setFilters((f) => ({ ...f, ...patch, page: 1 }));
  const d = dash.data;
  const templates = d?.templates ?? [];
  const summary = d?.summary;
  const dashLoading = dash.isLoading || (!d && !dash.error);
  const dashErr = dash.error ? classifyNetworkError(dash.error) : null;

  return (
    <div className="space-y-6">
      {/* B. Filtros globais */}
      <Card><CardContent className="p-4 flex flex-wrap items-end gap-4">
        <div className="space-y-1 min-w-[180px]">
          <Label htmlFor="net-period">Período</Label>
          <Select value={preset} onValueChange={(v) => setPreset(v as PeriodPreset)}>
            <SelectTrigger id="net-period"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">Últimos 7 dias</SelectItem>
              <SelectItem value="30d">Últimos 30 dias</SelectItem>
              <SelectItem value="90d">Últimos 90 dias</SelectItem>
              <SelectItem value="custom">Personalizado</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {preset === 'custom' && (<>
          <div className="space-y-1">
            <Label htmlFor="net-from">Data inicial</Label>
            <Input id="net-from" type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="net-to">Data final</Label>
            <Input id="net-to" type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} />
          </div>
        </>)}
        <div className="space-y-1 min-w-[200px]">
          <Label htmlFor="net-template">Template</Label>
          <Select value={templateId ?? 'all'} onValueChange={(v) => setTemplateId(v === 'all' ? null : v)}>
            <SelectTrigger id="net-template"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os Templates</SelectItem>
              {templates.map((t) => <SelectItem key={t.templateId} value={t.templateId}>{t.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        {(customInvalid || dashErr === 'period') && (
          <p className="text-sm text-destructive w-full" role="alert">
            Selecione um período válido para visualizar as métricas (máximo de 366 dias).
          </p>
        )}
      </CardContent></Card>

      {dashErr === 'generic' ? (
        <Card><CardContent className="py-8 text-center space-y-3">
          <p className="text-foreground">Tivemos um problema ao carregar os dados da sua rede.</p>
          <Button variant="outline" onClick={() => dash.refetch()}><RefreshCw className="h-4 w-4 mr-2" />Tentar novamente</Button>
        </CardContent></Card>
      ) : (<>
        {/* C. KPIs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <Kpi title="Cliques" value={formatCount(summary?.validClicks)} sub="no período selecionado" loading={dashLoading} />
          <Kpi title="Lojas criadas" value={formatCount(summary?.validActivations)} sub="no período selecionado" loading={dashLoading} />
          <Kpi title="Conversão" value={formatPercent(summary?.conversionPercent)} sub="no período selecionado" loading={dashLoading} />
          <Kpi title="Lojas prontas" value={formatCount(summary?.operationalTotal)} loading={dashLoading}
            sub={`Configuração mínima concluída · ${formatCount(summary?.operationalTotal)} de ${formatCount(summary?.totalValidActivations)} lojas da rede`}
            tip="Consideramos pronta a loja que concluiu os requisitos mínimos de configuração da ShopDrive." />
        </div>

        {/* D. Gráfico */}
        <NetworkChart series={d?.series} bucket={d?.period?.bucket ?? range?.bucket ?? 'day'} loading={dashLoading} />

        {/* E. Templates */}
        <section className="space-y-3">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Templates por Marca</h2>
            <p className="text-sm text-muted-foreground">Compartilhe seus templates e acompanhe o desempenho de cada um.</p>
          </div>
          {dashLoading ? (
            <div className="grid gap-4 lg:grid-cols-2"><Skeleton className="h-56" /><Skeleton className="h-56" /></div>
          ) : templates.length === 0 ? (
            <Card><CardContent className="py-8 text-center">
              <p className="font-medium text-foreground">Seus Templates por Marca estão sendo preparados pela ShopDrive.</p>
              <p className="text-sm text-muted-foreground">Quando a equipe ShopDrive concluir a configuração, eles aparecerão aqui.</p>
            </CardContent></Card>
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              {templates.map((t) => <NetworkTemplateCard key={t.templateId} template={t} />)}
            </div>
          )}
        </section>
      </>)}

      {/* F. Lojas da Rede */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Lojas da Rede</CardTitle>
          <p className="text-sm text-muted-foreground">Acompanhe as lojas criadas a partir dos seus Templates por Marca.</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input className="pl-9" placeholder="Buscar pelo nome da loja" aria-label="Buscar loja"
                value={searchInput} onChange={(e) => setSearchInput(e.target.value)} />
            </div>
            <Select value={filters.templateId ?? 'all'} onValueChange={(v) => setFilter({ templateId: v === 'all' ? null : v })}>
              <SelectTrigger className="w-full sm:w-48" aria-label="Filtrar por template"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os templates</SelectItem>
                {templates.map((t) => <SelectItem key={t.templateId} value={t.templateId}>{t.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filters.status} onValueChange={(v) => setFilter({ status: v as ActivationFilters['status'] })}>
              <SelectTrigger className="w-full sm:w-44" aria-label="Filtrar por situação"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                <SelectItem value="operational">Prontas</SelectItem>
                <SelectItem value="configuring">Em configuração</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filters.plan ?? 'all'} onValueChange={(v) => setFilter({ plan: v === 'all' ? null : v })}>
              <SelectTrigger className="w-full sm:w-40" aria-label="Filtrar por plano"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os planos</SelectItem>
                <SelectItem value="free">Grátis</SelectItem>
                <SelectItem value="pro">PRO</SelectItem>
                <SelectItem value="premium">PREMIUM</SelectItem>
                <SelectItem value="marca">MARCA</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {list.error && classifyNetworkError(list.error) !== 'denied' ? (
            <div className="py-6 text-center space-y-3">
              <p className="text-foreground">Tivemos um problema ao carregar os dados da sua rede.</p>
              <Button variant="outline" onClick={() => list.refetch()}><RefreshCw className="h-4 w-4 mr-2" />Tentar novamente</Button>
            </div>
          ) : list.isLoading || !list.data ? (
            <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
          ) : list.data.totalCount === 0 ? (
            <div className="py-8 text-center">
              {filters.search || filters.templateId || filters.plan || filters.status !== 'all' ? (
                <p className="text-muted-foreground">Nenhuma loja encontrada com os filtros selecionados.</p>
              ) : (<>
                <p className="font-medium text-foreground">Sua rede ainda não possui lojas ativadas.</p>
                <p className="text-sm text-muted-foreground">Compartilhe o link do seu Template por Marca para começar.</p>
              </>)}
            </div>
          ) : (<>
            {/* Desktop */}
            <div className="hidden md:block overflow-x-auto">
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Loja</TableHead><TableHead>Template</TableHead><TableHead>Ativada em</TableHead>
                  <TableHead>Situação</TableHead><TableHead>Progresso</TableHead><TableHead>Plano atual</TableHead>
                  <TableHead>Produtos</TableHead><TableHead>Loja pública</TableHead><TableHead className="text-right">Ações</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {list.data.items.map((it) => (
                    <TableRow key={it.storeKey}>
                      <TableCell className="font-medium">{it.storeName || '—'}</TableCell>
                      <TableCell>{it.templateName || '—'}</TableCell>
                      <TableCell>{formatDate(it.activatedAt)}</TableCell>
                      <TableCell><SituationBadge ready={it.minimumReady} /></TableCell>
                      <TableCell className="min-w-[120px]">
                        <div className="flex items-center gap-2"><Progress value={it.progressPercent} className="h-2 w-16" aria-label="Progresso" /><span className="text-sm">{it.progressPercent}%</span></div>
                      </TableCell>
                      <TableCell>{planLabel(it.currentPlan)}</TableCell>
                      <TableCell>{formatCount(it.activeProductsCount)} ativos</TableCell>
                      <TableCell><StoreLink path={it.publicPath} /></TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" onClick={() => setDetailKey(it.storeKey)}><Eye className="h-4 w-4 mr-1" />Ver detalhes</Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            {/* Mobile */}
            <div className="md:hidden space-y-3">
              {list.data.items.map((it) => (
                <div key={it.storeKey} className="rounded-lg border p-3 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium truncate">{it.storeName || '—'}</p>
                      <p className="text-xs text-muted-foreground">{it.templateName || '—'} · {formatDate(it.activatedAt)}</p>
                    </div>
                    <SituationBadge ready={it.minimumReady} />
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span>Plano: {planLabel(it.currentPlan)}</span>
                    <Button variant="outline" size="sm" onClick={() => setDetailKey(it.storeKey)}>Ver detalhes</Button>
                  </div>
                </div>
              ))}
            </div>
            <AdminPagination page={filters.page} totalItems={list.data.totalCount} pageSize={NETWORK_PAGE_SIZE}
              itemLabel="lojas" onPageChange={(p) => setFilters((f) => ({ ...f, page: p }))} />
          </>)}
        </CardContent>
      </Card>

      <Sheet open={!!detailKey} onOpenChange={(o) => !o && setDetailKey(null)}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Detalhes da loja</SheetTitle>
            <SheetDescription>Informações operacionais mínimas da loja da sua rede.</SheetDescription>
          </SheetHeader>
          <DetailBody loading={detail.isLoading} error={!!detail.error} data={detail.data} />
        </SheetContent>
      </Sheet>
    </div>
  );
};

const DetailBody = ({ loading, error, data }: { loading: boolean; error: boolean; data?: NetworkActivation }) => {
  if (loading) return <div className="mt-6 space-y-3">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-6 w-full" />)}</div>;
  if (error || !data) return <p className="mt-6 text-sm text-muted-foreground">Não foi possível carregar os detalhes desta loja.</p>;
  const Row = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div className="flex items-center justify-between gap-3 py-2 border-b last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span><span className="text-sm text-right">{children}</span>
    </div>
  );
  return (
    <div className="mt-6">
      <Row label="Loja">{data.storeName || '—'}</Row>
      <Row label="Template">{data.templateName || '—'}</Row>
      <Row label="Ativada em">{formatDate(data.activatedAt)}</Row>
      <Row label="Situação"><SituationBadge ready={data.minimumReady} /></Row>
      <Row label="Progresso">{data.progressPercent}%</Row>
      <Row label="Produtos ativos">{formatCount(data.activeProductsCount)}</Row>
      <Row label="Plano atual">{planLabel(data.currentPlan)}</Row>
      <Row label="Loja pública"><StoreLink path={data.publicPath} /></Row>
    </div>
  );
};

const MinhaRede = () => {
  const flag = usePlanMarcaFlag();
  const { plan, loading: planLoading, planSource, ownedStoreRole } = useMerchantPlan();
  const access = resolveNetworkAccess({
    flagLoading: flag.isLoading, flagEnabled: flag.data === true,
    planLoading, plan, planSource, ownedStoreRole,
  });

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <Header />
        {access === 'loading' && <Skeleton className="h-64 w-full" />}
        {access === 'unavailable' && (
          <Notice title="Recurso indisponível" text="O Minha Rede ainda não está disponível para a sua conta." />
        )}
        {access === 'secondary' && (
          <Notice title="Gerenciamento da rede indisponível nesta loja"
            text="Esta loja utiliza os recursos do Plano MARCA da empresa, mas o gerenciamento da rede está disponível apenas para o responsável principal." />
        )}
        {access === 'locked' && (
          <div className="relative min-h-[360px] rounded-lg border overflow-hidden">
            <div className="p-6 grid grid-cols-2 xl:grid-cols-4 gap-4" aria-hidden="true">
              {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24" />)}
              <Skeleton className="h-40 col-span-2 xl:col-span-4" />
            </div>
            <PlanGateOverlay
              message={"Desbloqueie o Minha Rede com o Plano MARCA.\nAcompanhe as lojas criadas\npelos seus Templates por Marca."}
              buttonLabel="Conhecer Plano MARCA"
              navigateTo="/lojista/financeiro"
            />
          </div>
        )}
        {access === 'full' && <NetworkContent />}
      </div>
    </DashboardLayout>
  );
};

export default MinhaRede;
