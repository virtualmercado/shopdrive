import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAsaasHomologationAccess } from "@/hooks/useAsaasHomologationAccess";
import { AsaasFinancialServicesSeal } from "@/components/asaas/AsaasFinancialServicesSeal";
import { ASAAS_REGULATORY_COPY } from "@/lib/asaasCompliance";
import { ArrowRight } from "lucide-react";

/**
 * Structurally independent Asaas BaaS card rendered in Gateway de Pagamento
 * exclusively for stores explicitly authorized by the backend feature flag.
 * Opens only the Phase 2.5 compliance/homologation screen — no external calls.
 */
export function AsaasPaymentGatewayCard() {
  const navigate = useNavigate();
  const { enabled, loading } = useAsaasHomologationAccess();

  if (loading || !enabled) {
    return null;
  }

  return (
    <Card className="border-border">
      <CardHeader className="gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1.5 min-w-0">
          <CardTitle className="text-lg">{ASAAS_REGULATORY_COPY.cardTitle}</CardTitle>
          <CardDescription>{ASAAS_REGULATORY_COPY.cardDescription}</CardDescription>
          <p className="text-xs font-medium text-foreground pt-1">
            {ASAAS_REGULATORY_COPY.cardProviderNotice}
          </p>
        </div>
        <div className="shrink-0">
          <AsaasFinancialServicesSeal surface="auto" size="default" />
        </div>
      </CardHeader>
      <CardContent className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-0">
        <p className="text-xs text-muted-foreground">
          {ASAAS_REGULATORY_COPY.transparencyPrimary}
        </p>
        <Button
          type="button"
          onClick={() => navigate("/lojista/payment-methods/asaas")}
          className="w-full sm:w-auto shrink-0 gap-2"
        >
          {ASAAS_REGULATORY_COPY.cardActionLabel}
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Button>
      </CardContent>
    </Card>
  );
}