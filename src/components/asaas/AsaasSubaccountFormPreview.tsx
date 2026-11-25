import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ASAAS_REGULATORY_COPY } from "@/lib/asaasCompliance";
import { Lock } from "lucide-react";

export interface AsaasStorePrefill {
  name: string;
  email: string;
  cpfCnpj: string;
  phone: string;
  zipCode: string;
  address: string;
  addressNumber: string;
  complement: string;
  neighborhood: string;
  city: string;
  state: string;
}

interface AsaasSubaccountFormPreviewProps {
  initialData: AsaasStorePrefill;
}

function inferPersonType(cpfCnpj: string): "PJ" | "PF" {
  const digits = cpfCnpj.replace(/\D/g, "");
  return digits.length === 11 ? "PF" : "PJ";
}

/**
 * Homologation-only subaccount registration preview form.
 * Displays required PF/PJ fields and read-only prefill from the store profile.
 * Never submits, persists financial data, or calls Asaas APIs in Phase 2.5.
 */
export function AsaasSubaccountFormPreview({ initialData }: AsaasSubaccountFormPreviewProps) {
  const [personType, setPersonType] = useState<"PJ" | "PF">(() => inferPersonType(initialData.cpfCnpj));
  const [form, setForm] = useState<AsaasStorePrefill>(initialData);
  const [birthDate, setBirthDate] = useState("");
  const [companyType, setCompanyType] = useState("");
  const [taxRegime, setTaxRegime] = useState("");

  useEffect(() => {
    setForm(initialData);
    setPersonType(inferPersonType(initialData.cpfCnpj));
  }, [initialData]);

  const updateField = (key: keyof AsaasStorePrefill, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="space-y-1">
            <CardTitle className="text-base">Dados cadastrais para abertura da conta Asaas</CardTitle>
            <CardDescription>{ASAAS_REGULATORY_COPY.ownershipNotice}</CardDescription>
          </div>
          <div className="inline-flex rounded-md border border-border bg-muted/40 p-1 self-start">
            <button
              type="button"
              onClick={() => setPersonType("PJ")}
              className={`px-3 py-1 text-xs font-medium rounded-sm transition-colors ${
                personType === "PJ"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Pessoa Jurídica (PJ)
            </button>
            <button
              type="button"
              onClick={() => setPersonType("PF")}
              className={`px-3 py-1 text-xs font-medium rounded-sm transition-colors ${
                personType === "PF"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Pessoa Física (PF)
            </button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <form onSubmit={(e) => e.preventDefault()} className="space-y-4" noValidate>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="asaas-name">
                {personType === "PJ" ? "Razão Social / Nome da empresa" : "Nome completo"}
              </Label>
              <Input
                id="asaas-name"
                value={form.name}
                onChange={(e) => updateField("name", e.target.value)}
                placeholder={personType === "PJ" ? "Ex.: Minha Loja Comércio Ltda" : "Ex.: Maria da Silva"}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="asaas-email">E-mail do titular</Label>
              <Input
                id="asaas-email"
                type="email"
                value={form.email}
                onChange={(e) => updateField("email", e.target.value)}
                placeholder="titular@loja.com.br"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="asaas-document">{personType === "PJ" ? "CNPJ" : "CPF"}</Label>
              <Input
                id="asaas-document"
                value={form.cpfCnpj}
                onChange={(e) => updateField("cpfCnpj", e.target.value)}
                placeholder={personType === "PJ" ? "00.000.000/0001-00" : "000.000.000-00"}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="asaas-phone">Telefone / Celular</Label>
              <Input
                id="asaas-phone"
                value={form.phone}
                onChange={(e) => updateField("phone", e.target.value)}
                placeholder="(11) 99999-9999"
              />
            </div>

            {personType === "PF" ? (
              <div className="space-y-1.5">
                <Label htmlFor="asaas-birth-date">Data de nascimento</Label>
                <Input
                  id="asaas-birth-date"
                  type="date"
                  value={birthDate}
                  onChange={(e) => setBirthDate(e.target.value)}
                />
              </div>
            ) : (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="asaas-company-type">Tipo de empresa</Label>
                  <Select value={companyType} onValueChange={setCompanyType}>
                    <SelectTrigger id="asaas-company-type">
                      <SelectValue placeholder="Selecione o tipo de empresa" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="MEI">MEI</SelectItem>
                      <SelectItem value="LIMITED">Sociedade Limitada (LTDA)</SelectItem>
                      <SelectItem value="INDIVIDUAL">Empresário Individual</SelectItem>
                      <SelectItem value="ASSOCIATION">Associação</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="asaas-tax-regime">Regime tributário (opcional)</Label>
                  <Select value={taxRegime} onValueChange={setTaxRegime}>
                    <SelectTrigger id="asaas-tax-regime">
                      <SelectValue placeholder="Selecione o regime tributário" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="SIMPLES_NACIONAL">Simples Nacional</SelectItem>
                      <SelectItem value="LUCRO_PRESUMIDO">Lucro Presumido</SelectItem>
                      <SelectItem value="LUCRO_REAL">Lucro Real</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-6 gap-4 pt-2 border-t border-border">
            <div className="space-y-1.5 md:col-span-2">
              <Label htmlFor="asaas-zip">CEP</Label>
              <Input
                id="asaas-zip"
                value={form.zipCode}
                onChange={(e) => updateField("zipCode", e.target.value)}
                placeholder="00000-000"
              />
            </div>

            <div className="space-y-1.5 md:col-span-3">
              <Label htmlFor="asaas-address">Endereço</Label>
              <Input
                id="asaas-address"
                value={form.address}
                onChange={(e) => updateField("address", e.target.value)}
                placeholder="Rua, Avenida..."
              />
            </div>

            <div className="space-y-1.5 md:col-span-1">
              <Label htmlFor="asaas-number">Número</Label>
              <Input
                id="asaas-number"
                value={form.addressNumber}
                onChange={(e) => updateField("addressNumber", e.target.value)}
                placeholder="123"
              />
            </div>

            <div className="space-y-1.5 md:col-span-2">
              <Label htmlFor="asaas-complement">Complemento</Label>
              <Input
                id="asaas-complement"
                value={form.complement}
                onChange={(e) => updateField("complement", e.target.value)}
                placeholder="Sala, bloco..."
              />
            </div>

            <div className="space-y-1.5 md:col-span-2">
              <Label htmlFor="asaas-neighborhood">Bairro</Label>
              <Input
                id="asaas-neighborhood"
                value={form.neighborhood}
                onChange={(e) => updateField("neighborhood", e.target.value)}
                placeholder="Centro"
              />
            </div>

            <div className="space-y-1.5 md:col-span-1">
              <Label htmlFor="asaas-city">Cidade</Label>
              <Input
                id="asaas-city"
                value={form.city}
                onChange={(e) => updateField("city", e.target.value)}
                placeholder="São Paulo"
              />
            </div>

            <div className="space-y-1.5 md:col-span-1">
              <Label htmlFor="asaas-state">UF</Label>
              <Input
                id="asaas-state"
                maxLength={2}
                value={form.state}
                onChange={(e) => updateField("state", e.target.value.toUpperCase())}
                placeholder="SP"
              />
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-4 border-t border-border">
            <p className="text-xs text-muted-foreground flex items-center gap-1.5">
              <Lock className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span>{ASAAS_REGULATORY_COPY.homologationUnavailableMessage}</span>
            </p>
            <Button type="button" disabled className="w-full sm:w-auto">
              {ASAAS_REGULATORY_COPY.homologationActionLabel}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}