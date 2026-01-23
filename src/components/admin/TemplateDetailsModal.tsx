import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Copy, 
  Check, 
  QrCode, 
  MousePointerClick,
  Store,
  Package,
  ExternalLink
} from 'lucide-react';
import { BrandTemplate, useToggleLinkStatus, getTemplateActivationLink } from '@/hooks/useBrandTemplates';
import { toast } from 'sonner';

interface TemplateDetailsModalProps {
  template: BrandTemplate | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onGenerateQRCode: (template: BrandTemplate) => void;
}

const TemplateDetailsModal = ({
  template,
  open,
  onOpenChange,
  onGenerateQRCode,
}: TemplateDetailsModalProps) => {
  const [copied, setCopied] = useState(false);
  const toggleLinkMutation = useToggleLinkStatus();

  const activationLink = template ? getTemplateActivationLink(template.template_slug) : '';

  const handleCopyLink = async () => {
    if (!activationLink) return;
    
    try {
      await navigator.clipboard.writeText(activationLink);
      setCopied(true);
      toast.success('Link copiado!');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Erro ao copiar link');
    }
  };

  const handleToggleLink = () => {
    if (!template) return;
    toggleLinkMutation.mutate({
      id: template.id,
      currentLinkStatus: template.is_link_active,
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Ativo</Badge>;
      case 'inactive':
        return <Badge variant="secondary">Inativo</Badge>;
      case 'draft':
        return <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">Rascunho</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(word => word[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  if (!template) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Detalhes do Template</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Header with logo and name */}
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16">
              <AvatarImage src={template.logo_url || undefined} alt={template.name} />
              <AvatarFallback className="bg-primary/10 text-primary text-lg">
                {getInitials(template.name)}
              </AvatarFallback>
            </Avatar>
            <div>
              <h3 className="text-xl font-semibold">{template.name}</h3>
              <div className="mt-1">{getStatusBadge(template.status)}</div>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
              <Package className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Produtos</p>
                <p className="font-semibold">{template.products_count}/{template.max_products}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
              <Store className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Lojas Criadas</p>
                <p className="font-semibold">{template.stores_created}</p>
              </div>
            </div>
          </div>

          <Separator />

          {/* Activation Link Section */}
          <div className="space-y-4">
            <h4 className="font-medium">Link de Ativação</h4>
            
            <div className="space-y-2">
              <Label htmlFor="activation-link">URL do Link</Label>
              <div className="flex gap-2">
                <Input
                  id="activation-link"
                  value={activationLink}
                  readOnly
                  className="flex-1 bg-muted"
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleCopyLink}
                  disabled={!template.template_slug}
                >
                  {copied ? (
                    <Check className="h-4 w-4 text-green-500" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => window.open(activationLink, '_blank')}
                  disabled={!template.template_slug || !template.is_link_active}
                >
                  <ExternalLink className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="link-active">Link ativo</Label>
                <p className="text-sm text-muted-foreground">
                  {template.is_link_active 
                    ? 'O link está habilitado para cadastros'
                    : 'O link está desabilitado'}
                </p>
              </div>
              <Switch
                id="link-active"
                checked={template.is_link_active}
                onCheckedChange={handleToggleLink}
                disabled={toggleLinkMutation.isPending}
              />
            </div>

            <Button
              variant="outline"
              className="w-full"
              onClick={() => onGenerateQRCode(template)}
              disabled={!template.template_slug}
            >
              <QrCode className="h-4 w-4 mr-2" />
              Gerar QR Code
            </Button>
          </div>

          <Separator />

          {/* Metrics Section */}
          <div className="space-y-4">
            <h4 className="font-medium">Métricas</h4>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center gap-3 p-3 rounded-lg border">
                <MousePointerClick className="h-5 w-5 text-blue-500" />
                <div>
                  <p className="text-sm text-muted-foreground">Cliques no Link</p>
                  <p className="font-semibold text-lg">{template.link_clicks}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-lg border">
                <Store className="h-5 w-5 text-green-500" />
                <div>
                  <p className="text-sm text-muted-foreground">Lojas Criadas</p>
                  <p className="font-semibold text-lg">{template.stores_created}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default TemplateDetailsModal;
