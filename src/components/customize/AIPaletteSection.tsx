import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Brain, Sparkles, Check, X, Loader2, Leaf, Waves, Mountain, Moon, Circle, Heart, Flame, TreeDeciduous, ArrowLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { PaletteMoodboard } from "./PaletteMoodboard";
import { StorePreviewMockup } from "./StorePreviewMockup";

// Catálogo oficial centralizado em src/lib/storePalettes.ts
import { PREDEFINED_PALETTES, type ColorPalette } from "@/lib/storePalettes";
import { persistStorePalette } from "@/lib/storeIdentity";

export type { ColorPalette };

// Helper function to render icon by type
const PaletteIcon = ({ type }: { type: ColorPalette['iconType'] }) => {
  switch (type) {
    case 'leaf': return <Leaf className="h-4 w-4" />;
    case 'waves': return <Waves className="h-4 w-4" />;
    case 'mountain': return <Mountain className="h-4 w-4" />;
    case 'moon': return <Moon className="h-4 w-4" />;
    case 'circle': return <Circle className="h-4 w-4" />;
    case 'heart': return <Heart className="h-4 w-4" />;
    case 'flame': return <Flame className="h-4 w-4" />;
    case 'tree': return <TreeDeciduous className="h-4 w-4" />;
    case 'sparkles': return <Sparkles className="h-4 w-4" />;
    default: return <Circle className="h-4 w-4" />;
  }
};


interface AIPaletteSectionProps {
  currentColors: {
    primary: string;
    secondary: string;
    background: string;
  };
  buttonBgColor: string;
  buttonTextColor: string;
  userId: string | null;
  onApplyPalette: (palette: {
    primary: string;
    secondary: string;
    background: string;
    buttonBg: string;
    buttonText: string;
  }) => void;
}

