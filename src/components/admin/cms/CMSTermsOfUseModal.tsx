import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Loader2, Save, FileText, Scale } from "lucide-react";
import { toast } from "sonner";

interface TermsOfUseContent {
  title: string;
  content: string;
  is_active: boolean;
  display_order: number;
}

interface CMSTermsOfUseModalProps {
  isOpen: boolean;
  onClose: () => void;
  content: Record<string, any> | undefined;
  onSave: (content: Record<string, any>) => Promise<void>;
}

const defaultTermsContent = `IDENTIFICAÇÃO DA PLATAFORMA

A ShopDrive é operada por:
Razão Social: [INSERIR RAZÃO SOCIAL]
CNPJ: [INSERIR CNPJ]
E-mail jurídico: [INSERIR E-MAIL JURÍDICO]

DEFINIÇÕES

"ShopDrive" significa a plataforma ShopDrive.
"Lojista" é a pessoa física ou jurídica que cria uma loja na plataforma.
"Loja" é a página de vendas criada pelo lojista dentro da ShopDrive.
"Cliente final" é o consumidor que compra diretamente do lojista.

SERVIÇOS OFERECIDOS

A ShopDrive fornece:

- Plataforma de criação de lojas online
- Catálogo de produtos
- Checkout e integração com meios de pagamento
- Hospedagem das páginas
- Ferramentas de gestão e automação

O QUE A SHOPDRIVE NÃO FAZ

A ShopDrive não:

- Vende produtos ao consumidor final
- Possui estoque
- Realiza entregas
- Emite notas fiscais pelos lojistas
- Se responsabiliza por defeitos, atrasos ou qualidade dos produtos

RESPONSABILIDADE DO LOJISTA

O lojista é o único responsável por:

- Produtos anunciados
- Preços e promoções
- Estoque e logística
- Emissão de notas fiscais
- Tributos e obrigações legais
- Atendimento ao cliente
- Garantias e devoluções

PAGAMENTOS E PLANOS

A ShopDrive opera por meio de planos de assinatura.
O lojista paga para utilizar a plataforma, independentemente de suas vendas.
A ShopDrive não garante volume de vendas, faturamento ou lucro.

CANCELAMENTO E ENCERRAMENTO

O lojista pode cancelar sua conta a qualquer momento conforme regras do painel.
A ShopDrive pode encerrar contas que:

- Violem a lei
- Vendam produtos proibidos
- Causem danos à plataforma ou terceiros
- Utilizem a plataforma de forma fraudulenta

LIMITAÇÃO DE RESPONSABILIDADE

A ShopDrive não se responsabiliza por:

- Perdas financeiras do lojista
- Problemas entre lojista e cliente final
- Chargebacks, fraudes ou disputas
- Erros causados por integrações externas

A responsabilidade da ShopDrive se limita ao valor pago pelo lojista à plataforma.

FORO JURÍDICO

Fica eleito o foro da cidade de [INSERIR CIDADE] – [INSERIR ESTADO], para dirimir quaisquer conflitos.`;

const defaultContent: TermsOfUseContent = {
  title: "TERMOS DE USO — SHOPDRIVE",
  content: defaultTermsContent,
  is_active: true,
  display_order: 2,
};

const CMSTermsOfUseModal = ({ isOpen, onClose, content, onSave }: CMSTermsOfUseModalProps) => {
  const [formData, setFormData] = useState<TermsOfUseContent>(defaultContent);
  const [isSaving, setIsSaving] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);

  useEffect(() => {
    if (isOpen && !hasLoaded) {
      if (content && Object.keys(content).length > 0) {
        setFormData({
          title: content.title || defaultContent.title,
          content: content.content || defaultContent.content,
          is_active: content.is_active ?? true,
          display_order: content.display_order || 2,
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
      toast.success("Página 'Termos de Uso' atualizada com sucesso!");
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
            <Scale className="h-5 w-5 text-[#6a1b9a]" />
            Página Institucional: Termos de Uso
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            Gerencie o conteúdo da página "Termos de Uso" exibida na Landing Page.
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
              <Label htmlFor="terms-title">Título da Página</Label>
              <Input
                id="terms-title"
                value={formData.title}
                onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                placeholder="Ex: TERMOS DE USO — SHOPDRIVE"
              />
            </div>

            {/* Content */}
            <div className="space-y-2">
              <Label htmlFor="terms-content">Texto dos Termos de Uso</Label>
              <p className="text-xs text-muted-foreground">
                Use linhas em branco para separar seções. Títulos em MAIÚSCULAS serão formatados como cabeçalhos. 
                Linhas começando com "-" serão formatadas como lista.
              </p>
              <Textarea
                id="terms-content"
                value={formData.content}
                onChange={(e) => setFormData(prev => ({ ...prev, content: e.target.value }))}
                placeholder="Digite o conteúdo dos termos de uso..."
                className="min-h-[400px] resize-y font-mono text-sm"
              />
            </div>

            {/* Display Order */}
            <div className="space-y-2">
              <Label htmlFor="terms-display_order">Ordem de Exibição</Label>
              <Input
                id="terms-display_order"
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
                <li>• <strong>Títulos de seção:</strong> Escreva em MAIÚSCULAS (ex: DEFINIÇÕES)</li>
                <li>• <strong>Parágrafos:</strong> Separe com uma linha em branco</li>
                <li>• <strong>Listas:</strong> Inicie a linha com "-" (hífen)</li>
                <li>• <strong>Campos a preencher:</strong> Use [TEXTO] para indicar dados a serem substituídos</li>
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

export default CMSTermsOfUseModal;
