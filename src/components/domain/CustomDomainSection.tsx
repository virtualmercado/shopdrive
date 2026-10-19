import { useState } from "react";
import { Globe, ExternalLink, Settings, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useTheme } from "@/contexts/ThemeContext";
import { useMerchantDomain } from "@/hooks/useMerchantDomain";
import { customDomainStateLabel, isCustomDomainConnected } from "@/lib/customDomainStatus";
import { CustomDomainWizard } from "./CustomDomainWizard";

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
          ) : (
            <>
              {domain && !domain.released ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant={connected ? "default" : "outline"} className="font-mono">{domain.domain}</Badge>
                    <span className="text-sm text-muted-foreground">{customDomainStateLabel(domain.state)}</span>
                    {connected && (
                      <a href={`https://${domain.domain}`} target="_blank" rel="noopener noreferrer" className="text-sm flex items-center gap-1 hover:underline" style={{ color: buttonBgColor }}>
                        Visitar <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Conecte um domínio que você já possui (ex.: seudominio.com.br).</p>
              )}
              <Button onClick={() => setOpen(true)} style={{ backgroundColor: buttonBgColor, color: buttonTextColor }} className="w-full gap-2">
                <Settings className="h-4 w-4" />
                {domain && !domain.released ? "Gerenciar domínio" : "Conectar domínio"}
              </Button>
            </>
          )}

          {purchaseUrl && (
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
