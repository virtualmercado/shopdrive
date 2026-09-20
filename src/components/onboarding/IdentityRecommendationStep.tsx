import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Loader2, Upload, Sparkles, Check, RefreshCw, Palette as PaletteIcon } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  PREDEFINED_PALETTES,
  OFFICIAL_LAYOUTS,
  getPaletteById,
  getLayoutById,
  type ColorPalette,
} from "@/lib/storePalettes";
import { applyOnboardingIdentity } from "@/lib/storeIdentity";

export interface BrandRecommendation {
  business_summary?: string;
  target_audience_summary?: string;
  positioning?: string;
  visual_style?: string;
  recommended_palette_id?: string;
  recommended_layout_id?: string;
  reasoning_short?: string;
  confidence?: number;
}

interface Props {
  storeId: string;
  logoUrl: string;
  uploading: boolean;
  onLogoUpload: (file: File) => void;
  recommendation: BrandRecommendation | null;
  analyzing: boolean;
  contextHash: string | null;
  appliedPaletteId: string | null;
  appliedLayoutId: string | null;
  onReanalyze: () => void;
  onApplied: () => void | Promise<unknown>;
}

const PaletteSwatch = ({ palette }: { palette: ColorPalette }) => (
  <div className="flex h-5 w-24 overflow-hidden rounded">
    <div className="flex-1" style={{ backgroundColor: palette.colors.primary }} />
    <div className="flex-1" style={{ backgroundColor: palette.colors.secondary }} />
    <div className="flex-1" style={{ backgroundColor: palette.colors.buttonBg }} />
    <div className="flex-1" style={{ backgroundColor: palette.colors.footerBg }} />
  </div>
);

