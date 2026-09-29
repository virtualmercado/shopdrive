import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

type Upgrade = { status: string; effective_at?: string; grace_until?: string; amount?: number; target_cycle?: string };

const fmtDate = (d?: string) => (d ? new Date(d).toLocaleDateString("pt-BR") : "");
const fmtMoney = (v?: number) => (v ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/** Estado da troca agendada para MARCA. Só aparece com o MARCA ligado (o servidor responde "unavailable" caso contrário). */
export function MarcaScheduledUpgradeCard() {
  const navigate = useNavigate();
  const { data } = useQuery({
    queryKey: ["marca-scheduled-upgrade"],
    queryFn: async (): Promise<Upgrade> => {
      const { data, error } = await (supabase.rpc as any)("get_my_marca_upgrade");
      if (error) return { status: "unavailable" };
      return data as Upgrade;
    },
    refetchOnWindowFocus: true,
  });

  if (!data || !["scheduled", "awaiting_payment", "expired", "activated"].includes(data.status)) return null;
  const pastEffective = data.effective_at && new Date(data.effective_at) <= new Date();

  return (
    <Card className="p-6 space-y-2">
      <h3 className="text-base font-semibold text-foreground">Troca para o Plano MARCA</h3>
      {data.status === "scheduled" && !pastEffective && (
        <p className="text-sm text-muted-foreground">
          Agendada para {fmtDate(data.effective_at)}. Seu plano atual continua até lá. O pagamento de {fmtMoney(data.amount)} fica disponível nessa data.
        </p>
      )}
      {(data.status === "awaiting_payment" || (data.status === "scheduled" && pastEffective)) && (
        <>
          <p className="text-sm text-muted-foreground">
            Chegou a data da troca. Pague {fmtMoney(data.amount)} por PIX até {fmtDate(data.grace_until)} para ativar o Plano MARCA.
          </p>
          <Button onClick={() => navigate(`/gestor/checkout-assinatura?plano=marca&ciclo=${data.target_cycle === "annual" ? "anual" : "mensal"}&origem=troca_agendada`)}>
            Pagar e ativar Plano MARCA
          </Button>
        </>
      )}
      {data.status === "expired" && (
        <p className="text-sm text-muted-foreground">O prazo para pagar a troca terminou. Para contratar o Plano MARCA, faça uma nova contratação.</p>
      )}
      {data.status === "activated" && <p className="text-sm text-muted-foreground">Plano MARCA ativo.</p>}
    </Card>
  );
}
