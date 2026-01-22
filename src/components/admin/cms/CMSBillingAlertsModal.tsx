import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { 
  AlertTriangle, 
  Clock, 
  Info, 
  Loader2, 
  Save, 
  Settings,
  Eye,
  RefreshCw
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

interface BillingAlert {
  id: string;
  alert_key: string;
  title: string;
  message: string;
  cta_text: string;
  cta_url: string;
  is_active: boolean;
}

interface BillingSetting {
  id: string;
  setting_key: string;
  setting_value: string;
  description: string | null;
}

const alertKeyLabels: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  past_due: { label: "Pagamento Pendente", icon: AlertTriangle, color: "text-amber-600" },
  in_grace_period: { label: "Período de Tolerância", icon: Clock, color: "text-red-600" },
  processing: { label: "Em Compensação", icon: Loader2, color: "text-blue-600" },
  downgraded: { label: "Conta Rebaixada", icon: Info, color: "text-gray-600" },
};

const placeholdersList = [
  { key: "{nomePlano}", description: "Nome do plano atual" },
  { key: "{valor}", description: "Valor do plano" },
  { key: "{dataVencimento}", description: "Data de vencimento" },
  { key: "{diasRestantes}", description: "Dias restantes do período de tolerância" },
  { key: "{ciclo}", description: "Ciclo de cobrança (mensal/anual)" },
];

