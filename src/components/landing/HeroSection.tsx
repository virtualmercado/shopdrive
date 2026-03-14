import { useRef } from "react";
import HeroContentLeft from "./HeroContentLeft";
import HeroCarousel from "./HeroCarousel";
import HeroInteractiveBackground from "./HeroInteractiveBackground";
import { useCMSBanners, getBannerUrl } from "@/hooks/useCMSBanners";
import heroImageDefault from "@/assets/hero-banner.jpg";

const extractYouTubeId = (url: string): string | null => {
  if (!url) return null;
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtube\.com\/watch\?.*&v=)([a-zA-Z0-9_-]{11})/,
    /youtu\.be\/([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
    /m\.youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m?.[1]) return m[1];
  }
  return null;
};

interface HeroSectionProps {
  heroContent: {
    badge: string;
    title: string;
    subtitle: string;
    buttonPrimary: string;
    buttonSecondary: string;
    infoText: string;
  };
  demoVideoContent?: Record<string, any>;
}

const HeroSection = ({ heroContent, demoVideoContent }: HeroSectionProps) => {
  const { data: cmsBanners, isLoading } = useCMSBanners();

  // Get hero carousel images from CMS - only when data is loaded
  // Use empty strings while loading to avoid showing fallback image
  const heroImage1 = isLoading ? "" : getBannerUrl(cmsBanners, "hero_01", heroImageDefault);
  const heroImage2 = isLoading ? "" : getBannerUrl(cmsBanners, "hero_02", "");
  const heroImage3 = isLoading ? "" : getBannerUrl(cmsBanners, "hero_03", "");

  // Build images array - only include non-empty URLs
  const carouselImages = [heroImage1, heroImage2, heroImage3].filter(
    (url) => url && url.length > 0
  );

  // Build demo video data
  const demoVideo = demoVideoContent?.url ? {
    url: demoVideoContent.url,
    title: demoVideoContent.title || "",
    behavior: (demoVideoContent.behavior || "modal") as "modal" | "new_tab",
    videoId: extractYouTubeId(demoVideoContent.url),
  } : undefined;

  return (
    <section className="relative py-16 md:py-24 px-4 overflow-hidden" style={{ background: '#FFFFFF' }}>
      {/* Interactive background layers 1-4 */}
      <HeroInteractiveBackground />

      <div className="container mx-auto relative" style={{ zIndex: 10 }}>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-16 items-center">
          {/* Left Column - Content */}
          <div className="order-1">
            <HeroContentLeft
              badge={heroContent.badge}
              title={heroContent.title}
              subtitle={heroContent.subtitle}
              buttonPrimary={heroContent.buttonPrimary}
              buttonSecondary={heroContent.buttonSecondary}
              infoText={heroContent.infoText}
              demoVideo={demoVideo}
            />
          </div>

          {/* Right Column - Carousel */}
          <div className="order-2 flex justify-center lg:justify-end">
            <div className="w-full max-w-md lg:max-w-lg">
              {isLoading ? (
                <div className="relative aspect-[4/5] md:aspect-square lg:aspect-[4/5] w-full" />
              ) : (
                <HeroCarousel images={carouselImages} interval={7000} />
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
