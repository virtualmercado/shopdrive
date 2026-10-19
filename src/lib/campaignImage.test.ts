import { describe, expect, it } from "vitest";
import { campaignImageError, isMasterCampaignImage, validCampaignImageLink, CAMPAIGN_IMAGE_MAX_BYTES, campaignImageAspectWarning } from "./campaignImage";
const media = { id: "test", name: "image", file_type: "image", file_path: "uploads/test.jpg", url: "https://assets.example/storage/v1/object/public/media-library/uploads/test.jpg", mime_type: "image/jpeg", size: 1000 };
describe("Master campaign image rules", () => {
  it("does not warn for 1200 × 600", () => expect(campaignImageAspectWarning({ width: 1200, height: 600 })).toBe(false));
  it("accepts the inclusive 1.7–2.3 banner tolerance", () => {
    for (const width of [1700, 1900, 2300]) expect(campaignImageAspectWarning({ width, height: 1000 })).toBe(false);
    for (const width of [1699, 2301]) expect(campaignImageAspectWarning({ width, height: 1000 })).toBe(true);
  });
  it("warns but accepts a 651 × 651 square", () => {
    const square = { ...media, width: 651, height: 651 };
    expect(campaignImageAspectWarning(square)).toBe(true);
    expect(campaignImageError(square)).toBeNull();
  });
  it("warns but accepts vertical images", () => {
    const vertical = { ...media, width: 600, height: 1200 };
    expect(campaignImageAspectWarning(vertical)).toBe(true);
    expect(campaignImageError(vertical)).toBeNull();
  });
  it("does not invent a warning without valid dimensions", () => {
    for (const dimensions of [{}, { width: 651 }, { width: 0, height: 600 }, { width: 600, height: -1 }, { width: Infinity, height: 600 }]) expect(campaignImageAspectWarning(dimensions)).toBe(false);
  });
  for (const [ext, mime] of [["jpg", "image/jpeg"], ["png", "image/png"], ["webp", "image/webp"]]) {
    it(`accepts ${ext}`, () => expect(campaignImageError({ ...media, file_path: `uploads/test.${ext}`, url: media.url.replace(".jpg", `.${ext}`), mime_type: mime })).toBeNull());
  }
  for (const mime of ["image/svg+xml", "application/pdf", "image/gif", "text/html"]) {
    it(`rejects ${mime}`, () => expect(isMasterCampaignImage({ ...media, mime_type: mime })).toBe(false));
  }
  it("enforces 1.5 MB", () => {
    expect(CAMPAIGN_IMAGE_MAX_BYTES).toBe(1572864);
    expect(campaignImageError({ ...media, size: 1572864 })).toBeNull();
    expect(campaignImageError({ ...media, size: 1572865 })).not.toBeNull();
  });
  it("rejects tenant bucket", () => expect(isMasterCampaignImage({ ...media, url: media.url.replace("media-library", "product-images") })).toBe(false));
  it("rejects temporary signed URLs", () => expect(isMasterCampaignImage({ ...media, url: media.url + "?token=temporary" })).toBe(false));
  it("accepts optional HTTPS click link", () => {
    expect(validCampaignImageLink("")).toBe(true);
    expect(validCampaignImageLink("https://shopdrive.com.br")).toBe(true);
  });
  for (const link of ["javascript:alert(1)", "data:image/png;base64,test", "http://example.com", "https://example.com/\"bad", "https://"]) {
    it(`rejects unsafe click URL ${link}`, () => expect(validCampaignImageLink(link)).toBe(false));
  }
});