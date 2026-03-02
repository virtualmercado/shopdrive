import { useState, useEffect, useCallback } from "react";

const STORAGE_KEY = "sd_billing_banner_dismiss";

interface DismissState {
  dismissedAt: number;
  status: string;
  hideUntil: number;
}

const getDismissState = (bannerId: string): DismissState | null => {
  try {
    const raw = localStorage.getItem(`${STORAGE_KEY}_${bannerId}`);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

const setDismissState = (bannerId: string, state: DismissState) => {
  try {
    localStorage.setItem(`${STORAGE_KEY}_${bannerId}`, JSON.stringify(state));
  } catch {
    // localStorage not available
  }
};

const clearDismissState = (bannerId: string) => {
  try {
    localStorage.removeItem(`${STORAGE_KEY}_${bannerId}`);
  } catch {
    // localStorage not available
  }
};

interface UseBannerDismissOptions {
  bannerId: string;
  status: string;
  /** Auto-hide after N milliseconds (e.g. 5000 for approved) */
  autoHideMs?: number;
  /** Max display duration in ms (e.g. 48h for pending) */
  maxDisplayMs?: number;
  /** Hours to suppress after manual dismiss */
  dismissHours?: number;
  /** Timestamp when the status was created/updated */
  statusTimestamp?: string | null;
}

export const useBannerDismiss = ({
  bannerId,
  status,
  autoHideMs,
  maxDisplayMs,
  dismissHours = 6,
  statusTimestamp,
}: UseBannerDismissOptions) => {
  const [isVisible, setIsVisible] = useState(true);

  // Check dismiss state on mount and when status changes
  useEffect(() => {
    const state = getDismissState(bannerId);

    // If status changed since last dismiss, reset and show
    if (state && state.status !== status) {
      clearDismissState(bannerId);
      setIsVisible(true);
      return;
    }

    // If dismissed and still within hide period
    if (state && Date.now() < state.hideUntil) {
      setIsVisible(false);
      return;
    }

    // If dismissed but hide period expired, clear and show
    if (state && Date.now() >= state.hideUntil) {
      clearDismissState(bannerId);
    }

    // Check max display duration (e.g. pending > 48h)
    if (maxDisplayMs && statusTimestamp) {
      const createdAt = new Date(statusTimestamp).getTime();
      if (Date.now() - createdAt > maxDisplayMs) {
        setIsVisible(false);
        return;
      }
    }

    setIsVisible(true);
  }, [bannerId, status, maxDisplayMs, statusTimestamp]);

  // Auto-hide timer (e.g. approved status shows for 5s)
  useEffect(() => {
    if (!autoHideMs || !isVisible) return;

    const timer = setTimeout(() => {
      setIsVisible(false);
    }, autoHideMs);

    return () => clearTimeout(timer);
  }, [autoHideMs, isVisible]);

  const dismiss = useCallback(() => {
    setIsVisible(false);
    setDismissState(bannerId, {
      dismissedAt: Date.now(),
      status,
      hideUntil: Date.now() + dismissHours * 60 * 60 * 1000,
    });
  }, [bannerId, status, dismissHours]);

  return { isVisible, dismiss };
};
