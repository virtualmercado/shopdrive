import { useState } from "react";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Globe, 
  ArrowLeft, 
  ArrowRight, 
  Check, 
  Copy, 
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Trash2,
  Power,
  PowerOff,
} from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";
import { useMerchantDomain, DomainProviderTutorial } from "@/hooks/useMerchantDomain";
import { toast } from "sonner";

interface CustomDomainWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type WizardStep = 'domain' | 'provider' | 'tutorial' | 'verify' | 'activate' | 'manage';

export const CustomDomainWizard = ({ open, onOpenChange }: CustomDomainWizardProps) => {
  const { buttonBgColor, buttonTextColor } = useTheme();
  const { domain, tutorials, addDomain, verifyDns, activateDomain, deactivateDomain, removeDomain } = useMerchantDomain();
  
  const [step, setStep] = useState<WizardStep>(domain ? 'manage' : 'domain');
  const [domainInput, setDomainInput] = useState(domain?.domain || '');
  const [domainType, setDomainType] = useState<'subdomain' | 'root'>(domain?.domain_type || 'subdomain');
  const [selectedProvider, setSelectedProvider] = useState<DomainProviderTutorial | null>(null);
  const [redirectOldLink, setRedirectOldLink] = useState(domain?.redirect_old_link ?? true);
  const [copied, setCopied] = useState<string | null>(null);

  const validateDomain = (value: string): boolean => {
    // Remove http:// or https://
    let cleaned = value.replace(/^https?:\/\//, '');
    // Remove trailing slashes and paths
    cleaned = cleaned.split('/')[0];
    // Check if it's a valid domain format
    const domainRegex = /^[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9]?\.[a-zA-Z]{2,}(\.[a-zA-Z]{2,})?$/;
    return domainRegex.test(cleaned);
  };

  const cleanDomain = (value: string): string => {
    let cleaned = value.replace(/^https?:\/\//, '');
    cleaned = cleaned.split('/')[0];
    cleaned = cleaned.replace(/\s/g, '');
    return cleaned.toLowerCase();
  };

  const handleDomainChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setDomainInput(cleanDomain(e.target.value));
  };

  const handleSaveDomain = async () => {
    if (!validateDomain(domainInput)) {
      toast.error('Por favor, insira um domínio válido (ex: seudominio.com.br)');
      return;
    }

    await addDomain.mutateAsync({ domain: domainInput, domainType });
    setStep('provider');
  };

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    toast.success('Copiado!');
    setTimeout(() => setCopied(null), 2000);
  };

  const handleVerifyDns = async () => {
    await verifyDns.mutateAsync();
    setStep('verify');
  };

  const handleActivate = async () => {
    await activateDomain.mutateAsync(redirectOldLink);
    onOpenChange(false);
  };

  const handleDeactivate = async () => {
    await deactivateDomain.mutateAsync();
  };

  const handleRemove = async () => {
    if (confirm('Tem certeza que deseja remover o domínio? Esta ação não pode ser desfeita.')) {
      await removeDomain.mutateAsync();
      setStep('domain');
      setDomainInput('');
    }
  };

  const resetWizard = () => {
    setStep('domain');
    setDomainInput('');
    setSelectedProvider(null);
  };

  const getStepTitle = () => {
    switch (step) {
      case 'domain': return 'Configurar Domínio';
      case 'provider': return 'Escolher Provedor';
      case 'tutorial': return `Tutorial - ${selectedProvider?.provider_name}`;
      case 'verify': return 'Verificar DNS';
      case 'activate': return 'Ativar Domínio';
      case 'manage': return 'Gerenciar Domínio';
      default: return 'Domínio Próprio';
    }
  };

  const renderStepContent = () => {
    switch (step) {
      case 'domain':
        return (
          <div className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="domain">Seu domínio</Label>
              <Input
                id="domain"
                value={domainInput}
                onChange={handleDomainChange}
                placeholder="seudominio.com.br"
                className="font-mono"
              />
              <p className="text-xs text-muted-foreground">
                Não inclua http:// ou https://
              </p>
            </div>

            <div className="space-y-3">
              <Label>Tipo de configuração</Label>
              <RadioGroup
                value={domainType}
                onValueChange={(v) => setDomainType(v as 'subdomain' | 'root')}
                className="space-y-2"
              >
                <div className="flex items-center space-x-3 p-3 border rounded-lg">
                  <RadioGroupItem value="subdomain" id="subdomain" />
                  <div className="flex-1">
                    <Label htmlFor="subdomain" className="font-medium cursor-pointer">
                      Subdomínio (www)
                      <Badge variant="secondary" className="ml-2">Recomendado</Badge>
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Exemplo: www.seudominio.com.br
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-3 p-3 border rounded-lg">
                  <RadioGroupItem value="root" id="root" />
                  <div className="flex-1">
                    <Label htmlFor="root" className="font-medium cursor-pointer">
                      Domínio raiz
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Exemplo: seudominio.com.br (sem www)
                    </p>
                  </div>
                </div>
              </RadioGroup>
            </div>

            <Button
              onClick={handleSaveDomain}
              disabled={!domainInput || addDomain.isPending}
              style={{ backgroundColor: buttonBgColor, color: buttonTextColor }}
              className="w-full"
            >
              {addDomain.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              Salvar domínio
            </Button>
          </div>
        );

      case 'provider':
        return (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Selecione onde você registrou seu domínio para ver as instruções específicas:
            </p>
            
            <div className="grid grid-cols-2 gap-2">
              {tutorials?.map((tutorial) => (
                <Button
                  key={tutorial.id}
                  variant="outline"
                  onClick={() => {
                    setSelectedProvider(tutorial);
                    setStep('tutorial');
                  }}
                  className="h-auto py-3 justify-start"
                >
                  {tutorial.provider_name}
                </Button>
              ))}
            </div>

            <Button
              variant="ghost"
              onClick={() => setStep('domain')}
              className="w-full"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Voltar
            </Button>
          </div>
        );

      case 'tutorial':
        return (
          <ScrollArea className="h-[400px] pr-4">
            <div className="space-y-6">
              {/* DNS Records to Copy */}
              <div className="space-y-3 p-4 bg-muted/50 rounded-lg">
                <h4 className="font-medium">Registros DNS necessários:</h4>
                
                <div className="space-y-2">
                  <div className="flex items-center justify-between p-2 bg-background rounded border">
                    <div>
                      <p className="text-xs text-muted-foreground">CNAME (www)</p>
                      <p className="font-mono text-sm">{domain?.expected_cname || 'cname.vm-dns.com'}</p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleCopy(domain?.expected_cname || 'cname.vm-dns.com', 'cname')}
                    >
                      {copied === 'cname' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  </div>

                  <div className="flex items-center justify-between p-2 bg-background rounded border">
                    <div>
                      <p className="text-xs text-muted-foreground">A (@)</p>
                      <p className="font-mono text-sm">{domain?.expected_ip || '185.158.133.1'}</p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleCopy(domain?.expected_ip || '185.158.133.1', 'a')}
                    >
                      {copied === 'a' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
              </div>

              {/* Tutorial Steps */}
              <div className="space-y-4">
                {selectedProvider?.tutorial_content.steps.map((tutorialStep, index) => (
                  <div key={index} className="space-y-2">
                    <div className="flex items-center gap-2">
                      <div 
                        className="flex items-center justify-center w-6 h-6 rounded-full text-white text-sm font-medium"
                        style={{ backgroundColor: buttonBgColor }}
                      >
                        {index + 1}
                      </div>
                      <h4 className="font-medium">{tutorialStep.title}</h4>
                    </div>
                    <p className="text-sm text-muted-foreground ml-8 whitespace-pre-line">
                      {tutorialStep.content}
                    </p>
                  </div>
                ))}
              </div>

              {/* Propagation Warning */}
              <div className="flex items-start gap-2 p-3 bg-amber-50 text-amber-800 rounded-lg">
                <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-sm">Importante</p>
                  <p className="text-xs">
                    As alterações de DNS podem levar até 48 horas para propagar completamente. 
                    Após configurar, aguarde alguns minutos e clique em "Verificar DNS".
                  </p>
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => setStep('provider')}
                  className="flex-1"
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Voltar
                </Button>
                <Button
                  onClick={handleVerifyDns}
                  disabled={verifyDns.isPending}
                  style={{ backgroundColor: buttonBgColor, color: buttonTextColor }}
                  className="flex-1"
                >
                  {verifyDns.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <RefreshCw className="h-4 w-4 mr-2" />
                  )}
                  Verificar DNS
                </Button>
              </div>
            </div>
          </ScrollArea>
        );

      case 'verify':
        return (
          <div className="space-y-6">
            {domain?.status === 'verifying' && (
              <div className="flex flex-col items-center gap-4 py-8">
                <Loader2 className="h-12 w-12 animate-spin text-blue-500" />
                <p className="text-center text-muted-foreground">
                  Verificando configurações DNS...
                </p>
              </div>
            )}

            {domain?.status === 'dns_error' && (
              <div className="space-y-4">
                <div className="flex items-center gap-3 text-red-600">
                  <AlertCircle className="h-8 w-8" />
                  <div>
                    <p className="font-medium">Erro na verificação DNS</p>
                    <p className="text-sm">{domain.dns_error_message}</p>
                  </div>
                </div>

                <Button
                  variant="outline"
                  onClick={() => setStep('tutorial')}
                  className="w-full"
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Revisar configurações
                </Button>

                <Button
                  onClick={handleVerifyDns}
                  disabled={verifyDns.isPending}
                  style={{ backgroundColor: buttonBgColor, color: buttonTextColor }}
                  className="w-full"
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Tentar novamente
                </Button>
              </div>
            )}

            {(domain?.status === 'ssl_provisioning' || domain?.ssl_status === 'provisioning') && (
              <div className="space-y-4">
                <div className="flex items-center gap-3 text-green-600">
                  <CheckCircle2 className="h-8 w-8" />
                  <div>
                    <p className="font-medium">DNS verificado com sucesso!</p>
                    <p className="text-sm text-muted-foreground">Provisionando certificado SSL...</p>
                  </div>
                </div>

                <Button
                  onClick={() => setStep('activate')}
                  style={{ backgroundColor: buttonBgColor, color: buttonTextColor }}
                  className="w-full"
                >
                  Continuar para ativação
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            )}
          </div>
        );

      case 'activate':
        return (
          <div className="space-y-6">
            <div className="flex items-center gap-3 text-green-600">
              <CheckCircle2 className="h-8 w-8" />
              <div>
                <p className="font-medium">Tudo pronto!</p>
                <p className="text-sm text-muted-foreground">
                  Seu domínio está pronto para ser ativado.
                </p>
              </div>
            </div>

            <div className="p-4 border rounded-lg space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="redirect">Redirecionar link antigo</Label>
                  <p className="text-xs text-muted-foreground">
                    Redireciona o link virtual-market-craft.lovable.app para seu domínio (301)
                  </p>
                </div>
                <Switch
                  id="redirect"
                  checked={redirectOldLink}
                  onCheckedChange={setRedirectOldLink}
                />
              </div>
            </div>

            <Button
              onClick={handleActivate}
              disabled={activateDomain.isPending}
              style={{ backgroundColor: buttonBgColor, color: buttonTextColor }}
              className="w-full"
            >
              {activateDomain.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Power className="h-4 w-4 mr-2" />
              )}
              Ativar domínio
            </Button>
          </div>
        );

      case 'manage':
        return (
          <div className="space-y-6">
            {/* Domain Info */}
            <div className="p-4 border rounded-lg space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Domínio:</span>
                <span className="font-mono font-medium">{domain?.domain}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Tipo:</span>
                <Badge variant="secondary">
                  {domain?.domain_type === 'subdomain' ? 'Subdomínio (www)' : 'Domínio raiz'}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Status:</span>
                <Badge variant={domain?.is_active ? 'default' : 'secondary'}>
                  {domain?.is_active ? 'Ativo' : 'Inativo'}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">SSL:</span>
                <Badge variant={domain?.ssl_status === 'active' ? 'default' : 'outline'}>
                  {domain?.ssl_status === 'active' ? 'Ativo' : domain?.ssl_status}
                </Badge>
              </div>
            </div>

            {/* Actions */}
            <div className="space-y-2">
              {domain?.is_active ? (
                <Button
                  variant="outline"
                  onClick={handleDeactivate}
                  disabled={deactivateDomain.isPending}
                  className="w-full"
                >
                  <PowerOff className="h-4 w-4 mr-2" />
                  Desativar domínio
                </Button>
              ) : (
                <Button
                  onClick={() => setStep('activate')}
                  style={{ backgroundColor: buttonBgColor, color: buttonTextColor }}
                  className="w-full"
                >
                  <Power className="h-4 w-4 mr-2" />
                  Ativar domínio
                </Button>
              )}

              <Button
                variant="outline"
                onClick={handleVerifyDns}
                disabled={verifyDns.isPending}
                className="w-full"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Reverificar DNS
              </Button>

              <Button
                variant="ghost"
                onClick={resetWizard}
                className="w-full"
              >
                <Globe className="h-4 w-4 mr-2" />
                Alterar domínio
              </Button>

              <Button
                variant="ghost"
                onClick={handleRemove}
                disabled={removeDomain.isPending}
                className="w-full text-red-600 hover:text-red-700 hover:bg-red-50"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Remover domínio
              </Button>
            </div>
          </div>
        );
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Globe className="h-5 w-5" style={{ color: buttonBgColor }} />
            <DialogTitle>{getStepTitle()}</DialogTitle>
          </div>
          <DialogDescription>
            {step === 'domain' && 'Configure um domínio próprio para sua loja'}
            {step === 'provider' && 'Selecione seu provedor de domínio para ver as instruções'}
            {step === 'tutorial' && 'Siga as instruções para configurar o DNS'}
            {step === 'verify' && 'Verificando suas configurações de DNS'}
            {step === 'activate' && 'Finalize a ativação do seu domínio'}
            {step === 'manage' && 'Gerencie as configurações do seu domínio'}
          </DialogDescription>
        </DialogHeader>

        {renderStepContent()}
      </DialogContent>
    </Dialog>
  );
};
