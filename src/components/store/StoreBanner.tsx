import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import HeroBannerSlide from "./HeroBannerSlide";
import { isInternalBannerUrl, type MainBannerSlideContent } from "@/lib/mainBannerContent";

interface StoreBannerProps {
  desktopBannerUrls?: string[];
  mobileBannerUrls?: string[];
  slideContent?: MainBannerSlideContent[];
}

const StoreBanner = ({ desktopBannerUrls = [], mobileBannerUrls = [], slideContent = [] }: StoreBannerProps) => {
  const navigate = useNavigate();
  const [currentDesktopIndex, setCurrentDesktopIndex] = useState(0);
  const [currentMobileIndex, setCurrentMobileIndex] = useState(0);
  const [isDesktopTransitioning, setIsDesktopTransitioning] = useState(false);
  const [isMobileTransitioning, setIsMobileTransitioning] = useState(false);

  const goToDesktopSlide = useCallback((index: number) => {
    if (isDesktopTransitioning) return;
    setIsDesktopTransitioning(true);
    setCurrentDesktopIndex(index);
    setTimeout(() => setIsDesktopTransitioning(false), 600);
  }, [isDesktopTransitioning]);

  const goToMobileSlide = useCallback((index: number) => {
    if (isMobileTransitioning) return;
    setIsMobileTransitioning(true);
    setCurrentMobileIndex(index);
    setTimeout(() => setIsMobileTransitioning(false), 600);
  }, [isMobileTransitioning]);

  // Auto-rotate banners every 5 seconds
  useEffect(() => {
    if (desktopBannerUrls.length > 1) {
      const interval = setInterval(() => {
        goToDesktopSlide((currentDesktopIndex + 1) % desktopBannerUrls.length);
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [desktopBannerUrls.length, currentDesktopIndex, goToDesktopSlide]);

  useEffect(() => {
    if (mobileBannerUrls.length > 1) {
      const interval = setInterval(() => {
        goToMobileSlide((currentMobileIndex + 1) % mobileBannerUrls.length);
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [mobileBannerUrls.length, currentMobileIndex, goToMobileSlide]);

  const nextDesktop = () => {
    goToDesktopSlide((currentDesktopIndex + 1) % desktopBannerUrls.length);
  };

  const prevDesktop = () => {
    goToDesktopSlide((currentDesktopIndex - 1 + desktopBannerUrls.length) % desktopBannerUrls.length);
  };

  const nextMobile = () => {
    goToMobileSlide((currentMobileIndex + 1) % mobileBannerUrls.length);
  };

  const prevMobile = () => {
    goToMobileSlide((currentMobileIndex - 1 + mobileBannerUrls.length) % mobileBannerUrls.length);
  };

  const handleCtaClick = (url: string) => {
    if (isInternalBannerUrl(url)) {
      navigate(url);
      return;
    }
    window.open(url, "_blank", "noopener,noreferrer");
  };

  if (desktopBannerUrls.length === 0 && mobileBannerUrls.length === 0) {
    return null;
  }

  return (
    <div className="w-full">
      {/* Desktop/Tablet Banner Carousel with Horizontal Slide - Dots navigation only */}
      {desktopBannerUrls.length > 0 && (
        <div
          className="hidden md:block relative overflow-hidden rounded-none group transition-shadow duration-400 ease-out"
          style={{ boxShadow: "0 4px 12px rgba(0,0,0,0.06)" }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLDivElement).style.boxShadow = "0 10px 30px rgba(0,0,0,0.12)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLDivElement).style.boxShadow = "0 4px 12px rgba(0,0,0,0.06)";
          }}
        >
          <div 
            className="flex transition-transform duration-500 ease-in-out"
            style={{ 
              transform: `translateX(-${currentDesktopIndex * (100 / desktopBannerUrls.length)}%)`,
              width: `${desktopBannerUrls.length * 100}%`
            }}
          >
            {desktopBannerUrls.map((url, index) => (
              <div 
                key={index} 
                className="flex-shrink-0 overflow-hidden"
                style={{ width: `${100 / desktopBannerUrls.length}%` }}
              >
                <div className="w-full" style={{ aspectRatio: '1920 / 680' }}>
                  <HeroBannerSlide
                    imageUrl={url}
                    imageAlt={`Banner ${index + 1}`}
                    content={slideContent[index]}
                    loading={index === 0 ? "eager" : "lazy"}
                    onCtaClick={handleCtaClick}
                  />
                </div>
              </div>
            ))}
          </div>
          
          {/* Dots navigation - only show when 2+ banners */}
          {desktopBannerUrls.length > 1 && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 z-10">
              {desktopBannerUrls.map((_, index) => (
                <button
                  key={index}
                  onClick={() => goToDesktopSlide(index)}
                  disabled={isDesktopTransitioning}
                  className={`rounded-full transition-all duration-300 ${
                    index === currentDesktopIndex 
                      ? "bg-white w-3 h-3" 
                      : "bg-white/50 w-2.5 h-2.5 hover:bg-white/70"
                  }`}
                  aria-label={`Ir para banner ${index + 1}`}
                />
              ))}
            </div>
          )}
        </div>
      )}
      
      {/* Mobile Banner Carousel with Horizontal Slide - Only dots, no arrows */}
      {mobileBannerUrls.length > 0 ? (
        <div className="md:hidden relative overflow-hidden">
          <div 
            className="flex transition-transform duration-500 ease-in-out"
            style={{ 
              transform: `translateX(-${currentMobileIndex * (100 / mobileBannerUrls.length)}%)`,
              width: `${mobileBannerUrls.length * 100}%`
            }}
          >
            {mobileBannerUrls.map((url, index) => (
              <div 
                key={index} 
                className="flex-shrink-0"
                style={{ width: `${100 / mobileBannerUrls.length}%` }}
              >
                {/* Mobile banner - image displayed fully without cropping */}
                <div className="w-full">
                  <HeroBannerSlide
                    imageUrl={url}
                    imageAlt={`Banner ${index + 1}`}
                    content={slideContent[index]}
                    mobile
                    loading={index === 0 ? "eager" : "lazy"}
                    onCtaClick={handleCtaClick}
                  />
                </div>
              </div>
            ))}
          </div>
          
          {/* Dots navigation - only show when 2+ banners */}
          {mobileBannerUrls.length > 1 && (
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-2 z-10">
              {mobileBannerUrls.map((_, index) => (
                <button
                  key={index}
                  onClick={() => goToMobileSlide(index)}
                  disabled={isMobileTransitioning}
                  className={`rounded-full transition-all duration-300 ${
                    index === currentMobileIndex 
                      ? "bg-white w-3 h-3" 
                      : "bg-white/50 w-2.5 h-2.5 hover:bg-white/70"
                  }`}
                  aria-label={`Ir para banner ${index + 1}`}
                />
              ))}
            </div>
          )}
        </div>
      ) : (
        // Fallback: use desktop banner on mobile if no mobile banner
        desktopBannerUrls.length > 0 && (
          <div className="md:hidden overflow-hidden">
            <div 
              className="flex transition-transform duration-500 ease-in-out"
              style={{ 
                transform: `translateX(-${currentDesktopIndex * (100 / desktopBannerUrls.length)}%)`,
                width: `${desktopBannerUrls.length * 100}%`
              }}
            >
              {desktopBannerUrls.map((url, index) => (
                <div 
                  key={index} 
                  className="flex-shrink-0"
                  style={{ width: `${100 / desktopBannerUrls.length}%` }}
                >
                  {/* Mobile fallback banner - image displayed fully without cropping */}
                  <div className="w-full">
                    <HeroBannerSlide
                      imageUrl={url}
                      imageAlt={`Banner ${index + 1}`}
                      content={slideContent[index]}
                      mobile
                      loading={index === 0 ? "eager" : "lazy"}
                      onCtaClick={handleCtaClick}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )
      )}
    </div>
  );
};

export default StoreBanner;
