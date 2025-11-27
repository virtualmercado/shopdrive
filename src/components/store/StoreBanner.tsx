import { useState, useEffect } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface StoreBannerProps {
  desktopBannerUrls?: string[];
  mobileBannerUrls?: string[];
}

const StoreBanner = ({ desktopBannerUrls = [], mobileBannerUrls = [] }: StoreBannerProps) => {
  const [currentDesktopIndex, setCurrentDesktopIndex] = useState(0);
  const [currentMobileIndex, setCurrentMobileIndex] = useState(0);

  // Auto-rotate banners every 5 seconds
  useEffect(() => {
    if (desktopBannerUrls.length > 1) {
      const interval = setInterval(() => {
        setCurrentDesktopIndex((prev) => (prev + 1) % desktopBannerUrls.length);
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [desktopBannerUrls.length]);

  useEffect(() => {
    if (mobileBannerUrls.length > 1) {
      const interval = setInterval(() => {
        setCurrentMobileIndex((prev) => (prev + 1) % mobileBannerUrls.length);
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [mobileBannerUrls.length]);

  const nextDesktop = () => {
    setCurrentDesktopIndex((prev) => (prev + 1) % desktopBannerUrls.length);
  };

  const prevDesktop = () => {
    setCurrentDesktopIndex((prev) => (prev - 1 + desktopBannerUrls.length) % desktopBannerUrls.length);
  };

  const nextMobile = () => {
    setCurrentMobileIndex((prev) => (prev + 1) % mobileBannerUrls.length);
  };

  const prevMobile = () => {
    setCurrentMobileIndex((prev) => (prev - 1 + mobileBannerUrls.length) % mobileBannerUrls.length);
  };

  if (desktopBannerUrls.length === 0 && mobileBannerUrls.length === 0) {
    return null;
  }

  return (
    <div className="w-full">
      {/* Desktop/Tablet Banner Carousel */}
      {desktopBannerUrls.length > 0 && (
        <div className="hidden md:block relative group">
          <img
            src={desktopBannerUrls[currentDesktopIndex]}
            alt="Banner principal"
            className="w-full h-64 lg:h-96 object-cover transition-opacity duration-500"
          />
          
          {desktopBannerUrls.length > 1 && (
            <>
              <button
                onClick={prevDesktop}
                className="absolute left-4 top-1/2 -translate-y-1/2 bg-black/50 text-white p-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/70"
                aria-label="Banner anterior"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
              <button
                onClick={nextDesktop}
                className="absolute right-4 top-1/2 -translate-y-1/2 bg-black/50 text-white p-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/70"
                aria-label="Próximo banner"
              >
                <ChevronRight className="w-6 h-6" />
              </button>
              
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
                {desktopBannerUrls.map((_, index) => (
                  <button
                    key={index}
                    onClick={() => setCurrentDesktopIndex(index)}
                    className={`w-2 h-2 rounded-full transition-all ${
                      index === currentDesktopIndex ? "bg-white w-8" : "bg-white/50"
                    }`}
                    aria-label={`Ir para banner ${index + 1}`}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      )}
      
      {/* Mobile Banner Carousel */}
      {mobileBannerUrls.length > 0 ? (
        <div className="md:hidden relative group">
          <img
            src={mobileBannerUrls[currentMobileIndex]}
            alt="Banner principal"
            className="w-full h-48 object-cover transition-opacity duration-500"
          />
          
          {mobileBannerUrls.length > 1 && (
            <>
              <button
                onClick={prevMobile}
                className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 text-white p-1.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/70"
                aria-label="Banner anterior"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button
                onClick={nextMobile}
                className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 text-white p-1.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/70"
                aria-label="Próximo banner"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
              
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
                {mobileBannerUrls.map((_, index) => (
                  <button
                    key={index}
                    onClick={() => setCurrentMobileIndex(index)}
                    className={`w-1.5 h-1.5 rounded-full transition-all ${
                      index === currentMobileIndex ? "bg-white w-6" : "bg-white/50"
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
          <div className="md:hidden">
            <img
              src={desktopBannerUrls[currentDesktopIndex]}
              alt="Banner principal"
              className="w-full h-48 object-cover"
            />
          </div>
        )
      )}
    </div>
  );
};

export default StoreBanner;
