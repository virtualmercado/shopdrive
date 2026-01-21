import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { 
  Loader2, 
  Save, 
  Crown,
  Plus,
  Trash2,
  GripVertical,
  Check,
  CircleDollarSign,
  Coins,
  LockOpen,
  Trophy,
  Star,
  Zap,
  Shield,
  Gift,
  Award
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// Available icons for features
const AVAILABLE_ICONS = [
  { name: "Check", icon: Check },
  { name: "CircleDollarSign", icon: CircleDollarSign },
  { name: "Coins", icon: Coins },
  { name: "LockOpen", icon: LockOpen },
  { name: "Trophy", icon: Trophy },
  { name: "Star", icon: Star },
  { name: "Zap", icon: Zap },
  { name: "Shield", icon: Shield },
  { name: "Gift", icon: Gift },
  { name: "Award", icon: Award },
  { name: "Crown", icon: Crown },
];

interface PlanFeature {
  icon: string;
  text: string;
}

interface PreviousPlan {
  name: string;
  label: string;
  description: string;
}

interface Plan {
  id: string;
  name: string;
  display_name: string;
  subtitle: string;
  monthly_price: number;
  button_text: string;
  badge_text: string;
  badge_active: boolean;
  badge_color: string;
  previous_plan?: PreviousPlan;
  features: PlanFeature[];
}

interface Guarantee {
  icon: string;
  text: string;
}

interface PlansContent {
  modal_title: string;
  modal_subtitle: string;
  toggle_monthly: string;
  toggle_annual: string;
  discount_badge: string;
  plans: Plan[];
  guarantees: Guarantee[];
  annual_discount_text: string;
  annual_savings_text: string;
}

interface CMSPlansModalProps {
  isOpen: boolean;
  onClose: () => void;
  content: Record<string, any> | undefined;
  onSave: (content: PlansContent) => Promise<void>;
}

// Default guarantees (must match PlansSection defaults)
const DEFAULT_GUARANTEES: Guarantee[] = [
  { icon: "CircleDollarSign", text: "Garantia de 7 dias" },
  { icon: "Coins", text: "Sem comissão sobre as vendas" },
  { icon: "LockOpen", text: "Cancele a qualquer momento, sem multas ou taxas" },
  { icon: "Trophy", text: "Plano escolhido por milhares de assinantes" },
];

// Default plans (must match PlansSection defaults)
const DEFAULT_PLANS: Plan[] = [
  {
    id: "gratis",
    name: "GRÁTIS",
    display_name: "Plano GRÁTIS",
    subtitle: "Comece a vender agora, sem custos.",
    monthly_price: 0,
    button_text: "Começar grátis",
    badge_text: "",
    badge_active: false,
    badge_color: "#f97316",
    features: [
      { icon: "Check", text: "Até 20 produtos cadastrados" },
      { icon: "Check", text: "Até 40 clientes ativos" },
      { icon: "Check", text: "Pedidos ilimitados" },
      { icon: "Check", text: "ERP (Gestor Virtual) integrado" },
      { icon: "Check", text: "Frete personalizado" },
      { icon: "Check", text: "Gerador de catálogo PDF ilimitado" },
      { icon: "Check", text: "Controle de estoque" },
      { icon: "Check", text: "Sem anúncios" },
      { icon: "Check", text: "Agente de mensagens" },
      { icon: "Check", text: "Calculadora de frete" },
      { icon: "Check", text: "Versão mobile responsiva" },
      { icon: "Check", text: "Categorias e subcategorias ilimitadas" },
      { icon: "Check", text: "Dashboard e relatórios avançados" },
      { icon: "Check", text: "Compartilhamento com suas redes sociais" },
      { icon: "Check", text: "Gateway e checkout de pagamentos" },
    ],
  },
  {
    id: "pro",
    name: "PRO",
    display_name: "Plano PRO",
    subtitle: "O melhor custo benefício do mercado online.",
    monthly_price: 29.97,
    button_text: "Escolher PRO",
    badge_text: "Recomendado",
    badge_active: true,
    badge_color: "#f97316",
    previous_plan: {
      name: "Plano GRÁTIS",
      label: "GRÁTIS",
      description: "Tudo o que o plano GRÁTIS oferece, e mais:",
    },
    features: [
      { icon: "Check", text: "Até 150 produtos cadastrados" },
      { icon: "Check", text: "Até 300 clientes ativos" },
      { icon: "Check", text: "Personalização total do seu site (sua logo e cores)" },
      { icon: "Check", text: "Cupons de desconto ilimitado" },
    ],
  },
  {
    id: "premium",
    name: "PREMIUM",
    display_name: "Plano PREMIUM",
    subtitle: "A solução ideal para quem quer escalar mais rápido as vendas.",
    monthly_price: 49.97,
    button_text: "Escolher PREMIUM",
    badge_text: "",
    badge_active: false,
    badge_color: "#f97316",
    previous_plan: {
      name: "Plano PRO",
      label: "PRO",
      description: "Tudo o que o plano PRO oferece, e mais:",
    },
    features: [
      { icon: "Check", text: "Produtos ilimitados" },
      { icon: "Check", text: "Clientes ilimitados" },
      { icon: "Check", text: "Editor de imagens com IA" },
      { icon: "Check", text: "Vínculo de domínio próprio" },
      { icon: "Check", text: "Suporte dedicado via e-mail e WhatsApp" },
    ],
  },
];

const defaultContent: PlansContent = {
  modal_title: "Escolha o plano ideal para você",
  modal_subtitle: "Comece grátis e faça upgrade quando quiser",
  toggle_monthly: "Mensal",
  toggle_annual: "Anual",
  discount_badge: "-30% DESC.",
  plans: DEFAULT_PLANS,
  guarantees: DEFAULT_GUARANTEES,
  annual_discount_text: "- 30% de desconto no plano anual",
  annual_savings_text: "Economize 30%",
};

export default function CMSPlansModal({ isOpen, onClose, content, onSave }: CMSPlansModalProps) {
  const [formData, setFormData] = useState<PlansContent>(defaultContent);
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState("general");

  useEffect(() => {
    if (content) {
      // Merge content with defaults - use defaults for empty arrays
      const mergedContent: PlansContent = {
        modal_title: content.modal_title || defaultContent.modal_title,
        modal_subtitle: content.modal_subtitle || defaultContent.modal_subtitle,
        toggle_monthly: content.toggle_monthly || defaultContent.toggle_monthly,
        toggle_annual: content.toggle_annual || defaultContent.toggle_annual,
        discount_badge: content.discount_badge || defaultContent.discount_badge,
        annual_discount_text: content.annual_discount_text || defaultContent.annual_discount_text,
        annual_savings_text: content.annual_savings_text || defaultContent.annual_savings_text,
        // Use defaults if arrays are empty or undefined
        plans: (content.plans && content.plans.length > 0) ? content.plans : DEFAULT_PLANS,
        guarantees: (content.guarantees && content.guarantees.length > 0) ? content.guarantees : DEFAULT_GUARANTEES,
      };
      setFormData(mergedContent);
    } else {
      setFormData(defaultContent);
    }
  }, [content, isOpen]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave(formData);
      toast.success("Conteúdo dos planos atualizado com sucesso!");
      onClose();
    } catch (error) {
      toast.error("Erro ao salvar conteúdo.");
    } finally {
      setIsSaving(false);
    }
  };

  const updatePlan = (planIndex: number, field: keyof Plan, value: any) => {
    const newPlans = [...formData.plans];
    newPlans[planIndex] = { ...newPlans[planIndex], [field]: value };
    setFormData({ ...formData, plans: newPlans });
  };

  const updatePlanFeature = (planIndex: number, featureIndex: number, field: keyof PlanFeature, value: string) => {
    const newPlans = [...formData.plans];
    const newFeatures = [...newPlans[planIndex].features];
    newFeatures[featureIndex] = { ...newFeatures[featureIndex], [field]: value };
    newPlans[planIndex] = { ...newPlans[planIndex], features: newFeatures };
    setFormData({ ...formData, plans: newPlans });
  };

  const addPlanFeature = (planIndex: number) => {
    const newPlans = [...formData.plans];
    newPlans[planIndex].features.push({ icon: "Check", text: "" });
    setFormData({ ...formData, plans: newPlans });
  };

  const removePlanFeature = (planIndex: number, featureIndex: number) => {
    const newPlans = [...formData.plans];
    newPlans[planIndex].features = newPlans[planIndex].features.filter((_, i) => i !== featureIndex);
    setFormData({ ...formData, plans: newPlans });
  };

  const updatePreviousPlan = (planIndex: number, field: keyof PreviousPlan, value: string) => {
    const newPlans = [...formData.plans];
    if (!newPlans[planIndex].previous_plan) {
      newPlans[planIndex].previous_plan = { name: "", label: "", description: "" };
    }
    newPlans[planIndex].previous_plan = { ...newPlans[planIndex].previous_plan!, [field]: value };
    setFormData({ ...formData, plans: newPlans });
  };

  const updateGuarantee = (index: number, field: keyof Guarantee, value: string) => {
    const newGuarantees = [...formData.guarantees];
    newGuarantees[index] = { ...newGuarantees[index], [field]: value };
    setFormData({ ...formData, guarantees: newGuarantees });
  };

  const addGuarantee = () => {
    setFormData({
      ...formData,
      guarantees: [...formData.guarantees, { icon: "Check", text: "" }],
    });
  };

  const removeGuarantee = (index: number) => {
    setFormData({
      ...formData,
      guarantees: formData.guarantees.filter((_, i) => i !== index),
    });
  };

  const getIconComponent = (iconName: string) => {
    const found = AVAILABLE_ICONS.find((i) => i.name === iconName);
    return found ? found.icon : Check;
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] p-0">
        <DialogHeader className="p-6 pb-0">
          <DialogTitle className="text-xl flex items-center gap-2">
            <Crown className="h-5 w-5 text-[#6a1b9a]" />
            CMS – Planos da Plataforma
          </DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1">
          <div className="px-6">
            <TabsList className="grid grid-cols-4 w-full">
              <TabsTrigger value="general">Geral</TabsTrigger>
              <TabsTrigger value="gratis">Plano Grátis</TabsTrigger>
              <TabsTrigger value="pro">Plano PRO</TabsTrigger>
              <TabsTrigger value="premium">Plano Premium</TabsTrigger>
            </TabsList>
          </div>

          <ScrollArea className="h-[60vh] px-6 py-4">
            {/* General Tab */}
            <TabsContent value="general" className="mt-0 space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Cabeçalho do Modal</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Título Principal</Label>
                      <Input
                        value={formData.modal_title}
                        onChange={(e) => setFormData({ ...formData, modal_title: e.target.value })}
                        placeholder="Escolha o plano ideal para você"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Subtítulo</Label>
                      <Input
                        value={formData.modal_subtitle}
                        onChange={(e) => setFormData({ ...formData, modal_subtitle: e.target.value })}
                        placeholder="Comece grátis e faça upgrade quando quiser"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Toggle Mensal/Anual</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label>Texto "Mensal"</Label>
                      <Input
                        value={formData.toggle_monthly}
                        onChange={(e) => setFormData({ ...formData, toggle_monthly: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Texto "Anual"</Label>
                      <Input
                        value={formData.toggle_annual}
                        onChange={(e) => setFormData({ ...formData, toggle_annual: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Badge de Desconto</Label>
                      <Input
                        value={formData.discount_badge}
                        onChange={(e) => setFormData({ ...formData, discount_badge: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Texto do Desconto Anual</Label>
                      <Input
                        value={formData.annual_discount_text}
                        onChange={(e) => setFormData({ ...formData, annual_discount_text: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Texto de Economia</Label>
                      <Input
                        value={formData.annual_savings_text}
                        onChange={(e) => setFormData({ ...formData, annual_savings_text: e.target.value })}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="text-base">Garantias (PRO e Premium)</CardTitle>
                  <Button size="sm" variant="outline" onClick={addGuarantee}>
                    <Plus className="h-4 w-4 mr-1" />
                    Adicionar
                  </Button>
                </CardHeader>
                <CardContent className="space-y-3">
                  {formData.guarantees.map((guarantee, index) => (
                    <div key={index} className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                      <GripVertical className="h-4 w-4 text-muted-foreground" />
                      <Select
                        value={guarantee.icon}
                        onValueChange={(value) => updateGuarantee(index, "icon", value)}
                      >
                        <SelectTrigger className="w-[140px]">
                          <SelectValue>
                            {(() => {
                              const IconComp = getIconComponent(guarantee.icon);
                              return (
                                <div className="flex items-center gap-2">
                                  <IconComp className="h-4 w-4" />
                                  <span>{guarantee.icon}</span>
                                </div>
                              );
                            })()}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {AVAILABLE_ICONS.map((iconItem) => (
                            <SelectItem key={iconItem.name} value={iconItem.name}>
                              <div className="flex items-center gap-2">
                                <iconItem.icon className="h-4 w-4" />
                                <span>{iconItem.name}</span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Input
                        value={guarantee.text}
                        onChange={(e) => updateGuarantee(index, "text", e.target.value)}
                        placeholder="Texto da garantia"
                        className="flex-1"
                      />
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => removeGuarantee(index)}
                        className="text-red-500 hover:text-red-600"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Plan Tabs */}
            {formData.plans.map((plan, planIndex) => (
              <TabsContent key={plan.id} value={plan.id} className="mt-0 space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Informações do Plano</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Nome do Plano</Label>
                        <Input
                          value={plan.name}
                          onChange={(e) => updatePlan(planIndex, "name", e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Nome de Exibição</Label>
                        <Input
                          value={plan.display_name}
                          onChange={(e) => updatePlan(planIndex, "display_name", e.target.value)}
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Subtítulo</Label>
                      <Textarea
                        value={plan.subtitle}
                        onChange={(e) => updatePlan(planIndex, "subtitle", e.target.value)}
                        rows={2}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Preço Mensal (R$)</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={plan.monthly_price}
                          onChange={(e) => updatePlan(planIndex, "monthly_price", parseFloat(e.target.value) || 0)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Texto do Botão</Label>
                        <Input
                          value={plan.button_text}
                          onChange={(e) => updatePlan(planIndex, "button_text", e.target.value)}
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Selo de Destaque</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={plan.badge_active}
                          onCheckedChange={(checked) => updatePlan(planIndex, "badge_active", checked)}
                        />
                        <Label>Exibir selo</Label>
                      </div>
                    </div>
                    {plan.badge_active && (
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Texto do Selo</Label>
                          <Input
                            value={plan.badge_text}
                            onChange={(e) => updatePlan(planIndex, "badge_text", e.target.value)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Cor do Selo</Label>
                          <div className="flex gap-2">
                            <Input
                              type="color"
                              value={plan.badge_color}
                              onChange={(e) => updatePlan(planIndex, "badge_color", e.target.value)}
                              className="w-16 h-10 p-1 cursor-pointer"
                            />
                            <Input
                              value={plan.badge_color}
                              onChange={(e) => updatePlan(planIndex, "badge_color", e.target.value)}
                              className="flex-1"
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Previous Plan Reference (for PRO and PREMIUM) */}
                {plan.previous_plan && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Referência ao Plano Anterior</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Nome do Plano Anterior</Label>
                          <Input
                            value={plan.previous_plan.name}
                            onChange={(e) => updatePreviousPlan(planIndex, "name", e.target.value)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Label (Badge)</Label>
                          <Input
                            value={plan.previous_plan.label}
                            onChange={(e) => updatePreviousPlan(planIndex, "label", e.target.value)}
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>Descrição</Label>
                        <Textarea
                          value={plan.previous_plan.description}
                          onChange={(e) => updatePreviousPlan(planIndex, "description", e.target.value)}
                          rows={2}
                        />
                      </div>
                    </CardContent>
                  </Card>
                )}

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle className="text-base">Recursos do Plano</CardTitle>
                    <Button size="sm" variant="outline" onClick={() => addPlanFeature(planIndex)}>
                      <Plus className="h-4 w-4 mr-1" />
                      Adicionar
                    </Button>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {plan.features.map((feature, featureIndex) => (
                      <div key={featureIndex} className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                        <GripVertical className="h-4 w-4 text-muted-foreground" />
                        <Select
                          value={feature.icon}
                          onValueChange={(value) => updatePlanFeature(planIndex, featureIndex, "icon", value)}
                        >
                          <SelectTrigger className="w-[140px]">
                            <SelectValue>
                              {(() => {
                                const IconComp = getIconComponent(feature.icon);
                                return (
                                  <div className="flex items-center gap-2">
                                    <IconComp className="h-4 w-4" />
                                    <span>{feature.icon}</span>
                                  </div>
                                );
                              })()}
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            {AVAILABLE_ICONS.map((iconItem) => (
                              <SelectItem key={iconItem.name} value={iconItem.name}>
                                <div className="flex items-center gap-2">
                                  <iconItem.icon className="h-4 w-4" />
                                  <span>{iconItem.name}</span>
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Input
                          value={feature.text}
                          onChange={(e) => updatePlanFeature(planIndex, featureIndex, "text", e.target.value)}
                          placeholder="Texto do recurso"
                          className="flex-1"
                        />
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => removePlanFeature(planIndex, featureIndex)}
                          className="text-red-500 hover:text-red-600"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </TabsContent>
            ))}
          </ScrollArea>
        </Tabs>

        <Separator />

        <div className="flex justify-end gap-3 p-6 pt-4">
          <Button variant="outline" onClick={onClose} disabled={isSaving}>
            Cancelar
          </Button>
          <Button
            onClick={handleSave}
            disabled={isSaving}
            className="bg-[#6a1b9a] hover:bg-[#6a1b9a]/90"
          >
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
        </div>
      </DialogContent>
    </Dialog>
  );
}
