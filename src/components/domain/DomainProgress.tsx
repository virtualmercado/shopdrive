import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { CUSTOM_DOMAIN_PROGRESS_STEPS, type CustomDomainStep } from "@/lib/customDomainStatus";

/** Compact 4-step guide. Only the current step is highlighted; completion is shown with icon + text. */
export const DomainProgress = ({ step, connected = false }: { step: CustomDomainStep; connected?: boolean }) => (
  <ol aria-label="Etapas da conexão do domínio" className="grid grid-cols-4 gap-1">
    {CUSTOM_DOMAIN_PROGRESS_STEPS.map((label, i) => {
      const n = (i + 1) as CustomDomainStep;
      const done = n < step || (connected && n === 4);
      const current = n === step && !done;
      return (
        <li key={label} aria-current={current ? "step" : undefined} className="flex min-w-0 flex-col items-center gap-1 text-center">
          <span className="flex w-full items-center">
            <span className={cn("h-px flex-1", i === 0 ? "bg-transparent" : n <= step ? "bg-primary" : "bg-border")} />
            <span className={cn(
              "flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs font-semibold",
              done && "border-primary bg-primary text-primary-foreground",
              current && "border-primary bg-background text-primary ring-2 ring-primary/30",
              !done && !current && "border-border bg-muted text-muted-foreground",
            )}>
              {done ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : n}
            </span>
            <span className={cn("h-px flex-1", i === 3 ? "bg-transparent" : n < step ? "bg-primary" : "bg-border")} />
          </span>
          <span className={cn("text-[11px] leading-tight sm:text-xs", current ? "font-semibold text-foreground" : "text-muted-foreground")}>
            {label}
            <span className="sr-only">{done ? " (concluída)" : current ? " (etapa atual)" : " (pendente)"}</span>
          </span>
        </li>
      );
    })}
  </ol>
);
