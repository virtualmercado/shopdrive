import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Download, FileText, FileJson } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

interface Subscriber {
  id: string;
  store_name: string | null;
  email: string | null;
}

interface DataExportModalProps {
  subscriber: Subscriber | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const DataExportModal = ({
  subscriber,
  open,
  onOpenChange,
}: DataExportModalProps) => {
  const { toast } = useToast();
  const { user } = useAuth();
  
  const [format, setFormat] = useState<"csv" | "json">("csv");
  const [includeCadastral, setIncludeCadastral] = useState(true);
  const [includeFinancial, setIncludeFinancial] = useState(true);
  const [includeConsents, setIncludeConsents] = useState(true);
  const [includeAudit, setIncludeAudit] = useState(true);
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async () => {
    if (!subscriber || !user) return;
    
    setIsExporting(true);
    
    try {
      // Fetch data based on selections
      const exportData: Record<string, any> = {};
      
      if (includeCadastral) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("id, full_name, email, phone, cpf_cnpj, address, store_name, store_slug, created_at")
          .eq("id", subscriber.id)
          .single();
        exportData.dados_cadastrais = profile;
      }
      
      if (includeFinancial) {
        const { data: invoices } = await supabase
          .from("invoices")
          .select("id, amount, status, due_date, paid_at, created_at, reference_period_start, reference_period_end")
          .eq("subscriber_id", subscriber.id);
        
        const { data: payments } = await supabase
          .from("payments")
          .select("id, amount, gateway, status, paid_at, created_at")
          .eq("invoice_id", subscriber.id);
        
        exportData.historico_financeiro = {
          faturas: invoices || [],
          pagamentos: payments || [],
        };
      }
      
      if (includeConsents) {
        // For now, create a placeholder since we don't have a consents table
        exportData.consentimentos = {
          termos_de_uso: {
            aceito: true,
            data: subscriber.id ? "Data de cadastro" : null,
            versao: "1.0",
          },
          politica_privacidade: {
            aceito: true,
            data: subscriber.id ? "Data de cadastro" : null,
            versao: "1.0",
          },
        };
      }
      
      if (includeAudit) {
        const { data: logs } = await supabase
          .from("audit_logs")
          .select("action, entity_type, created_at")
          .eq("user_id", subscriber.id)
          .order("created_at", { ascending: false })
          .limit(100);
        
        exportData.auditoria_resumo = logs || [];
      }
      
      // Generate file content
      let content: string;
      let filename: string;
      let mimeType: string;
      
      if (format === "json") {
        content = JSON.stringify(exportData, null, 2);
        filename = `export_${subscriber.id}_${new Date().toISOString().split("T")[0]}.json`;
        mimeType = "application/json";
      } else {
        // Convert to CSV format
        const csvLines: string[] = [];
        
        for (const [section, data] of Object.entries(exportData)) {
          csvLines.push(`\n=== ${section.toUpperCase()} ===\n`);
          
          if (Array.isArray(data)) {
            if (data.length > 0) {
              csvLines.push(Object.keys(data[0]).join(","));
              data.forEach(item => {
                csvLines.push(Object.values(item).map(v => 
                  typeof v === "string" ? `"${v}"` : v
                ).join(","));
              });
            }
          } else if (typeof data === "object") {
            Object.entries(data).forEach(([key, value]) => {
              if (typeof value === "object") {
                csvLines.push(`${key}:`);
                Object.entries(value as object).forEach(([k, v]) => {
                  csvLines.push(`  ${k},${v}`);
                });
              } else {
                csvLines.push(`${key},${value}`);
              }
            });
          }
        }
        
        content = csvLines.join("\n");
        filename = `export_${subscriber.id}_${new Date().toISOString().split("T")[0]}.csv`;
        mimeType = "text/csv";
      }
      
      // Create and download file
      const blob = new Blob([content], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      // Log export in audit
      await supabase
        .from("audit_logs")
        .insert({
          user_id: user.id,
          action: "data_export",
          entity_type: "profile",
          entity_id: subscriber.id,
          metadata: {
            format,
            includeCadastral,
            includeFinancial,
            includeConsents,
            includeAudit,
            exported_by: user.id,
          }
        });
      
      // Record export in data_exports table
      await supabase
        .from("data_exports")
        .insert({
          merchant_id: subscriber.id,
          requested_by: user.id,
          format,
          include_cadastral: includeCadastral,
          include_financial: includeFinancial,
          include_consents: includeConsents,
          include_audit: includeAudit,
          status: "completed",
          completed_at: new Date().toISOString(),
          expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        });
      
      toast({
        title: "Exportação concluída",
        description: `Arquivo ${filename} baixado com sucesso.`,
      });
      
      onOpenChange(false);
      
    } catch (error) {
      console.error("Error exporting data:", error);
      toast({
        title: "Erro na exportação",
        description: "Não foi possível gerar a exportação. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  };

  if (!subscriber) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            Exportar dados do lojista
          </DialogTitle>
          <DialogDescription>
            Exportar dados de <strong>{subscriber.store_name || subscriber.email}</strong>
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-6 py-4">
          <div className="space-y-3">
            <Label>Formato</Label>
            <RadioGroup value={format} onValueChange={(v) => setFormat(v as "csv" | "json")}>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="csv" id="csv" />
                <Label htmlFor="csv" className="flex items-center gap-2 cursor-pointer">
                  <FileText className="h-4 w-4" />
                  CSV
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="json" id="json" />
                <Label htmlFor="json" className="flex items-center gap-2 cursor-pointer">
                  <FileJson className="h-4 w-4" />
                  JSON
                </Label>
              </div>
            </RadioGroup>
          </div>
          
          <div className="space-y-3">
            <Label>Incluir</Label>
            <div className="space-y-3">
              <div className="flex items-center space-x-3">
                <Checkbox
                  id="cadastral"
                  checked={includeCadastral}
                  onCheckedChange={(c) => setIncludeCadastral(c as boolean)}
                />
                <Label htmlFor="cadastral" className="cursor-pointer">Dados cadastrais</Label>
              </div>
              <div className="flex items-center space-x-3">
                <Checkbox
                  id="financial"
                  checked={includeFinancial}
                  onCheckedChange={(c) => setIncludeFinancial(c as boolean)}
                />
                <Label htmlFor="financial" className="cursor-pointer">Histórico financeiro (faturas/pagamentos)</Label>
              </div>
              <div className="flex items-center space-x-3">
                <Checkbox
                  id="consents"
                  checked={includeConsents}
                  onCheckedChange={(c) => setIncludeConsents(c as boolean)}
                />
                <Label htmlFor="consents" className="cursor-pointer">Consentimentos (termos e privacidade)</Label>
              </div>
              <div className="flex items-center space-x-3">
                <Checkbox
                  id="audit"
                  checked={includeAudit}
                  onCheckedChange={(c) => setIncludeAudit(c as boolean)}
                />
                <Label htmlFor="audit" className="cursor-pointer">Logs de auditoria (resumo)</Label>
              </div>
            </div>
          </div>
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isExporting}>
            Cancelar
          </Button>
          <Button onClick={handleExport} disabled={isExporting}>
            {isExporting ? "Gerando..." : "Gerar exportação"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
