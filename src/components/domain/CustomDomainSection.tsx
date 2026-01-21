import { useState } from "react";
import { Globe, AlertCircle, CheckCircle2, Clock, XCircle, ExternalLink, BookOpen, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useTheme } from "@/contexts/ThemeContext";
import { useMerchantDomain } from "@/hooks/useMerchantDomain";
import { CustomDomainWizard } from "./CustomDomainWizard";
import { toast } from "sonner";

export const CustomDomainSection = () => {
  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardInitialStep, setWizardInitialStep] = useState<'domain' | 'provider' | 'manage'>('domain');
  const [domainInput, setDomainInput] = useState('');
  const { buttonBgColor, buttonTextColor } = useTheme();
  const { domain, isLoading, addDomain } = useMerchantDomain();

  const getStatusDisplay = () => {
    if (!domain) {
      return {
        icon: <XCircle className="h-5 w-5 text-muted-foreground" />,
        text: "Seu domínio ainda não foi vinculado à nossa plataforma",
        variant: "secondary" as const,
        color: "text-muted-foreground",
      };
    }

    switch (domain.status) {
      case 'pending':
        return {
          icon: <Clock className="h-5 w-5 text-amber-500" />,
          text: "Domínio pendente de configuração DNS",
          variant: "outline" as const,
          color: "text-amber-600",
        };
      case 'verifying':
        return {
          icon: <Clock className="h-5 w-5 text-blue-500 animate-pulse" />,
          text: "Domínio em verificação",
          variant: "outline" as const,
          color: "text-blue-600",
        };
      case 'dns_error':
        return {
          icon: <AlertCircle className="h-5 w-5 text-red-500" />,
          text: "Erro na configuração DNS",
          variant: "destructive" as const,
          color: "text-red-600",
        };
      case 'ssl_provisioning':
        return {
          icon: <Clock className="h-5 w-5 text-blue-500 animate-pulse" />,
          text: "SSL em provisionamento",
          variant: "outline" as const,
          color: "text-blue-600",
        };
      case 'ssl_error':
        return {
          icon: <AlertCircle className="h-5 w-5 text-red-500" />,
          text: "Erro ao ativar SSL",
          variant: "destructive" as const,
          color: "text-red-600",
        };
      case 'active':
        return {
          icon: <CheckCircle2 className="h-5 w-5 text-green-500" />,
          text: "Domínio vinculado com sucesso",
          variant: "default" as const,
          color: "text-green-600",
        };
      case 'inactive':
        return {
          icon: <XCircle className="h-5 w-5 text-gray-500" />,
          text: "Domínio desativado",
          variant: "secondary" as const,
          color: "text-gray-600",
        };
      default:
        return {
          icon: <XCircle className="h-5 w-5 text-muted-foreground" />,
          text: "Status desconhecido",
          variant: "secondary" as const,
          color: "text-muted-foreground",
        };
    }
  };

  const cleanDomain = (value: string): string => {
    let cleaned = value.replace(/^https?:\/\//, '');
    cleaned = cleaned.split('/')[0];
    cleaned = cleaned.replace(/\s/g, '');
    return cleaned.toLowerCase();
  };

  const validateDomain = (value: string): boolean => {
    let cleaned = value.replace(/^https?:\/\//, '');
    cleaned = cleaned.split('/')[0];
    const domainRegex = /^[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9]?\.[a-zA-Z]{2,}(\.[a-zA-Z]{2,})?$/;
    return domainRegex.test(cleaned);
  };

  const handleAddDomain = async () => {
    const cleaned = cleanDomain(domainInput);
    if (!validateDomain(cleaned)) {
      toast.error('Por favor, insira um domínio válido (ex: seudominio.com.br)');
      return;
    }

    await addDomain.mutateAsync({ domain: cleaned, domainType: 'subdomain' });
    setDomainInput('');
    toast.success('Domínio adicionado! Agora configure o DNS no seu provedor.');
  };

  const openWizard = (step: 'domain' | 'provider' | 'manage') => {
    setWizardInitialStep(step);
    setWizardOpen(true);
  };

  const status = getStatusDisplay();

  if (isLoading) {
    return (
      <div className="space-y-3 pt-4 border-t animate-pulse">
        <div className="h-6 bg-muted rounded w-1/3" />
        <div className="h-20 bg-muted rounded" />
      </div>
    );
  }

  return (
    <>
      <div className="space-y-3 pt-4 border-t">
        <div className="flex items-center gap-2">
          <div className="flex items-center justify-center w-8 h-8 bg-gray-100 rounded">
            <Globe className="h-4 w-4 text-gray-600" />
          </div>
          <Label className="text-base font-medium">Domínio próprio</Label>
        </div>

        <div className="p-4 rounded-lg bg-muted/30 space-y-4">
          {/* Domain Input Section - Only show if no domain configured */}
          {!domain && (
            <div className="space-y-2">
              <Label className="text-sm font-medium">Seu domínio</Label>
              <p className="text-xs text-muted-foreground">Insira seu domínio abaixo</p>
              <div className="flex gap-2">
                <Input
                  value={domainInput}
                  onChange={(e) => setDomainInput(cleanDomain(e.target.value))}
                  placeholder="Ex: seudominio.com"
                  className="font-mono flex-1"
                />
                <Button
                  variant="link"
                  onClick={handleAddDomain}
                  disabled={!domainInput || addDomain.isPending}
                  style={{ color: buttonBgColor }}
                  className="px-4"
                >
                  Adicionar
                </Button>
              </div>
            </div>
          )}

          {/* Status Display - Only show if domain exists */}
          {domain && (
            <>
              <div className="flex items-center gap-3">
                {status.icon}
                <span className={`text-sm font-medium ${status.color}`}>
                  {status.text}
                </span>
              </div>

              {/* Domain Display */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm text-muted-foreground">Domínio:</span>
                <Badge variant={status.variant} className="font-mono">
                  {domain.domain}
                </Badge>
                {domain.is_active && domain.status === 'active' && (
                  <a 
                    href={`https://${domain.domain}`} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-sm flex items-center gap-1 hover:underline"
                    style={{ color: buttonBgColor }}
                  >
                    Visitar <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>

              {/* DNS Error Message */}
              {domain.dns_error_message && (
                <p className="text-sm text-red-600 bg-red-50 p-2 rounded">
                  {domain.dns_error_message}
                </p>
              )}
            </>
          )}

          {/* Tutorial Section */}
          <div className="space-y-2 pt-2 border-t">
            <Label className="text-sm font-medium">Como vincular seu domínio</Label>
            <p className="text-xs text-muted-foreground">
              Siga o tutorial que preparamos para vincular seu domínio, é muito simples, e leva menos de 1 minuto.
            </p>
            <Button
              onClick={() => openWizard('provider')}
              style={{ backgroundColor: buttonBgColor, color: buttonTextColor }}
              className="w-full gap-2"
            >
              <BookOpen className="h-4 w-4" />
              Veja como vincular seu domínio
            </Button>
          </div>

          {/* Manage Domain Button - Only show if domain exists */}
          {domain && (
            <Button
              variant="outline"
              onClick={() => openWizard('manage')}
              className="w-full gap-2"
            >
              <Settings className="h-4 w-4" />
              Gerenciar domínio
            </Button>
          )}

          {/* Help Link */}
          <a 
            href="https://registro.br" 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-sm flex items-center gap-1 hover:underline"
            style={{ color: buttonBgColor }}
          >
            Ainda não tem um domínio? Compre com desconto aqui
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </div>

      <CustomDomainWizard 
        open={wizardOpen} 
        onOpenChange={setWizardOpen}
        initialStep={wizardInitialStep}
      />
    </>
  );
};
