import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Gift } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { BENEFIT_BANNERS, MAX_BENEFIT_BANNERS } from "@/lib/benefitBanners";

const SD_PRIMARY = "#6A1B9A";

interface BenefitBannersConfigProps {
  userId: string | null;
}

export const BenefitBannersConfig = ({ userId }: BenefitBannersConfigProps) => {
  const { toast } = useToast();
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [savedIds, setSavedIds] = useState<number[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (userId) fetchSaved();
  }, [userId]);

  const fetchSaved = async () => {
    if (!userId) return;
    const { data } = await supabase
      .from("profiles")
      .select("selected_benefit_banners")
      .eq("id", userId)
      .single();
    if (data?.selected_benefit_banners) {
      const ids = (data.selected_benefit_banners as number[]) || [];
      setSelectedIds(ids);
      setSavedIds(ids);
    }
  };

  const toggleBanner = (id: number) => {
    setSelectedIds((prev) => {
      if (prev.includes(id)) return prev.filter((i) => i !== id);
      if (prev.length >= MAX_BENEFIT_BANNERS) return prev;
      return [...prev, id];
    });
  };

  const handleSave = async () => {
    if (!userId) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ selected_benefit_banners: selectedIds } as any)
        .eq("id", userId);
      if (error) throw error;
      setSavedIds(selectedIds);
      toast({ title: "Banners de benefícios salvos!" });
    } catch {
      toast({ title: "Erro ao salvar", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const hasChanges = JSON.stringify(selectedIds.sort()) !== JSON.stringify(savedIds.sort());
  const atLimit = selectedIds.length >= MAX_BENEFIT_BANNERS;

  return (
    <Card className="p-6">
      <div className="space-y-1 mb-6">
        <div className="flex items-center gap-2">
          <div className="flex items-center justify-center w-8 h-8 bg-muted rounded">
            <Gift className="h-4 w-4 text-muted-foreground" />
          </div>
          <h2 className="text-lg font-semibold text-foreground">
            Banners de benefícios da loja
          </h2>
        </div>
        <p className="text-sm text-muted-foreground ml-10">
          Escolha até 4 banners de benefícios para exibir na sua loja.
          Esses banners aparecerão logo abaixo do banner principal da loja.
        </p>
      </div>

      {/* Counter */}
      <div className="flex items-center gap-2 mb-4">
        <Badge
          variant="outline"
          className="text-sm"
          style={{ borderColor: SD_PRIMARY, color: SD_PRIMARY }}
        >
          Selecionados: {selectedIds.length} / {MAX_BENEFIT_BANNERS}
        </Badge>
        {atLimit && (
          <span className="text-xs text-muted-foreground">
            Ao selecionar 4 banners, os demais ficam indisponíveis até que um seja desmarcado.
          </span>
        )}
      </div>

      {/* Banner list */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        {BENEFIT_BANNERS.map((banner) => {
          const isActive = selectedIds.includes(banner.id);
          const isDisabled = !isActive && atLimit;
          return (
            <div
              key={banner.id}
              className={`bg-white rounded-xl p-3 flex items-center gap-4 transition-all shadow-sm ${
                isActive
                  ? "ring-2 shadow-md"
                  : "border border-border"
              } ${isDisabled ? "opacity-40 cursor-not-allowed" : "hover:shadow-md"}`}
              style={
                isActive
                  ? { boxShadow: `0 0 0 2px ${SD_PRIMARY}, 0 4px 12px -2px rgba(106,27,154,0.12)` }
                  : undefined
              }
            >
              {/* Thumbnail */}
              <div className="flex-shrink-0 w-[120px] sm:w-[140px] h-[60px] sm:h-[70px] rounded-lg overflow-hidden bg-gray-50 border border-border/50 flex items-center justify-center p-1">
                <img
                  src={banner.image}
                  alt={banner.name}
                  className="max-w-full max-h-full object-contain"
                  loading="lazy"
                />
              </div>

              {/* Text */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground truncate">
                  {banner.name}
                </p>
                <p className="text-xs text-muted-foreground truncate mt-0.5">
                  {banner.subtitle}
                </p>
              </div>

              {/* Toggle */}
              <Switch
                checked={isActive}
                onCheckedChange={() => toggleBanner(banner.id)}
                disabled={isDisabled}
              />
            </div>
          );
        })}
      </div>

      <Button
        onClick={handleSave}
        disabled={!hasChanges || saving}
        className="w-full"
        style={{ backgroundColor: SD_PRIMARY, color: "#fff" }}
      >
        {saving ? "Salvando..." : hasChanges ? "Salvar banners" : "Banners salvos"}
      </Button>
    </Card>
  );
};

export default BenefitBannersConfig;
