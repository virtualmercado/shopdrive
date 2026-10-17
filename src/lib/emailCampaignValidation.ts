/** Stage-specific validation; the server repeats final campaign validation. */
export const validCampaignInformation = (name: string, subject: string) =>
  name.trim().length >= 1 && name.trim().length <= 120
  && subject.trim().length >= 1 && subject.trim().length <= 200;

export const validCampaignContent = (content: string, ctaLabel: string, ctaUrl: string) =>
  content.trim().length >= 1 && content.length <= 20000
  && (ctaLabel.trim() === "" || (ctaLabel.trim().length <= 60
    && ctaUrl.trim().length <= 2000 && /^https:\/\/[^\s"'<>]+$/.test(ctaUrl.trim())));

export const validCampaignAudienceDates = (from: string, to: string) =>
  (!from || Number.isFinite(Date.parse(from))) && (!to || Number.isFinite(Date.parse(to)))
  && (!from || !to || Date.parse(from) <= Date.parse(to));