import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { ExternalLink, Loader2, Upload, Image as ImageIcon, Trash2, Store, ImagePlus } from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";

const StorePreviewEnhanced = () => {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const { toast } = useToast();
  const { buttonBgColor, buttonTextColor } = useTheme();
  
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
    phone: "",
    whatsapp_number: "",
    footer_bg_color: "#1a1a1a",
    footer_text_color: "#ffffff",
    return_policy_text: "",
    email: "",
    address: "",
    address_number: "",
    address_complement: "",
    address_neighborhood: "",
    address_city: "",
    address_state: "",
    address_zip_code: "",
    banner_desktop_urls: [] as string[],
    banner_mobile_urls: [] as string[],
    is_maintenance_mode: false,
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
          phone: data.phone || "",
          whatsapp_number: data.whatsapp_number || "",
          footer_bg_color: data.footer_bg_color || "#1a1a1a",
          footer_text_color: data.footer_text_color || "#ffffff",
          return_policy_text: data.return_policy_text || "",
          email: data.email || "",
          address: data.address || "",
          address_number: data.address_number || "",
          address_complement: data.address_complement || "",
          address_neighborhood: data.address_neighborhood || "",
          address_city: data.address_city || "",
          address_state: data.address_state || "",
          address_zip_code: data.address_zip_code || "",
          banner_desktop_urls: (data.banner_desktop_urls as string[]) || [],
          banner_mobile_urls: (data.banner_mobile_urls as string[]) || [],
          is_maintenance_mode: data.is_maintenance_mode || false,
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

  const handleMultipleImageUpload = async (
    files: File[],
    arrayField: "banner_desktop_urls" | "banner_mobile_urls"
  ) => {
    // Garante que existam arquivos selecionados
    if (!files || files.length === 0) {
      toast({
        title: "Nenhum arquivo selecionado",
        description: "Escolha ao menos uma imagem para enviar",
        variant: "destructive",
      });
      return;
    }

    const currentUrls = (storeData[arrayField] || []) as string[];

    if (currentUrls.length >= 3) {
      toast({
        title: "Limite atingido",
        description: "Você pode enviar no máximo 3 imagens",
        variant: "destructive",
      });
      return;
    }

    setUploading(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const uploadedUrls: string[] = [];
      const filesToUpload = files.slice(0, 3 - currentUrls.length);

      for (const file of filesToUpload) {
        const fileExt = file.name.split(".").pop();
        const fileName = `${user.id}/${arrayField}_${Date.now()}_${Math.random()}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from("product-images")
          .upload(fileName, file);

        if (uploadError) throw uploadError;

        const { data } = supabase.storage
          .from("product-images")
          .getPublicUrl(fileName);

        uploadedUrls.push(data.publicUrl);
      }

      // Segurança extra: evita mensagem de sucesso com 0 imagens
      if (uploadedUrls.length === 0) {
        toast({
          title: "Nenhuma imagem enviada",
          description: "Tente selecionar os arquivos novamente.",
          variant: "destructive",
        });
        return;
      }

      const newUrls = [...currentUrls, ...uploadedUrls];

      // Atualiza estado local para pré-visualização imediata
      setStoreData({
        ...storeData,
        [arrayField]: newUrls,
      });

      // Salva automaticamente no banco apenas quando há novas imagens
      await supabase
        .from("profiles")
        .update({ [arrayField]: newUrls })
        .eq("id", user.id);

      toast({
        title: `${uploadedUrls.length} imagem(ns) enviada(s) e salva(s) com sucesso!`,
      });
    } catch (error: any) {
      toast({
        title: "Erro ao enviar imagens",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveImage = async (arrayField: "banner_desktop_urls" | "banner_mobile_urls", index: number) => {
    const currentUrls = storeData[arrayField];
    const newUrls = currentUrls.filter((_, i) => i !== index);
    setStoreData({ ...storeData, [arrayField]: newUrls });

    // Salvar automaticamente no banco
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      await supabase
        .from("profiles")
        .update({ [arrayField]: newUrls })
        .eq("id", user.id);

      toast({ title: "Imagem removida e alterações salvas" });
    } catch (error: any) {
      toast({
        title: "Erro ao remover imagem",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleRemoveSingleImage = async (
    field: "banner_rect_1_url" | "banner_rect_2_url"
  ) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from("profiles")
        .update({ [field]: null })
        .eq("id", user.id);

      if (error) throw error;

      setStoreData({
        ...storeData,
        [field]: "",
      });

      toast({
        title: "Minibanner removido",
        description: "O minibanner foi removido com sucesso.",
      });
    } catch (error: any) {
      toast({
        title: "Erro ao remover minibanner",
        description: error.message,
        variant: "destructive",
      });
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
      <div className="space-y-6">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center w-8 h-8 bg-gray-100 rounded">
              <Store className="h-4 w-4 text-gray-600" />
            </div>
            <h1 className="text-lg font-semibold text-foreground">Minha Loja Virtual</h1>
          </div>
          <p className="text-sm text-muted-foreground ml-10">
            Configure e personalize completamente sua loja online
          </p>
        </div>

        {/* Informações Básicas */}
        <Card className="p-6">
          <div className="space-y-1 mb-4">
            <div className="flex items-center gap-2">
              <div className="flex items-center justify-center w-8 h-8 bg-gray-100 rounded">
                <Store className="h-4 w-4 text-gray-600" />
              </div>
              <h2 className="text-lg font-semibold text-foreground">Informações Básicas</h2>
            </div>
          </div>
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
              <Label htmlFor="store_description">Slogan de Rodapé</Label>
              <p className="text-xs text-muted-foreground">
                O texto será exibido no rodapé da sua loja online
              </p>
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

            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="phone">Telefone</Label>
                <Input
                  id="phone"
                  value={storeData.phone}
                  onChange={(e) =>
                    setStoreData({ ...storeData, phone: e.target.value.replace(/[^0-9()\s-]/g, '') })
                  }
                  placeholder="(00) 0000-0000"
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

            {/* Campos de Endereço */}
            <div className="border-t pt-4 mt-4">
              <h3 className="font-semibold mb-2">Endereço Completo</h3>
              <p className="text-xs text-muted-foreground mb-4">
                O endereço será exibido no rodapé da sua loja online
              </p>
              <div className="space-y-4">
                <div className="grid sm:grid-cols-3 gap-4">
                  <div className="sm:col-span-2 space-y-2">
                    <Label htmlFor="address">Endereço (Rua/Avenida)</Label>
                    <Input
                      id="address"
                      value={storeData.address}
                      onChange={(e) =>
                        setStoreData({ ...storeData, address: e.target.value })
                      }
                      placeholder="Rua das Flores"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="address_number">Número</Label>
                    <Input
                      id="address_number"
                      value={storeData.address_number}
                      onChange={(e) =>
                        setStoreData({ ...storeData, address_number: e.target.value })
                      }
                      placeholder="123"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="address_complement">Complemento (opcional)</Label>
                  <Input
                    id="address_complement"
                    value={storeData.address_complement}
                    onChange={(e) =>
                      setStoreData({ ...storeData, address_complement: e.target.value })
                    }
                    placeholder="Apto 101, Bloco A"
                  />
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="address_neighborhood">Bairro</Label>
                    <Input
                      id="address_neighborhood"
                      value={storeData.address_neighborhood}
                      onChange={(e) =>
                        setStoreData({ ...storeData, address_neighborhood: e.target.value })
                      }
                      placeholder="Centro"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="address_city">Cidade</Label>
                    <Input
                      id="address_city"
                      value={storeData.address_city}
                      onChange={(e) =>
                        setStoreData({ ...storeData, address_city: e.target.value })
                      }
                      placeholder="São Paulo"
                    />
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="address_state">Estado</Label>
                    <Input
                      id="address_state"
                      value={storeData.address_state}
                      onChange={(e) =>
                        setStoreData({ ...storeData, address_state: e.target.value })
                      }
                      placeholder="SP"
                      maxLength={2}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="address_zip_code">CEP</Label>
                    <Input
                      id="address_zip_code"
                      value={storeData.address_zip_code}
                      onChange={(e) =>
                        setStoreData({ ...storeData, address_zip_code: e.target.value.replace(/\D/g, '') })
                      }
                      placeholder="12345678"
                      maxLength={8}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Card>

        {/* Banners */}
        <Card className="p-6">
          <div className="space-y-1 mb-4">
            <div className="flex items-center gap-2">
              <div className="flex items-center justify-center w-8 h-8 bg-gray-100 rounded">
                <ImagePlus className="h-4 w-4 text-gray-600" />
              </div>
              <h2 className="text-lg font-semibold text-foreground">Banners</h2>
            </div>
          </div>
          <div className="space-y-6">
            {/* Banner Principal Desktop/Tablet */}
            <div className="space-y-3">
              <Label className="text-base font-semibold">Banner Principal (Desktop/Tablet)</Label>
              <p className="text-xs text-muted-foreground">
                Tamanho recomendado: 1920x600px • Máximo: 3 imagens
              </p>
              
              {storeData.banner_desktop_urls.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {storeData.banner_desktop_urls.map((url, index) => (
                    <div key={index} className="relative group">
                      <img
                        src={url}
                        alt={`Banner Desktop ${index + 1}`}
                        className="w-full h-32 object-cover rounded-lg"
                      />
                      <button
                        type="button"
                        onClick={() => handleRemoveImage("banner_desktop_urls", index)}
                        className="absolute top-2 right-2 rounded-full p-1.5 opacity-0 group-hover:opacity-100 transition-all duration-200"
                        title="Excluir imagem"
                        style={{ backgroundColor: buttonBgColor, color: buttonTextColor }}
                        onMouseEnter={(e) => {
                          const hex = buttonBgColor.replace('#', '');
                          const r = parseInt(hex.substr(0, 2), 16);
                          const g = parseInt(hex.substr(2, 2), 16);
                          const b = parseInt(hex.substr(4, 2), 16);
                          e.currentTarget.style.backgroundColor = `rgb(${Math.floor(r * 0.85)}, ${Math.floor(g * 0.85)}, ${Math.floor(b * 0.85)})`;
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = buttonBgColor;
                        }}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              
              {storeData.banner_desktop_urls.length < 3 && (
                <div>
                  <input
                    type="file"
                    id="banner_desktop_input"
                    accept="image/*"
                    multiple
                    onChange={(e) => {
                      if (e.target.files) {
                        handleMultipleImageUpload(Array.from(e.target.files), "banner_desktop_urls");
                        e.target.value = "";
                      }
                    }}
                    disabled={uploading}
                    className="hidden"
                  />
                  <label
                    htmlFor="banner_desktop_input"
                    className={`inline-flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg cursor-pointer transition-colors ${
                      uploading ? "opacity-50 cursor-not-allowed" : "hover:bg-gray-50 hover:border-gray-400"
                    }`}
                  >
                    <Upload className="w-4 h-4" />
                    <span className="text-sm font-medium">Escolher Arquivos</span>
                  </label>
                </div>
              )}
            </div>

            {/* Banner Mobile */}
            <div className="space-y-3 border-t pt-6">
              <Label className="text-base font-semibold">Banner Mobile (Formato Exclusivo)</Label>
              <p className="text-xs text-muted-foreground">
                Tamanho recomendado: 800x600px • Máximo: 3 imagens
              </p>
              
              {storeData.banner_mobile_urls.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {storeData.banner_mobile_urls.map((url, index) => (
                    <div key={index} className="relative group">
                      <img
                        src={url}
                        alt={`Banner Mobile ${index + 1}`}
                        className="w-full h-32 object-cover rounded-lg"
                      />
                      <button
                        type="button"
                        onClick={() => handleRemoveImage("banner_mobile_urls", index)}
                        className="absolute top-2 right-2 rounded-full p-1.5 opacity-0 group-hover:opacity-100 transition-all duration-200"
                        title="Excluir imagem"
                        style={{ backgroundColor: buttonBgColor, color: buttonTextColor }}
                        onMouseEnter={(e) => {
                          const hex = buttonBgColor.replace('#', '');
                          const r = parseInt(hex.substr(0, 2), 16);
                          const g = parseInt(hex.substr(2, 2), 16);
                          const b = parseInt(hex.substr(4, 2), 16);
                          e.currentTarget.style.backgroundColor = `rgb(${Math.floor(r * 0.85)}, ${Math.floor(g * 0.85)}, ${Math.floor(b * 0.85)})`;
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = buttonBgColor;
                        }}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              
              {storeData.banner_mobile_urls.length < 3 && (
                <div>
                  <input
                    type="file"
                    id="banner_mobile_input"
                    accept="image/*"
                    multiple
                    onChange={(e) => {
                      if (e.target.files) {
                        handleMultipleImageUpload(Array.from(e.target.files), "banner_mobile_urls");
                        e.target.value = "";
                      }
                    }}
                    disabled={uploading}
                    className="hidden"
                  />
                  <label
                    htmlFor="banner_mobile_input"
                    className={`inline-flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg cursor-pointer transition-colors ${
                      uploading ? "opacity-50 cursor-not-allowed" : "hover:bg-gray-50 hover:border-gray-400"
                    }`}
                  >
                    <Upload className="w-4 h-4" />
                    <span className="text-sm font-medium">Escolher Arquivos</span>
                  </label>
                </div>
              )}
            </div>

            <div className="grid sm:grid-cols-2 gap-4 border-t pt-6">
              <div className="space-y-2">
                <Label>Minibanner 1</Label>
                <p className="text-xs text-muted-foreground mb-2">
                  Tamanho recomendado: 600x300px
                </p>
                {storeData.banner_rect_1_url && (
                  <div className="relative group mb-2">
                    <img
                      src={storeData.banner_rect_1_url}
                      alt="Minibanner 1"
                      className="w-full h-24 object-cover rounded-lg"
                    />
                    <button
                      type="button"
                      onClick={() => handleRemoveSingleImage("banner_rect_1_url")}
                      className="absolute top-2 right-2 rounded-full p-1.5 opacity-0 group-hover:opacity-100 transition-all duration-200"
                      title="Excluir minibanner"
                      style={{ backgroundColor: buttonBgColor, color: buttonTextColor }}
                      onMouseEnter={(e) => {
                        const hex = buttonBgColor.replace('#', '');
                        const r = parseInt(hex.substr(0, 2), 16);
                        const g = parseInt(hex.substr(2, 2), 16);
                        const b = parseInt(hex.substr(4, 2), 16);
                        e.currentTarget.style.backgroundColor = `rgb(${Math.floor(r * 0.85)}, ${Math.floor(g * 0.85)}, ${Math.floor(b * 0.85)})`;
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = buttonBgColor;
                      }}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
                <div>
                  <input
                    type="file"
                    id="minibanner_1_input"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleImageUpload(file, "banner_rect_1_url");
                    }}
                    disabled={uploading}
                    className="hidden"
                  />
                  <label
                    htmlFor="minibanner_1_input"
                    className={`inline-flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg cursor-pointer transition-colors ${
                      uploading ? "opacity-50 cursor-not-allowed" : "hover:bg-gray-50 hover:border-gray-400"
                    }`}
                  >
                    <Upload className="w-4 h-4" />
                    <span className="text-sm font-medium">Escolher Arquivos</span>
                  </label>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Minibanner 2</Label>
                <p className="text-xs text-muted-foreground mb-2">
                  Tamanho recomendado: 600x300px
                </p>
                {storeData.banner_rect_2_url && (
                  <div className="relative group mb-2">
                    <img
                      src={storeData.banner_rect_2_url}
                      alt="Minibanner 2"
                      className="w-full h-24 object-cover rounded-lg"
                    />
                    <button
                      type="button"
                      onClick={() => handleRemoveSingleImage("banner_rect_2_url")}
                      className="absolute top-2 right-2 rounded-full p-1.5 opacity-0 group-hover:opacity-100 transition-all duration-200"
                      title="Excluir minibanner"
                      style={{ backgroundColor: buttonBgColor, color: buttonTextColor }}
                      onMouseEnter={(e) => {
                        const hex = buttonBgColor.replace('#', '');
                        const r = parseInt(hex.substr(0, 2), 16);
                        const g = parseInt(hex.substr(2, 2), 16);
                        const b = parseInt(hex.substr(4, 2), 16);
                        e.currentTarget.style.backgroundColor = `rgb(${Math.floor(r * 0.85)}, ${Math.floor(g * 0.85)}, ${Math.floor(b * 0.85)})`;
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = buttonBgColor;
                      }}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
                <div>
                  <input
                    type="file"
                    id="minibanner_2_input"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleImageUpload(file, "banner_rect_2_url");
                    }}
                    disabled={uploading}
                    className="hidden"
                  />
                  <label
                    htmlFor="minibanner_2_input"
                    className={`inline-flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg cursor-pointer transition-colors ${
                      uploading ? "opacity-50 cursor-not-allowed" : "hover:bg-gray-50 hover:border-gray-400"
                    }`}
                  >
                    <Upload className="w-4 h-4" />
                    <span className="text-sm font-medium">Escolher Arquivos</span>
                  </label>
                </div>
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

            {/* Maintenance Mode */}
            <div className="space-y-3 pt-4 border-t">
              <Label htmlFor="maintenance_mode" className="text-base font-medium">
                Colocar site em manutenção
              </Label>
              <div className="flex items-center justify-between p-4 rounded-lg bg-muted/30">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">
                    Quando ativado, sua loja exibirá uma página de manutenção para os visitantes.
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Apenas você poderá acessar a loja normalmente enquanto estiver logado.
                  </p>
                </div>
                <Switch
                  id="maintenance_mode"
                  checked={storeData.is_maintenance_mode}
                  onCheckedChange={(checked) =>
                    setStoreData({
                      ...storeData,
                      is_maintenance_mode: checked,
                    })
                  }
                  className="data-[state=unchecked]:bg-input"
                  style={{
                    backgroundColor: storeData.is_maintenance_mode ? buttonBgColor : undefined,
                  }}
                />
              </div>
              {storeData.is_maintenance_mode && (
                <p className="text-sm text-amber-600 font-medium">
                  ⚠️ O modo de manutenção está ativado. Sua loja está invisível para visitantes.
                </p>
              )}
            </div>
          </div>
        </Card>

        <div className="flex gap-4">
          <Button 
            onClick={handleSave} 
            disabled={saving || uploading} 
            className="flex-1 transition-all hover:opacity-90"
            style={{ backgroundColor: buttonBgColor, color: buttonTextColor }}
          >
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Salvar Todas as Configurações
          </Button>
          {storeData.store_slug && (
            <Button
              onClick={() => window.open(storeUrl, "_blank")}
              className="gap-2 transition-all hover:opacity-90"
              style={{ backgroundColor: buttonBgColor, color: buttonTextColor }}
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
