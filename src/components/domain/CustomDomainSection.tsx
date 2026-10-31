import { useState } from "react";
import { Globe, ExternalLink, Settings, Lock, Check, Copy, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useTheme } from "@/contexts/ThemeContext";
import { useMerchantDomain } from "@/hooks/useMerchantDomain";
import {
  customDomainStateLabel, isCustomDomainConnected,
  customDomainCtaLabel, customDomainDisplayHostname, customDomainChecklist,
} from "@/lib/customDomainStatus";
import { CustomDomainWizard } from "./CustomDomainWizard";
import { toast } from "sonner";

export const CustomDomainSection = () => {
  const [open, setOpen] = useState(false);
  const { buttonBgColor, buttonTextColor } = useTheme();
  const { overview, domain, isLoading, loadError } = useMerchantDomain();

  if (isLoading) {
    return (
      <div className="space-y-3 pt-4 border-t animate-pulse">
        <div className="h-6 bg-muted rounded w-1/3" />
        <div className="h-20 bg-muted rounded" />
      </div>
    );
  }

  const available = !!overview?.available;
  const connected = isCustomDomainConnected(domain);
  const hasDomain = !!domain && !domain.released;
  const hostname = customDomainDisplayHostname(domain);
  const purchaseUrl = overview?.purchase_url;

  const copyAddress = async () => {
    await navigator.clipboard.writeText(`https://${hostname}`);
    toast.success("Endereço copiado.");
  };

  return (
    <>
      <div className="space-y-3 pt-4 border-t">
        <div className="flex items-center gap-2">
          <div className="flex items-center justify-center w-8 h-8 bg-muted rounded">
            <Globe className="h-4 w-4 text-muted-foreground" />
          </div>
          <Label className="text-base font-medium">Domínio próprio</Label>
        </div>

        <div className="p-4 rounded-lg bg-muted/30 space-y-4">
          {loadError ? (
            <p className="text-sm text-muted-foreground">Não foi possível carregar o domínio próprio agora. Tente novamente mais tarde.</p>
          ) : !available ? (
            <div className="flex items-start gap-3">
              <Lock className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div className="space-y-1">
                <p className="text-sm font-medium">Domínio próprio temporariamente indisponível</p>
                <p className="text-xs text-muted-foreground">
                  Estamos preparando a conexão segura de domínios. Sua loja continua funcionando normalmente no endereço ShopDrive.
                </p>
              </div>
            </div>
          ) : connected ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-primary" />
                <p className="text-sm font-medium">Domínio conectado</p>
              </div>
              <a href={`https://${hostname}`} target="_blank" rel="noopener noreferrer"
                className="font-mono text-sm flex items-center gap-1 hover:underline w-fit" style={{ color: buttonBgColor }}>
                {hostname} <ExternalLink className="h-3 w-3" />
              </a>
              <ul className="text-xs text-muted-foreground space-y-1">
                {customDomainChecklist(domain).map((item) => (
                  <li key={item.key} className="flex items-center gap-1.5">
                    <Check className="h-3 w-3 text-primary" /> {item.label}
                  </li>
                ))}
                <li className="flex items-center gap-1.5">
                  <Check className="h-3 w-3 text-primary" /> Loja publicada
                </li>
              </ul>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" asChild>
                  <a href={`https://${hostname}`} target="_blank" rel="noopener noreferrer" className="gap-1.5">
                    <ExternalLink className="h-4 w-4" /> Ver domínio
                  </a>
                </Button>
                <Button variant="outline" size="sm" onClick={copyAddress} className="gap-1.5">
                  <Copy className="h-4 w-4" /> Copiar endereço
                </Button>
                <Button size="sm" onClick={() => setOpen(true)} style={{ backgroundColor: buttonBgColor, color: buttonTextColor }} className="gap-1.5">
                  <Settings className="h-4 w-4" /> Gerenciar domínio
                </Button>
              </div>
            </div>
          ) : (
            <>
              {hasDomain ? (
                <div className="space-y-1">
                  <p className="font-mono text-sm">{hostname}</p>
                  <p className="text-sm text-muted-foreground">{customDomainStateLabel(domain!.state)}</p>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Use seu próprio domínio na sua loja ShopDrive.</p>
              )}
              <Button onClick={() => setOpen(true)} style={{ backgroundColor: buttonBgColor, color: buttonTextColor }} className="w-full gap-2">
                <Settings className="h-4 w-4" />
                {customDomainCtaLabel(domain)}
              </Button>
            </>
          )}

          {purchaseUrl && !connected && (
            <a href={purchaseUrl} target="_blank" rel="noopener noreferrer" className="text-sm flex items-center gap-1 hover:underline" style={{ color: buttonBgColor }}>
              Ainda não tem um domínio? Registrar um domínio
              <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>
      </div>

      {available && <CustomDomainWizard open={open} onOpenChange={setOpen} />}
    </>
  );
};
