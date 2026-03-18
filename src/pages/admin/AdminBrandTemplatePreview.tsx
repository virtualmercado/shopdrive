import { useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, ExternalLink, Loader2, RefreshCw } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { syncTemplatePreviewState } from '@/lib/templatePreviewSync';

const AdminBrandTemplatePreview = () => {
  const { templateId } = useParams<{ templateId: string }>();
  const navigate = useNavigate();

  const {
    data: previewState,
    isLoading,
    isRefetching,
    error,
    refetch,
  } = useQuery({
    queryKey: ['brand-template-preview-complete', templateId],
    queryFn: async () => {
      if (!templateId) {
        throw new Error('Template inválido para preview.');
      }

      return syncTemplatePreviewState(templateId, {
        context: 'preview-route',
        forceSync: true,
        enforceCompleteness: true,
      });
    },
    enabled: !!templateId,
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: 'always',
    retry: false,
  });

  const previewUrl = useMemo(() => {
    if (!previewState?.storeSlug) return '';

    const url = new URL(`/loja/${previewState.storeSlug}`, window.location.origin);
    url.searchParams.set('templatePreview', '1');
    url.searchParams.set('templateId', previewState.templateId);
    url.searchParams.set('sourceProfileId', previewState.sourceProfileId);
    url.searchParams.set('syncedAt', previewState.snapshotSyncedAt);
    url.searchParams.set('v', String(Date.now()));

    const current = new URL(window.location.href);
    current.searchParams.forEach((value, key) => {
      if (key.startsWith('__lovable')) {
        url.searchParams.set(key, value);
      }
    });

    return url.toString();
  }, [previewState]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !previewState || !previewUrl) {
    const message = error instanceof Error ? error.message : 'Falha ao gerar preview completo do template.';

    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-2xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Sincronização incompleta do preview
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">{message}</p>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => navigate('/gestor/templates-marca')}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Voltar ao painel
              </Button>
              <Button variant="secondary" onClick={() => refetch()} disabled={isRefetching}>
                {isRefetching ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
                Tentar novamente
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="border-b bg-card px-4 py-3 flex items-center justify-between gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate('/gestor/templates-marca')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Voltar ao Painel Master
        </Button>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => window.open(previewUrl, '_blank')}>
            <ExternalLink className="h-4 w-4 mr-2" />
            Abrir em nova aba
          </Button>
          <Button variant="secondary" size="sm" onClick={() => refetch()} disabled={isRefetching}>
            {isRefetching ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
            Revalidar
          </Button>
        </div>
      </div>

      <div className="border-b bg-muted/40 px-4 py-2 flex flex-wrap items-center gap-2 text-xs">
        <Badge variant="secondary">template_id: {previewState.templateId}</Badge>
        <Badge variant="secondary">marca_id: {previewState.brandId}</Badge>
        <Badge variant="outline">source_profile_id: {previewState.sourceProfileId}</Badge>
        <Badge variant="outline">snapshot: {new Date(previewState.snapshotSyncedAt).toLocaleString('pt-BR')}</Badge>
        <Badge variant="outline">origem visual: profiles</Badge>
        <Badge variant="outline">origem produtos: products</Badge>
      </div>

      <iframe
        title={`Preview completo do template ${previewState.templateName}`}
        src={previewUrl}
        className="w-full flex-1 border-0"
      />
    </div>
  );
};

export default AdminBrandTemplatePreview;
