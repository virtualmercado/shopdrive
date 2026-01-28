import { useState } from "react";

interface MiniBannerData {
  img1Url?: string | null;
  img2Url?: string | null;
}

interface MiniBannerSectionProps {
  miniBanner1: MiniBannerData;
  miniBanner2: MiniBannerData;
}

/**
 * MiniBanner component with hover/touch effect to switch between two images
 * Uses the same smooth transition pattern as product image hover
 */
const MiniBannerItem = ({ img1Url, img2Url }: MiniBannerData) => {
  const [isHovered, setIsHovered] = useState(false);
  
  // Determine primary and secondary images
  // If only one exists, use it as primary
  const primaryImage = img1Url || img2Url;
  const secondaryImage = img2Url && img1Url ? img2Url : null;
  
  // If no images at all, don't render
  if (!primaryImage) {
    return null;
  }
  
  const hasSecondImage = !!secondaryImage;
  
  return (
    <div 
      className="relative w-full h-[400px] rounded-lg overflow-hidden cursor-pointer group"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onTouchStart={() => setIsHovered(true)}
      onTouchEnd={() => setIsHovered(false)}
    >
      {/* Primary Image */}
      <img
        src={primaryImage}
        alt="Banner promocional"
        className={`absolute inset-0 w-full h-full object-cover transition-all duration-700 ease-in-out group-hover:scale-105 ${
          isHovered && hasSecondImage ? 'opacity-0' : 'opacity-100'
        }`}
      />
      
      {/* Secondary Image (shown on hover/touch if exists) */}
      {hasSecondImage && (
        <img
          src={secondaryImage}
          alt="Banner promocional - alternativo"
          className={`absolute inset-0 w-full h-full object-cover transition-all duration-700 ease-in-out group-hover:scale-105 ${
            isHovered ? 'opacity-100' : 'opacity-0'
          }`}
        />
      )}
    </div>
  );
};

const MiniBannerSection = ({ miniBanner1, miniBanner2 }: MiniBannerSectionProps) => {
  // Check if at least one minibanner has at least one image
  const miniBanner1HasImage = !!(miniBanner1.img1Url || miniBanner1.img2Url);
  const miniBanner2HasImage = !!(miniBanner2.img1Url || miniBanner2.img2Url);
  
  // If neither minibanner has any image, hide the entire container
  if (!miniBanner1HasImage && !miniBanner2HasImage) {
    return null;
  }
  
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {miniBanner1HasImage && (
        <MiniBannerItem 
          img1Url={miniBanner1.img1Url} 
          img2Url={miniBanner1.img2Url} 
        />
      )}
      {miniBanner2HasImage && (
        <MiniBannerItem 
          img1Url={miniBanner2.img1Url} 
          img2Url={miniBanner2.img2Url} 
        />
      )}
    </div>
  );
};

export default MiniBannerSection;
