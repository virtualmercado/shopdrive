import { ColorPalette } from "./AIPaletteSection";
import { ShoppingCart, Search, User, Heart, ChevronRight } from "lucide-react";

interface StorePreviewMockupProps {
  colors: ColorPalette["colors"];
  storeName?: string;
}

export const StorePreviewMockup = ({ colors, storeName = "Minha Loja" }: StorePreviewMockupProps) => {
  return (
    <div className="w-full h-full min-h-[400px] bg-white rounded-lg shadow-lg overflow-hidden flex flex-col text-[10px] leading-tight">
      {/* Top Bar */}
      <div 
        className="w-full py-1 px-2 text-center font-medium"
        style={{ 
          backgroundColor: colors.topBarBg, 
          color: colors.topBarText 
        }}
      >
        <span className="text-[8px]">🔥 Frete Grátis acima de R$ 199</span>
        <div className="absolute right-2 top-0.5 text-[7px] bg-white/20 px-1 rounded">Top Bar</div>
      </div>

      {/* Header */}
      <div 
        className="relative w-full py-2 px-3 flex items-center justify-between"
        style={{ 
          backgroundColor: colors.headerBg, 
          color: colors.headerText 
        }}
      >
        <div className="font-bold text-[11px] truncate max-w-[60px]">{storeName}</div>
        <div className="flex items-center gap-2">
          <Search className="h-3 w-3" />
          <User className="h-3 w-3" />
          <ShoppingCart className="h-3 w-3" />
        </div>
        <div className="absolute right-1 bottom-0.5 text-[7px] bg-black/10 px-1 rounded">Header</div>
      </div>

      {/* Banner */}
      <div 
        className="relative w-full h-20 flex items-center justify-center"
        style={{ 
          background: `linear-gradient(135deg, ${colors.primary}cc, ${colors.secondary}cc)` 
        }}
      >
        <div className="text-center text-white">
          <div className="font-bold text-[12px] drop-shadow">NOVOS LANÇAMENTOS</div>
          <div className="text-[8px] opacity-90">Confira nossa coleção</div>
        </div>
      </div>

      {/* Products Section */}
      <div className="flex-1 p-2 bg-gray-50">
        <div className="flex items-center justify-between mb-2">
          <span className="font-semibold text-[9px] text-gray-700">Destaques</span>
          <ChevronRight className="h-3 w-3 text-gray-400" />
        </div>
        
        {/* Product Grid */}
        <div className="grid grid-cols-2 gap-1.5">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-white rounded shadow-sm overflow-hidden">
              {/* Product Image Placeholder */}
              <div 
                className="h-12 w-full"
                style={{ 
                  backgroundColor: i % 2 === 0 ? `${colors.secondary}40` : `${colors.primary}20` 
                }}
              />
              {/* Product Info */}
              <div className="p-1">
                <div className="text-[8px] text-gray-600 truncate">Produto {i}</div>
                <div className="text-[9px] font-bold text-gray-800">R$ 99,90</div>
                {/* Buy Button */}
                <button
                  className="relative w-full mt-1 py-0.5 rounded text-[7px] font-medium transition-colors"
                  style={{ 
                    backgroundColor: colors.buttonBg, 
                    color: colors.buttonText 
                  }}
                >
                  Comprar
                  {i === 1 && (
                    <span className="absolute -right-0.5 -top-0.5 text-[6px] bg-black/20 px-0.5 rounded">Botões</span>
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div 
        className="relative w-full py-2 px-2"
        style={{ 
          backgroundColor: colors.footerBg, 
          color: colors.footerText 
        }}
      >
        <div className="text-center">
          <div className="font-medium text-[9px]">{storeName}</div>
          <div className="text-[7px] opacity-80 mt-0.5">
            Atendimento • Sobre • Contato
          </div>
        </div>
        <div className="absolute right-1 bottom-0.5 text-[6px] bg-white/20 px-0.5 rounded">Rodapé</div>
      </div>
    </div>
  );
};
