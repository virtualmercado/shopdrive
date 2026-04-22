import { useEffect, useRef, useState } from "react";

export interface IntegrationBanner {
  image_url: string;
  description: string;
}

interface IntegrationsSectionProps {
  title: string;
  subtitle: string;
  items: IntegrationBanner[];
}

const IntegrationsSection = ({ title, subtitle, items }: IntegrationsSectionProps) => {
  const [paused, setPaused] = useState(false);
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const offsetRef = useRef(0);
  const rafRef = useRef<number | null>(null);

  // Duplicate items for seamless infinite scroll
  const loop = items && items.length > 0 ? [...items, ...items] : [];

  useEffect(() => {
    if (!items || items.length === 0) return;
    const track = trackRef.current;
    if (!track) return;
    const speed = 0.5; // px per frame (~30px/s)
    let lastTime = performance.now();

    const tick = (now: number) => {
      const dt = now - lastTime;
      lastTime = now;
      if (!paused) {
        offsetRef.current -= speed * (dt / 16.67);
        // single-set width = scrollWidth/2
        const halfWidth = track.scrollWidth / 2;
        if (halfWidth > 0 && Math.abs(offsetRef.current) >= halfWidth) {
          offsetRef.current += halfWidth;
        }
        track.style.transform = `translate3d(${offsetRef.current}px, 0, 0)`;
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [paused, items?.length]);

  if (!items || items.length === 0) return null;

  return (
    <section className="py-20 px-4 bg-background overflow-hidden">
      <div className="container mx-auto">
        <div className="text-center mb-14">
          <h2 className="text-4xl font-bold mb-4 text-black">{title}</h2>
          <p className="text-xl max-w-3xl mx-auto" style={{ color: "#5A5A5A" }}>
            {subtitle}
          </p>
        </div>

        <div
          className="relative w-full"
          onMouseLeave={() => {
            setPaused(false);
            setHoveredIdx(null);
          }}
        >
          <div
            ref={trackRef}
            className="flex gap-6 will-change-transform"
            style={{ width: "max-content" }}
          >
            {loop.map((item, i) => {
              const realIdx = i % items.length;
              const isHovered = hoveredIdx === i;
              return (
                <div
                  key={i}
                  className="relative shrink-0"
                  style={{ width: "min(709px, 80vw)" }}
                  onMouseEnter={() => {
                    setPaused(true);
                    setHoveredIdx(i);
                  }}
                >
                  <div
                    className={`relative overflow-hidden rounded-xl bg-white border border-border transition-all duration-300 ease-out ${
                      isHovered
                        ? "shadow-2xl -translate-y-1 scale-[1.015]"
                        : "shadow-md"
                    }`}
                    style={{ aspectRatio: "709 / 236" }}
                  >
                    <img
                      src={item.image_url}
                      alt={item.description || `Integração ${realIdx + 1}`}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  </div>

                  {/* Info balloon */}
                  <div
                    className={`absolute left-0 right-0 top-full mt-3 px-5 py-3 rounded-xl bg-white border border-border shadow-xl text-center text-sm leading-snug text-foreground origin-top transition-all duration-300 ease-out ${
                      isHovered
                        ? "opacity-100 scale-y-100 translate-y-0"
                        : "opacity-0 scale-y-0 -translate-y-2 pointer-events-none"
                    }`}
                    style={{ zIndex: 20 }}
                  >
                    {item.description}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
};

export default IntegrationsSection;