const IdentityRecommendationStep = ({
  storeId,
  logoUrl,
  uploading,
  onLogoUpload,
  recommendation,
  analyzing,
  contextHash,
  appliedPaletteId,
  appliedLayoutId,
  onReanalyze,
  onApplied,
}: Props) => {
  const [showOptions, setShowOptions] = useState(false);
  const [applying, setApplying] = useState(false);
  const [pickedPalette, setPickedPalette] = useState<string | null>(null);
  const [pickedLayout, setPickedLayout] = useState<string | null>(null);

  const recommendedPalette = useMemo(
    () => getPaletteById(recommendation?.recommended_palette_id),
    [recommendation]
  );
  const recommendedLayout = useMemo(
    () => getLayoutById(recommendation?.recommended_layout_id),
    [recommendation]
  );
  const appliedPalette = getPaletteById(appliedPaletteId);
  const appliedLayout = getLayoutById(appliedLayoutId);

  const apply = async (palette: ColorPalette, layoutId: string) => {
    setApplying(true);
    try {
      const result = await applyOnboardingIdentity(storeId, palette, layoutId, contextHash);
      if (!result.authorized) {
        toast.error(
          "Você já usou as aplicações de identidade disponíveis nesta configuração. Ajustes adicionais ficam no menu Personalizar, conforme o seu plano."
        );
        return;
      }
      await supabase.auth.getSession();
      await onApplied();
      setShowOptions(false);
      toast.success("Identidade visual aplicada na sua loja!");
    } catch {
      toast.error("Não foi possível aplicar a identidade agora. Tente novamente.");
    } finally {
      setApplying(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label>Logo da loja</Label>
        <div className="flex items-center gap-4">
          {logoUrl ? (
            <img
              src={logoUrl}
              alt="Logo da loja"
              className="h-16 w-16 rounded border object-contain bg-muted"
            />
          ) : (
            <div className="h-16 w-16 rounded border flex items-center justify-center text-muted-foreground text-xs">
              sem logo
            </div>
          )}
          <div>
            <input
              id="logo-input"
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) onLogoUpload(file);
                e.currentTarget.value = "";
              }}
            />
            <Button
              variant="outline"
              onClick={() => document.getElementById("logo-input")?.click()}
              disabled={uploading}
            >
              {uploading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Upload className="mr-2 h-4 w-4" />
              )}
              {logoUrl ? "Substituir logo" : "Enviar logo"}
            </Button>
          </div>
        </div>
      </div>

      <Card className="border-primary/40">
        <CardContent className="pt-6 space-y-4">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <h3 className="font-medium flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" /> Identidade visual recomendada para sua loja
            </h3>
            {appliedPalette && (
              <Badge variant="default" className="gap-1">
                <Check className="h-3 w-3" /> Identidade aplicada
              </Badge>
            )}
          </div>

          {analyzing ? (
            <p className="text-sm text-muted-foreground flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" /> Analisando o que você contou sobre o seu negócio...
            </p>
          ) : recommendedPalette && recommendedLayout ? (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <span className="text-xs text-muted-foreground">Paleta sugerida</span>
                  <div className="flex items-center gap-2">
                    <PaletteSwatch palette={recommendedPalette} />
                    <span className="text-sm font-medium">{recommendedPalette.name}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">{recommendedPalette.description}</p>
                </div>
                <div className="space-y-1">
                  <span className="text-xs text-muted-foreground">Layout sugerido</span>
                  <p className="text-sm font-medium">{recommendedLayout.name}</p>
                  <p className="text-xs text-muted-foreground">{recommendedLayout.description}</p>
                </div>
              </div>
              {recommendation?.reasoning_short && (
                <p className="text-sm text-muted-foreground">{recommendation.reasoning_short}</p>
              )}
              <div className="flex flex-wrap gap-2">
                <Button
                  onClick={() => apply(recommendedPalette, recommendedLayout.id)}
                  disabled={applying}
                >
                  {applying ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Check className="mr-2 h-4 w-4" />
                  )}
                  Usar esta identidade
                </Button>
                <Button variant="outline" onClick={() => setShowOptions((v) => !v)}>
                  <PaletteIcon className="mr-2 h-4 w-4" /> Ver outras opções
                </Button>
                <Button variant="ghost" onClick={onReanalyze} disabled={analyzing}>
                  <RefreshCw className="mr-2 h-4 w-4" /> Analisar novamente
                </Button>
              </div>
            </>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Ainda não temos uma sugestão. Conte mais sobre o seu negócio no Passo 1 ou escolha
                manualmente abaixo.
              </p>
              <Button variant="outline" onClick={() => setShowOptions(true)}>
                <PaletteIcon className="mr-2 h-4 w-4" /> Escolher manualmente
              </Button>
            </div>
          )}

          {appliedPalette && appliedLayout && (
            <p className="text-xs text-muted-foreground">
              Em uso na sua loja: {appliedPalette.name} • {appliedLayout.name}
            </p>
          )}

          {showOptions && (
            <div className="space-y-4 border-t pt-4">
              <div className="space-y-2">
                <Label>Paletas disponíveis</Label>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {PREDEFINED_PALETTES.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setPickedPalette(p.id)}
                      className={`rounded-md border p-2 text-left transition-all ${
                        pickedPalette === p.id ? "ring-2 ring-primary" : "hover:border-primary/50"
                      }`}
                    >
                      <PaletteSwatch palette={p} />
                      <span className="mt-1 block truncate text-[11px] font-medium">{p.name}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <Label>Layouts disponíveis</Label>
                <div className="grid gap-2 sm:grid-cols-3">
                  {OFFICIAL_LAYOUTS.map((l) => (
                    <button
                      key={l.id}
                      type="button"
                      onClick={() => setPickedLayout(l.id)}
                      className={`rounded-md border p-3 text-left transition-all ${
                        pickedLayout === l.id ? "ring-2 ring-primary" : "hover:border-primary/50"
                      }`}
                    >
                      <span className="text-sm font-medium">{l.name}</span>
                      <p className="text-xs text-muted-foreground">{l.description}</p>
                    </button>
                  ))}
                </div>
              </div>
              <Button
                disabled={applying || !pickedPalette || !pickedLayout}
                onClick={() => {
                  const p = getPaletteById(pickedPalette);
                  if (p && pickedLayout) void apply(p, pickedLayout);
                }}
              >
                {applying ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Check className="mr-2 h-4 w-4" />
                )}
                Usar a opção escolhida
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default IdentityRecommendationStep;
