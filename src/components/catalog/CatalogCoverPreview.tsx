import { type CatalogLayoutType } from './CatalogLayoutSelector';

interface CatalogCoverPreviewProps {
  layoutType: CatalogLayoutType;
  primaryColor: string;
  logoUrl?: string | null;
  coverMessage?: string;
}

// Neutral grays for preview thumbnails
const NEUTRAL = {
  dark: '#9E9E9E',
  medium: '#BDBDBD',
  light: '#E0E0E0',
  lightest: '#F5F5F5',
};

export const CatalogCoverPreview = ({ layoutType, logoUrl, coverMessage }: CatalogCoverPreviewProps) => {
  const year = new Date().getFullYear();

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
          <div className="absolute left-0 top-0 bottom-0" style={{ width: '19%', backgroundColor: NEUTRAL.dark }} />
          <div className="absolute top-0 bottom-0" style={{ left: '22%', width: '9.5%', backgroundColor: NEUTRAL.dark }} />
          <div className="absolute top-0 bottom-0" style={{ left: '34%', width: '4.75%', backgroundColor: NEUTRAL.dark }} />
        </>
      )}

      {layoutType === 'layout_02' && (
        <>
          <div className="absolute left-0 top-0 bottom-0" style={{ width: '6%', backgroundColor: NEUTRAL.dark }} />
          <div className="absolute top-0 bottom-0" style={{ left: '8%', width: '3%', backgroundColor: NEUTRAL.medium }} />
          <div className="absolute top-0 bottom-0 right-0" style={{ width: '6%', backgroundColor: NEUTRAL.dark }} />
          <div className="absolute top-0 bottom-0" style={{ right: '8%', width: '3%', backgroundColor: NEUTRAL.medium }} />
        </>
      )}

      {layoutType === 'layout_03' && (
        <svg className="absolute inset-0 w-full h-full" viewBox="0 0 210 297" preserveAspectRatio="none">
          <polygon points="0,0 210,0 210,90" fill={NEUTRAL.lightest} />
          <polygon points="0,297 0,180 140,297" fill={NEUTRAL.dark} />
          <polygon points="210,297 210,210 100,297" fill={NEUTRAL.medium} />
        </svg>
      )}

      {layoutType === 'layout_04' && (
        <svg className="absolute inset-0 w-full h-full" viewBox="0 0 210 297" preserveAspectRatio="none">
          <polygon points="0,148 210,110 210,297 0,297" fill={NEUTRAL.dark} />
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
