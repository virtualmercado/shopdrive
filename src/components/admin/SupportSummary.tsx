import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { HeadphonesIcon, CheckCircle, Clock } from "lucide-react";
import { Link } from "react-router-dom";

export const SupportSummary = () => {
  const { data } = useQuery({
    queryKey: ["support-summary"],
    queryFn: async () => {
      const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);

      const { count: openTickets } = await supabase
        .from("support_tickets")
        .select("*", { count: "exact", head: true })
        .eq("status", "open");

      const { count: resolvedThisMonth } = await supabase
        .from("support_tickets")
        .select("*", { count: "exact", head: true })
        .eq("status", "closed")
        .gte("closed_at", startOfMonth.toISOString());

      const { data: recentTickets } = await supabase
        .from("support_tickets")
        .select(`
          *,
          profiles(full_name, store_name)
        `)
        .order("created_at", { ascending: false })
        .limit(3);

      return {
        openTickets: openTickets || 0,
        resolvedThisMonth: resolvedThisMonth || 0,
        avgSLA: "2h 30min",
        recentTickets: recentTickets || [],
      };
    },
  });

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case "high":
        return <Badge variant="destructive">Alta</Badge>;
      case "medium":
        return <Badge className="bg-orange-600">Média</Badge>;
      case "low":
        return <Badge variant="secondary">Baixa</Badge>;
      default:
        return <Badge>{priority}</Badge>;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Suporte ao Cliente</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="flex items-center gap-2">
            <HeadphonesIcon className="h-5 w-5 text-primary" />
            <div>
              <p className="text-sm text-muted-foreground">Abertos</p>
              <p className="text-2xl font-bold">{data?.openTickets || 0}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-green-600" />
            <div>
              <p className="text-sm text-muted-foreground">Resolvidos</p>
              <p className="text-2xl font-bold">{data?.resolvedThisMonth || 0}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-blue-600" />
            <div>
              <p className="text-sm text-muted-foreground">SLA Médio</p>
              <p className="text-2xl font-bold">{data?.avgSLA}</p>
            </div>
          </div>
        </div>

        <div className="space-y-3 mb-4">
          <h4 className="font-semibold text-sm">Últimos Tickets</h4>
          {data?.recentTickets && data.recentTickets.length > 0 ? (
            data.recentTickets.map((ticket: any) => (
              <div
                key={ticket.id}
                className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
              >
                <div className="flex-1">
                  <p className="font-medium text-sm">{ticket.ticket_number}</p>
                  <p className="text-sm text-muted-foreground">
                    {ticket.profiles?.store_name || ticket.profiles?.full_name}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {getPriorityBadge(ticket.priority)}
                  <Badge variant="outline">{ticket.status}</Badge>
                </div>
              </div>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">Nenhum ticket recente</p>
          )}
        </div>

        <Link to="/gestor/suporte">
          <Button variant="outline" className="w-full">
            Ver Todos os Tickets
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
};
