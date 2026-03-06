import { supabase } from "@/integrations/supabase/client";

/**
 * Get or create a session ID for deduplication of store events.
 */
const getSessionId = (): string => {
  const key = "sd_session_id";
  let sessionId = sessionStorage.getItem(key);
  if (!sessionId) {
    sessionId = crypto.randomUUID();
    sessionStorage.setItem(key, sessionId);
  }
  return sessionId;
};

/**
 * Track a store event with session-based deduplication.
 * For store_visit: 1 per session per store.
 * For product_view/add_to_cart: 1 per session per store+product.
 * For purchase: always recorded (no dedup).
 */
export const trackStoreEvent = async (
  storeId: string,
  eventType: "store_visit" | "product_view" | "add_to_cart" | "purchase",
  productId?: string | null
) => {
  try {
    const sessionId = getSessionId();

    // Deduplication key (purchase is always tracked)
    if (eventType !== "purchase") {
      const dedupKey = `se_${eventType}_${storeId}_${productId || "none"}`;
      if (sessionStorage.getItem(dedupKey)) return;
      // Set early to avoid race conditions
      sessionStorage.setItem(dedupKey, "1");
    }

    await supabase.from("store_events").insert({
      store_id: storeId,
      product_id: productId || null,
      event_type: eventType,
      session_id: getSessionId(),
    } as any);
  } catch (e) {
    console.error("Error tracking store event:", e);
  }
};
