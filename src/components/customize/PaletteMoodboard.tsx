import { ColorPalette } from "./AIPaletteSection";

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

  // Create a subtle gradient background using palette colors
  const bgGradient = `linear-gradient(145deg, ${colors.headerBg}40 0%, ${colors.secondary}30 50%, ${colors.primary}20 100%)`;

  return (
    <div className="relative w-full h-full min-h-[400px] rounded-lg overflow-hidden shadow-lg border border-border/30">
      {/* Main container with left image area and right color column */}
      <div className="absolute inset-0 flex">
        {/* Left side - Realistic minimalist composition */}
        <div 
          className="flex-1 relative overflow-hidden"
          style={{ background: bgGradient }}
        >
          {/* Base layer with primary tone */}
          <div 
            className="absolute inset-0" 
            style={{ 
              background: `linear-gradient(180deg, ${colors.headerBg} 0%, ${colors.secondary}90 100%)` 
            }}
          />
          
          {/* Decorative surface/floor */}
          <div 
            className="absolute bottom-0 left-0 right-0 h-[35%]"
            style={{ backgroundColor: colors.primary }}
          />
          
          {/* Fabric/curtain texture on top-left */}
          <div 
            className="absolute top-0 left-0 w-[60%] h-[70%]"
            style={{ 
              background: `linear-gradient(135deg, ${colors.buttonBg}dd 0%, ${colors.buttonBg}aa 100%)`,
              borderBottomRightRadius: '20%'
            }}
          />
          
          {/* Minimalist vase silhouette */}
          <div className="absolute bottom-[20%] left-[25%] flex flex-col items-center">
            {/* Vase body */}
            <div 
              className="w-12 h-20 rounded-b-full"
              style={{ 
                backgroundColor: colors.topBarBg,
                boxShadow: `2px 4px 12px ${colors.footerBg}40`
              }}
            />
            {/* Vase neck */}
            <div 
              className="w-6 h-4 -mt-1"
              style={{ backgroundColor: colors.topBarBg }}
            />
            {/* Decorative branches */}
            <svg 
              className="absolute -top-16 left-1/2 -translate-x-1/2 w-16 h-20"
              viewBox="0 0 60 80"
            >
              {/* Main stem */}
              <path 
                d="M30 80 Q30 50 25 30 Q22 20 30 10"
                fill="none"
                stroke={colors.footerBg}
                strokeWidth="2"
                opacity="0.7"
              />
              {/* Left branches */}
              <path 
                d="M26 40 Q15 35 10 25"
                fill="none"
                stroke={colors.footerBg}
                strokeWidth="1.5"
                opacity="0.6"
              />
              <ellipse cx="8" cy="22" rx="6" ry="4" fill={colors.footerBg} opacity="0.5" transform="rotate(-20 8 22)" />
              <path 
                d="M24 55 Q12 50 8 42"
                fill="none"
                stroke={colors.footerBg}
                strokeWidth="1.5"
                opacity="0.6"
              />
              <ellipse cx="6" cy="40" rx="5" ry="3" fill={colors.footerBg} opacity="0.5" transform="rotate(-30 6 40)" />
              {/* Right branches */}
              <path 
                d="M28 35 Q40 28 48 18"
                fill="none"
                stroke={colors.footerBg}
                strokeWidth="1.5"
                opacity="0.6"
              />
              <ellipse cx="50" cy="15" rx="6" ry="4" fill={colors.footerBg} opacity="0.5" transform="rotate(25 50 15)" />
              <path 
                d="M28 48 Q42 42 50 35"
                fill="none"
                stroke={colors.footerBg}
                strokeWidth="1.5"
                opacity="0.6"
              />
              <ellipse cx="52" cy="33" rx="5" ry="3" fill={colors.footerBg} opacity="0.5" transform="rotate(20 52 33)" />
            </svg>
          </div>
          
          {/* Decorative stone/object */}
          <div 
            className="absolute bottom-[15%] right-[15%] w-14 h-10 rounded-full"
            style={{ 
              backgroundColor: colors.footerBg,
              transform: 'rotate(-15deg)',
              boxShadow: `1px 2px 8px ${colors.footerBg}50`
            }}
          />
          
          {/* Soft light overlay */}
          <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-black/5 pointer-events-none" />
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
