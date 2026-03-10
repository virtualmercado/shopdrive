interface ContentBannerSectionProps {
  enabled?: boolean;
  imageUrl?: string | null;
  title?: string | null;
  subtitle?: string | null;
  titleColor?: string;
  subtitleColor?: string;
  url?: string | null;
}

const ContentBannerSection = ({
  enabled,
  imageUrl,
  title,
  subtitle,
  titleColor = "#ffffff",
  subtitleColor = "#ffffffcc",
  url,
}: ContentBannerSectionProps) => {
  if (!enabled || !imageUrl || !url) return null;

  return (
    <section className="w-full px-4 py-8">
      <div className="max-w-4xl mx-auto">
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="block relative w-full overflow-hidden rounded-xl group cursor-pointer"
          style={{ aspectRatio: "16 / 5" }}
        >
          {/* Background Image */}
          <img
            src={imageUrl}
            alt={title || "Banner promocional"}
            className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          />

          {/* Translucent Mask */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="bg-white/30 backdrop-blur-sm rounded-lg px-8 py-5 sm:px-12 sm:py-6 max-w-[80%] text-center">
              {title && (
                <h3
                  className="text-lg sm:text-xl md:text-2xl font-semibold leading-tight"
                  style={{ color: titleColor }}
                >
                  {title}
                </h3>
              )}
              {subtitle && (
                <p
                  className="text-sm sm:text-base mt-1.5 leading-snug"
                  style={{ color: subtitleColor }}
                >
                  {subtitle}
                </p>
              )}
            </div>
          </div>
        </a>
      </div>
    </section>
  );
};

export default ContentBannerSection;
