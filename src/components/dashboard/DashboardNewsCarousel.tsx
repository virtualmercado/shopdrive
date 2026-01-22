import { useEffect, useState, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useMerchantBanners, useBannerTracking, DashboardBanner } from "@/hooks/useDashboardBanners";
import { cn } from "@/lib/utils";

const AUTOPLAY_INTERVAL = 3000; // 3 seconds
const PAUSE_AFTER_INTERACTION = 10000; // 10 seconds

const DashboardNewsCarousel = () => {
  const navigate = useNavigate();
  const { data: banners, isLoading } = useMerchantBanners();
  const { trackImpression, trackClick } = useBannerTracking();
  
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isAutoplayActive, setIsAutoplayActive] = useState(true);
  const [isPaused, setIsPaused] = useState(false);
  const autoplayRef = useRef<NodeJS.Timeout | null>(null);
  const pauseTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const impressionTrackedRef = useRef<Set<string>>(new Set());
  
  const totalBanners = banners?.length || 0;
  
  // Calculate visible count based on screen size
  const getVisibleCount = () => {
    if (typeof window === "undefined") return 3;
    if (window.innerWidth < 640) return 1; // Mobile
    if (window.innerWidth < 1024) return 2; // Tablet
    return 3; // Desktop
  };
  
  const [visibleCount, setVisibleCount] = useState(getVisibleCount());
  
  useEffect(() => {
    const handleResize = () => {
      setVisibleCount(getVisibleCount());
    };
    
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);
  
  // Track impressions for visible banners
  useEffect(() => {
    if (!banners || banners.length === 0) return;
    
    const visibleBanners = getVisibleBanners();
    visibleBanners.forEach(banner => {
      if (!impressionTrackedRef.current.has(banner.id)) {
        trackImpression(banner.id);
        impressionTrackedRef.current.add(banner.id);
      }
    });
  }, [currentIndex, banners, trackImpression]);
  
  // Autoplay logic
  useEffect(() => {
    if (!isAutoplayActive || isPaused || totalBanners <= visibleCount) return;
    
    autoplayRef.current = setInterval(() => {
      setCurrentIndex(prev => (prev + 1) % Math.max(1, totalBanners - visibleCount + 1));
    }, AUTOPLAY_INTERVAL);
    
    return () => {
      if (autoplayRef.current) clearInterval(autoplayRef.current);
    };
  }, [isAutoplayActive, isPaused, totalBanners, visibleCount]);
  
  const pauseAutoplay = useCallback(() => {
    setIsPaused(true);
    
    if (pauseTimeoutRef.current) clearTimeout(pauseTimeoutRef.current);
    
    pauseTimeoutRef.current = setTimeout(() => {
      setIsPaused(false);
    }, PAUSE_AFTER_INTERACTION);
  }, []);
  
  const handlePrev = () => {
    pauseAutoplay();
    setCurrentIndex(prev => 
      prev === 0 ? Math.max(0, totalBanners - visibleCount) : prev - 1
    );
  };
  
  const handleNext = () => {
    pauseAutoplay();
    setCurrentIndex(prev => 
      (prev + 1) % Math.max(1, totalBanners - visibleCount + 1)
    );
  };
  
  const handleBannerClick = async (banner: DashboardBanner) => {
    const destination = banner.link_type === "internal" 
      ? banner.internal_route 
      : banner.external_url;
    
    if (!destination) return;
    
    await trackClick(banner.id, destination);
    
    if (banner.link_type === "internal") {
      navigate(destination);
    } else {
      if (banner.open_in_new_tab) {
        window.open(destination, "_blank", "noopener,noreferrer");
      } else {
        window.location.href = destination;
      }
    }
  };
  
  const getVisibleBanners = (): DashboardBanner[] => {
    if (!banners || banners.length === 0) return [];
    return banners.slice(currentIndex, currentIndex + visibleCount);
  };
  
  const getBadgeVariant = (badgeType: string | null) => {
    switch (badgeType) {
      case "success": return "default";
      case "warning": return "secondary";
      case "sponsored": return "outline";
      case "info": return "default";
      default: return "default";
    }
  };
  
  const getBadgeClassName = (badgeType: string | null, isSponsored: boolean) => {
    if (isSponsored) {
      return "bg-amber-100 text-amber-800 border-amber-300";
    }
    switch (badgeType) {
      case "success": return "bg-green-100 text-green-800 border-green-300";
      case "warning": return "bg-orange-100 text-orange-800 border-orange-300";
      case "info": return "bg-blue-100 text-blue-800 border-blue-300";
      default: return "bg-primary/10 text-primary border-primary/30";
    }
  };
  
  if (isLoading) {
    return (
      <div className="mb-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <Skeleton key={i} className="h-40 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }
  
  if (!banners || banners.length === 0) {
    return null;
  }
  
  const visibleBanners = getVisibleBanners();
  const maxIndex = Math.max(0, totalBanners - visibleCount);
  const showNavigation = totalBanners > visibleCount;
  
  return (
    <div 
      className="mb-6 relative"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      <div className="relative overflow-hidden">
        {/* Navigation Arrows */}
        {showNavigation && (
          <>
            <Button
              variant="outline"
              size="icon"
              onClick={handlePrev}
              disabled={currentIndex === 0}
              className="absolute left-0 top-1/2 -translate-y-1/2 z-10 bg-white/90 shadow-md hover:bg-white"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={handleNext}
              disabled={currentIndex >= maxIndex}
              className="absolute right-0 top-1/2 -translate-y-1/2 z-10 bg-white/90 shadow-md hover:bg-white"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </>
        )}
        
        {/* Banner Cards */}
        <div 
          className={cn(
            "grid gap-4 px-8",
            visibleCount === 1 && "grid-cols-1",
            visibleCount === 2 && "grid-cols-2",
            visibleCount === 3 && "grid-cols-3"
          )}
        >
          {visibleBanners.map((banner) => (
            <div
              key={banner.id}
              onClick={() => handleBannerClick(banner)}
              className="relative rounded-lg overflow-hidden cursor-pointer group transition-all duration-300 hover:shadow-lg hover:scale-[1.02] bg-white border"
              style={{ height: "160px" }}
            >
              {/* Background Image */}
              <img
                src={
                  (visibleCount === 1 && banner.image_mobile_url) 
                    ? banner.image_mobile_url 
                    : banner.image_desktop_url
                }
                alt={banner.title}
                className="absolute inset-0 w-full h-full object-cover"
                loading="lazy"
              />
              
              {/* Overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent" />
              
              {/* Badge */}
              {(banner.badge_text || banner.is_sponsored) && (
                <div className="absolute top-3 left-3">
                  <Badge 
                    variant="outline"
                    className={cn(
                      "text-xs font-medium",
                      getBadgeClassName(banner.badge_type, banner.is_sponsored)
                    )}
                  >
                    {banner.is_sponsored ? "Patrocinado" : banner.badge_text}
                  </Badge>
                </div>
              )}
              
              {/* Content */}
              <div className="absolute bottom-0 left-0 right-0 p-4 text-white">
                <h3 className="font-semibold text-sm sm:text-base line-clamp-1 group-hover:underline">
                  {banner.title}
                </h3>
                {banner.subtitle && (
                  <p className="text-xs sm:text-sm text-white/80 line-clamp-1 mt-1">
                    {banner.subtitle}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
      
      {/* Pagination Dots */}
      {showNavigation && (
        <div className="flex justify-center gap-2 mt-4">
          {Array.from({ length: maxIndex + 1 }).map((_, idx) => (
            <button
              key={idx}
              onClick={() => {
                pauseAutoplay();
                setCurrentIndex(idx);
              }}
              className={cn(
                "w-2 h-2 rounded-full transition-all",
                idx === currentIndex 
                  ? "bg-primary w-4" 
                  : "bg-gray-300 hover:bg-gray-400"
              )}
              aria-label={`Go to slide ${idx + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default DashboardNewsCarousel;
