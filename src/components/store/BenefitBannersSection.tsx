import { useState, useEffect, useRef, useCallback } from "react";
import { BENEFIT_BANNERS } from "@/lib/benefitBanners";
import { useIsMobile } from "@/hooks/use-mobile";

interface BenefitBannersSectionProps {
  selectedIds: number[];
}

const AUTOPLAY_INTERVAL = 3000;
const PAUSE_AFTER_INTERACTION = 5000;

const BenefitBannersSection = ({ selectedIds }: BenefitBannersSectionProps) => {
  const isMobile = useIsMobile();
  const [activeSlide, setActiveSlide] = useState(0);
  const autoplayRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pauseTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isPaused, setIsPaused] = useState(false);

  if (!selectedIds || selectedIds.length === 0) return null;

  const allSelected = BENEFIT_BANNERS.filter((b) => selectedIds.includes(b.id));

  if (allSelected.length === 0) return null;

  const slides: typeof allSelected[] = [];
  for (let i = 0; i < allSelected.length; i += 2) {
    slides.push(allSelected.slice(i, i + 2));
  }
  const totalSlides = slides.length;

  const pauseAutoplay = useCallback(() => {
    setIsPaused(true);
    if (pauseTimeoutRef.current) clearTimeout(pauseTimeoutRef.current);
    pauseTimeoutRef.current = setTimeout(() => {
      setIsPaused(false);
    }, PAUSE_AFTER_INTERACTION);
  }, []);

  // Autoplay for mobile
  useEffect(() => {
    if (!isMobile || totalSlides <= 1 || isPaused) {
      if (autoplayRef.current) clearInterval(autoplayRef.current);
      return;
    }
    autoplayRef.current = setInterval(() => {
      setActiveSlide((prev) => (prev + 1) % totalSlides);
    }, AUTOPLAY_INTERVAL);
    return () => {
      if (autoplayRef.current) clearInterval(autoplayRef.current);
    };
  }, [isMobile, totalSlides, isPaused]);

  // Desktop: grid of all banners
  if (!isMobile) {
    return (
      <section className="w-full">
        <div className="grid gap-3 grid-cols-4">
          {allSelected.map((banner) => (
            <div
              key={banner.id}
              className="rounded-lg overflow-hidden transition-all duration-300 hover:shadow-md hover:-translate-y-0.5"
            >
              <img
                src={banner.image}
                alt={banner.name}
                className="w-full h-auto object-cover"
                loading="lazy"
              />
            </div>
          ))}
        </div>
      </section>
    );
  }

  // Mobile: carousel showing 2 per slide with autoplay
  const handleTouchStart = (e: React.TouchEvent) => {
    (e.currentTarget as any)._touchX = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    const startX = (e.currentTarget as any)._touchX;
    if (startX == null) return;
    const diff = startX - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 40) {
      pauseAutoplay();
      if (diff > 0) setActiveSlide((prev) => (prev + 1) % totalSlides);
      if (diff < 0) setActiveSlide((prev) => (prev - 1 + totalSlides) % totalSlides);
    }
  };

  return (
    <section className="w-full">
      <div
        className="overflow-hidden"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <div
          className="flex transition-transform duration-500 ease-in-out"
          style={{ transform: `translateX(-${activeSlide * 100}%)` }}
        >
          {slides.map((slideBanners, idx) => (
            <div key={idx} className="min-w-full grid grid-cols-2 gap-2 px-0.5">
              {slideBanners.map((banner) => (
                <div
                  key={banner.id}
                  className="rounded-lg overflow-hidden transition-all duration-300 hover:shadow-md"
                >
                  <img
                    src={banner.image}
                    alt={banner.name}
                    className="w-full h-auto object-cover scale-105"
                    loading="lazy"
                  />
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>

      {totalSlides > 1 && (
        <div className="flex justify-center gap-2 mt-2">
          {slides.map((_, idx) => (
            <button
              key={idx}
              onClick={() => {
                pauseAutoplay();
                setActiveSlide(idx);
              }}
              className={`rounded-full transition-all duration-300 ${
                idx === activeSlide
                  ? "bg-foreground/70 w-2.5 h-2.5"
                  : "bg-foreground/25 w-2 h-2"
              }`}
              aria-label={`Slide ${idx + 1}`}
            />
          ))}
        </div>
      )}
    </section>
  );
};

export default BenefitBannersSection;
