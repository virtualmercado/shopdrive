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

  // Map palette colors to Abaporu elements
  const skyColor = colors.headerBg;      // Céu
  const sunColor = colors.buttonBg;       // Sol
  const skinColor = colors.topBarBg;      // Pele da mulher
  const cactusColor = colors.footerBg;    // Cacto
  const groundColor = colors.primary;     // Chão/Morros

  return (
    <div className="relative w-full h-full min-h-[400px] rounded-lg overflow-hidden shadow-lg border border-border/30">
      {/* Main container with left image area and right color column */}
      <div className="absolute inset-0 flex">
        {/* Left side - SVG Abaporu illustration with dynamic colors */}
        <div className="flex-1 relative overflow-hidden">
          <svg 
            viewBox="0 0 400 480" 
            className="absolute inset-0 w-full h-full"
            preserveAspectRatio="xMidYMid slice"
          >
            {/* Sky background */}
            <rect 
              x="0" y="0" width="400" height="480" 
              fill={skyColor}
              className="transition-colors duration-500"
            />
            
            {/* Ground/Hills - bottom curved shapes */}
            <ellipse 
              cx="80" cy="480" rx="180" ry="120" 
              fill={groundColor}
              className="transition-colors duration-500"
            />
            <ellipse 
              cx="350" cy="500" rx="150" ry="100" 
              fill={groundColor}
              className="transition-colors duration-500"
            />
            
            {/* Cactus */}
            <g className="transition-colors duration-500">
              {/* Main cactus body */}
              <path 
                d="M320 480 Q320 380 325 300 Q330 250 325 200 Q320 180 325 160 Q330 150 325 140 L335 140 Q340 150 335 160 Q330 180 335 200 Q340 250 335 300 Q340 380 340 480 Z"
                fill={cactusColor}
              />
              {/* Left arm */}
              <path 
                d="M320 280 Q290 270 280 240 Q275 220 280 200 Q285 185 290 200 Q295 220 290 235 Q300 260 320 265 Z"
                fill={cactusColor}
              />
              {/* Right arm */}
              <path 
                d="M340 320 Q370 310 380 280 Q385 255 380 235 Q375 220 370 235 Q365 255 370 275 Q360 305 340 310 Z"
                fill={cactusColor}
              />
            </g>
            
            {/* Sun */}
            <circle 
              cx="280" cy="80" r="40" 
              fill={sunColor}
              className="transition-colors duration-500"
            />
            
            {/* Woman figure - simplified Abaporu style */}
            <g className="transition-colors duration-500">
              {/* Giant foot (right) */}
              <ellipse 
                cx="220" cy="420" rx="80" ry="50" 
                fill={skinColor}
                transform="rotate(-10 220 420)"
              />
              
              {/* Giant foot (left) */}
              <ellipse 
                cx="130" cy="380" rx="60" ry="40" 
                fill={skinColor}
                transform="rotate(-25 130 380)"
              />
              
              {/* Lower leg (right) */}
              <path 
                d="M160 380 Q180 350 170 300 Q165 270 175 240 L195 245 Q185 275 190 305 Q200 355 180 390 Z"
                fill={skinColor}
              />
              
              {/* Upper leg / thigh */}
              <ellipse 
                cx="140" cy="260" rx="45" ry="70" 
                fill={skinColor}
                transform="rotate(-30 140 260)"
              />
              
              {/* Body/torso - curved elongated shape */}
              <path 
                d="M100 200 Q95 170 100 140 Q110 100 130 80 Q145 70 155 85 Q165 110 160 150 Q155 190 145 220 Q130 240 110 230 Z"
                fill={skinColor}
              />
              
              {/* Tiny head */}
              <ellipse 
                cx="145" cy="65" rx="12" ry="15" 
                fill={skinColor}
              />
              
              {/* Arm bent over head */}
              <path 
                d="M130 95 Q110 80 100 60 Q95 45 105 40 Q120 38 130 50 Q140 65 145 80 Z"
                fill={skinColor}
              />
              
              {/* Hand on head */}
              <ellipse 
                cx="108" cy="42" rx="12" ry="8" 
                fill={skinColor}
                transform="rotate(-20 108 42)"
              />
            </g>
          </svg>
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
