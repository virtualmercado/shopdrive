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
      <div className="max-w-5xl mx-auto">
        {/* Desktop: fixed aspect-ratio with absolute positioning */}
        <div
          className="hidden md:block group relative overflow-hidden transition-all duration-300 ease-out hover:-translate-y-1"
          style={{
            aspectRatio: "1360 / 460",
            borderRadius: "12px",
            boxShadow: "0 6px 18px rgba(0,0,0,0.08)",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLDivElement).style.boxShadow = "0 12px 28px rgba(0,0,0,0.15)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLDivElement).style.boxShadow = "0 6px 18px rgba(0,0,0,0.08)";
          }}
        >
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
                className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.03]"
              />
              <div className="absolute inset-0 z-10 flex items-center justify-center">
                <div
                  className="rounded-xl px-8 py-5 sm:px-12 sm:py-6 max-w-[80%] text-center shadow-lg"
                  style={{
                    background: "rgba(255, 255, 255, 0.65)",
                    backdropFilter: "blur(8px)",
                    WebkitBackdropFilter: "blur(8px)",
                  }}
                >
                  {banner.title && (
                    <h3
                      className="text-xl md:text-2xl font-semibold leading-tight"
                      style={{ color: banner.title_color }}
                    >
                      {banner.title}
                    </h3>
                  )}
                  {banner.subtitle && (
                    <p
                      className="text-base mt-1.5 leading-snug"
                      style={{ color: banner.subtitle_color }}
                    >
                      {banner.subtitle}
                    </p>
                  )}
                  {banner.cta_text && (
                    <span
                      className="inline-block mt-3 px-6 py-2 rounded-md text-sm font-medium transition-all duration-200 ease-out hover:brightness-110 hover:-translate-y-0.5 hover:shadow-md"
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

        {/* Mobile: adaptive vertical space, full image without crop */}
        <div
          className="md:hidden relative"
          style={{ borderRadius: "12px" }}
        >
          {activeBanners.map((banner, i) => (
            <a
              key={i}
              href={banner.url}
              target="_blank"
              rel="noopener noreferrer"
              className="relative block w-full rounded-xl transition-opacity duration-700 ease-in-out cursor-pointer"
              style={{
                opacity: current === i ? 1 : 0,
                pointerEvents: current === i ? "auto" : "none",
                minHeight: "clamp(280px, 82vw, 420px)",
                position: i === 0 ? "relative" : "absolute",
                top: i === 0 ? undefined : 0,
                left: i === 0 ? undefined : 0,
                right: i === 0 ? undefined : 0,
                bottom: i === 0 ? undefined : 0,
              }}
              aria-hidden={current !== i}
            >
              <img
                src={banner.image_url}
                alt={banner.title || "Banner promocional"}
                className="absolute inset-0 w-full h-full rounded-xl object-contain"
              />
              <div className="absolute inset-0 z-10 flex items-center justify-center px-3 py-4">
                <div
                  className="w-full max-w-[95%] rounded-xl px-5 py-4 text-center shadow-lg"
                  style={{
                    background: "rgba(255, 255, 255, 0.65)",
                    backdropFilter: "blur(8px)",
                    WebkitBackdropFilter: "blur(8px)",
                  }}
                >
                  {banner.title && (
                    <h3
                      className="text-base font-semibold leading-tight"
                      style={{ color: banner.title_color }}
                    >
                      {banner.title}
                    </h3>
                  )}
                  {banner.subtitle && (
                    <p
                      className="text-sm mt-1 leading-snug"
                      style={{ color: banner.subtitle_color }}
                    >
                      {banner.subtitle}
                    </p>
                  )}
                  {banner.cta_text && (
                    <span
                      className="inline-block mt-2.5 px-5 py-1.5 rounded-md text-sm font-medium"
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
          <div className="flex justify-center gap-2.5 mt-4">
            {activeBanners.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrent(i)}
                className="rounded-full transition-all duration-300 ease-out"
                style={{
                  width: current === i ? "20px" : "8px",
                  height: "8px",
                  backgroundColor: current === i ? "hsl(var(--foreground))" : "hsl(var(--muted-foreground) / 0.25)",
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
