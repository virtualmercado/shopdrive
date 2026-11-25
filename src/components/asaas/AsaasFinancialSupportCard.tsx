import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ASAAS_SUPPORT } from "@/lib/asaasCompliance";
import { Mail, Phone } from "lucide-react";

/**
 * Reusable Asaas financial services support channels block.
 * Clearly separates Asaas financial support from ShopDrive platform support.
 */
export function AsaasFinancialSupportCard() {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{ASAAS_SUPPORT.title}</CardTitle>
        <CardDescription>{ASAAS_SUPPORT.description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <a
            href={ASAAS_SUPPORT.phoneHref}
            className="flex items-center gap-3 rounded-lg border border-border bg-muted/30 p-3 text-sm transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Phone className="h-4 w-4 text-primary shrink-0" aria-hidden="true" />
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Telefone oficial Asaas</p>
              <p className="font-medium text-foreground">{ASAAS_SUPPORT.phoneDisplay}</p>
            </div>
          </a>

          <a
            href={ASAAS_SUPPORT.emailHref}
            className="flex items-center gap-3 rounded-lg border border-border bg-muted/30 p-3 text-sm transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Mail className="h-4 w-4 text-primary shrink-0" aria-hidden="true" />
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">E-mail oficial Asaas</p>
              <p className="font-medium text-foreground break-all">{ASAAS_SUPPORT.email}</p>
            </div>
          </a>
        </div>

        <div className="space-y-1 rounded-md border border-border bg-background p-3 text-xs text-muted-foreground">
          <p>{ASAAS_SUPPORT.shopdriveScope}</p>
          <p>{ASAAS_SUPPORT.asaasScope}</p>
        </div>
      </CardContent>
    </Card>
  );
}