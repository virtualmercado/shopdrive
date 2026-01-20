import HeroContentLeft from "./HeroContentLeft";
import HeroCarousel from "./HeroCarousel";
import { useCMSBanners, getBannerUrl } from "@/hooks/useCMSBanners";
import heroImageDefault from "@/assets/hero-banner.jpg";

interface HeroSectionProps {
  heroContent: {
    badge: string;
    title: string;
    subtitle: string;
    buttonPrimary: string;
    buttonSecondary: string;
    infoText: string;
  };
}

const HeroSection = ({ heroContent }: HeroSectionProps) => {
  const { data: cmsBanners } = useCMSBanners();

  // Get hero carousel images from CMS
  const heroImage1 = getBannerUrl(cmsBanners, "hero_01", heroImageDefault);
  const heroImage2 = getBannerUrl(cmsBanners, "hero_02", "");
  const heroImage3 = getBannerUrl(cmsBanners, "hero_03", "");

  // Build images array - only include non-empty URLs
  const carouselImages = [heroImage1, heroImage2, heroImage3].filter(
    (url) => url && url.length > 0
  );

  return (
    <section className="relative py-16 md:py-24 px-4 bg-gradient-to-br from-primary/5 via-background to-secondary/5 overflow-hidden">
      <div className="container mx-auto">
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
            />
          </div>

          {/* Right Column - Carousel */}
          <div className="order-2 flex justify-center lg:justify-end">
            <div className="w-full max-w-md lg:max-w-lg">
              <HeroCarousel images={carouselImages} interval={7000} />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
