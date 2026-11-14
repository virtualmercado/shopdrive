import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Read-only DNS value with a copy button; values come exactly from the server. */
export const DomainCopyRow = ({ label, value }: { label: string; value: string }) => {
  const [done, setDone] = useState(false);
  return (
    <div className="flex min-w-0 items-center justify-between gap-2 rounded-md border bg-background p-2">
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="font-mono text-sm break-all">{value}</p>
      </div>
      <Button size="icon" variant="ghost" className="shrink-0" aria-label={`Copiar ${label}`} onClick={async () => {
        await navigator.clipboard.writeText(value); setDone(true); setTimeout(() => setDone(false), 1500);
      }}>
        {done ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
      </Button>
    </div>
  );
};
