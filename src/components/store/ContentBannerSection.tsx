import { useState, useEffect, useCallback } from "react";
import type { ContentBannerItem } from "@/components/customize/ContentBannerCard";

interface ContentBannerSectionProps {
  banners: ContentBannerItem[];
}

const ContentBannerSection = ({ banners }: ContentBannerSectionProps) => {
  const activeBanners = banners.filter(
    (b) => b.enabled && b.image_url && b.url
  );

  const [current, setCurrent] = useState(0);
  const isCarousel = activeBanners.length > 1;

  const next = useCallback(() => {
    setCurrent((prev) => (prev + 1) % activeBanners.length);
  }, [activeBanners.length]);

  useEffect(() => {
    if (!isCarousel) return;
    const timer = setInterval(next, 5000);
    return () => clearInterval(timer);
  }, [isCarousel, next]);

  if (activeBanners.length === 0) return null;

  return (
    <section className="w-full px-4 py-8">
      <div className="max-w-4xl mx-auto">
        <div className="relative overflow-hidden rounded-xl" style={{ aspectRatio: "16 / 5" }}>
          {activeBanners.map((banner, i) => (
            <a
              key={i}
              href={banner.url}
              target="_blank"
              rel="noopener noreferrer"
              className="absolute inset-0 w-full h-full transition-opacity duration-700 ease-in-out cursor-pointer"
              style={{ opacity: current === i ? 1 : 0, pointerEvents: current === i ? "auto" : "none" }}
              aria-hidden={current !== i}
            >
              <img
                src={banner.image_url}
                alt={banner.title || "Banner promocional"}
                className="absolute inset-0 w-full h-full object-cover"
              />
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="bg-white/30 backdrop-blur-sm rounded-lg px-8 py-5 sm:px-12 sm:py-6 max-w-[80%] text-center">
                  {banner.title && (
                    <h3
                      className="text-lg sm:text-xl md:text-2xl font-semibold leading-tight"
                      style={{ color: banner.title_color }}
                    >
                      {banner.title}
                    </h3>
                  )}
                  {banner.subtitle && (
                    <p
                      className="text-sm sm:text-base mt-1.5 leading-snug"
                      style={{ color: banner.subtitle_color }}
                    >
                      {banner.subtitle}
                    </p>
                  )}
                  {banner.cta_text && (
                    <span
                      className="inline-block mt-3 px-6 py-2 rounded-md text-sm font-medium transition-opacity hover:opacity-90"
                      style={{ backgroundColor: banner.cta_bg_color, color: banner.cta_text_color }}
                    >
                      {banner.cta_text}
                    </span>
                  )}
                </div>
              </div>
            </a>
          ))}
        </div>

        {/* Dots navigation */}
        {isCarousel && (
          <div className="flex justify-center gap-2 mt-3">
            {activeBanners.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrent(i)}
                className="w-2.5 h-2.5 rounded-full transition-colors"
                style={{
                  backgroundColor: current === i ? "hsl(var(--foreground))" : "hsl(var(--muted-foreground) / 0.3)",
                }}
                aria-label={`Ir para banner ${i + 1}`}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
};

export default ContentBannerSection;
