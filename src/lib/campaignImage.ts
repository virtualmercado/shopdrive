export const CAMPAIGN_IMAGE_MAX_BYTES = 1.5 * 1024 * 1024;
export const CAMPAIGN_IMAGE_MIMES = ["image/jpeg", "image/png", "image/webp"];
export interface CampaignMedia {
  id: string; name: string; url: string; file_path: string; file_type: string;
  size: number; mime_type?: string | null; width?: number | null; height?: number | null;
}
export function isCampaignImageFormat(file: CampaignMedia): boolean {
  return file.file_type === "image" && CAMPAIGN_IMAGE_MIMES.includes(file.mime_type || "");
}
export function isMasterCampaignImage(file: CampaignMedia): boolean {
  try {
    const url = new URL(file.url);
    return isCampaignImageFormat(file) && url.protocol === "https:" && !url.search && !url.hash
      && !url.username && !url.password
      && /^uploads\/[A-Za-z0-9_-]+\.(jpg|jpeg|png|webp)$/.test(file.file_path)
      && url.pathname === `/storage/v1/object/public/media-library/${file.file_path}`;
  } catch { return false; }
}
export function campaignImageError(file: CampaignMedia): string | null {
  if (!isMasterCampaignImage(file)) return "Selecione uma imagem JPG, PNG ou WebP da Biblioteca Master.";
  if (file.size > CAMPAIGN_IMAGE_MAX_BYTES) return "Esta imagem é muito grande para campanhas de e-mail. Utilize uma versão otimizada.";
  if (file.size <= 0) return "Imagem inválida.";
  return null;
}
export function validCampaignImageLink(link: string): boolean {
  if (!link.trim()) return true;
  try {
    const url = new URL(link.trim());
    return url.protocol === "https:" && !!url.hostname && !url.username && !url.password
      && link.trim().length <= 2000 && !/[\s"'<>]/.test(link.trim());
  } catch { return false; }
}