import { MouseEvent } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  getContrastingTextColor,
  hasStructuredBannerContent,
  isSafeBannerUrl,
  type MainBannerSlideContent,
} from "@/lib/mainBannerContent";

interface HeroBannerSlideProps {
  imageUrl: string;
  imageAlt: string;
  content?: MainBannerSlideContent;
  mobile?: boolean;
  loading?: "eager" | "lazy";
  interactive?: boolean;
  onCtaClick?: (url: string) => void;
}

const positionClasses: Record<MainBannerSlideContent["contentPosition"], string> = {
  left: "items-start text-left",
  center: "items-center text-center",
  right: "items-end text-right",
};

const protectionClasses: Record<MainBannerSlideContent["contentPosition"], string> = {
  left: "hero-banner-readable-left",
  center: "hero-banner-readable-center",
  right: "hero-banner-readable-right",
};

const HeroBannerSlide = ({
  imageUrl,
  imageAlt,
  content,
  mobile = false,
  loading = "lazy",
  interactive = true,
  onCtaClick,
}: HeroBannerSlideProps) => {
  const hasContent = hasStructuredBannerContent(content);
  const validCta = Boolean(content?.ctaText.trim() && isSafeBannerUrl(content.ctaUrl));
  const position = content?.contentPosition ?? "left";

  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    if (!interactive) {
      event.preventDefault();
      return;
    }
    if (onCtaClick && content) {
      event.preventDefault();
      onCtaClick(content.ctaUrl);
    }
  };

  return (
    <div className={cn("relative w-full overflow-hidden", mobile ? "h-auto" : "h-full")}>
      <img
        src={imageUrl}
        alt={imageAlt}
        className={cn(
          "w-full object-center",
          mobile ? "h-auto object-contain" : "h-full object-cover transition-transform duration-[400ms] ease-out will-change-transform group-hover:scale-[1.03]",
        )}
        loading={loading}
      />

      {hasContent && content && (
        <div className={cn("absolute inset-0 z-[1] flex items-center px-[7%] py-[8%]", positionClasses[position])}>
          <div className={cn("flex w-full max-w-[88%] flex-col sm:max-w-[44%]", position === "center" && "sm:max-w-[56%]", protectionClasses[position])}>
            {content.title && (
              <div
                className="text-[clamp(1.25rem,3.2vw,3.25rem)] font-semibold leading-[1.08]"
                style={{ color: content.textColor }}
              >
                {content.title}
              </div>
            )}
            {content.subtitle && (
              <p
                className="mt-2 text-[clamp(0.75rem,1.35vw,1.2rem)] leading-snug sm:mt-3"
                style={{ color: content.textColor }}
              >
                {content.subtitle}
              </p>
            )}
            {validCta && (
              <Button
                asChild
                size={mobile ? "sm" : "default"}
                className="mt-3 w-fit max-w-full transition-[filter,transform] hover:brightness-95 active:scale-[0.98] sm:mt-5"
                style={{
                  backgroundColor: content.buttonColor,
                  color: getContrastingTextColor(content.buttonColor),
                }}
              >
                <a href={content.ctaUrl} onClick={handleClick} tabIndex={interactive ? 0 : -1}>
                  <span className="truncate">{content.ctaText}</span>
                </a>
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default HeroBannerSlide;