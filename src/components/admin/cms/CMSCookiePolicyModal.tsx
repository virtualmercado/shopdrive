import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Loader2, Save, FileText, Cookie } from "lucide-react";
import { toast } from "sonner";

interface CookiePolicyContent {
  title: string;
  content: string;
  is_active: boolean;
  display_order: number;
}

interface CMSCookiePolicyModalProps {
  isOpen: boolean;
  onClose: () => void;
  content: Record<string, any> | undefined;
  onSave: (content: Record<string, any>) => Promise<void>;
}

const defaultCookieContent = `O QUE SÃO COOKIES

Cookies são pequenos arquivos armazenados no seu navegador que permitem reconhecer preferências e melhorar sua experiência.

QUAIS COOKIES UTILIZAMOS

A VirtualMercado utiliza:

- Cookies necessários: funcionamento da plataforma
- Cookies de desempenho: análise de uso
- Cookies de funcionalidade: lembrar preferências
- Cookies de marketing: anúncios e remarketing

PARA QUE USAMOS COOKIES

Os cookies são usados para:

- Manter você logado
- Salvar preferências
- Melhorar desempenho
- Analisar comportamento
- Exibir anúncios relevantes

COMO GERENCIAR

Você pode aceitar, recusar ou configurar cookies pelo banner ou pelo link no rodapé.

COMPARTILHAMENTO

Cookies podem ser definidos por:

- Gateways de pagamento
- Ferramentas de análise
- Plataformas de marketing

CONFORMIDADE LGPD

O uso de cookies respeita a Lei Geral de Proteção de Dados. Nenhum cookie não essencial é ativado sem consentimento.`;

const defaultContent: CookiePolicyContent = {
  title: "POLÍTICA DE COOKIES — VIRTUALMERCADO",
  content: defaultCookieContent,
  is_active: true,
  display_order: 4,
};

const CMSCookiePolicyModal = ({ isOpen, onClose, content, onSave }: CMSCookiePolicyModalProps) => {
  const [formData, setFormData] = useState<CookiePolicyContent>(defaultContent);
  const [isSaving, setIsSaving] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);

  useEffect(() => {
    if (isOpen && !hasLoaded) {
      if (content && Object.keys(content).length > 0) {
        setFormData({
          title: content.title || defaultContent.title,
          content: content.content || defaultContent.content,
          is_active: content.is_active ?? true,
          display_order: content.display_order || 4,
        });
      } else {
        // If no content exists, use default content
        setFormData(defaultContent);
      }
      setHasLoaded(true);
    }
    
    if (!isOpen) {
      setHasLoaded(false);
    }
  }, [isOpen, content, hasLoaded]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave(formData);
      toast.success("Página 'Política de Cookies' atualizada com sucesso!");
      onClose();
    } catch (error) {
      toast.error("Erro ao salvar conteúdo.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Cookie className="h-5 w-5 text-[#6a1b9a]" />
            Página Institucional: Política de Cookies
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            Gerencie o conteúdo da página "Política de Cookies" exibida na Landing Page.
          </p>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto pr-4 max-h-[calc(90vh-180px)]">
          <div className="space-y-6 pb-4">
            {/* Status Toggle */}
            <div className="flex items-center justify-between p-4 border rounded-lg bg-muted/30">
              <div>
                <Label className="text-base font-medium">Status da Página</Label>
                <p className="text-sm text-muted-foreground">
                  {formData.is_active ? "Página visível para visitantes" : "Página oculta (não acessível)"}
                </p>
              </div>
              <Switch
                checked={formData.is_active}
                onCheckedChange={(v) => setFormData(prev => ({ ...prev, is_active: v }))}
              />
            </div>

            {/* Title */}
            <div className="space-y-2">
              <Label htmlFor="cookie-title">Título da Página</Label>
              <Input
                id="cookie-title"
                value={formData.title}
                onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                placeholder="Ex: POLÍTICA DE COOKIES — VIRTUALMERCADO"
              />
            </div>

            {/* Content */}
            <div className="space-y-2">
              <Label htmlFor="cookie-content">Texto da Política de Cookies</Label>
              <p className="text-xs text-muted-foreground">
                Use linhas em branco para separar seções. Títulos em MAIÚSCULAS serão formatados como cabeçalhos. 
                Linhas começando com "-" serão formatadas como lista.
              </p>
              <Textarea
                id="cookie-content"
                value={formData.content}
                onChange={(e) => setFormData(prev => ({ ...prev, content: e.target.value }))}
                placeholder="Digite o conteúdo da política de cookies..."
                className="min-h-[400px] resize-y font-mono text-sm"
              />
            </div>

            {/* Display Order */}
            <div className="space-y-2">
              <Label htmlFor="cookie-display_order">Ordem de Exibição</Label>
              <Input
                id="cookie-display_order"
                type="number"
                min={1}
                value={formData.display_order}
                onChange={(e) => setFormData(prev => ({ ...prev, display_order: parseInt(e.target.value) || 1 }))}
                className="w-24"
              />
              <p className="text-xs text-muted-foreground">
                Usado para ordenar páginas institucionais (menor número = primeiro)
              </p>
            </div>

            {/* Help Section */}
            <div className="p-4 border rounded-lg bg-blue-50/50 dark:bg-blue-950/20">
              <h4 className="font-medium flex items-center gap-2 mb-2">
                <FileText className="h-4 w-4 text-blue-600" />
                Dicas de Formatação
              </h4>
              <ul className="text-xs text-muted-foreground space-y-1">
                <li>• <strong>Títulos de seção:</strong> Escreva em MAIÚSCULAS (ex: QUAIS COOKIES UTILIZAMOS)</li>
                <li>• <strong>Parágrafos:</strong> Separe com uma linha em branco</li>
                <li>• <strong>Listas:</strong> Inicie a linha com "-" (hífen)</li>
              </ul>
            </div>
          </div>
        </div>

        <DialogFooter className="border-t pt-4">
          <Button variant="outline" onClick={onClose} disabled={isSaving}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Salvando...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Salvar Alterações
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CMSCookiePolicyModal;
