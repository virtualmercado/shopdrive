import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface LogDetailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  log: any | null;
}

const LogDetailModal = ({ open, onOpenChange, log }: LogDetailModalProps) => {
  if (!log) return null;

  const meta = log.metadata || {};

  const rows: { label: string; value: string }[] = [
    { label: "Evento", value: log.action },
    { label: "Tipo", value: log.entity_type },
    { label: "Descrição", value: meta.description || "-" },
    { label: "Usuário", value: meta.user_name || log.profiles?.store_name || "-" },
    { label: "Email", value: meta.user_email || log.profiles?.email || "-" },
    { label: "Tipo de Usuário", value: meta.user_role || "-" },
    { label: "ID da Loja", value: log.entity_id || "-" },
    { label: "IP", value: log.ip_address || "-" },
    { label: "Navegador", value: meta.user_agent || "-" },
    {
      label: "Data/Hora",
      value: format(new Date(log.created_at), "dd/MM/yyyy HH:mm:ss", { locale: ptBR }),
    },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Detalhes do Log
            <Badge variant="outline">{log.action}</Badge>
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 mt-2">
          {rows.map((row) => (
            <div key={row.label} className="grid grid-cols-3 gap-2 text-sm">
              <span className="font-medium text-muted-foreground">{row.label}</span>
              <span className="col-span-2 break-all">{row.value}</span>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default LogDetailModal;