export const CMSBillingAlertsModal = ({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) => {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("content");
  const [editingAlert, setEditingAlert] = useState<BillingAlert | null>(null);
  const [previewAlert, setPreviewAlert] = useState<string | null>(null);

  // Fetch alerts
  const { data: alerts, isLoading: alertsLoading } = useQuery({
    queryKey: ["admin-billing-alerts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cms_billing_alerts")
        .select("*")
        .order("alert_key");
      if (error) throw error;
      return data as BillingAlert[];
    },
    enabled: open,
  });

  // Fetch settings
  const { data: settings, isLoading: settingsLoading } = useQuery({
    queryKey: ["admin-billing-settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("billing_alert_settings")
        .select("*");
      if (error) throw error;
      return data as BillingSetting[];
    },
    enabled: open,
  });

  // Update alert mutation
  const updateAlertMutation = useMutation({
    mutationFn: async (alert: BillingAlert) => {
      const { error } = await supabase
        .from("cms_billing_alerts")
        .update({
          title: alert.title,
          message: alert.message,
          cta_text: alert.cta_text,
          cta_url: alert.cta_url,
          is_active: alert.is_active,
          updated_at: new Date().toISOString(),
        })
        .eq("id", alert.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-billing-alerts"] });
      queryClient.invalidateQueries({ queryKey: ["billing-alert-content"] });
      toast.success("Alerta atualizado com sucesso!");
      setEditingAlert(null);
    },
    onError: () => {
      toast.error("Erro ao atualizar alerta");
    },
  });

  // Update setting mutation
  const updateSettingMutation = useMutation({
    mutationFn: async ({ key, value }: { key: string; value: string }) => {
      const { error } = await supabase
        .from("billing_alert_settings")
        .update({
          setting_value: value,
          updated_at: new Date().toISOString(),
        })
        .eq("setting_key", key);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-billing-settings"] });
      queryClient.invalidateQueries({ queryKey: ["billing-alert-settings"] });
      toast.success("Configuração atualizada!");
    },
    onError: () => {
      toast.error("Erro ao atualizar configuração");
    },
  });

  const getSettingValue = (key: string): string => {
    return settings?.find(s => s.setting_key === key)?.setting_value || "";
  };

  const handleSaveAlert = () => {
    if (editingAlert) {
      updateAlertMutation.mutate(editingAlert);
    }
  };

  const handleToggleEnabled = (checked: boolean) => {
    updateSettingMutation.mutate({ key: "enabled", value: checked ? "true" : "false" });
  };

  if (alertsLoading || settingsLoading) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Alertas de Cobrança
          </DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="content">Conteúdo</TabsTrigger>
            <TabsTrigger value="settings">Configurações</TabsTrigger>
            <TabsTrigger value="preview">Preview</TabsTrigger>
          </TabsList>

          {/* Content Tab */}
          <TabsContent value="content" className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
              <div className="flex items-center gap-2">
                <Switch
                  checked={getSettingValue("enabled") === "true"}
                  onCheckedChange={handleToggleEnabled}
                />
                <span className="text-sm font-medium">Banner global de cobrança</span>
              </div>
              <Badge variant={getSettingValue("enabled") === "true" ? "default" : "secondary"}>
                {getSettingValue("enabled") === "true" ? "Ativado" : "Desativado"}
              </Badge>
            </div>

            <div className="space-y-3">
              {alerts?.map((alert) => {
                const config = alertKeyLabels[alert.alert_key];
                const Icon = config?.icon || Info;
                
                return (
                  <Card key={alert.id} className="overflow-hidden">
                    <CardHeader className="py-3 px-4 bg-muted/50">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Icon className={`h-4 w-4 ${config?.color || "text-gray-600"}`} />
                          <CardTitle className="text-sm font-medium">
                            {config?.label || alert.alert_key}
                          </CardTitle>
                          <Badge variant={alert.is_active ? "default" : "secondary"} className="text-xs">
                            {alert.is_active ? "Ativo" : "Inativo"}
                          </Badge>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setEditingAlert(editingAlert?.id === alert.id ? null : alert)}
                        >
                          {editingAlert?.id === alert.id ? "Fechar" : "Editar"}
                        </Button>
                      </div>
                    </CardHeader>
                    
                    {editingAlert?.id === alert.id && (
                      <CardContent className="pt-4 space-y-4">
                        <div className="grid gap-4">
                          <div>
                            <Label>Título</Label>
                            <Input
                              value={editingAlert.title}
                              onChange={(e) => setEditingAlert({ ...editingAlert, title: e.target.value })}
                            />
                          </div>
                          <div>
                            <Label>Mensagem</Label>
                            <Textarea
                              value={editingAlert.message}
                              onChange={(e) => setEditingAlert({ ...editingAlert, message: e.target.value })}
                              rows={3}
                            />
                            <div className="mt-2 flex flex-wrap gap-1">
                              {placeholdersList.map((p) => (
                                <Badge
                                  key={p.key}
                                  variant="outline"
                                  className="text-xs cursor-pointer hover:bg-muted"
                                  onClick={() => {
                                    const newMessage = editingAlert.message + ` ${p.key}`;
                                    setEditingAlert({ ...editingAlert, message: newMessage });
                                  }}
                                  title={p.description}
                                >
                                  {p.key}
                                </Badge>
                              ))}
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <Label>Texto do CTA</Label>
                              <Input
                                value={editingAlert.cta_text}
                                onChange={(e) => setEditingAlert({ ...editingAlert, cta_text: e.target.value })}
                              />
                            </div>
                            <div>
                              <Label>URL do CTA</Label>
                              <Input
                                value={editingAlert.cta_url}
                                onChange={(e) => setEditingAlert({ ...editingAlert, cta_url: e.target.value })}
                              />
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={editingAlert.is_active}
                              onCheckedChange={(checked) => setEditingAlert({ ...editingAlert, is_active: checked })}
                            />
                            <Label>Alerta ativo</Label>
                          </div>
                        </div>
                        <div className="flex justify-end gap-2 pt-2">
                          <Button variant="outline" onClick={() => setEditingAlert(null)}>
                            Cancelar
                          </Button>
                          <Button onClick={handleSaveAlert} disabled={updateAlertMutation.isPending}>
                            {updateAlertMutation.isPending ? (
                              <Loader2 className="h-4 w-4 animate-spin mr-2" />
                            ) : (
                              <Save className="h-4 w-4 mr-2" />
                            )}
                            Salvar
                          </Button>
                        </div>
                      </CardContent>
                    )}
                  </Card>
                );
              })}
            </div>
          </TabsContent>

          {/* Settings Tab */}
          <TabsContent value="settings" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <Settings className="h-4 w-4" />
                  Configurações Globais
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Dias de tolerância (Mensal)</Label>
                    <Input
                      type="number"
                      value={getSettingValue("grace_period_days_monthly")}
                      onChange={(e) => updateSettingMutation.mutate({ 
                        key: "grace_period_days_monthly", 
                        value: e.target.value 
                      })}
                      min={1}
                      max={30}
                    />
                    <p className="text-xs text-muted-foreground mt-1">Padrão: 7 dias</p>
                  </div>
                  <div>
                    <Label>Dias de tolerância (Anual)</Label>
                    <Input
                      type="number"
                      value={getSettingValue("grace_period_days_annual")}
                      onChange={(e) => updateSettingMutation.mutate({ 
                        key: "grace_period_days_annual", 
                        value: e.target.value 
                      })}
                      min={1}
                      max={60}
                    />
                    <p className="text-xs text-muted-foreground mt-1">Padrão: 14 dias</p>
                  </div>
                </div>
                <div>
                  <Label>Tempo máximo de compensação (horas)</Label>
                  <Input
                    type="number"
                    value={getSettingValue("max_compensation_hours")}
                    onChange={(e) => updateSettingMutation.mutate({ 
                      key: "max_compensation_hours", 
                      value: e.target.value 
                    })}
                    min={1}
                    max={168}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Tempo exibido para PIX/boleto em compensação. Padrão: 48 horas
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Placeholders Disponíveis</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-2">
                  {placeholdersList.map((p) => (
                    <div key={p.key} className="flex items-center gap-2 text-sm">
                      <code className="bg-muted px-2 py-1 rounded text-xs">{p.key}</code>
                      <span className="text-muted-foreground">{p.description}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Preview Tab */}
          <TabsContent value="preview" className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Selecione um estado para visualizar como o banner aparecerá para o lojista:
            </p>
            
            <div className="flex gap-2 flex-wrap">
              {alerts?.map((alert) => {
                const config = alertKeyLabels[alert.alert_key];
                return (
                  <Button
                    key={alert.id}
                    variant={previewAlert === alert.alert_key ? "default" : "outline"}
                    size="sm"
                    onClick={() => setPreviewAlert(alert.alert_key)}
                  >
                    {config?.label || alert.alert_key}
                  </Button>
                );
              })}
            </div>

            {previewAlert && alerts && (
              <div className="border rounded-lg overflow-hidden">
                <PreviewBanner 
                  alert={alerts.find(a => a.alert_key === previewAlert)!} 
                />
              </div>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

const PreviewBanner = ({ alert }: { alert: BillingAlert }) => {
  const config = alertKeyLabels[alert.alert_key];
  const Icon = config?.icon || Info;
  
  const bgClasses: Record<string, string> = {
    past_due: "bg-amber-50 border-amber-300",
    in_grace_period: "bg-red-50 border-red-300",
    processing: "bg-blue-50 border-blue-300",
    downgraded: "bg-gray-50 border-gray-300",
  };

  const textClasses: Record<string, string> = {
    past_due: "text-amber-900",
    in_grace_period: "text-red-900",
    processing: "text-blue-900",
    downgraded: "text-gray-900",
  };

  const buttonClasses: Record<string, string> = {
    past_due: "bg-amber-600 hover:bg-amber-700",
    in_grace_period: "bg-red-600 hover:bg-red-700",
    processing: "bg-blue-600 hover:bg-blue-700",
    downgraded: "bg-gray-700 hover:bg-gray-800",
  };

  // Replace placeholders with sample data
  const displayMessage = alert.message
    .replace(/{diasRestantes}/g, "5")
    .replace(/{nomePlano}/g, "PRO")
    .replace(/{ciclo}/g, "mensal")
    .replace(/{dataVencimento}/g, "25/01/2026")
    .replace(/{valor}/g, "R$ 49,90");

  return (
    <div className={`w-full px-4 py-3 border-b-2 ${bgClasses[alert.alert_key]}`}>
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div className="flex items-start gap-3">
          <Icon className={`h-5 w-5 mt-0.5 shrink-0 ${config?.color}`} />
          <div className="space-y-1">
            <p className={`font-semibold text-sm ${textClasses[alert.alert_key]}`}>
              {alert.title}
            </p>
            <p className={`text-sm opacity-90 ${textClasses[alert.alert_key]}`}>
              {displayMessage}
            </p>
          </div>
        </div>
        
        <Button size="sm" className={`shrink-0 text-white ${buttonClasses[alert.alert_key]}`}>
          {alert.cta_text}
        </Button>
      </div>
    </div>
  );
};

export default CMSBillingAlertsModal;
