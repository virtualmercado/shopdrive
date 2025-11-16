import { Badge } from "@/components/ui/badge";

interface OrderStatusBadgeProps {
  status: string;
}

export const OrderStatusBadge = ({ status }: OrderStatusBadgeProps) => {
  const getStatusConfig = (status: string) => {
    const configs: Record<string, { text: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
      pending: { text: "Pendente", variant: "outline" },
      paid: { text: "Pago", variant: "default" },
      processing: { text: "Processando", variant: "secondary" },
      shipped: { text: "Enviado", variant: "default" },
      delivered: { text: "Entregue", variant: "default" },
      cancelled: { text: "Cancelado", variant: "destructive" },
    };
    return configs[status] || { text: status, variant: "outline" };
  };

  const config = getStatusConfig(status);

  return <Badge variant={config.variant}>{config.text}</Badge>;
};
