import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Tag, Plus, Search, Loader2, Image as ImageIcon, Trash2 } from "lucide-react";
import { useRef } from "react";

interface Brand {
  id: string;
  name: string;
  logo_url: string | null;
  is_active: boolean;
}

interface BrandSelectorProps {
  value: string | null;
  onChange: (brandId: string | null) => void;
  buttonBgColor?: string;
  buttonTextColor?: string;
  buttonRadius?: string;
}

export const BrandSelector = ({
  value,
  onChange,
  buttonBgColor = "#6a1b9a",
  buttonTextColor = "#FFFFFF",
  buttonRadius = "rounded-md",
}: BrandSelectorProps) => {
  const [brands, setBrands] = useState<Brand[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [newBrandName, setNewBrandName] = useState("");
  const [newBrandLogo, setNewBrandLogo] = useState<File | null>(null);
  const [newBrandLogoPreview, setNewBrandLogoPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetchBrands();
  }, []);

  const fetchBrands = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("product_brands")
        .select("*")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .order("name");

      if (error) throw error;
      setBrands(data || []);
    } catch (error) {
      console.error("Error fetching brands:", error);
    } finally {
      setLoading(false);
    }
  };

  const selectedBrand = brands.find((b) => b.id === value);

  const filteredBrands = brands.filter((brand) =>
    brand.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setNewBrandLogo(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setNewBrandLogoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const uploadLogo = async (userId: string, file: File): Promise<string> => {
    const fileExt = file.name.split(".").pop();
    const fileName = `brands/${userId}/${Math.random()}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from("product-images")
      .upload(fileName, file);

    if (uploadError) throw uploadError;

    const { data } = supabase.storage
      .from("product-images")
      .getPublicUrl(fileName);

    return data.publicUrl;
  };

  const handleQuickAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBrandName.trim()) {
      toast({
        title: "Erro",
        description: "Nome da marca é obrigatório",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      let logoUrl = null;
      if (newBrandLogo) {
        logoUrl = await uploadLogo(user.id, newBrandLogo);
      }

      const { data, error } = await supabase
        .from("product_brands")
        .insert({
          name: newBrandName.trim(),
          logo_url: logoUrl,
          is_active: true,
          user_id: user.id,
        })
        .select()
        .single();

      if (error) {
        if (error.code === "23505") {
          toast({
            title: "Erro",
            description: "Já existe uma marca com este nome",
            variant: "destructive",
          });
          return;
        }
        throw error;
      }

      toast({
        title: "Sucesso",
        description: "Marca criada com sucesso",
      });

      setBrands([...brands, data]);
      onChange(data.id);
      setQuickAddOpen(false);
      setNewBrandName("");
      setNewBrandLogo(null);
      setNewBrandLogoPreview(null);
    } catch (error) {
      console.error("Error creating brand:", error);
      toast({
        title: "Erro",
        description: "Erro ao criar marca",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const getHoverColor = (color: string) => {
    const hex = color.replace('#', '');
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);
    const factor = 0.85;
    return `rgb(${Math.floor(r * factor)}, ${Math.floor(g * factor)}, ${Math.floor(b * factor)})`;
  };

  const removeLogo = () => {
    setNewBrandLogo(null);
    setNewBrandLogoPreview(null);
  };

  return (
    <div className="space-y-2">
      <Label>Marca do Produto (opcional)</Label>
      
      {/* Selected brand display or dropdown */}
      <div className="relative">
        <select
          value={value || ""}
          onChange={(e) => onChange(e.target.value || null)}
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm pr-10"
        >
          <option value="">Sem marca</option>
          {loading ? (
            <option disabled>Carregando...</option>
          ) : (
            filteredBrands.map((brand) => (
              <option key={brand.id} value={brand.id}>
                {brand.name}
              </option>
            ))
          )}
        </select>
        
        {selectedBrand?.logo_url && (
          <div className="absolute right-10 top-1/2 -translate-y-1/2">
            <img
              src={selectedBrand.logo_url}
              alt={selectedBrand.name}
              className="h-6 w-6 rounded object-contain"
            />
          </div>
        )}
      </div>

      {/* Quick add button */}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setQuickAddOpen(true)}
        className={`w-full ${buttonRadius} transition-all duration-200`}
        style={{
          borderColor: buttonBgColor,
          color: buttonBgColor,
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = buttonBgColor;
          e.currentTarget.style.color = buttonTextColor;
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = "transparent";
          e.currentTarget.style.color = buttonBgColor;
        }}
      >
        <Plus className="h-4 w-4 mr-2" />
        Nova Marca
      </Button>

      {/* Quick Add Modal */}
      <Dialog open={quickAddOpen} onOpenChange={setQuickAddOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Tag className="h-5 w-5" />
              Nova Marca
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleQuickAdd} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="quick-brand-name">Nome da Marca *</Label>
              <Input
                id="quick-brand-name"
                value={newBrandName}
                onChange={(e) => setNewBrandName(e.target.value)}
                placeholder="Ex: Nike, Adidas, Apple"
                required
              />
            </div>

            <div className="space-y-2">
              <Label>Logo da Marca (opcional)</Label>
              <div className="flex items-center gap-2">
                {newBrandLogoPreview ? (
                  <div className="relative h-12 w-12 rounded-md overflow-hidden border">
                    <img
                      src={newBrandLogoPreview}
                      alt="Logo preview"
                      className="h-full w-full object-contain"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute -top-1 -right-1 h-5 w-5 bg-destructive text-destructive-foreground rounded-full"
                      onClick={removeLogo}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                ) : (
                  <div className="h-12 w-12 rounded-md border border-dashed flex items-center justify-center">
                    <ImageIcon className="h-5 w-5 text-muted-foreground" />
                  </div>
                )}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                >
                  {newBrandLogoPreview ? "Alterar" : "Upload Logo"}
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleLogoChange}
                  className="hidden"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setQuickAddOpen(false);
                  setNewBrandName("");
                  setNewBrandLogo(null);
                  setNewBrandLogoPreview(null);
                }}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Criar Marca
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};
