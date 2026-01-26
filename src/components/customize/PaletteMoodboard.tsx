import { ColorPalette } from "./AIPaletteSection";

interface PaletteMoodboardProps {
  colors: ColorPalette["colors"];
}

export const PaletteMoodboard = ({ colors }: PaletteMoodboardProps) => {
  // Create a visual moodboard with vertical color stripes
  const colorStripes = [
    { color: colors.primary, label: "Primária" },
    { color: colors.topBarBg, label: "Top Bar" },
    { color: colors.headerBg, label: "Header" },
    { color: colors.buttonBg, label: "Botão" },
    { color: colors.footerBg, label: "Rodapé" },
  ];

  return (
    <div className="relative w-full h-full min-h-[400px] rounded-lg overflow-hidden shadow-lg">
      {/* Decorative elements */}
      <div className="absolute inset-0 flex">
        {colorStripes.map((stripe, index) => (
          <div
            key={index}
            className="flex-1 transition-colors duration-500"
            style={{ backgroundColor: stripe.color }}
          />
        ))}
      </div>
      
      {/* Decorative overlays for moodboard effect */}
      <div className="absolute inset-0 pointer-events-none">
        {/* Abstract shapes */}
        <div 
          className="absolute top-8 left-8 w-24 h-32 rounded-lg opacity-20 bg-white"
          style={{ transform: "rotate(-5deg)" }}
        />
        <div 
          className="absolute top-20 right-12 w-20 h-28 rounded-lg opacity-15 bg-black"
          style={{ transform: "rotate(8deg)" }}
        />
        <div 
          className="absolute bottom-24 left-16 w-28 h-20 rounded-lg opacity-20 bg-white"
          style={{ transform: "rotate(3deg)" }}
        />
        <div 
          className="absolute bottom-12 right-8 w-16 h-24 rounded-lg opacity-15 bg-black"
          style={{ transform: "rotate(-8deg)" }}
        />
        
        {/* Color swatches overlay */}
        <div className="absolute top-1/4 left-1/2 transform -translate-x-1/2 flex flex-col gap-2">
          {colorStripes.map((stripe, index) => (
            <div
              key={`swatch-${index}`}
              className="w-16 h-8 rounded shadow-md border border-white/30"
              style={{ 
                backgroundColor: stripe.color,
                transform: `rotate(${(index - 2) * 3}deg) translateX(${(index - 2) * 8}px)`
              }}
            />
          ))}
        </div>
        
        {/* Decorative plant silhouette */}
        <svg 
          className="absolute bottom-0 left-4 w-24 h-32 opacity-30"
          viewBox="0 0 100 150"
          fill="currentColor"
        >
          <ellipse cx="50" cy="140" rx="15" ry="8" fill="currentColor" />
          <path 
            d="M50 140 Q45 100 30 80 Q20 70 35 60 Q50 70 50 100 Q50 70 65 60 Q80 70 70 80 Q55 100 50 140"
            fill="currentColor"
          />
          <path 
            d="M50 100 Q40 80 25 70 Q15 65 30 55 Q45 60 50 80"
            fill="currentColor"
            opacity="0.7"
          />
          <path 
            d="M50 100 Q60 80 75 70 Q85 65 70 55 Q55 60 50 80"
            fill="currentColor"
            opacity="0.7"
          />
        </svg>
      </div>
      
      {/* Gradient overlay for depth */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/10 pointer-events-none" />
    </div>
  );
};