export const AIPaletteSection = ({
  currentColors,
  buttonBgColor,
  buttonTextColor,
  userId,
  onApplyPalette,
}: AIPaletteSectionProps) => {
  const { toast } = useToast();
  const [selectedPalette, setSelectedPalette] = useState<ColorPalette | null>(null);
  const [previewPalette, setPreviewPalette] = useState<ColorPalette | null>(null);
  const [refinementPrompt, setRefinementPrompt] = useState("");
  const [isRefining, setIsRefining] = useState(false);
  const [refinedColors, setRefinedColors] = useState<ColorPalette["colors"] | null>(null);

  // Store original colors to restore on discard
  const [originalColors] = useState({
    primary: currentColors.primary,
    secondary: currentColors.secondary,
    background: currentColors.background,
    buttonBg: buttonBgColor,
    buttonText: buttonTextColor,
  });

  const handleSelectPalette = (palette: ColorPalette) => {
    setSelectedPalette(palette);
    setPreviewPalette(palette);
    setRefinedColors(null);
    setRefinementPrompt("");
    
    // Apply preview colors immediately
    applyPreviewColors(palette.colors);
  };

  const applyPreviewColors = (colors: ColorPalette["colors"]) => {
    const root = document.documentElement;
    root.style.setProperty('--merchant-primary', colors.primary);
    root.style.setProperty('--merchant-secondary', colors.secondary);
    root.style.setProperty('--merchant-button-bg', colors.buttonBg);
    root.style.setProperty('--merchant-button-text', colors.buttonText);
    root.style.setProperty('--merchant-primary-hover', `${colors.primary}dd`);
    root.style.setProperty('--merchant-primary-light', `${colors.primary}15`);
    root.style.setProperty('--merchant-primary-ring', `${colors.primary}33`);
    root.style.setProperty('--merchant-button-hover', `${colors.buttonBg}dd`);
    root.style.setProperty('--merchant-topbar-bg', colors.topBarBg);
    root.style.setProperty('--merchant-topbar-text', colors.topBarText);
  };

  const restoreOriginalColors = () => {
    const root = document.documentElement;
    root.style.setProperty('--merchant-primary', originalColors.primary);
    root.style.setProperty('--merchant-secondary', originalColors.secondary);
    root.style.setProperty('--merchant-button-bg', originalColors.buttonBg);
    root.style.setProperty('--merchant-button-text', originalColors.buttonText);
    root.style.setProperty('--merchant-primary-hover', `${originalColors.primary}dd`);
    root.style.setProperty('--merchant-primary-light', `${originalColors.primary}15`);
    root.style.setProperty('--merchant-primary-ring', `${originalColors.primary}33`);
    root.style.setProperty('--merchant-button-hover', `${originalColors.buttonBg}dd`);
  };

  const handleRefineWithAI = async () => {
    if (!selectedPalette || !refinementPrompt.trim()) {
      toast({
        title: "Atenção",
        description: "Selecione uma paleta e descreva o refinamento desejado.",
        variant: "destructive",
      });
      return;
    }

    setIsRefining(true);

    try {
      const { data, error } = await supabase.functions.invoke('refine-color-palette', {
        body: {
          basePalette: selectedPalette.colors,
          paletteName: selectedPalette.name,
          refinementPrompt: refinementPrompt.trim(),
        },
      });

      if (error) throw error;

      if (data?.colors) {
        setRefinedColors(data.colors);
        applyPreviewColors(data.colors);
        toast({
          title: "Paleta refinada!",
          description: "A IA ajustou as cores conforme sua solicitação.",
        });
      }
    } catch (error) {
      console.error("Erro ao refinar paleta:", error);
      toast({
        title: "Erro ao refinar",
        description: "Não foi possível refinar a paleta. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsRefining(false);
    }
  };

  const handleApply = async () => {
    const colorsToApply = refinedColors || previewPalette?.colors;
    
    if (!colorsToApply || !userId) {
      toast({
        title: "Erro",
        description: "Selecione uma paleta primeiro.",
        variant: "destructive",
      });
      return;
    }

    try {
      await persistStorePalette(userId, colorsToApply);

      // Update parent state
      onApplyPalette({
        primary: colorsToApply.primary,
        secondary: colorsToApply.headerBg,
        background: colorsToApply.headerText,
        buttonBg: colorsToApply.buttonBg,
        buttonText: colorsToApply.buttonText,
      });

      // Reset preview state
      setSelectedPalette(null);
      setPreviewPalette(null);
      setRefinedColors(null);
      setRefinementPrompt("");

      toast({
        title: "Paleta aplicada!",
        description: "As cores foram salvas na sua loja.",
      });
    } catch (error) {
      console.error("Erro ao aplicar paleta:", error);
      toast({
        title: "Erro ao salvar",
        description: "Não foi possível salvar as cores. Tente novamente.",
        variant: "destructive",
      });
    }
  };

  const handleDiscard = () => {
    restoreOriginalColors();
    setSelectedPalette(null);
    setPreviewPalette(null);
    setRefinedColors(null);
    setRefinementPrompt("");
  };

  const handleBackToGrid = () => {
    restoreOriginalColors();
    setSelectedPalette(null);
    setPreviewPalette(null);
    setRefinedColors(null);
    setRefinementPrompt("");
  };

  const activeColors = refinedColors || previewPalette?.colors;

  // Advanced state - 3-column layout
  if (selectedPalette && activeColors) {
    return (
      <Card className="p-6">
        {/* Header with back button */}
        <div className="flex items-center gap-3 mb-6">
          <Button variant="ghost" size="sm" onClick={handleBackToGrid} className="p-1 h-8 w-8">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center w-8 h-8 bg-gradient-to-br from-purple-500 to-pink-500 rounded">
              <Brain className="h-4 w-4 text-white" />
            </div>
            <h2 className="text-lg font-semibold text-foreground">Paleta de Cor com IA</h2>
          </div>
        </div>

        {/* Palette Grid (2 rows x 6 columns) */}
        <div className="grid grid-cols-3 md:grid-cols-6 gap-2 mb-6">
          {PREDEFINED_PALETTES.map((palette) => (
            <button
              key={palette.id}
              onClick={() => handleSelectPalette(palette)}
              className={`border rounded-lg p-2 text-left transition-all hover:shadow-md ${
                selectedPalette?.id === palette.id
                  ? "ring-2 ring-primary border-transparent"
                  : "border-input hover:border-primary/50"
              }`}
              title={palette.name}
            >
              {/* Color Preview Bar */}
              <div className="flex gap-0.5 rounded overflow-hidden h-4">
                <div className="flex-1" style={{ backgroundColor: palette.colors.primary }} />
                <div className="flex-1" style={{ backgroundColor: palette.colors.secondary }} />
                <div className="flex-1" style={{ backgroundColor: palette.colors.buttonBg }} />
                <div className="flex-1" style={{ backgroundColor: palette.colors.footerBg }} />
              </div>
              <span className="text-[10px] font-medium truncate block mt-1">{palette.name}</span>
            </button>
          ))}
        </div>

        {/* 3-Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Column 1 - Moodboard */}
          <div className="lg:col-span-1">
            <PaletteMoodboard colors={activeColors} />
          </div>

          {/* Column 2 - AI Controls */}
          <div className="lg:col-span-1 flex flex-col">
            {/* Preview Indicator */}
            <div className="bg-muted/50 border border-dashed border-primary/30 rounded-lg p-4 mb-4">
              <div className="flex items-center gap-2 mb-3">
                <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                <span className="text-sm font-medium">
                  Modo Preview Ativo: {selectedPalette.name}
                  {refinedColors && " (Refinada com IA)"}
                </span>
              </div>
              
              {/* Color swatches - sequence: Primária, Top Bar, Header, Botão, Rodapé */}
              <div className="flex gap-2 flex-wrap">
                <div className="flex items-center gap-1.5">
                  <div className="w-5 h-5 rounded border" style={{ backgroundColor: activeColors.primary }} />
                  <span className="text-xs text-muted-foreground">Primária</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-5 h-5 rounded border" style={{ backgroundColor: activeColors.topBarBg }} />
                  <span className="text-xs text-muted-foreground">Top Bar</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-5 h-5 rounded border" style={{ backgroundColor: activeColors.headerBg }} />
                  <span className="text-xs text-muted-foreground">Header</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-5 h-5 rounded border" style={{ backgroundColor: activeColors.buttonBg }} />
                  <span className="text-xs text-muted-foreground">Botão</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-5 h-5 rounded border" style={{ backgroundColor: activeColors.footerBg }} />
                  <span className="text-xs text-muted-foreground">Rodapé</span>
                </div>
              </div>
            </div>

            {/* AI Refinement Section */}
            <div className="space-y-4 flex-1">
              <div className="space-y-2">
                <Label htmlFor="refinement-prompt" className="text-sm font-medium">
                  Deseja ajustar essa paleta com IA? (opcional)
                </Label>
                <Textarea
                  id="refinement-prompt"
                  value={refinementPrompt}
                  onChange={(e) => setRefinementPrompt(e.target.value)}
                  placeholder='Ex: "Deixar mais elegante", "Mais contraste nos botões", "Tons mais claros"'
                  className="resize-none"
                  rows={3}
                />
              </div>
              
              <Button
                onClick={handleRefineWithAI}
                disabled={isRefining || !refinementPrompt.trim()}
                variant="outline"
                className="w-full"
              >
                {isRefining ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Refinando...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 mr-2" />
                    Refinar paleta com IA
                  </>
                )}
              </Button>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 justify-end pt-4 border-t mt-4">
              <Button variant="outline" onClick={handleDiscard}>
                <X className="h-4 w-4 mr-2" />
                Descartar
              </Button>
              <Button onClick={handleApply} className="bg-primary text-primary-foreground hover:bg-primary/90">
                <Check className="h-4 w-4 mr-2" />
                Aplicar Paleta
              </Button>
            </div>
          </div>

          {/* Column 3 - Store Preview */}
          <div className="lg:col-span-1">
            <div className="text-center mb-2">
              <span className="text-sm font-medium text-muted-foreground">Pré-Visualização</span>
            </div>
            <StorePreviewMockup colors={activeColors} storeName="Minha Loja" />
          </div>
        </div>
      </Card>
    );
  }

  // Initial state - Palette Grid
  return (
    <Card className="p-6">
      <div className="space-y-1 mb-6">
        <div className="flex items-center gap-2">
          <div className="flex items-center justify-center w-8 h-8 bg-gradient-to-br from-purple-500 to-pink-500 rounded">
            <Brain className="h-4 w-4 text-white" />
          </div>
          <h2 className="text-lg font-semibold text-foreground">Paleta de Cor com IA</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          Escolha uma paleta visual e, opcionalmente, refine com IA
        </p>
      </div>

      {/* Palette Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {PREDEFINED_PALETTES.map((palette) => (
          <button
            key={palette.id}
            onClick={() => handleSelectPalette(palette)}
            className="border rounded-lg p-3 text-left transition-all hover:shadow-md border-input hover:border-primary/50"
          >
            {/* Color Preview Bar */}
            <div className="flex gap-0.5 rounded overflow-hidden h-6 mb-2">
              <div className="flex-1" style={{ backgroundColor: palette.colors.primary }} />
              <div className="flex-1" style={{ backgroundColor: palette.colors.secondary }} />
              <div className="flex-1" style={{ backgroundColor: palette.colors.headerBg }} />
              <div className="flex-1" style={{ backgroundColor: palette.colors.buttonBg }} />
              <div className="flex-1" style={{ backgroundColor: palette.colors.footerBg }} />
            </div>
            
            <div className="flex items-center gap-1.5 mb-1">
              <span className="text-muted-foreground"><PaletteIcon type={palette.iconType} /></span>
              <span className="font-medium text-sm truncate">{palette.name}</span>
            </div>
            <p className="text-xs text-muted-foreground line-clamp-2">{palette.description}</p>
          </button>
        ))}
      </div>
    </Card>
  );
};
