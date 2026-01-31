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
  const skyColor = colors.headerBg;       // Céu azul
  const sunColor = colors.buttonBg;       // Sol amarelo
  const skinColor = colors.topBarBg;      // Pele ocre/laranja
  const cactusColor = colors.footerBg;    // Cacto verde escuro
  const groundColor = colors.primary;     // Chão/Morro verde

  return (
    <div className="relative w-full h-full min-h-[400px] rounded-lg overflow-hidden shadow-lg border border-border/30">
      <div className="absolute inset-0 flex">
        {/* Left side - SVG Abaporu illustration */}
        <div className="flex-1 relative overflow-hidden bg-gray-100">
          <svg 
            viewBox="0 0 340 420" 
            className="absolute inset-0 w-full h-full"
            preserveAspectRatio="xMidYMid slice"
          >
            {/* Céu - Sky background */}
            <rect 
              x="0" y="0" width="340" height="420" 
              fill={skyColor}
              className="transition-colors duration-500"
            />
            
            {/* Morro verde esquerdo - Green hill left */}
            <path 
              d="M0 320 Q60 280 100 300 Q140 320 160 380 L160 420 L0 420 Z"
              fill={groundColor}
              className="transition-colors duration-500"
            />
            
            {/* Morro verde direito - Green hill right */}
            <path 
              d="M200 380 Q260 340 300 360 Q340 380 340 420 L200 420 Z"
              fill={groundColor}
              className="transition-colors duration-500"
            />
            
            {/* Cacto - Cactus main stem */}
            <path 
              d="M270 420 
                 C268 380 266 340 268 300
                 C270 260 272 220 270 180
                 C268 150 270 130 272 120
                 L280 120
                 C282 130 284 150 282 180
                 C280 220 282 260 284 300
                 C286 340 284 380 282 420
                 Z"
              fill={cactusColor}
              className="transition-colors duration-500"
            />
            
            {/* Cacto - Left arm */}
            <path 
              d="M268 260
                 C250 255 235 245 230 225
                 C225 205 228 185 235 175
                 C242 168 248 172 250 182
                 C252 195 248 210 252 225
                 C256 240 262 252 268 255
                 Z"
              fill={cactusColor}
              className="transition-colors duration-500"
            />
            
            {/* Cacto - Right arm */}
            <path 
              d="M284 300
                 C302 295 318 280 325 255
                 C332 230 328 205 320 195
                 C312 188 305 192 304 205
                 C303 220 308 238 302 258
                 C296 278 288 292 284 298
                 Z"
              fill={cactusColor}
              className="transition-colors duration-500"
            />
            
            {/* Sol - Sun */}
            <circle 
              cx="240" cy="65" r="32" 
              fill={sunColor}
              className="transition-colors duration-500"
            />
            
            {/* === FIGURA HUMANA - Human Figure === */}
            
            {/* Pé direito gigante - Giant right foot */}
            <path 
              d="M95 420
                 C85 415 70 405 65 390
                 C60 375 65 355 80 345
                 C95 335 120 330 150 332
                 C180 334 210 345 225 360
                 C240 375 245 395 240 408
                 C235 418 220 420 200 420
                 Z"
              fill={skinColor}
              className="transition-colors duration-500"
            />
            
            {/* Dedos do pé direito - Right foot toes */}
            <ellipse cx="72" cy="378" rx="12" ry="18" fill={skinColor} transform="rotate(-30 72 378)" className="transition-colors duration-500" />
            <ellipse cx="58" cy="390" rx="10" ry="14" fill={skinColor} transform="rotate(-40 58 390)" className="transition-colors duration-500" />
            <ellipse cx="48" cy="402" rx="8" ry="12" fill={skinColor} transform="rotate(-50 48 402)" className="transition-colors duration-500" />
            
            {/* Pé esquerdo - Left foot */}
            <path 
              d="M20 380
                 C15 370 20 355 35 345
                 C50 335 75 330 100 335
                 C125 340 140 355 145 370
                 C150 385 140 395 120 398
                 C90 402 50 395 30 388
                 Z"
              fill={skinColor}
              className="transition-colors duration-500"
            />
            
            {/* Perna direita - Right leg */}
            <path 
              d="M150 335
                 C145 310 135 280 130 250
                 C125 220 130 190 140 170
                 L160 175
                 C155 195 152 220 155 250
                 C158 280 165 310 170 340
                 Z"
              fill={skinColor}
              className="transition-colors duration-500"
            />
            
            {/* Coxa/Quadril - Thigh/Hip - the iconic curved shape */}
            <path 
              d="M30 340
                 C25 310 30 270 50 235
                 C70 200 100 175 130 165
                 C145 160 158 165 165 178
                 C172 195 168 220 158 250
                 C148 280 130 310 115 335
                 C100 355 70 365 45 358
                 Z"
              fill={skinColor}
              className="transition-colors duration-500"
            />
            
            {/* Torso alongado - Elongated torso */}
            <path 
              d="M130 170
                 C125 150 118 125 115 100
                 C112 80 118 60 130 52
                 C142 45 155 52 160 68
                 C165 85 162 110 158 135
                 C154 155 148 172 145 180
                 Z"
              fill={skinColor}
              className="transition-colors duration-500"
            />
            
            {/* Cabeça pequena - Tiny head */}
            <ellipse 
              cx="128" cy="48" rx="10" ry="13" 
              fill={skinColor}
              className="transition-colors duration-500"
            />
            
            {/* Braço curvado sobre a cabeça - Arm curved over head */}
            <path 
              d="M115 75
                 C105 65 92 55 85 45
                 C78 35 80 25 90 22
                 C100 19 112 25 120 35
                 C128 45 130 58 128 70
                 Z"
              fill={skinColor}
              className="transition-colors duration-500"
            />
            
            {/* Mão apoiada na cabeça - Hand resting on head */}
            <path 
              d="M85 38
                 C78 35 72 28 72 22
                 C72 16 78 12 86 14
                 C94 16 100 22 102 30
                 C104 38 98 42 90 40
                 Z"
              fill={skinColor}
              className="transition-colors duration-500"
            />
            
            {/* Dedos da mão - Fingers */}
            <ellipse cx="75" cy="18" rx="6" ry="4" fill={skinColor} transform="rotate(-30 75 18)" className="transition-colors duration-500" />
            <ellipse cx="82" cy="13" rx="5" ry="3" fill={skinColor} transform="rotate(-15 82 13)" className="transition-colors duration-500" />
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
  const hex = hexColor.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.5;
}
