import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Paintbrush, Info } from "lucide-react";

interface StoreAppearanceCardProps {
  fontFamily: string;
  setFontFamily: (v: string) => void;
  fontWeight: number;
  setFontWeight: (v: number) => void;
  headerLogoPosition: "left" | "center" | "right";
  setHeaderLogoPosition: (v: "left" | "center" | "right") => void;
  buttonBorderStyle: string;
  setButtonBorderStyle: (v: string) => void;
  productButtonDisplay: string;
  setProductButtonDisplay: (v: string) => void;
  productTextAlignment: string;
  setProductTextAlignment: (v: string) => void;
  buttonBgColor: string;
  setButtonBgColor: (v: string) => void;
  buttonTextColor: string;
  setButtonTextColor: (v: string) => void;
  priceColor: string;
  setPriceColor: (v: string) => void;
  aiPaletteActive?: boolean;
}

const SD_PRIMARY = "#6A1B9A";
const SD_PRIMARY_BG = "#6A1B9A40";
const SD_PRIMARY_HOVER = "#6A1B9A80";

const fontOptions = [
  { label: "Inter", value: "Inter" },
  { label: "Poppins", value: "Poppins" },
  { label: "Roboto", value: "Roboto" },
  { label: "Open Sans", value: "Open Sans" },
  { label: "Lato", value: "Lato" },
  { label: "Montserrat", value: "Montserrat" },
  { label: "Nunito", value: "Nunito" },
  { label: "Raleway", value: "Raleway" },
];

const weightOptions = [
  { label: "Light", value: 300 },
  { label: "Regular", value: 400 },
  { label: "Medium", value: 500 },
  { label: "Semibold", value: 600 },
  { label: "Bold", value: 700 },
];

