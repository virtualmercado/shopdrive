import { type CatalogLayoutType } from './CatalogLayoutSelector';

interface CatalogCoverPreviewProps {
  layoutType: CatalogLayoutType;
  primaryColor: string;
  logoUrl?: string | null;
  coverMessage?: string;
}

// Helper: lighten a hex color by mixing with white
const lightenHex = (hex: string, amount: number): string => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const lr = Math.min(255, Math.round(r + (255 - r) * amount));
  const lg = Math.min(255, Math.round(g + (255 - g) * amount));
  const lb = Math.min(255, Math.round(b + (255 - b) * amount));
  return `rgb(${lr},${lg},${lb})`;
};

export const CatalogCoverPreview = ({ layoutType, primaryColor, logoUrl, coverMessage }: CatalogCoverPreviewProps) => {
  const year = new Date().getFullYear();
  const color = primaryColor || '#6a1b9a';
  const colorLight = lightenHex(color, 0.35);
  const colorLightest = lightenHex(color, 0.7);

  const CenterContent = () => (
    <div className="bg-white p-6 text-center shadow-lg" style={{ width: '60%', maxWidth: '200px' }}>
      <p className="text-lg font-bold text-gray-800">CATÁLOGO</p>
      <p className="text-sm text-gray-800">de</p>
      <p className="text-lg font-bold text-gray-800">PRODUTOS</p>
      {coverMessage && (
        <p className="text-xs text-gray-600 mt-1 italic">{coverMessage}</p>
      )}
      <p className="text-sm text-gray-600 mt-2">{year}</p>
      {logoUrl && (
        <img src={logoUrl} alt="Logo" className="h-8 w-auto mx-auto mt-3 object-contain" />
      )}
    </div>
  );

  return (
    <div className="relative rounded-lg overflow-hidden aspect-[210/297] bg-white">
      {layoutType === 'layout_01' && (
        <>
          <div className="absolute left-0 top-0 bottom-0" style={{ width: '19%', backgroundColor: color }} />
          <div className="absolute top-0 bottom-0" style={{ left: '22%', width: '9.5%', backgroundColor: color }} />
          <div className="absolute top-0 bottom-0" style={{ left: '34%', width: '4.75%', backgroundColor: color }} />
        </>
      )}

      {layoutType === 'layout_02' && (
        <>
          <div className="absolute left-0 top-0 bottom-0" style={{ width: '6%', backgroundColor: color }} />
          <div className="absolute top-0 bottom-0" style={{ left: '8%', width: '3%', backgroundColor: colorLight }} />
          <div className="absolute top-0 bottom-0 right-0" style={{ width: '6%', backgroundColor: color }} />
          <div className="absolute top-0 bottom-0" style={{ right: '8%', width: '3%', backgroundColor: colorLight }} />
        </>
      )}

      {layoutType === 'layout_03' && (
        <svg className="absolute inset-0 w-full h-full" viewBox="0 0 210 297" preserveAspectRatio="none">
          <polygon points="0,0 210,0 210,90" fill={colorLightest} />
          <polygon points="0,297 0,180 140,297" fill={color} />
          <polygon points="210,297 210,210 100,297" fill={colorLight} />
        </svg>
      )}

      {layoutType === 'layout_04' && (
        <svg className="absolute inset-0 w-full h-full" viewBox="0 0 210 297" preserveAspectRatio="none">
          <polygon points="0,148 210,110 210,297 0,297" fill={color} />
        </svg>
      )}

      <div className="absolute inset-0 flex items-center justify-center z-10">
        <CenterContent />
      </div>

      <div className="absolute bottom-2 left-2 bg-black/50 text-white text-xs px-2 py-1 rounded z-20">
        Capa
      </div>
    </div>
  );
};

export default CatalogCoverPreview;
