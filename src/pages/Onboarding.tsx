import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Store, Settings, Package, Rocket, ArrowRight, ArrowLeft, SkipForward } from "lucide-react";
import logoVirtualMercado from "@/assets/logo-virtual-mercado.png";

const STEPS = [
  { id: 1, title: "Criar loja", icon: Store },
  { id: 2, title: "Configurações", icon: Settings },
  { id: 3, title: "Primeiro produto", icon: Package },
  { id: 4, title: "Pronto!", icon: Rocket },
];

const CATEGORIES = [
  "Moda e Acessórios",
  "Eletrônicos",
  "Casa e Decoração",
  "Beleza e Saúde",
  "Alimentos e Bebidas",
  "Esportes e Lazer",
  "Brinquedos",
  "Automotivo",
  "Pet Shop",
  "Outros",
];

const Onboarding = () => {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { user } = useAuth();

  const [storeData, setStoreData] = useState({
    storeName: "",
    category: "",
    city: "",
    whatsapp: "",
  });

  const [settingsData, setSettingsData] = useState({
    currency: "BRL",
    catalogType: "grid",
    layout: "modelo-1",
  });

  const [productData, setProductData] = useState({
    name: "",
    price: "",
    description: "",
  });

  const handleCreateStore = async () => {
    if (!storeData.storeName.trim()) {
      toast.error("Informe o nome da loja");
      return;
    }
    if (!user) {
      toast.error("Sessão expirada. Faça login novamente.");
      navigate("/login", { replace: true });
      return;
    }

    setLoading(true);
    try {
      // Generate slug
      const { data: slugData } = await supabase.rpc("generate_store_slug", {
        p_store_name: storeData.storeName,
      });

      const slug = slugData || storeData.storeName.toLowerCase().replace(/\s+/g, "-");

      const { error } = await supabase
        .from("profiles")
        .update({
          store_name: storeData.storeName,
          store_slug: slug,
          whatsapp_number: storeData.whatsapp || null,
          city: storeData.city || null,
          store_category: storeData.category || null,
        })
        .eq("id", user.id);

      if (error) {
        console.error("[Onboarding] Error creating store:", error);
        toast.error("Erro ao criar loja. Tente novamente.");
        return;
      }

      console.info("[Onboarding] Store created successfully:", slug);
      toast.success("Loja criada com sucesso!");
      setStep(2);
    } catch (err) {
      console.error("[Onboarding] Unexpected error:", err);
      toast.error("Erro inesperado. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSettings = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          store_layout: settingsData.layout,
        })
        .eq("id", user.id);

      if (error) {
        console.error("[Onboarding] Error saving settings:", error);
      }
      setStep(3);
    } catch (err) {
      console.error("[Onboarding] Unexpected error:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateProduct = async () => {
    if (!productData.name.trim() || !productData.price) {
      toast.error("Informe o nome e preço do produto");
      return;
    }
    if (!user) return;

    setLoading(true);
    try {
      const { error } = await supabase.from("products").insert({
        user_id: user.id,
        name: productData.name,
        price: parseFloat(productData.price),
        description: productData.description || null,
        is_active: true,
      });

      if (error) {
        console.error("[Onboarding] Error creating product:", error);
        toast.error("Erro ao cadastrar produto.");
        return;
      }

      toast.success("Produto cadastrado!");
      setStep(4);
    } catch (err) {
      console.error("[Onboarding] Unexpected error:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleFinish = () => {
    console.info("[Onboarding] Completed — redirecting to /lojista");
    navigate("/lojista", { replace: true });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/5 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-lg">
        {/* Logo */}
        <div className="text-center mb-6">
          <img src={logoVirtualMercado} alt="VirtualMercado" className="h-10 w-auto mx-auto mb-4" />
        </div>

        {/* Progress */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {STEPS.map((s) => (
            <div key={s.id} className="flex items-center gap-2">
              <div
                className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold transition-colors ${
                  step >= s.id
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {s.id}
              </div>
              {s.id < STEPS.length && (
                <div className={`w-8 h-0.5 ${step > s.id ? "bg-primary" : "bg-muted"}`} />
              )}
            </div>
          ))}
        </div>

        <Card className="p-8">
          {/* Step 1 — Create Store */}
          {step === 1 && (
            <div className="space-y-6">
              <div className="text-center">
                <Store className="h-10 w-10 text-primary mx-auto mb-3" />
                <h2 className="text-2xl font-bold">Crie sua loja</h2>
                <p className="text-muted-foreground text-sm mt-1">
                  Preencha as informações básicas da sua loja
                </p>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="storeName">Nome da loja *</Label>
                  <Input
                    id="storeName"
                    placeholder="Ex: Minha Loja Virtual"
                    value={storeData.storeName}
                    onChange={(e) => setStoreData((p) => ({ ...p, storeName: e.target.value }))}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="category">Categoria</Label>
                  <Select
                    value={storeData.category}
                    onValueChange={(v) => setStoreData((p) => ({ ...p, category: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione uma categoria" />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map((cat) => (
                        <SelectItem key={cat} value={cat}>
                          {cat}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="city">Cidade</Label>
                  <Input
                    id="city"
                    placeholder="Ex: São Paulo"
                    value={storeData.city}
                    onChange={(e) => setStoreData((p) => ({ ...p, city: e.target.value }))}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="whatsapp">WhatsApp</Label>
                  <Input
                    id="whatsapp"
                    placeholder="(11) 99999-9999"
                    value={storeData.whatsapp}
                    onChange={(e) => setStoreData((p) => ({ ...p, whatsapp: e.target.value }))}
                  />
                </div>
              </div>

              <Button
                className="w-full"
                onClick={handleCreateStore}
                disabled={loading}
              >
                {loading ? "Criando..." : "Continuar"}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          )}

          {/* Step 2 — Basic Settings */}
          {step === 2 && (
            <div className="space-y-6">
              <div className="text-center">
                <Settings className="h-10 w-10 text-primary mx-auto mb-3" />
                <h2 className="text-2xl font-bold">Configurações básicas</h2>
                <p className="text-muted-foreground text-sm mt-1">
                  Personalize o visual inicial da sua loja
                </p>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Moeda</Label>
                  <Select
                    value={settingsData.currency}
                    onValueChange={(v) => setSettingsData((p) => ({ ...p, currency: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="BRL">Real (R$)</SelectItem>
                      <SelectItem value="USD">Dólar (US$)</SelectItem>
                      <SelectItem value="EUR">Euro (€)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Layout da loja</Label>
                  <Select
                    value={settingsData.layout}
                    onValueChange={(v) => setSettingsData((p) => ({ ...p, layout: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="modelo-1">Modelo 1 — Clássico</SelectItem>
                      <SelectItem value="modelo-2">Modelo 2 — Moderno</SelectItem>
                      <SelectItem value="modelo-3">Modelo 3 — Minimalista</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Tipo de catálogo</Label>
                  <Select
                    value={settingsData.catalogType}
                    onValueChange={(v) => setSettingsData((p) => ({ ...p, catalogType: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="grid">Grade</SelectItem>
                      <SelectItem value="list">Lista</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setStep(1)} className="flex-1">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Voltar
                </Button>
                <Button className="flex-1" onClick={handleSaveSettings} disabled={loading}>
                  {loading ? "Salvando..." : "Continuar"}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {/* Step 3 — First Product */}
          {step === 3 && (
            <div className="space-y-6">
              <div className="text-center">
                <Package className="h-10 w-10 text-primary mx-auto mb-3" />
                <h2 className="text-2xl font-bold">Primeiro produto</h2>
                <p className="text-muted-foreground text-sm mt-1">
                  Cadastre seu primeiro produto ou pule esta etapa
                </p>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="productName">Nome do produto</Label>
                  <Input
                    id="productName"
                    placeholder="Ex: Camiseta Premium"
                    value={productData.name}
                    onChange={(e) => setProductData((p) => ({ ...p, name: e.target.value }))}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="productPrice">Preço (R$)</Label>
                  <Input
                    id="productPrice"
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="99.90"
                    value={productData.price}
                    onChange={(e) => setProductData((p) => ({ ...p, price: e.target.value }))}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="productDesc">Descrição (opcional)</Label>
                  <Input
                    id="productDesc"
                    placeholder="Descreva brevemente o produto"
                    value={productData.description}
                    onChange={(e) => setProductData((p) => ({ ...p, description: e.target.value }))}
                  />
                </div>
              </div>

              <div className="flex flex-col gap-3">
                <Button onClick={handleCreateProduct} disabled={loading}>
                  {loading ? "Cadastrando..." : "Cadastrar produto"}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
                <Button variant="ghost" onClick={() => setStep(4)}>
                  <SkipForward className="mr-2 h-4 w-4" />
                  Pular por enquanto
                </Button>
              </div>
            </div>
          )}

          {/* Step 4 — Done */}
          {step === 4 && (
            <div className="space-y-6 text-center">
              <div>
                <Rocket className="h-14 w-14 text-primary mx-auto mb-4" />
                <h2 className="text-2xl font-bold">Sua loja está pronta! 🚀</h2>
                <p className="text-muted-foreground mt-2">
                  Tudo configurado! Agora você pode acessar o painel e começar a vender.
                </p>
              </div>

              <Button className="w-full" size="lg" onClick={handleFinish}>
                Ir para o painel
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};

export default Onboarding;
