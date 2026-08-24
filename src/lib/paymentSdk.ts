import { supabase } from "@/integrations/supabase/client";

/**
 * Shared, single source of truth for initializing the Mercado Pago
 * checkout SDK used by ShopDrive subscription billing.
 *
 * Security notes:
 * - Only the platform gateway PUBLIC key is fetched (via a restricted RPC).
 *   No access token / webhook secret is ever exposed to the browser.
 * - No PCI data (PAN, CVV, expiry) and no card token is ever logged here.
 */

export type PaymentSdkStatus =
  | "idle"
  | "loading_config"
  | "loading_sdk"
  | "initializing"
  | "ready"
  | "error";

export type PaymentSdkErrorKind = "config" | "sdk" | "init";

export interface PaymentPublicConfig {
  gatewayName: string | null;
  displayName: string | null;
  environment: string | null;
  publicKey: string;
}

const SDK_SRC = "https://sdk.mercadopago.com/js/v2";

/** Technical observability without sensitive values. */
export const paymentTrack = (
  event: string,
  data?: Record<string, string | number | boolean | null>
) => {
  // eslint-disable-next-line no-console
  console.info(`[payment] ${event}`, data ?? {});
};

export const paymentSdkErrorMessage = (kind: PaymentSdkErrorKind): string => {
  switch (kind) {
    case "config":
      return "Não foi possível carregar a configuração de pagamento. Tente novamente.";
    case "sdk":
      return "Não foi possível carregar o sistema de pagamento.";
    case "init":
    default:
      return "Não foi possível iniciar o pagamento com cartão.";
  }
};

export class PaymentSdkError extends Error {
  kind: PaymentSdkErrorKind;
  constructor(kind: PaymentSdkErrorKind, message?: string) {
    super(message ?? kind);
    this.kind = kind;
    this.name = "PaymentSdkError";
  }
}

/** Fetches ONLY the platform-level public gateway config. */
export const fetchPaymentPublicConfig = async (): Promise<PaymentPublicConfig> => {
  paymentTrack("payment_public_config_load_started");

  const { data, error } = await supabase.rpc("get_master_gateway_public_config");

  if (error) {
    paymentTrack("payment_public_config_load_failed", { reason: "request_error" });
    throw new PaymentSdkError("config", error.message);
  }

  const row = Array.isArray(data) ? data[0] : null;
  const publicKey = row?.mercadopago_public_key?.trim();

  if (!publicKey) {
    paymentTrack("payment_public_config_load_failed", { reason: "not_configured" });
    throw new PaymentSdkError("config", "gateway_not_configured");
  }

  paymentTrack("payment_public_config_load_success", {
    public_key_present: true,
    environment: row?.environment ?? null,
  });

  return {
    gatewayName: row?.gateway_name ?? null,
    displayName: row?.display_name ?? null,
    environment: row?.environment ?? null,
    publicKey,
  };
};

let sdkPromise: Promise<void> | null = null;

/** Idempotent SDK script loader — reuses the global script from index.html. */
export const loadMercadoPagoSdk = (): Promise<void> => {
  if (typeof window !== "undefined" && (window as any).MercadoPago) {
    return Promise.resolve();
  }

  if (sdkPromise) return sdkPromise;

  paymentTrack("payment_sdk_load_started");

  sdkPromise = new Promise<void>((resolve, reject) => {
    const finish = () => {
      if ((window as any).MercadoPago) {
        paymentTrack("payment_sdk_load_success");
        resolve();
      } else {
        sdkPromise = null;
        paymentTrack("payment_sdk_load_failed", { reason: "global_missing" });
        reject(new PaymentSdkError("sdk", "sdk_global_missing"));
      }
    };

    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${SDK_SRC}"]`
    );

    if (existing) {
      existing.addEventListener("load", finish, { once: true });
      existing.addEventListener(
        "error",
        () => {
          sdkPromise = null;
          paymentTrack("payment_sdk_load_failed", { reason: "script_error" });
          reject(new PaymentSdkError("sdk", "sdk_script_error"));
        },
        { once: true }
      );
      return;
    }

    const script = document.createElement("script");
    script.src = SDK_SRC;
    script.async = true;
    script.addEventListener("load", finish, { once: true });
    script.addEventListener(
      "error",
      () => {
        sdkPromise = null;
        paymentTrack("payment_sdk_load_failed", { reason: "script_error" });
        reject(new PaymentSdkError("sdk", "sdk_script_error"));
      },
      { once: true }
    );
    document.body.appendChild(script);
  });

  return sdkPromise;
};

export interface InitializedPaymentSdk {
  mp: any;
  config: PaymentPublicConfig;
}

/**
 * Loads the public config, the SDK script and instantiates MercadoPago.
 * Retries transient failures with a short backoff (max 3 attempts total).
 */
export const initializePaymentSdk = async (
  attempts = 3
): Promise<InitializedPaymentSdk> => {
  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const config = await fetchPaymentPublicConfig();
      await loadMercadoPagoSdk();

      const mp = new (window as any).MercadoPago(config.publicKey, {
        locale: "pt-BR",
      });

      if (!mp) throw new PaymentSdkError("init", "instance_missing");

      paymentTrack("payment_sdk_init_success");
      return { mp, config };
    } catch (error) {
      lastError = error;
      const kind =
        error instanceof PaymentSdkError ? error.kind : ("init" as PaymentSdkErrorKind);

      // Configuration is simply absent — retrying will not help.
      const permanent =
        error instanceof PaymentSdkError && error.message === "gateway_not_configured";

      if (permanent || attempt === attempts) {
        if (kind === "init") paymentTrack("payment_sdk_init_failed");
        throw error instanceof PaymentSdkError ? error : new PaymentSdkError("init");
      }

      await new Promise((r) => setTimeout(r, attempt * 600));
    }
  }

  throw lastError instanceof PaymentSdkError ? lastError : new PaymentSdkError("init");
};
