import { useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useMerchantStore } from "@/hooks/useMerchantStore";
import { useAsaasHomologationAccess } from "@/hooks/useAsaasHomologationAccess";
import { AsaasFinancialServicesSeal } from "@/components/asaas/AsaasFinancialServicesSeal";
import { AsaasFinancialSupportCard } from "@/components/asaas/AsaasFinancialSupportCard";
import { AsaasAccountStatusPanel } from "@/components/asaas/AsaasAccountStatusPanel";
import { useAsaasMerchantAccountStatus } from "@/hooks/useAsaasMerchantAccountStatus";
import { unavailableAsaasMerchantStatus } from "@/lib/asaasAccountStatus";
import {
  AsaasSubaccountFormPreview,
  type AsaasStorePrefill,
} from "@/components/asaas/AsaasSubaccountFormPreview";
import { ASAAS_JOURNEY_STEPS, ASAAS_REGULATORY_COPY } from "@/lib/asaasCompliance";
import { ArrowLeft, Loader2, ShieldCheck } from "lucide-react";

const EMPTY_PREFILL: AsaasStorePrefill = {
  name: "",
  email: "",
  cpfCnpj: "",
  phone: "",
  zipCode: "",
  address: "",
  addressNumber: "",
  complement: "",
  neighborhood: "",
  city: "",
  state: "",
};

/**
 * Dedicated stable route (/lojista/payment-methods/asaas) for Asaas BaaS
 * Phase 2.5 regulatory compliance and homologation evidence.
 * Strictly gated by server-side per-store feature flag; never calls Asaas APIs.
 */
export default function AsaasBaasActivation() {
  const navigate = useNavigate();
  const { storeId, client: scopedClient } = useMerchantStore();
  const { enabled, loading } = useAsaasHomologationAccess();
  const accountStatus = useAsaasMerchantAccountStatus(enabled);
  const [prefill, setPrefill] = useState<AsaasStorePrefill>(EMPTY_PREFILL);

  useEffect(() => {
    setPrefill(EMPTY_PREFILL);
    if (!enabled || !storeId || accountStatus.isHomologation) return;
    let active = true;

    void scopedClient
      .from("profiles")
      .select(
        "full_name, store_name, email, cpf_cnpj, phone, whatsapp_number, address, address_number, address_complement, address_neighborhood, address_city, address_state, address_zip_code, city",
      )
      .eq("id", storeId)
      .maybeSingle()
      .then(({ data }) => {
        if (!active || !data) return;
        setPrefill({
          name: data.store_name || data.full_name || "",
          email: data.email || "",
          cpfCnpj: data.cpf_cnpj || "",
          phone: data.phone || data.whatsapp_number || "",
          zipCode: data.address_zip_code || "",
          address: data.address || "",
          addressNumber: data.address_number || "",
          complement: data.address_complement || "",
          neighborhood: data.address_neighborhood || "",
          city: data.address_city || data.city || "",
          state: data.address_state || "",
        });
      });

    return () => {
      active = false;
    };
  }, [enabled, storeId, scopedClient, accountStatus.isHomologation]);

  if (loading) {
    return (
      <DashboardLayout pageTitle="Serviços financeiros Asaas">
        <div className="flex items-center justify-center min-h-[320px]">
          <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    );
  }

  if (!enabled) {
    return <Navigate to="/lojista/payment-methods" replace />;
  }

  const isApprovedAccount =
    accountStatus.isHomologation && !accountStatus.loading && accountStatus.result?.state === "active";

  return (
    <DashboardLayout pageTitle="Serviços financeiros Asaas">
      <div className="space-y-6 max-w-4xl">
        <div className="flex items-center justify-between gap-4">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => navigate("/lojista/payment-methods")}
            className="gap-2 -ml-2 text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Voltar para Gateway de Pagamento
          </Button>
        </div>

        {/* Main header with ShopDrive context and official Asaas seal */}
        <Card>
          <CardHeader className="gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-1.5 min-w-0">
              <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-foreground">
                {isApprovedAccount ? "Serviços financeiros Asaas" : ASAAS_REGULATORY_COPY.pageTitle}
              </h1>
              <CardDescription className="text-sm">
                {ASAAS_REGULATORY_COPY.pageSubtitle}
              </CardDescription>
            </div>
            <div className="shrink-0">
              <AsaasFinancialServicesSeal surface="auto" size="default" />
            </div>
          </CardHeader>
          <CardContent className="space-y-3 pt-0">
            <div className="rounded-lg border border-border bg-muted/40 p-4 space-y-2 text-sm">
              <div className="flex items-start gap-2.5">
                <ShieldCheck className="h-4 w-4 text-primary shrink-0 mt-0.5" aria-hidden="true" />
                <div className="space-y-1.5">
                  <p className="font-medium text-foreground">
                    {ASAAS_REGULATORY_COPY.transparencyPrimary}
                  </p>
                  <p className="text-muted-foreground">
                    {ASAAS_REGULATORY_COPY.transparencySecondary}
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {accountStatus.isHomologation ? (
          accountStatus.loading ? (
            <Card>
              <CardContent className="flex min-h-[240px] items-center justify-center">
                <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" aria-label="Consultando situação cadastral" />
              </CardContent>
            </Card>
          ) : (
            <AsaasAccountStatusPanel
              status={accountStatus.result ?? unavailableAsaasMerchantStatus(storeId ?? undefined)}
              onRetry={accountStatus.retry}
            />
          )
        ) : (
          <>
            {/* Visual 5-step onboarding journey preserved for visual-only stores. */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Jornada de ativação</CardTitle>
                <CardDescription>{ASAAS_REGULATORY_COPY.journeyStageNotice}</CardDescription>
              </CardHeader>
              <CardContent>
                <ol className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                  {ASAAS_JOURNEY_STEPS.map((item) => (
                    <li
                      key={item.step}
                      className="rounded-lg border border-border bg-muted/20 p-3 flex flex-col justify-between gap-2"
                    >
                      <div className="space-y-1">
                        <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                          {item.step}
                        </span>
                        <p className="text-sm font-medium text-foreground leading-snug">{item.title}</p>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          {item.description}
                        </p>
                      </div>
                      <p className="text-[11px] text-muted-foreground pt-1 border-t border-border">
                        {ASAAS_REGULATORY_COPY.journeyStageNotice}
                      </p>
                    </li>
                  ))}
                </ol>
              </CardContent>
            </Card>

            {/* Evidence form (no submission, no persistence, no external API calls) */}
            <AsaasSubaccountFormPreview initialData={prefill} />
          </>
        )}

        {/* Reusable Asaas financial support channels */}
        <AsaasFinancialSupportCard />

        {/* Regulatory compliance notice prepared for future Terms of Use inclusion */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{ASAAS_REGULATORY_COPY.termsReferenceTitle}</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1.5 text-xs text-muted-foreground list-disc pl-5">
              {ASAAS_REGULATORY_COPY.termsReferencePoints.map((point) => (
                <li key={point}>{point}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}