import { MapPin } from 'lucide-react';
import { type CatalogLayoutType } from './CatalogLayoutSelector';
import iconWhatsAppOutline from '@/assets/icon-whatsapp-outline.jpg';

interface CatalogBackCoverPreviewProps {
  layoutType: CatalogLayoutType;
  primaryColor: string;
  logoUrl?: string | null;
  storeSlug?: string | null;
  whatsappNumber?: string | null;
  fullAddress?: string;
}

// Neutral grays for preview
const NEUTRAL = {
  dark: '#9E9E9E',
  medium: '#BDBDBD',
  light: '#E0E0E0',
  lightest: '#F5F5F5',
};

const formatWhatsApp = (number: string) => {
  const raw = number.replace(/\D/g, '');
  let display = raw;
  if (raw.startsWith('55') && raw.length > 11) display = raw.substring(2);
  if (display.length === 11) return `(${display.substring(0, 2)}) ${display.substring(2, 7)}-${display.substring(7)}`;
  if (display.length === 10) return `(${display.substring(0, 2)}) ${display.substring(2, 6)}-${display.substring(6)}`;
  return display;
};

export const CatalogBackCoverPreview = ({
  layoutType,
  logoUrl,
  storeSlug,
  whatsappNumber,
  fullAddress,
}: CatalogBackCoverPreviewProps) => {

  const ContactInfo = () => (
    <div className="mt-4 text-center text-xs text-gray-600 max-w-[80%] space-y-2">
      {storeSlug && (
        <p className="font-semibold cursor-pointer hover:underline" style={{ color: NEUTRAL.dark }}>
          {window.location.origin}/loja/{storeSlug}
        </p>
      )}
      {whatsappNumber && (
        <div className="flex items-center justify-center gap-1 cursor-pointer hover:underline">
          <img src={iconWhatsAppOutline} alt="WhatsApp" className="w-3 h-3 object-contain" />
          <span className="text-[10px]">{formatWhatsApp(whatsappNumber)}</span>
        </div>
      )}
      {fullAddress && (
        <div className="flex items-center justify-center gap-1 cursor-pointer hover:underline">
          <MapPin className="w-3 h-3 flex-shrink-0" />
          <span className="text-[8px] truncate">{fullAddress}</span>
        </div>
      )}
    </div>
  );

  const LogoCircle = () => (
    <div className="w-16 h-16 rounded-full bg-white shadow-lg flex items-center justify-center overflow-hidden">
      {logoUrl ? (
        <img src={logoUrl} alt="Logo" className="w-12 h-12 object-contain" />
      ) : (
        <span className="text-xs text-gray-400">Logo</span>
      )}
    </div>
  );

  const renderBackground = () => {
    switch (layoutType) {
      case 'layout_01':
        return (
          <>
            <div className="absolute top-0 left-0 right-0 h-1/2" style={{ backgroundColor: NEUTRAL.dark }} />
            <div className="absolute bottom-0 left-0 right-0 h-1/2 bg-white" />
          </>
        );
      case 'layout_02':
        return (
          <>
            <div className="absolute inset-0 bg-white" />
            <div className="absolute left-0 top-0 bottom-0" style={{ width: '6%', backgroundColor: NEUTRAL.dark }} />
            <div className="absolute top-0 bottom-0" style={{ left: '8%', width: '3%', backgroundColor: NEUTRAL.medium }} />
            <div className="absolute top-0 bottom-0 right-0" style={{ width: '6%', backgroundColor: NEUTRAL.dark }} />
            <div className="absolute top-0 bottom-0" style={{ right: '8%', width: '3%', backgroundColor: NEUTRAL.medium }} />
          </>
        );
      case 'layout_03':
        return (
          <>
            <div className="absolute inset-0 bg-white" />
            <svg className="absolute inset-0 w-full h-full" viewBox="0 0 210 297" preserveAspectRatio="none">
              <polygon points="0,0 210,0 210,90" fill={NEUTRAL.lightest} />
              <polygon points="0,297 0,250 80,297" fill={NEUTRAL.dark} />
              <polygon points="210,297 210,260 140,297" fill={NEUTRAL.medium} />
            </svg>
          </>
        );
      case 'layout_04':
        return (
          <>
            <div className="absolute inset-0 bg-white" />
            <svg className="absolute inset-0 w-full h-full" viewBox="0 0 210 297" preserveAspectRatio="none">
              <polygon points="0,200 210,170 210,297 0,297" fill={NEUTRAL.dark} />
            </svg>
          </>
        );
    }
  };

  return (
    <div className="relative rounded-lg overflow-hidden aspect-[210/297]">
      {renderBackground()}
      <div className="absolute inset-0 flex flex-col items-center justify-center z-10">
        <LogoCircle />
        <ContactInfo />
      </div>
      <div className="absolute bottom-2 left-2 bg-black/50 text-white text-xs px-2 py-1 rounded z-20">
        Contracapa
      </div>
    </div>
  );
};

export default CatalogBackCoverPreview;
