import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Mail,
  Globe,
  CheckCircle2,
  XCircle,
  AlertCircle,
  RefreshCw,
  Copy,
  CloudCog,
  Loader2,
} from "lucide-react";
import { useTenantEmailSettings } from "@/hooks/useTenantEmailSettings";
import { toast } from "sonner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const TenantEmailSettingsSection = () => {
  const {
    settings,
    dnsRecords,
    loading,
    saving,
    verifying,
    saveSettings,
    verifyDomain,
    createCloudflareRecords,
  } = useTenantEmailSettings();

  const [form, setForm] = useState({
    sender_name: settings?.sender_name || "",
    sender_email: settings?.sender_email || "",
    reply_to: settings?.reply_to || "",
    email_domain: settings?.email_domain || "",
  });
  const [cloudflareZoneId, setCloudflareZoneId] = useState(settings?.cloudflare_zone_id || "");
  const [initialized, setInitialized] = useState(false);

  // Sync form with loaded settings
  if (settings && !initialized) {
    setForm({
      sender_name: settings.sender_name || "",
      sender_email: settings.sender_email || "",
      reply_to: settings.reply_to || "",
      email_domain: settings.email_domain || "",
    });
    setCloudflareZoneId(settings.cloudflare_zone_id || "");
    setInitialized(true);
  }

  const handleSave = async () => {
    await saveSettings({
      sender_name: form.sender_name,
      sender_email: form.sender_email,
      reply_to: form.reply_to,
      email_domain: form.email_domain,
    });
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copiado!");
  };

  const getStatusBadge = () => {
    if (!settings || !settings.email_domain) return null;
    switch (settings.domain_status) {
      case "verified":
        return (
          <Badge className="bg-green-500 text-white">
            <CheckCircle2 className="h-3 w-3 mr-1" /> Verificado
          </Badge>
        );
      case "verifying":
        return (
          <Badge variant="outline" className="border-blue-500 text-blue-600">
            <AlertCircle className="h-3 w-3 mr-1" /> Verificando
          </Badge>
        );
      default:
        return (
          <Badge variant="destructive">
            <XCircle className="h-3 w-3 mr-1" /> Não verificado
          </Badge>
        );
    }
  };

  if (loading) {
    return (
      <Card className="p-6">
        <div className="flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Carregando configurações de e-mail...</span>
        </div>
      </Card>
    );
  }

  const dnsEntries = settings?.email_domain
    ? [
        {
          type: "TXT",
          name: settings.email_domain,
          value: settings.spf_record || `v=spf1 include:shopdrive.com.br ~all`,
          label: "SPF",
          verified: settings.spf_verified,
        },
        {
          type: "TXT",
          name: `shopdrive._domainkey.${settings.email_domain}`,
          value: settings.dkim_record || "(chave DKIM)",
          label: "DKIM",
          verified: settings.dkim_verified,
        },
        {
          type: "TXT",
          name: `_dmarc.${settings.email_domain}`,
          value: settings.dmarc_record || `v=DMARC1; p=quarantine`,
          label: "DMARC",
          verified: settings.dmarc_verified,
        },
      ]
    : [];

  return (
    <div className="space-y-6">
      {/* Email Configuration */}
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-6">
          <div className="flex items-center justify-center w-8 h-8 bg-primary/10 rounded">
            <Mail className="h-4 w-4 text-primary" />
          </div>
          <h2 className="text-lg font-semibold text-foreground">Email da Loja</h2>
          {getStatusBadge()}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Nome do remetente</Label>
            <Input
              placeholder="Moda da Ana"
              value={form.sender_name}
              onChange={(e) => setForm((p) => ({ ...p, sender_name: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label>Email remetente</Label>
            <Input
              type="email"
              placeholder="contato@lojadaana.com.br"
              value={form.sender_email}
              onChange={(e) => setForm((p) => ({ ...p, sender_email: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label>Email de resposta</Label>
            <Input
              type="email"
              placeholder="suporte@lojadaana.com.br"
              value={form.reply_to}
              onChange={(e) => setForm((p) => ({ ...p, reply_to: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label>Domínio do email</Label>
            <Input
              placeholder="lojadaana.com.br"
              value={form.email_domain}
              onChange={(e) => setForm((p) => ({ ...p, email_domain: e.target.value }))}
            />
          </div>
        </div>

        <div className="flex justify-end mt-4 gap-2">
          <Button onClick={handleSave} disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Salvando...
              </>
            ) : (
              "Salvar Configurações"
            )}
          </Button>
        </div>
      </Card>

      {/* DNS Records */}
      {settings?.email_domain && (
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="flex items-center justify-center w-8 h-8 bg-primary/10 rounded">
                <Globe className="h-4 w-4 text-primary" />
              </div>
              <h2 className="text-lg font-semibold text-foreground">Registros DNS</h2>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={verifyDomain}
              disabled={verifying}
            >
              {verifying ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              Verificar Domínio
            </Button>
          </div>

          <p className="text-sm text-muted-foreground mb-4">
            Adicione os registros abaixo no DNS do seu domínio para autenticar o envio de e-mails.
          </p>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {dnsEntries.map((entry, idx) => (
                  <TableRow key={idx}>
                    <TableCell>
                      <Badge variant="outline" className="font-mono text-xs">
                        {entry.type}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-xs max-w-[200px] truncate">
                      {entry.name}
                    </TableCell>
                    <TableCell className="font-mono text-xs max-w-[300px] truncate">
                      {entry.value}
                    </TableCell>
                    <TableCell>
                      {entry.verified ? (
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                      ) : (
                        <XCircle className="h-4 w-4 text-red-500" />
                      )}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyToClipboard(entry.value)}
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Cloudflare Integration */}
          <Separator className="my-6" />

          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <CloudCog className="h-5 w-5 text-muted-foreground" />
              <h3 className="font-medium">Integração com Cloudflare (opcional)</h3>
            </div>
            <p className="text-sm text-muted-foreground">
              Se o seu domínio está gerenciado pelo Cloudflare, insira o Zone ID para criar os
              registros DNS automaticamente.
            </p>
            <div className="flex gap-2 max-w-md">
              <Input
                placeholder="Zone ID do Cloudflare"
                value={cloudflareZoneId}
                onChange={(e) => setCloudflareZoneId(e.target.value)}
              />
              <Button
                variant="outline"
                onClick={() => {
                  if (!cloudflareZoneId.trim()) {
                    toast.error("Informe o Zone ID do Cloudflare");
                    return;
                  }
                  createCloudflareRecords(cloudflareZoneId.trim());
                }}
              >
                Criar Registros
              </Button>
            </div>
          </div>

          {/* Existing Cloudflare Records */}
          {dnsRecords.length > 0 && (
            <>
              <Separator className="my-6" />
              <h3 className="font-medium mb-2">Registros criados no Cloudflare</h3>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Nome</TableHead>
                      <TableHead>Record ID</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dnsRecords.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell>
                          <Badge variant="outline" className="font-mono text-xs">
                            {r.record_type}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-mono text-xs">{r.record_name}</TableCell>
                        <TableCell className="font-mono text-xs">{r.record_id_cloudflare}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </Card>
      )}

      {/* Info Card */}
      <Card className="p-4 bg-muted/50 border-dashed">
        <div className="flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-muted-foreground mt-0.5 flex-shrink-0" />
          <div className="text-sm text-muted-foreground space-y-1">
            <p className="font-medium text-foreground">Como funciona?</p>
            <p>
              Quando o domínio estiver verificado, seus e-mails serão enviados como:{" "}
              <strong>
                {form.sender_name || "Sua Loja"} &lt;{form.sender_email || "contato@seudominio.com.br"}&gt;
              </strong>
            </p>
            <p>
              Caso o domínio não esteja verificado, o envio será feito como:{" "}
              <strong>
                {form.sender_name || "Sua Loja"} via ShopDrive &lt;no-reply@shopdrive.com.br&gt;
              </strong>
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
};
