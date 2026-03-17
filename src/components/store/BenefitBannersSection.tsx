import { useState } from "react";
import { BENEFIT_BANNERS } from "@/lib/benefitBanners";
import { useIsMobile } from "@/hooks/use-mobile";

interface BenefitBannersSectionProps {
  selectedIds: number[];
}

const BenefitBannersSection = ({ selectedIds }: BenefitBannersSectionProps) => {
  const isMobile = useIsMobile();
  const [activeSlide, setActiveSlide] = useState(0);

  if (!selectedIds || selectedIds.length === 0) return null;

  const allSelected = BENEFIT_BANNERS.filter((b) => selectedIds.includes(b.id));

  if (allSelected.length === 0) return null;

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

  // Mobile: carousel showing 2 per slide
  const slides: typeof allSelected[] = [];
  for (let i = 0; i < allSelected.length; i += 2) {
    slides.push(allSelected.slice(i, i + 2));
  }
  const totalSlides = slides.length;

  const handleTouchStart = (e: React.TouchEvent) => {
    (e.currentTarget as any)._touchX = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    const startX = (e.currentTarget as any)._touchX;
    if (startX == null) return;
    const diff = startX - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 40) {
      if (diff > 0 && activeSlide < totalSlides - 1) setActiveSlide(activeSlide + 1);
      if (diff < 0 && activeSlide > 0) setActiveSlide(activeSlide - 1);
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
          className="flex transition-transform duration-400 ease-in-out"
          style={{ transform: `translateX(-${activeSlide * 100}%)` }}
        >
          {slides.map((slideBanners, idx) => (
            <div key={idx} className="min-w-full grid grid-cols-2 gap-3">
              {slideBanners.map((banner) => (
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
          ))}
        </div>
      </div>

      {totalSlides > 1 && (
        <div className="flex justify-center gap-2 mt-2">
          {slides.map((_, idx) => (
            <button
              key={idx}
              onClick={() => setActiveSlide(idx)}
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
