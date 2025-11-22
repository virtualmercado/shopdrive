import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useIntegrations } from '@/hooks/useIntegrations';

interface IntegrationConfigModalProps {
  open: boolean;
  onClose: () => void;
  integration: any;
}

export const IntegrationConfigModal = ({
  open,
  onClose,
  integration,
}: IntegrationConfigModalProps) => {
  const [config, setConfig] = useState(integration?.config || {});
  const { updateIntegration, testIntegration, loading } = useIntegrations();

  if (!integration) return null;

  const handleSave = async () => {
    const success = await updateIntegration(integration.id, config);
    if (success) {
      onClose();
    }
  };

  const handleTest = async () => {
    await testIntegration(integration.id);
  };

  const renderConfigFields = () => {
    switch (integration.type) {
      case 'payment_gateway':
        return (
          <>
            <div className="space-y-2">
              <Label htmlFor="api_key">API Key</Label>
              <Input
                id="api_key"
                type="password"
                value={config.api_key || ''}
                onChange={(e) => setConfig({ ...config, api_key: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="public_key">Public Key</Label>
              <Input
                id="public_key"
                type="password"
                value={config.public_key || ''}
                onChange={(e) => setConfig({ ...config, public_key: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="webhook_url">Webhook URL (somente leitura)</Label>
              <Input
                id="webhook_url"
                value={config.webhook_url || 'https://api.virtualmercado.com/webhook'}
                readOnly
              />
            </div>
          </>
        );
      case 'analytics':
        return (
          <>
            <div className="space-y-2">
              <Label htmlFor="tracking_id">Tracking ID</Label>
              <Input
                id="tracking_id"
                value={config.tracking_id || ''}
                onChange={(e) => setConfig({ ...config, tracking_id: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="domain">Domínio</Label>
              <Input
                id="domain"
                value={config.domain || ''}
                onChange={(e) => setConfig({ ...config, domain: e.target.value })}
              />
            </div>
          </>
        );
      default:
        return (
          <div className="space-y-2">
            <Label htmlFor="api_key">API Key</Label>
            <Input
              id="api_key"
              type="password"
              value={config.api_key || ''}
              onChange={(e) => setConfig({ ...config, api_key: e.target.value })}
            />
          </div>
        );
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Configurar {integration.name}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {renderConfigFields()}

          <div className="flex gap-2 pt-4 border-t">
            <Button onClick={handleTest} variant="outline" disabled={loading}>
              Testar Conexão
            </Button>
            <Button onClick={handleSave} disabled={loading}>
              Salvar Configurações
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
