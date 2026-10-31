import { useState } from "react";
import { Globe, ExternalLink, Settings, Lock, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useMerchantDomain } from "@/hooks/useMerchantDomain";
import { CustomDomainWizard } from "./CustomDomainWizard";

export const CustomDomainSection = () => {
  const [open, setOpen] = useState(false);
  const { overview, presentation, isLoading, loadError } = useMerchantDomain();

  if (isLoading) {
    return (
      <div className="space-y-3 pt-4 border-t animate-pulse">
        <div className="h-6 bg-muted rounded w-1/3" />
        <div className="h-20 bg-muted rounded" />
      </div>
    );
  }

  const available = !!overview?.available;
  const { domain, connected, hostname, address, ctaLabel, stateLabel } = presentation;
  const hasDomain = !!domain;
  const purchaseUrl = overview?.purchase_url;

  return (
    <>
      <div className="space-y-3 pt-4 border-t">
        <div className="flex items-center gap-2">
          <div className="flex items-center justify-center w-8 h-8 bg-muted rounded">
            <Globe className="h-4 w-4 text-muted-foreground" />
          </div>
          <Label className="text-base font-medium">Domínio próprio</Label>
        </div>

        <div className="space-y-4">
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
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                <span className="font-mono text-sm break-all">{hostname}</span>
                <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <ShieldCheck className="h-4 w-4 shrink-0 text-primary" /> {stateLabel}
                </p>
                <Button variant="outline" size="sm" asChild>
                  <a href={address} target="_blank" rel="noopener noreferrer" className="gap-1.5">
                    <ExternalLink className="h-4 w-4" /> Visitar
                  </a>
                </Button>
              </div>
              <Button size="sm" onClick={() => setOpen(true)} className="gap-1.5">
                <Settings className="h-4 w-4" /> {ctaLabel}
              </Button>
            </div>
          ) : (
            <>
              {hasDomain ? (
                <div className="space-y-1">
                  <p className="font-mono text-sm break-all">{hostname}</p>
                  <p className="text-sm text-muted-foreground">{stateLabel}</p>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Use seu próprio domínio na sua loja ShopDrive.</p>
              )}
              <Button onClick={() => setOpen(true)} className="w-full gap-2">
                <Settings className="h-4 w-4" />
                {ctaLabel}
              </Button>
            </>
          )}

          {purchaseUrl && !connected && (
            <a href={purchaseUrl} target="_blank" rel="noopener noreferrer" className="text-sm flex items-center gap-1 hover:underline text-primary">
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
