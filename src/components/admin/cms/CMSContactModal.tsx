import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Save, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import type { Json } from "@/integrations/supabase/types";

interface CMSContactModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ContactContent {
  title: string;
  subtitle: string;
  support_title: string;
  support_text: string;
  financial_title: string;
  financial_text: string;
  privacy_title: string;
  privacy_text: string;
  dpo_email: string;
  commercial_title: string;
  commercial_text: string;
  financial_email: string;
  commercial_email: string;
}

const CMSContactModal = ({ open, onOpenChange }: CMSContactModalProps) => {
  const queryClient = useQueryClient();
  const [isSaving, setIsSaving] = useState(false);
  const [content, setContent] = useState<ContactContent>({
    title: "Fale com a VirtualMercado",
    subtitle: "Escolha o tipo de atendimento para que possamos ajudar mais rápido",
    support_title: "Suporte ao Lojista",
    support_text: "Problemas com sua loja, produtos, pedidos, pagamentos ou sistema",
    financial_title: "Financeiro e Cobranças",
    financial_text: "Problemas com sua assinatura, cartão ou cobranças",
    privacy_title: "Privacidade e Dados (LGPD)",
    privacy_text: "Solicitações sobre dados pessoais, exclusão ou privacidade",
    dpo_email: "dpo@virtualmercado.com.br",
    commercial_title: "Comercial e Parcerias",
    commercial_text: "Parcerias, revenda, integrações ou negócios",
    financial_email: "financeiro@virtualmercado.com.br",
    commercial_email: "comercial@virtualmercado.com.br",
  });

  useEffect(() => {
    if (open) {
      loadContent();
    }
  }, [open]);

  const loadContent = async () => {
    try {
      const { data, error } = await supabase
        .from("cms_landing_content")
        .select("content")
        .eq("section_key", "contact_page")
        .single();

      if (error && error.code !== "PGRST116") throw error;

      if (data?.content) {
        const loadedContent = data.content as unknown as ContactContent;
        setContent({
          title: loadedContent.title || content.title,
          subtitle: loadedContent.subtitle || content.subtitle,
          support_title: loadedContent.support_title || content.support_title,
          support_text: loadedContent.support_text || content.support_text,
          financial_title: loadedContent.financial_title || content.financial_title,
          financial_text: loadedContent.financial_text || content.financial_text,
          privacy_title: loadedContent.privacy_title || content.privacy_title,
          privacy_text: loadedContent.privacy_text || content.privacy_text,
          dpo_email: loadedContent.dpo_email || content.dpo_email,
          commercial_title: loadedContent.commercial_title || content.commercial_title,
          commercial_text: loadedContent.commercial_text || content.commercial_text,
          financial_email: loadedContent.financial_email || content.financial_email,
          commercial_email: loadedContent.commercial_email || content.commercial_email,
        });
      }
    } catch (error) {
      console.error("Error loading contact content:", error);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // Check if record exists
      const { data: existing } = await supabase
        .from("cms_landing_content")
        .select("id")
        .eq("section_key", "contact_page")
        .maybeSingle();

      if (existing) {
        // Update existing
        const { error } = await supabase
          .from("cms_landing_content")
          .update({
            content: content as unknown as Json,
            is_active: true,
            updated_at: new Date().toISOString(),
          })
          .eq("section_key", "contact_page");

        if (error) throw error;
      } else {
        // Insert new
        const { error } = await supabase
          .from("cms_landing_content")
          .insert([{
            section_key: "contact_page",
            content: content as unknown as Json,
            is_active: true,
          }]);

        if (error) throw error;
      }

      toast.success("Conteúdo salvo com sucesso!");
      queryClient.invalidateQueries({ queryKey: ["cms-landing-content"] });
      queryClient.invalidateQueries({ queryKey: ["cms-landing-content-admin"] });
      onOpenChange(false);
    } catch (error) {
      console.error("Error saving contact content:", error);
      toast.error("Erro ao salvar conteúdo");
    } finally {
      setIsSaving(false);
    }
  };

  const updateField = (field: keyof ContactContent, value: string) => {
    setContent((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Gerenciar Página Fale Conosco</DialogTitle>
          <DialogDescription>
            Edite os textos e e-mails de contato da página.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh] pr-4">
          <div className="space-y-6 py-4">
            {/* Main Content */}
            <div className="space-y-4">
              <h3 className="font-medium text-foreground">Cabeçalho</h3>
              <div className="space-y-3">
                <div>
                  <Label>Título da página</Label>
                  <Input
                    value={content.title}
                    onChange={(e) => updateField("title", e.target.value)}
                    placeholder="Título principal"
                  />
                </div>
                <div>
                  <Label>Subtítulo</Label>
                  <Textarea
                    value={content.subtitle}
                    onChange={(e) => updateField("subtitle", e.target.value)}
                    placeholder="Subtítulo explicativo"
                    rows={2}
                  />
                </div>
              </div>
            </div>

            {/* Support Section */}
            <div className="space-y-4 border-t pt-4">
              <h3 className="font-medium text-foreground">Suporte ao Lojista</h3>
              <div className="space-y-3">
                <div>
                  <Label>Título do card</Label>
                  <Input
                    value={content.support_title}
                    onChange={(e) => updateField("support_title", e.target.value)}
                  />
                </div>
                <div>
                  <Label>Descrição</Label>
                  <Textarea
                    value={content.support_text}
                    onChange={(e) => updateField("support_text", e.target.value)}
                    rows={2}
                  />
                </div>
              </div>
            </div>

            {/* Financial Section */}
            <div className="space-y-4 border-t pt-4">
              <h3 className="font-medium text-foreground">Financeiro e Cobranças</h3>
              <div className="space-y-3">
                <div>
                  <Label>Título do card</Label>
                  <Input
                    value={content.financial_title}
                    onChange={(e) => updateField("financial_title", e.target.value)}
                  />
                </div>
                <div>
                  <Label>Descrição</Label>
                  <Textarea
                    value={content.financial_text}
                    onChange={(e) => updateField("financial_text", e.target.value)}
                    rows={2}
                  />
                </div>
                <div>
                  <Label>E-mail financeiro</Label>
                  <Input
                    type="email"
                    value={content.financial_email}
                    onChange={(e) => updateField("financial_email", e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* Privacy Section */}
            <div className="space-y-4 border-t pt-4">
              <h3 className="font-medium text-foreground">Privacidade e LGPD</h3>
              <div className="space-y-3">
                <div>
                  <Label>Título do card</Label>
                  <Input
                    value={content.privacy_title}
                    onChange={(e) => updateField("privacy_title", e.target.value)}
                  />
                </div>
                <div>
                  <Label>Descrição</Label>
                  <Textarea
                    value={content.privacy_text}
                    onChange={(e) => updateField("privacy_text", e.target.value)}
                    rows={2}
                  />
                </div>
                <div>
                  <Label>E-mail do DPO (LGPD)</Label>
                  <Input
                    type="email"
                    value={content.dpo_email}
                    onChange={(e) => updateField("dpo_email", e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* Commercial Section */}
            <div className="space-y-4 border-t pt-4">
              <h3 className="font-medium text-foreground">Comercial e Parcerias</h3>
              <div className="space-y-3">
                <div>
                  <Label>Título do card</Label>
                  <Input
                    value={content.commercial_title}
                    onChange={(e) => updateField("commercial_title", e.target.value)}
                  />
                </div>
                <div>
                  <Label>Descrição</Label>
                  <Textarea
                    value={content.commercial_text}
                    onChange={(e) => updateField("commercial_text", e.target.value)}
                    rows={2}
                  />
                </div>
                <div>
                  <Label>E-mail comercial</Label>
                  <Input
                    type="email"
                    value={content.commercial_email}
                    onChange={(e) => updateField("commercial_email", e.target.value)}
                  />
                </div>
              </div>
            </div>
          </div>
        </ScrollArea>

        <div className="flex justify-end gap-3 pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Salvar alterações
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CMSContactModal;
