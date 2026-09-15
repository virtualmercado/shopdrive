import { z } from "zod";

export const MAIN_BANNER_MAX_SLIDES = 4;
export const HEX_COLOR_PATTERN = /^#[0-9A-Fa-f]{6}$/;

export const mainBannerSlideContentSchema = z.object({
  title: z.string().trim().max(60).optional().default(""),
  subtitle: z.string().trim().max(120).optional().default(""),
  ctaText: z.string().trim().max(30).optional().default(""),
  ctaUrl: z.string().trim().max(2048).optional().default(""),
  contentPosition: z.enum(["left", "center", "right"]).optional().default("left"),
  textColor: z.string().regex(HEX_COLOR_PATTERN).optional().default("#FFFFFF"),
  buttonColor: z.string().regex(HEX_COLOR_PATTERN).optional().default("#6A1B9A"),
});

export type MainBannerSlideContent = z.infer<typeof mainBannerSlideContentSchema>;

export const EMPTY_MAIN_BANNER_CONTENT: MainBannerSlideContent = {
  title: "",
  subtitle: "",
  ctaText: "",
  ctaUrl: "",
  contentPosition: "left",
  textColor: "#FFFFFF",
  buttonColor: "#6A1B9A",
};

export const isSafeBannerUrl = (value: string): boolean => {
  const url = value.trim();
  if (!url) return false;
  if (url.startsWith("/") && !url.startsWith("//")) return !/[\u0000-\u001F\u007F]/.test(url);

  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
};

export const isInternalBannerUrl = (value: string): boolean => {
  const url = value.trim();
  return url.startsWith("/") && !url.startsWith("//") && isSafeBannerUrl(url);
};

export const normalizeMainBannerContent = (value: unknown): MainBannerSlideContent[] => {
  if (!Array.isArray(value)) return [];

  return value.slice(0, MAIN_BANNER_MAX_SLIDES).map((item) => {
    const parsed = mainBannerSlideContentSchema.safeParse(item);
    return parsed.success ? parsed.data : { ...EMPTY_MAIN_BANNER_CONTENT };
  });
};

export const hasStructuredBannerContent = (content?: MainBannerSlideContent): boolean => {
  if (!content) return false;
  return Boolean(content.title.trim() || content.subtitle.trim() || (content.ctaText.trim() && isSafeBannerUrl(content.ctaUrl)));
};

export const getContrastingTextColor = (hexColor: string): "#000000" | "#FFFFFF" => {
  const normalized = HEX_COLOR_PATTERN.test(hexColor) ? hexColor.slice(1) : "6A1B9A";
  const channels = [0, 2, 4].map((offset) => Number.parseInt(normalized.slice(offset, offset + 2), 16) / 255);
  const [red, green, blue] = channels.map((channel) =>
    channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4,
  );
  const luminance = (0.2126 * red) + (0.7152 * green) + (0.0722 * blue);
  const contrastWithBlack = (luminance + 0.05) / 0.05;
  const contrastWithWhite = 1.05 / (luminance + 0.05);
  return contrastWithBlack >= contrastWithWhite ? "#000000" : "#FFFFFF";
};

export const removeMainBannerContentAt = (
  content: MainBannerSlideContent[],
  index: number,
): MainBannerSlideContent[] => content.filter((_, itemIndex) => itemIndex !== index);