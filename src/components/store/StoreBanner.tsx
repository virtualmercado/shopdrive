import { useState, useEffect, useCallback } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface StoreBannerProps {
  desktopBannerUrls?: string[];
  mobileBannerUrls?: string[];
}

const StoreBanner = ({ desktopBannerUrls = [], mobileBannerUrls = [] }: StoreBannerProps) => {
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

  if (desktopBannerUrls.length === 0 && mobileBannerUrls.length === 0) {
    return null;
  }

  return (
    <div className="w-full">
      {/* Desktop/Tablet Banner Carousel with Horizontal Slide */}
      {desktopBannerUrls.length > 0 && (
        <div className="hidden md:block relative group overflow-hidden">
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
                <img
                  src={url}
                  alt={`Banner ${index + 1}`}
                  className="w-full h-64 lg:h-96 object-cover"
                  loading={index === 0 ? "eager" : "lazy"}
                />
              </div>
            ))}
          </div>
          
          {desktopBannerUrls.length > 1 && (
            <>
              <button
                onClick={prevDesktop}
                disabled={isDesktopTransitioning}
                className="absolute left-4 top-1/2 -translate-y-1/2 bg-black/50 text-white p-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/70 disabled:cursor-not-allowed z-10"
                aria-label="Banner anterior"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
              <button
                onClick={nextDesktop}
                disabled={isDesktopTransitioning}
                className="absolute right-4 top-1/2 -translate-y-1/2 bg-black/50 text-white p-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/70 disabled:cursor-not-allowed z-10"
                aria-label="Próximo banner"
              >
                <ChevronRight className="w-6 h-6" />
              </button>
              
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 z-10">
                {desktopBannerUrls.map((_, index) => (
                  <button
                    key={index}
                    onClick={() => goToDesktopSlide(index)}
                    disabled={isDesktopTransitioning}
                    className={`h-2 rounded-full transition-all duration-300 ${
                      index === currentDesktopIndex ? "bg-white w-8" : "bg-white/50 w-2 hover:bg-white/70"
                    }`}
                    aria-label={`Ir para banner ${index + 1}`}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      )}
      
      {/* Mobile Banner Carousel with Horizontal Slide */}
      {mobileBannerUrls.length > 0 ? (
        <div className="md:hidden relative group overflow-hidden">
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
                <img
                  src={url}
                  alt={`Banner ${index + 1}`}
                  className="w-full h-48 object-cover"
                  loading={index === 0 ? "eager" : "lazy"}
                />
              </div>
            ))}
          </div>
          
          {mobileBannerUrls.length > 1 && (
            <>
              <button
                onClick={prevMobile}
                disabled={isMobileTransitioning}
                className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 text-white p-1.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/70 disabled:cursor-not-allowed z-10"
                aria-label="Banner anterior"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button
                onClick={nextMobile}
                disabled={isMobileTransitioning}
                className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 text-white p-1.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/70 disabled:cursor-not-allowed z-10"
                aria-label="Próximo banner"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
              
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5 z-10">
                {mobileBannerUrls.map((_, index) => (
                  <button
                    key={index}
                    onClick={() => goToMobileSlide(index)}
                    disabled={isMobileTransitioning}
                    className={`h-1.5 rounded-full transition-all duration-300 ${
                      index === currentMobileIndex ? "bg-white w-6" : "bg-white/50 w-1.5 hover:bg-white/70"
                    }`}
                    aria-label={`Ir para banner ${index + 1}`}
                  />
                ))}
              </div>
            </>
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
                  <img
                    src={url}
                    alt={`Banner ${index + 1}`}
                    className="w-full h-48 object-cover"
                    loading={index === 0 ? "eager" : "lazy"}
                  />
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
