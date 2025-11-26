import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { ExternalLink, Loader2, Upload, Image as ImageIcon } from "lucide-react";

const StorePreviewEnhanced = () => {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const { toast } = useToast();
  
  const [storeData, setStoreData] = useState({
    store_name: "",
    store_slug: "",
    store_description: "",
    store_logo_url: "",
    primary_color: "#000000",
    secondary_color: "#ffffff",
    banner_desktop_url: "",
    banner_mobile_url: "",
    banner_rect_1_url: "",
    banner_rect_2_url: "",
    instagram_url: "",
    facebook_url: "",
    x_url: "",
    youtube_url: "",
    whatsapp_number: "",
    footer_bg_color: "#1a1a1a",
    footer_text_color: "#ffffff",
    return_policy_text: "",
    email: "",
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
        .select("*")
        .eq("id", user.id)
        .single();

      if (error) throw error;
      if (data) {
        setStoreData({
          store_name: data.store_name || "",
          store_slug: data.store_slug || "",
          store_description: data.store_description || "",
          store_logo_url: data.store_logo_url || "",
          primary_color: data.primary_color || "#000000",
          secondary_color: data.secondary_color || "#ffffff",
          banner_desktop_url: data.banner_desktop_url || "",
          banner_mobile_url: data.banner_mobile_url || "",
          banner_rect_1_url: data.banner_rect_1_url || "",
          banner_rect_2_url: data.banner_rect_2_url || "",
          instagram_url: data.instagram_url || "",
          facebook_url: data.facebook_url || "",
          x_url: data.x_url || "",
          youtube_url: data.youtube_url || "",
          whatsapp_number: data.whatsapp_number || "",
          footer_bg_color: data.footer_bg_color || "#1a1a1a",
          footer_text_color: data.footer_text_color || "#ffffff",
          return_policy_text: data.return_policy_text || "",
          email: data.email || "",
        });
      }
    } catch (error) {
      console.error("Error:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleImageUpload = async (file: File, field: string) => {
    setUploading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const fileExt = file.name.split(".").pop();
      const fileName = `${user.id}/${field}_${Date.now()}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from("product-images")
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("product-images")
        .getPublicUrl(fileName);

      setStoreData({ ...storeData, [field]: publicUrl });
      toast({ title: "Imagem enviada com sucesso!" });
    } catch (error: any) {
      toast({
        title: "Erro ao enviar imagem",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setUploading(false);
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

  const storeUrl = `${window.location.origin}/loja/${storeData.store_slug}`;

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
      <div className="space-y-6 max-w-4xl">
        <div>
          <h1 className="text-3xl font-bold mb-2">Minha Loja Virtual</h1>
          <p className="text-muted-foreground">
            Configure e personalize completamente sua loja online
          </p>
        </div>

        {/* Informações Básicas */}
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4">Informações Básicas</h2>
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
                  Sua loja ficará em: {storeUrl}
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

            <div className="space-y-2">
              <Label htmlFor="email">E-mail da Loja</Label>
              <Input
                id="email"
                type="email"
                value={storeData.email}
                onChange={(e) =>
                  setStoreData({ ...storeData, email: e.target.value })
                }
                placeholder="contato@minhaloja.com"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="whatsapp_number">Número do WhatsApp</Label>
              <Input
                id="whatsapp_number"
                value={storeData.whatsapp_number}
                onChange={(e) =>
                  setStoreData({ ...storeData, whatsapp_number: e.target.value })
                }
                placeholder="(00) 00000-0000"
              />
              <p className="text-xs text-muted-foreground">
                Será usado no botão flutuante de WhatsApp
              </p>
            </div>
          </div>
        </Card>

        {/* Banners */}
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4">Banners</h2>
          <div className="space-y-6">
            <div className="space-y-2">
              <Label>Banner Desktop/Tablet</Label>
              <p className="text-xs text-muted-foreground mb-2">
                Tamanho recomendado: 1920x600px
              </p>
              {storeData.banner_desktop_url && (
                <img
                  src={storeData.banner_desktop_url}
                  alt="Banner Desktop"
                  className="w-full h-32 object-cover rounded-lg mb-2"
                />
              )}
              <Input
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleImageUpload(file, "banner_desktop_url");
                }}
                disabled={uploading}
              />
            </div>

            <div className="space-y-2">
              <Label>Banner Mobile</Label>
              <p className="text-xs text-muted-foreground mb-2">
                Tamanho recomendado: 800x600px
              </p>
              {storeData.banner_mobile_url && (
                <img
                  src={storeData.banner_mobile_url}
                  alt="Banner Mobile"
                  className="w-full h-32 object-cover rounded-lg mb-2"
                />
              )}
              <Input
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleImageUpload(file, "banner_mobile_url");
                }}
                disabled={uploading}
              />
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Banner Retangular 1</Label>
                <p className="text-xs text-muted-foreground mb-2">
                  Tamanho recomendado: 600x300px
                </p>
                {storeData.banner_rect_1_url && (
                  <img
                    src={storeData.banner_rect_1_url}
                    alt="Banner 1"
                    className="w-full h-24 object-cover rounded-lg mb-2"
                  />
                )}
                <Input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleImageUpload(file, "banner_rect_1_url");
                  }}
                  disabled={uploading}
                />
              </div>
              <div className="space-y-2">
                <Label>Banner Retangular 2</Label>
                <p className="text-xs text-muted-foreground mb-2">
                  Tamanho recomendado: 600x300px
                </p>
                {storeData.banner_rect_2_url && (
                  <img
                    src={storeData.banner_rect_2_url}
                    alt="Banner 2"
                    className="w-full h-24 object-cover rounded-lg mb-2"
                  />
                )}
                <Input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleImageUpload(file, "banner_rect_2_url");
                  }}
                  disabled={uploading}
                />
              </div>
            </div>
          </div>
        </Card>

        {/* Redes Sociais */}
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4">Redes Sociais</h2>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="instagram_url">Instagram</Label>
              <Input
                id="instagram_url"
                value={storeData.instagram_url}
                onChange={(e) =>
                  setStoreData({ ...storeData, instagram_url: e.target.value })
                }
                placeholder="https://instagram.com/sua-loja"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="facebook_url">Facebook</Label>
              <Input
                id="facebook_url"
                value={storeData.facebook_url}
                onChange={(e) =>
                  setStoreData({ ...storeData, facebook_url: e.target.value })
                }
                placeholder="https://facebook.com/sua-loja"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="x_url">X (Twitter)</Label>
              <Input
                id="x_url"
                value={storeData.x_url}
                onChange={(e) =>
                  setStoreData({ ...storeData, x_url: e.target.value })
                }
                placeholder="https://x.com/sua-loja"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="youtube_url">YouTube</Label>
              <Input
                id="youtube_url"
                value={storeData.youtube_url}
                onChange={(e) =>
                  setStoreData({ ...storeData, youtube_url: e.target.value })
                }
                placeholder="https://youtube.com/@sua-loja"
              />
            </div>
          </div>
        </Card>

        {/* Personalização do Rodapé */}
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4">Personalização do Rodapé</h2>
          <div className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="footer_bg_color">Cor de Fundo do Rodapé</Label>
                <div className="flex gap-2">
                  <Input
                    id="footer_bg_color"
                    type="color"
                    value={storeData.footer_bg_color}
                    onChange={(e) =>
                      setStoreData({
                        ...storeData,
                        footer_bg_color: e.target.value,
                      })
                    }
                    className="w-20 h-10"
                  />
                  <Input
                    value={storeData.footer_bg_color}
                    onChange={(e) =>
                      setStoreData({
                        ...storeData,
                        footer_bg_color: e.target.value,
                      })
                    }
                    placeholder="#1a1a1a"
                    className="flex-1"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="footer_text_color">Cor do Texto do Rodapé</Label>
                <div className="flex gap-2">
                  <Input
                    id="footer_text_color"
                    type="color"
                    value={storeData.footer_text_color}
                    onChange={(e) =>
                      setStoreData({
                        ...storeData,
                        footer_text_color: e.target.value,
                      })
                    }
                    className="w-20 h-10"
                  />
                  <Input
                    value={storeData.footer_text_color}
                    onChange={(e) =>
                      setStoreData({
                        ...storeData,
                        footer_text_color: e.target.value,
                      })
                    }
                    placeholder="#ffffff"
                    className="flex-1"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="return_policy_text">Política de Trocas e Devoluções</Label>
              <Textarea
                id="return_policy_text"
                value={storeData.return_policy_text}
                onChange={(e) =>
                  setStoreData({
                    ...storeData,
                    return_policy_text: e.target.value,
                  })
                }
                placeholder="Descreva sua política de trocas e devoluções..."
                rows={6}
              />
            </div>
          </div>
        </Card>

        <div className="flex gap-4">
          <Button onClick={handleSave} disabled={saving || uploading} className="flex-1">
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Salvar Todas as Configurações
          </Button>
          {storeData.store_slug && (
            <Button
              variant="outline"
              onClick={() => window.open(storeUrl, "_blank")}
              className="gap-2"
            >
              <ExternalLink className="h-4 w-4" />
              Ver Loja
            </Button>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
};

export default StorePreviewEnhanced;
