import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Loader2, Save, FileText, Shield } from "lucide-react";
import { toast } from "sonner";

interface PrivacyPolicyContent {
  title: string;
  content: string;
  is_active: boolean;
  display_order: number;
}

interface CMSPrivacyPolicyModalProps {
  isOpen: boolean;
  onClose: () => void;
  content: Record<string, any> | undefined;
  onSave: (content: Record<string, any>) => Promise<void>;
}

const defaultPrivacyContent = `INTRODUÇÃO

A VirtualMercado ("VM") respeita a privacidade e a proteção dos dados pessoais de seus usuários e opera em conformidade com a Lei Geral de Proteção de Dados (Lei nº 13.709/2018 – LGPD).

Esta Política descreve como os dados são coletados, utilizados, armazenados e protegidos.

DADOS COLETADOS

A VM pode coletar os seguintes dados:

- Nome completo
- E-mail
- CPF ou CNPJ
- Endereço
- Telefone
- Endereço IP
- Dados de pagamento (processados por gateways)
- Informações de navegação

DE QUEM OS DADOS SÃO COLETADOS

Os dados são coletados de:

- Lojistas cadastrados na plataforma
- Compradores finais que realizam pedidos nas lojas

FINALIDADE DO USO DOS DADOS

Os dados são utilizados para:

- Criar e gerenciar contas
- Processar pedidos e pagamentos
- Executar cobranças de assinatura
- Emitir comunicações
- Cumprir obrigações legais
- Prevenir fraudes

COMPARTILHAMENTO DE DADOS

Os dados podem ser compartilhados apenas com:

- Gateways de pagamento (Pix, cartão, boleto)
- Empresas de logística e Correios
- Plataformas de e-mail e notificação
- WhatsApp (quando usado como canal de comunicação)

Sempre apenas na medida necessária para execução do serviço.

ARMAZENAMENTO E SEGURANÇA

A VM utiliza:

- Servidores seguros
- Criptografia de dados
- Controle de acesso
- Boas práticas de segurança da informação

para proteger os dados contra acesso não autorizado, vazamento ou uso indevido.

DIREITOS DO USUÁRIO

O usuário pode, a qualquer momento:

- Solicitar acesso aos seus dados
- Solicitar correção
- Solicitar exclusão
- Solicitar portabilidade
- Revogar consentimento

conforme garantido pela LGPD.

CONTATO DO DPO (ENCARREGADO DE DADOS)

Para exercer seus direitos ou esclarecer dúvidas:

E-mail do DPO: [INSERIR E-MAIL DE PRIVACIDADE]`;

const defaultContent: PrivacyPolicyContent = {
  title: "POLÍTICA DE PRIVACIDADE — VIRTUALMERCADO",
  content: defaultPrivacyContent,
  is_active: true,
  display_order: 3,
};

const CMSPrivacyPolicyModal = ({ isOpen, onClose, content, onSave }: CMSPrivacyPolicyModalProps) => {
  const [formData, setFormData] = useState<PrivacyPolicyContent>(defaultContent);
  const [isSaving, setIsSaving] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);

  useEffect(() => {
    if (isOpen && !hasLoaded) {
      if (content && Object.keys(content).length > 0) {
        setFormData({
          title: content.title || defaultContent.title,
          content: content.content || defaultContent.content,
          is_active: content.is_active ?? true,
          display_order: content.display_order || 3,
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
      toast.success("Página 'Política de Privacidade' atualizada com sucesso!");
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
            <Shield className="h-5 w-5 text-[#6a1b9a]" />
            Página Institucional: Política de Privacidade
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            Gerencie o conteúdo da página "Política de Privacidade" exibida na Landing Page.
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
              <Label htmlFor="privacy-title">Título da Página</Label>
              <Input
                id="privacy-title"
                value={formData.title}
                onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                placeholder="Ex: POLÍTICA DE PRIVACIDADE — VIRTUALMERCADO"
              />
            </div>

            {/* Content */}
            <div className="space-y-2">
              <Label htmlFor="privacy-content">Texto da Política de Privacidade</Label>
              <p className="text-xs text-muted-foreground">
                Use linhas em branco para separar seções. Títulos em MAIÚSCULAS serão formatados como cabeçalhos. 
                Linhas começando com "-" serão formatadas como lista.
              </p>
              <Textarea
                id="privacy-content"
                value={formData.content}
                onChange={(e) => setFormData(prev => ({ ...prev, content: e.target.value }))}
                placeholder="Digite o conteúdo da política de privacidade..."
                className="min-h-[400px] resize-y font-mono text-sm"
              />
            </div>

            {/* Display Order */}
            <div className="space-y-2">
              <Label htmlFor="privacy-display_order">Ordem de Exibição</Label>
              <Input
                id="privacy-display_order"
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
                <li>• <strong>Títulos de seção:</strong> Escreva em MAIÚSCULAS (ex: DADOS COLETADOS)</li>
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

export default CMSPrivacyPolicyModal;
