import { BENEFIT_BANNERS, getMobileBanners } from "@/lib/benefitBanners";
import { useIsMobile } from "@/hooks/use-mobile";

interface BenefitBannersSectionProps {
  selectedIds: number[];
}

const BenefitBannersSection = ({ selectedIds }: BenefitBannersSectionProps) => {
  const isMobile = useIsMobile();

  if (!selectedIds || selectedIds.length === 0) return null;

  const allSelected = BENEFIT_BANNERS.filter((b) => selectedIds.includes(b.id));
  const bannersToShow = isMobile ? getMobileBanners(selectedIds) : allSelected;

  if (bannersToShow.length === 0) return null;

  return (
    <section className="w-full">
      <div
        className={`grid gap-3 ${
          isMobile ? "grid-cols-2" : "grid-cols-4"
        }`}
      >
        {bannersToShow.map((banner) => (
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
};

export default BenefitBannersSection;
