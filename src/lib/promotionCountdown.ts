export interface CountdownProductFields {
  price?: number | null;
  promotional_price?: number | null;
  promotion_countdown_enabled?: boolean | null;
  promotion_countdown_ends_at?: string | null;
  promotion_countdown_text?: string | null;
}

export const getPromotionDiscountPercent = (
  price?: number | null,
  promotionalPrice?: number | null,
): number | null => {
  if (!price || price <= 0) return null;
  if (promotionalPrice == null || promotionalPrice <= 0) return null;
  if (promotionalPrice >= price) return null;
  return Math.round(((price - promotionalPrice) / price) * 100);
};

export const hasValidPromotionalPrice = (
  price?: number | null,
  promotionalPrice?: number | null,
): boolean => {
  return (
    price != null &&
    price > 0 &&
    promotionalPrice != null &&
    promotionalPrice > 0 &&
    promotionalPrice < price
  );
};

export const isPromotionCountdownActive = (p: CountdownProductFields): boolean => {
  if (!p.promotion_countdown_enabled) return false;
  if (!hasValidPromotionalPrice(p.price, p.promotional_price)) return false;
  if (!p.promotion_countdown_ends_at) return false;
  const end = new Date(p.promotion_countdown_ends_at).getTime();
  if (isNaN(end)) return false;
  return end > Date.now();
};

export interface CountdownTimeLeft {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  totalMs: number;
}

export const getCountdownTimeLeft = (endIso?: string | null): CountdownTimeLeft | null => {
  if (!endIso) return null;
  const end = new Date(endIso).getTime();
  if (isNaN(end)) return null;
  const totalMs = end - Date.now();
  if (totalMs <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0, totalMs: 0 };
  const days = Math.floor(totalMs / 86400000);
  const hours = Math.floor((totalMs % 86400000) / 3600000);
  const minutes = Math.floor((totalMs % 3600000) / 60000);
  const seconds = Math.floor((totalMs % 60000) / 1000);
  return { days, hours, minutes, seconds, totalMs };
};

export const formatCountdownUnit = (n: number): string =>
  String(Math.max(0, n)).padStart(2, "0");
