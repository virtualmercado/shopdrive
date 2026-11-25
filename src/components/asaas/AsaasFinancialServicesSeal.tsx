import { useEffect, useState } from "react";
import {
  ASAAS_OFFICIAL_URL,
  ASAAS_SEAL_ALT,
  getAsaasSealUrl,
  resolveAsaasSealVariant,
  type AsaasSealSurface,
  type AsaasSealVariant,
} from "@/lib/asaasCompliance";
import { cn } from "@/lib/utils";

interface AsaasFinancialServicesSealProps {
  surface?: AsaasSealSurface;
  variant?: AsaasSealVariant;
  size?: "default" | "compact";
  className?: string;
}

function readDocumentDarkMode(): boolean {
  if (typeof document === "undefined") return false;
  return document.documentElement.classList.contains("dark");
}

/**
 * Official clickable Asaas BaaS seal loaded directly from baas.asaas.com.
 * - Never sets referrerPolicy="no-referrer" on the <img> so Asaas can verify origin.
 * - Preserves original aspect ratio and official colors with no CSS filters or transforms.
 */
export function AsaasFinancialServicesSeal({
  surface = "light",
  variant,
  size = "default",
  className,
}: AsaasFinancialServicesSealProps) {
  const [isDarkTheme, setIsDarkTheme] = useState<boolean>(readDocumentDarkMode);

  useEffect(() => {
    if (surface !== "auto" || typeof document === "undefined") return;
    const root = document.documentElement;
    const update = () => setIsDarkTheme(root.classList.contains("dark"));
    update();
    const observer = new MutationObserver(update);
    observer.observe(root, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, [surface]);

  const resolvedVariant = resolveAsaasSealVariant(surface, isDarkTheme, variant);
  const sealUrl = getAsaasSealUrl(resolvedVariant);

  return (
    <a
      href={ASAAS_OFFICIAL_URL}
      target="_blank"
      rel="noopener"
      aria-label={`${ASAAS_SEAL_ALT} — abrir site oficial do Asaas em nova aba`}
      className={cn(
        "inline-flex items-center shrink-0 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        className,
      )}
    >
      <img
        src={sealUrl}
        alt={ASAAS_SEAL_ALT}
        width={160}
        height={48}
        decoding="async"
        loading="eager"
        className={cn(
          "block w-auto max-w-full object-contain",
          size === "compact" ? "h-10 min-h-[40px]" : "h-11 sm:h-12 min-h-[44px]",
        )}
      />
    </a>
  );
}