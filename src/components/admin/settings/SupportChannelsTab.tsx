import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Loader2, Save, MessageCircle, ExternalLink, Copy } from "lucide-react";
import { useSupportChannels } from "@/hooks/usePlatformSettings";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

const SupportChannelsTab = () => {
  const { channels, loading, saving, updateChannel } = useSupportChannels();
  const [formData, setFormData] = useState<Record<string, any>>({});

  useEffect(() => {
    if (channels.length > 0) {
      const whatsappChannel = channels.find((c) => c.channel_type === "whatsapp");
      if (whatsappChannel) {
        setFormData(whatsappChannel);
      }
    }
  }, [channels]);

  const handleChange = (key: string, value: any) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    if (!formData.id) return;
    await updateChannel(formData.id, {
      phone_number: formData.phone_number,
      operating_hours: formData.operating_hours,
      default_message: formData.default_message,
      is_active: formData.is_active,
    });
  };

  const generatePreviewLink = () => {
    if (!formData.phone_number) return "";
    const cleanPhone = formData.phone_number.replace(/\D/g, "");
    const message = encodeURIComponent(formData.default_message || "");
    return `https://wa.me/${cleanPhone}?text=${message}`;
  };

  const copyLink = () => {
    const link = generatePreviewLink();
    if (link) {
      navigator.clipboard.writeText(link);
      toast.success("Link copiado para a área de transferência!");
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-72 mt-2" />
        </CardHeader>
        <CardContent className="space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <MessageCircle className="h-6 w-6 text-green-600" />
            <div className="flex-1">
              <div className="flex items-center gap-3">
                <CardTitle>WhatsApp de Atendimento</CardTitle>
                <Badge variant={formData.is_active ? "default" : "secondary"}>
                  {formData.is_active ? "Ativo" : "Inativo"}
                </Badge>
              </div>
              <CardDescription>
                Canal oficial de atendimento via WhatsApp
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
            <div>
              <Label className="text-base font-medium">Status do Canal</Label>
              <p className="text-sm text-muted-foreground">
                Ative ou desative o canal de WhatsApp
              </p>
            </div>
            <Switch
              checked={formData.is_active || false}
              onCheckedChange={(checked) => handleChange("is_active", checked)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone_number">Número de WhatsApp</Label>
            <Input
              id="phone_number"
              value={formData.phone_number || ""}
              onChange={(e) => handleChange("phone_number", e.target.value)}
              placeholder="5511999999999 (código do país + DDD + número)"
            />
            <p className="text-xs text-muted-foreground">
              Formato: código do país + DDD + número (ex: 5511999999999)
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="operating_hours">Horário de Atendimento</Label>
            <Input
              id="operating_hours"
              value={formData.operating_hours || ""}
              onChange={(e) => handleChange("operating_hours", e.target.value)}
              placeholder="Segunda a Sexta, 9h às 18h"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="default_message">Mensagem Padrão Automática</Label>
            <Textarea
              id="default_message"
              value={formData.default_message || ""}
              onChange={(e) => handleChange("default_message", e.target.value)}
              placeholder="Olá! Preciso de ajuda..."
              className="min-h-[100px]"
            />
            <p className="text-xs text-muted-foreground">
              Variáveis disponíveis: {"{{nome_da_loja}}"}, {"{{email_do_assinante}}"}, {"{{plano_do_assinante}}"}
            </p>
          </div>

          {formData.phone_number && (
            <div className="p-4 bg-green-50 border border-green-200 rounded-lg space-y-3">
              <Label className="text-sm font-medium text-green-800">
                Preview do Link Gerado
              </Label>
              <div className="flex items-center gap-2">
                <Input
                  value={generatePreviewLink()}
                  readOnly
                  className="bg-white text-xs"
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={copyLink}
                  title="Copiar link"
                >
                  <Copy className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => window.open(generatePreviewLink(), "_blank")}
                  title="Testar link"
                >
                  <ExternalLink className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          <div className="flex justify-end pt-4">
            <Button
              onClick={handleSave}
              disabled={saving}
              className="bg-[#6a1b9a] hover:bg-[#5a1589]"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Salvar Configurações
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default SupportChannelsTab;
