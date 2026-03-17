import { ShoppingCart } from "lucide-react";

interface ProductCardStylePreviewProps {
  titleColor: string;
  priceColor: string;
  buttonBgColor: string;
  buttonTextColor: string;
  buttonBorderStyle: string;
  productButtonDisplay: string;
  productTextAlignment: string;
}

const ProductCardStylePreview = ({
  titleColor,
  priceColor,
  buttonBgColor,
  buttonTextColor,
  buttonBorderStyle,
  productButtonDisplay,
  productTextAlignment,
}: ProductCardStylePreviewProps) => {
  const borderRadius =
    buttonBorderStyle === "rounded"
      ? "9999px"
      : buttonBorderStyle === "soft"
      ? "8px"
      : "0px";

  const textAlign =
    productTextAlignment === "center"
      ? "text-center"
      : productTextAlignment === "right"
      ? "text-right"
      : "text-left";

  return (
    <div className="flex flex-col items-center gap-3">
      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
        Preview em tempo real
      </span>
      <div
        className="w-full max-w-[220px] bg-card rounded-lg overflow-hidden border border-border"
        style={{ boxShadow: "0 6px 18px rgba(0,0,0,0.08)" }}
      >
        {/* Mock product image */}
        <div className="aspect-square bg-muted flex items-center justify-center">
          <div className="text-muted-foreground/40 flex flex-col items-center gap-1">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <path d="m21 15-5-5L5 21" />
            </svg>
            <span className="text-[10px]">Imagem</span>
          </div>
        </div>

        {/* Product info */}
        <div className={`p-3 space-y-2 ${textAlign}`}>
          <h4
            className="font-semibold text-sm line-clamp-2 leading-tight"
            style={{ color: titleColor }}
          >
            Produto Exemplo
          </h4>
          <div
            className={`flex items-center gap-1.5 ${
              productTextAlignment === "center"
                ? "justify-center"
                : productTextAlignment === "right"
                ? "justify-end"
                : ""
            }`}
          >
            <span className="text-base font-bold" style={{ color: priceColor }}>
              R$ 99,90
            </span>
            <span className="text-xs text-muted-foreground line-through">
              R$ 129,90
            </span>
          </div>
          {productButtonDisplay === "below" && (
            <button
              className="w-full flex items-center justify-center gap-1.5 py-1.5 text-xs font-medium transition-all"
              style={{
                borderRadius,
                backgroundColor: buttonBgColor,
                color: buttonTextColor,
              }}
            >
              <ShoppingCart className="h-3.5 w-3.5" />
              Adicionar
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProductCardStylePreview;