const OptionButton = ({
  selected,
  onClick,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) => (
  <button
    type="button"
    onClick={onClick}
    className={`border rounded-md p-3 text-center text-sm transition-all ${
      selected ? "border-transparent font-semibold" : "border-input"
    }`}
    style={{
      ...(selected && { backgroundColor: SD_PRIMARY_BG, color: SD_PRIMARY }),
    }}
    onMouseEnter={(e) => {
      if (!selected) e.currentTarget.style.borderColor = SD_PRIMARY_HOVER;
    }}
    onMouseLeave={(e) => {
      if (!selected) e.currentTarget.style.borderColor = "hsl(var(--input))";
    }}
  >
    {children}
  </button>
);

const StoreAppearanceCard = ({
  fontFamily,
  setFontFamily,
  fontWeight,
  setFontWeight,
  headerLogoPosition,
  setHeaderLogoPosition,
  buttonBorderStyle,
  setButtonBorderStyle,
  productButtonDisplay,
  setProductButtonDisplay,
  productTextAlignment,
  setProductTextAlignment,
  buttonBgColor,
  setButtonBgColor,
  buttonTextColor,
  setButtonTextColor,
  priceColor,
  setPriceColor,
  aiPaletteActive = false,
}: StoreAppearanceCardProps) => {
  return (
    <Card className="p-6">
      <div className="space-y-1 mb-6">
        <div className="flex items-center gap-2">
          <div className="flex items-center justify-center w-8 h-8 bg-gray-100 rounded">
            <Paintbrush className="h-4 w-4 text-gray-600" />
          </div>
          <h2 className="text-lg font-semibold text-foreground">Aparência da Loja</h2>
        </div>
        <p className="text-sm text-muted-foreground ml-10">
          Configure a aparência visual da vitrine e o comportamento dos elementos principais da sua loja.
        </p>
      </div>

      <div className="space-y-6">
        {/* Font Family */}
        <div className="space-y-2">
          <Label className="text-base font-medium">Estilo da Fonte</Label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {fontOptions.map((opt) => (
              <OptionButton
                key={opt.value}
                selected={fontFamily === opt.value}
                onClick={() => setFontFamily(opt.value)}
              >
                <span style={{ fontFamily: opt.value }}>{opt.label}</span>
              </OptionButton>
            ))}
          </div>
        </div>

        {/* Font Weight */}
        <div className="space-y-2 border-t pt-6">
          <Label className="text-base font-medium">Peso da Fonte</Label>
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
            {weightOptions.map((opt) => (
              <OptionButton
                key={opt.value}
                selected={fontWeight === opt.value}
                onClick={() => setFontWeight(opt.value)}
              >
                <span style={{ fontWeight: opt.value }}>{opt.label}</span>
              </OptionButton>
            ))}
          </div>
        </div>

        {/* Header Logo Position */}
        <div className="space-y-2 border-t pt-6">
          <Label className="text-base font-medium">Posição da Logo no Cabeçalho</Label>
          <div className="grid grid-cols-3 gap-2">
            {(["left", "center", "right"] as const).map((pos) => (
              <OptionButton
                key={pos}
                selected={headerLogoPosition === pos}
                onClick={() => setHeaderLogoPosition(pos)}
              >
                <div className="flex items-center gap-1 w-full mb-1">
                  {pos === "left" && (
                    <>
                      <div className="w-4 h-3 rounded-sm" style={{ backgroundColor: headerLogoPosition === pos ? SD_PRIMARY : "#9ca3af" }} />
                      <div className="flex-1 h-2 bg-muted rounded" />
                      <div className="w-6 h-2 bg-muted rounded" />
                    </>
                  )}
                  {pos === "center" && (
                    <>
                      <div className="w-6 h-2 bg-muted rounded" />
                      <div className="w-4 h-3 rounded-sm" style={{ backgroundColor: headerLogoPosition === pos ? SD_PRIMARY : "#9ca3af" }} />
                      <div className="w-6 h-2 bg-muted rounded" />
                    </>
                  )}
                  {pos === "right" && (
                    <>
                      <div className="w-6 h-2 bg-muted rounded" />
                      <div className="flex-1 h-2 bg-muted rounded" />
                      <div className="w-4 h-3 rounded-sm" style={{ backgroundColor: headerLogoPosition === pos ? SD_PRIMARY : "#9ca3af" }} />
                    </>
                  )}
                </div>
                <span className="text-sm">
                  {pos === "left" ? "Esquerda" : pos === "center" ? "Centralizada" : "Direita"}
                </span>
              </OptionButton>
            ))}
          </div>
        </div>

        {/* Button Border Style */}
        <div className="space-y-2 border-t pt-6">
          <Label className="text-base font-medium">Estilo dos Botões</Label>
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: "Arredondado", value: "rounded", radius: "9999px" },
              { label: "Suave", value: "soft", radius: "8px" },
              { label: "Reto", value: "square", radius: "0px" },
            ].map((opt) => (
              <OptionButton
                key={opt.value}
                selected={buttonBorderStyle === opt.value}
                onClick={() => setButtonBorderStyle(opt.value)}
              >
                <div className="flex justify-center mb-2">
                  <div
                    className="px-4 py-1.5 text-xs font-medium"
                    style={{
                      borderRadius: opt.radius,
                      backgroundColor: SD_PRIMARY,
                      color: "#FFFFFF",
                    }}
                  >
                    Comprar
                  </div>
                </div>
                <span className="text-sm">{opt.label}</span>
              </OptionButton>
            ))}
          </div>
        </div>

        {/* Button Colors */}
        <div className="space-y-2 border-t pt-6">
          <Label className="text-base font-medium">Cores do Botão de Compra</Label>
          {aiPaletteActive ? (
            <div className="flex items-center gap-2 p-3 rounded-md bg-muted/50 border border-input text-sm text-muted-foreground">
              <Info className="h-4 w-4 flex-shrink-0" />
              <span>As cores estão sendo controladas pela Paleta de Cor com IA.</span>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-sm">Fundo do botão</Label>
                <div className="flex gap-2">
                  <Input
                    type="color"
                    value={buttonBgColor}
                    onChange={(e) => setButtonBgColor(e.target.value)}
                    className="h-10 w-16 p-1 cursor-pointer"
                  />
                  <Input
                    type="text"
                    value={buttonBgColor}
                    onChange={(e) => setButtonBgColor(e.target.value)}
                    className="flex-1"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm">Texto do botão</Label>
                <div className="flex gap-2">
                  <Input
                    type="color"
                    value={buttonTextColor}
                    onChange={(e) => setButtonTextColor(e.target.value)}
                    className="h-10 w-16 p-1 cursor-pointer"
                  />
                  <Input
                    type="text"
                    value={buttonTextColor}
                    onChange={(e) => setButtonTextColor(e.target.value)}
                    className="flex-1"
                  />
                </div>
              </div>
              <div className="col-span-2 flex justify-center">
                <div
                  className="px-6 py-2 text-sm font-medium"
                  style={{
                    borderRadius: buttonBorderStyle === "rounded" ? "9999px" : buttonBorderStyle === "soft" ? "8px" : "0px",
                    backgroundColor: buttonBgColor,
                    color: buttonTextColor,
                  }}
                >
                  Pré-visualização do botão
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Price Color */}
        <div className="space-y-2 border-t pt-6">
          <Label className="text-base font-medium">Cor dos Preços dos Produtos</Label>
          <p className="text-xs text-muted-foreground">
            Define a cor dos preços exibidos nos cards de produto da vitrine.
          </p>
          {aiPaletteActive ? (
            <div className="flex items-center gap-2 p-3 rounded-md bg-muted/50 border border-input text-sm text-muted-foreground">
              <Info className="h-4 w-4 flex-shrink-0" />
              <span>As cores estão sendo controladas pela Paleta de Cor com IA.</span>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex gap-2 max-w-xs">
                <Input
                  type="color"
                  value={priceColor}
                  onChange={(e) => setPriceColor(e.target.value)}
                  className="h-10 w-16 p-1 cursor-pointer"
                />
                <Input
                  type="text"
                  value={priceColor}
                  onChange={(e) => setPriceColor(e.target.value)}
                  className="flex-1"
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Pré-visualização:</span>
                <span className="text-lg font-bold" style={{ color: priceColor }}>
                  R$ 99,90
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Product Button Display */}
        <div className="space-y-2 border-t pt-6">
          <Label className="text-base font-medium">Botão de Compra na Vitrine</Label>
          <p className="text-xs text-muted-foreground">
            Escolha se o botão de compra será exibido nos cards de produto da vitrine.
          </p>
          <div className="grid grid-cols-2 gap-2">
            <OptionButton
              selected={productButtonDisplay === "below"}
              onClick={() => setProductButtonDisplay("below")}
            >
              Exibir botão
            </OptionButton>
            <OptionButton
              selected={productButtonDisplay === "hidden"}
              onClick={() => setProductButtonDisplay("hidden")}
            >
              Ocultar botão
            </OptionButton>
          </div>
        </div>

        {/* Product Text Alignment */}
        <div className="space-y-2 border-t pt-6">
          <Label className="text-base font-medium">Posição do Título nos Cards</Label>
          <p className="text-xs text-muted-foreground">
            Define o alinhamento do título e preço nos cards da vitrine.
          </p>
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: "Esquerda", value: "left" },
              { label: "Centralizado", value: "center" },
              { label: "Direita", value: "right" },
            ].map((opt) => (
              <OptionButton
                key={opt.value}
                selected={productTextAlignment === opt.value}
                onClick={() => setProductTextAlignment(opt.value)}
              >
                {opt.label}
              </OptionButton>
            ))}
          </div>
        </div>
      </div>
    </Card>
  );
};

export default StoreAppearanceCard;
