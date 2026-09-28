import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { toast } from 'sonner';
import { Copy, MessageCircle, QrCode } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  formatCount, formatPercent, networkTemplateLink, networkWhatsAppUrl, templateStatusLabel,
  type NetworkTemplate,
} from '@/lib/brandNetwork';

const copyLink = async (link: string) => {
  try {
    await navigator.clipboard.writeText(link);
    toast.success('Link copiado com sucesso.');
  } catch {
    toast.error('Não foi possível copiar o link.');
  }
};

const Stat = ({ label, value }: { label: string; value: string }) => (
  <div>
    <p className="text-xs text-muted-foreground">{label}</p>
    <p className="text-lg font-semibold text-foreground">{value}</p>
  </div>
);

export const NetworkTemplateCard = ({ template }: { template: NetworkTemplate }) => {
  const [qrOpen, setQrOpen] = useState(false);
  const [qrUrl, setQrUrl] = useState('');
  const link = template.linkAvailable ? networkTemplateLink(template.templateSlug) : '';
  const canShare = template.linkAvailable && !!link;

  useEffect(() => {
    if (!qrOpen || !link) return;
    // Gerado localmente — o link nunca é enviado a serviço externo.
    QRCode.toDataURL(link, { width: 280, margin: 2 }).then(setQrUrl).catch(() => setQrUrl(''));
  }, [qrOpen, link]);

  const variant = template.status === 'active' ? 'default' : template.status === 'draft' ? 'secondary' : 'outline';

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <CardTitle className="text-base truncate">{template.name}</CardTitle>
            <p className="text-sm text-muted-foreground">{formatCount(template.productsCount)} produtos</p>
          </div>
          <Badge variant={variant}>{templateStatusLabel(template.status)}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <Stat label="Cliques no período" value={formatCount(template.validClicks)} />
          <Stat label="Ativações no período" value={formatCount(template.validActivations)} />
          <Stat label="Conversão" value={formatPercent(template.conversionPercent)} />
          <Stat label="Total de lojas" value={formatCount(template.totalValidActivations)} />
          <Stat label="Lojas prontas" value={formatCount(template.operationalTotal)} />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" disabled={!canShare} onClick={() => copyLink(link)}>
            <Copy className="h-4 w-4 mr-2" /> Copiar link
          </Button>
          <Button size="sm" variant="outline" disabled={!canShare}
            onClick={() => window.open(networkWhatsAppUrl(template.name, template.templateSlug), '_blank', 'noopener,noreferrer')}>
            <MessageCircle className="h-4 w-4 mr-2" /> Compartilhar no WhatsApp
          </Button>
          <Button size="sm" variant="outline" disabled={!canShare} onClick={() => setQrOpen(true)}>
            <QrCode className="h-4 w-4 mr-2" /> QR Code
          </Button>
        </div>
        {!canShare && (
          <p className="text-xs text-muted-foreground">Link disponível quando o template estiver ativo.</p>
        )}
      </CardContent>

      <Dialog open={qrOpen} onOpenChange={setQrOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{template.name}</DialogTitle>
            <DialogDescription>Aponte a câmera para abrir o link de criação de loja.</DialogDescription>
          </DialogHeader>
          <div className="flex justify-center">
            {qrUrl ? (
              <img src={qrUrl} alt={`QR Code do template ${template.name}`} className="h-64 w-64 rounded-md border" />
            ) : (
              <div className="h-64 w-64 rounded-md bg-muted animate-pulse" />
            )}
          </div>
          <div className="flex gap-2">
            <Input value={link} readOnly aria-label="Link do template" />
            <Button variant="outline" size="icon" aria-label="Copiar link" onClick={() => copyLink(link)}>
              <Copy className="h-4 w-4" />
            </Button>
          </div>
          <Button variant="outline"
            onClick={() => window.open(networkWhatsAppUrl(template.name, template.templateSlug), '_blank', 'noopener,noreferrer')}>
            <MessageCircle className="h-4 w-4 mr-2" /> Compartilhar no WhatsApp
          </Button>
        </DialogContent>
      </Dialog>
    </Card>
  );
};
