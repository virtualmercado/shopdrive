import { ColorPalette } from "./AIPaletteSection";
import paletteMoodboard from "@/assets/palette-moodboard.png";

interface PaletteMoodboardProps {
  colors: ColorPalette["colors"];
}

export const PaletteMoodboard = ({ colors }: PaletteMoodboardProps) => {
  // Define the 5 main colors in order
  const colorSwatches = [
    { color: colors.primary, label: "Primária" },
    { color: colors.topBarBg, label: "Top Bar" },
    { color: colors.headerBg, label: "Header" },
    { color: colors.buttonBg, label: "Botão" },
    { color: colors.footerBg, label: "Rodapé" },
  ];

  return (
    <div className="relative w-full h-full min-h-[400px] rounded-lg overflow-hidden shadow-lg border border-border/30">
      {/* Main container with left image area and right color column */}
      <div className="absolute inset-0 flex">
        {/* Left side - Moodboard image */}
        <div className="flex-1 relative overflow-hidden">
          <img 
            src={paletteMoodboard} 
            alt="Moodboard de referência" 
            className="absolute inset-0 w-full h-full object-cover"
          />
        </div>
        
        {/* Right side - Vertical color column */}
        <div className="w-[100px] flex flex-col">
          {colorSwatches.map((swatch, index) => (
            <div
              key={index}
              className="flex-1 flex flex-col justify-center px-2 transition-colors duration-300"
              style={{ backgroundColor: swatch.color }}
            >
              <span 
                className="text-[9px] font-medium uppercase tracking-wide leading-tight"
                style={{ 
                  color: isLightColor(swatch.color) ? '#1a1a1a' : '#ffffff',
                  textShadow: isLightColor(swatch.color) ? 'none' : '0 1px 2px rgba(0,0,0,0.3)'
                }}
              >
                {swatch.label}
              </span>
              <span 
                className="text-[8px] font-mono opacity-80 uppercase"
                style={{ 
                  color: isLightColor(swatch.color) ? '#333333' : '#ffffffcc'
                }}
              >
                {swatch.color}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// Helper function to determine if a color is light or dark
function isLightColor(hexColor: string): boolean {
  // Remove # if present
  const hex = hexColor.replace('#', '');
  
  // Parse RGB values
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  
  // Calculate relative luminance
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  
  return luminance > 0.5;
}
