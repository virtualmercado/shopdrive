import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { ExternalLink, Loader2, Copy, Check } from "lucide-react";

const StorePreview = () => {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();
  
  const [storeData, setStoreData] = useState({
    store_name: "",
    store_slug: "",
    store_description: "",
    primary_color: "#000000",
    secondary_color: "#ffffff",
  });

  useEffect(() => {
    fetchStoreData();
  }, []);

  const fetchStoreData = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("profiles")
        .select("store_name, store_slug, store_description, primary_color, secondary_color")
        .eq("id", user.id)
        .single();

      if (error) throw error;
      if (data) {
        setStoreData({
          store_name: data.store_name || "",
          store_slug: data.store_slug || "",
          store_description: data.store_description || "",
          primary_color: data.primary_color || "#000000",
          secondary_color: data.secondary_color || "#ffffff",
        });
      }
    } catch (error) {
      console.error("Error:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from("profiles")
        .update(storeData)
        .eq("id", user.id);

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Configurações da loja atualizadas",
      });
    } catch (error: any) {
      console.error("Error:", error);
      toast({
        title: "Erro",
        description: error.message || "Erro ao salvar configurações",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const copyStoreUrl = () => {
    const url = `${window.location.origin}/store/${storeData.store_slug}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({
      title: "URL copiada!",
      description: "O link da sua loja foi copiado",
    });
  };

  const storeUrl = `${window.location.origin}/store/${storeData.store_slug}`;

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold mb-2">Minha Loja Virtual</h1>
          <p className="text-muted-foreground">
            Configure e personalize sua loja online
          </p>
        </div>

        {/* Store URL */}
        {storeData.store_slug && (
          <Card className="p-6">
            <Label className="mb-2 block">URL da sua loja</Label>
            <div className="flex gap-2">
              <Input value={storeUrl} readOnly className="flex-1" />
              <Button
                variant="outline"
                onClick={copyStoreUrl}
                className="gap-2"
              >
                {copied ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
                {copied ? "Copiado" : "Copiar"}
              </Button>
              <Button
                variant="outline"
                onClick={() => window.open(storeUrl, "_blank")}
                className="gap-2"
              >
                <ExternalLink className="h-4 w-4" />
                Visualizar
              </Button>
            </div>
          </Card>
        )}

        {/* Store Settings */}
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4">Configurações da Loja</h2>
          <div className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="store_name">Nome da Loja *</Label>
                <Input
                  id="store_name"
                  value={storeData.store_name}
                  onChange={(e) =>
                    setStoreData({ ...storeData, store_name: e.target.value })
                  }
                  placeholder="Minha Loja"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="store_slug">URL da Loja (slug) *</Label>
                <Input
                  id="store_slug"
                  value={storeData.store_slug}
                  onChange={(e) =>
                    setStoreData({
                      ...storeData,
                      store_slug: e.target.value
                        .toLowerCase()
                        .replace(/[^a-z0-9-]/g, "-"),
                    })
                  }
                  placeholder="minha-loja"
                />
                <p className="text-xs text-muted-foreground">
                  Use apenas letras minúsculas, números e hífens
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="store_description">Descrição da Loja</Label>
              <Textarea
                id="store_description"
                value={storeData.store_description}
                onChange={(e) =>
                  setStoreData({
                    ...storeData,
                    store_description: e.target.value,
                  })
                }
                placeholder="Descreva sua loja..."
                rows={3}
              />
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="primary_color">Cor Primária</Label>
                <div className="flex gap-2">
                  <Input
                    id="primary_color"
                    type="color"
                    value={storeData.primary_color}
                    onChange={(e) =>
                      setStoreData({
                        ...storeData,
                        primary_color: e.target.value,
                      })
                    }
                    className="w-20 h-10"
                  />
                  <Input
                    value={storeData.primary_color}
                    onChange={(e) =>
                      setStoreData({
                        ...storeData,
                        primary_color: e.target.value,
                      })
                    }
                    placeholder="#000000"
                    className="flex-1"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="secondary_color">Cor Secundária</Label>
                <div className="flex gap-2">
                  <Input
                    id="secondary_color"
                    type="color"
                    value={storeData.secondary_color}
                    onChange={(e) =>
                      setStoreData({
                        ...storeData,
                        secondary_color: e.target.value,
                      })
                    }
                    className="w-20 h-10"
                  />
                  <Input
                    value={storeData.secondary_color}
                    onChange={(e) =>
                      setStoreData({
                        ...storeData,
                        secondary_color: e.target.value,
                      })
                    }
                    placeholder="#ffffff"
                    className="flex-1"
                  />
                </div>
              </div>
            </div>

            <Button onClick={handleSave} disabled={saving} className="w-full sm:w-auto">
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Salvar Configurações
            </Button>
          </div>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default StorePreview;
