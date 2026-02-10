import { Badge } from "@/components/ui/badge";

const statusMap: Record<string, { label: string; className: string }> = {
  draft: { label: "Rascunho", className: "bg-muted text-muted-foreground" },
  open: { label: "Em aberto", className: "bg-blue-100 text-blue-800" },
  approved: { label: "Aprovado", className: "bg-green-100 text-green-800" },
  rejected: { label: "Recusado", className: "bg-red-100 text-red-800" },
  expired: { label: "Expirado", className: "bg-yellow-100 text-yellow-800" },
  converted: { label: "Convertido", className: "bg-purple-100 text-purple-800" },
};

export const QuoteStatusBadge = ({ status }: { status: string }) => {
  const config = statusMap[status] || { label: status, className: "bg-muted text-muted-foreground" };
  return <Badge className={config.className}>{config.label}</Badge>;
};
