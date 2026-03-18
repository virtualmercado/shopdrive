import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export const PASSWORD_MASK = "••••••••";

export const statusColor = (s: string) => {
  switch (s) {
    case "sent": case "success": return "default" as const;
    case "error": case "failed": case "dlq": return "destructive" as const;
    case "pending": case "queued": return "outline" as const;
    default: return "secondary" as const;
  }
};

export const statusLabel = (s: string) => {
  switch (s) {
    case "sent": case "success": return "Enviado";
    case "error": case "failed": return "Falha";
    case "dlq": return "Descartado";
    case "pending": case "queued": return "Pendente";
    default: return s;
  }
};

export const originLabel = (s: string | null) => {
  if (!s) return "Plataforma";
  if (s === "tenant_custom") return "SMTP Próprio";
  return "Plataforma";
};

export const formatDate = (d: string | null) => {
  if (!d) return "—";
  try {
    return format(new Date(d), "dd/MM/yyyy HH:mm", { locale: ptBR });
  } catch {
    return d;
  }
};
