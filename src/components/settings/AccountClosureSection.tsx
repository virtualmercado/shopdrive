import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AlertTriangle, UserX, Info } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useTheme } from "@/contexts/ThemeContext";

const DELETION_REASONS = [
  { value: "not_using", label: "Não estou usando" },
  { value: "price", label: "Preço" },
  { value: "technical_issue", label: "Problema técnico" },
  { value: "switching_platform", label: "Vou mudar de plataforma" },
  { value: "other", label: "Outro" },
];

export const AccountClosureSection = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  const { primaryColor } = useTheme();
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [accountStatus, setAccountStatus] = useState<string>("active");
  const [hasPendingRequest, setHasPendingRequest] = useState(false);
  
  const [reason, setReason] = useState("");
  const [details, setDetails] = useState("");
  const [consent, setConsent] = useState(false);

  useEffect(() => {
    const fetchAccountStatus = async () => {
      if (!user) return;
      
      try {
        // Check account status
        const { data: profile } = await supabase
          .from("profiles")
          .select("account_status")
          .eq("id", user.id)
          .single();
        
        if (profile) {
          setAccountStatus(profile.account_status || "active");
        }
        
        // Check for pending deletion request
        const { data: requests } = await supabase
          .from("account_deletion_requests")
          .select("id, status")
          .eq("merchant_id", user.id)
          .in("status", ["pending", "in_review"])
          .limit(1);
        
        if (requests && requests.length > 0) {
          setHasPendingRequest(true);
        }
      } catch (error) {
        console.error("Error fetching account status:", error);
      }
    };
    
    fetchAccountStatus();
  }, [user]);

  const handleSubmitRequest = async () => {
    if (!user || !reason || !consent) return;
    
    setIsSubmitting(true);
    
    try {
      // 1. Create deletion request
      const { data: deletionRequest, error: requestError } = await supabase
        .from("account_deletion_requests")
        .insert({
          merchant_id: user.id,
          reason,
          details: details || null,
          ip_address: null, // Could be captured via API
          user_agent: navigator.userAgent,
        })
        .select("id")
        .single();
      
      if (requestError) throw requestError;
      
      // 2. Create support ticket with category "account_deletion"
      const { data: ticket, error: ticketError } = await supabase
        .from("merchant_support_tickets")
        .insert({
          merchant_id: user.id,
          message: `Solicitação de exclusão de conta\n\nMotivo: ${DELETION_REASONS.find(r => r.value === reason)?.label || reason}\n\nDetalhes: ${details || "Nenhum detalhe adicional fornecido."}`,
          category: "account_deletion",
          status: "pending",
        })
        .select("id")
        .single();
      
      if (ticketError) throw ticketError;
      
      // 3. Link ticket to deletion request
      if (ticket) {
        await supabase
          .from("account_deletion_requests")
          .update({ ticket_id: ticket.id })
          .eq("id", deletionRequest.id);
      }
      
      // 4. Update account status
      await supabase
        .from("profiles")
        .update({ 
          account_status: "exclusao_solicitada",
          account_status_updated_at: new Date().toISOString()
        })
        .eq("id", user.id);
      
      // 5. Log audit event
      await supabase
        .from("audit_logs")
        .insert({
          user_id: user.id,
          action: "account_deletion_requested",
          entity_type: "profile",
          entity_id: user.id,
          metadata: {
            reason,
            details,
            ticket_id: ticket?.id,
            request_id: deletionRequest.id
          }
        });
      
      toast({
        title: "Solicitação enviada",
        description: "Nossa equipe irá analisar e entrar em contato. Você pode acompanhar pelo Suporte.",
      });
      
      setIsModalOpen(false);
      setAccountStatus("exclusao_solicitada");
      setHasPendingRequest(true);
      setReason("");
      setDetails("");
      setConsent(false);
      
    } catch (error) {
      console.error("Error submitting deletion request:", error);
      toast({
        title: "Erro ao enviar solicitação",
        description: "Não foi possível enviar sua solicitação. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="p-6 border-destructive/20">
      <div className="space-y-1 mb-6">
        <div className="flex items-center gap-2">
          <div className="flex items-center justify-center w-8 h-8 bg-red-100 rounded">
            <UserX className="h-4 w-4 text-red-600" />
          </div>
          <h2 className="text-lg font-semibold text-foreground">Encerramento da conta</h2>
        </div>
      </div>
      
      {accountStatus === "exclusao_solicitada" || hasPendingRequest ? (
        <Alert className="bg-amber-50 border-amber-200">
          <Info className="h-4 w-4 text-amber-600" />
          <AlertDescription className="text-amber-800">
            Sua solicitação de exclusão está em análise. Acompanhe pelo menu <strong>Suporte</strong>.
          </AlertDescription>
        </Alert>
      ) : (
        <>
          <p className="text-sm text-muted-foreground mb-4">
            Se você deseja encerrar sua conta e remover seus dados da plataforma, 
            você pode solicitar a exclusão abaixo. Nossa equipe irá analisar sua solicitação.
          </p>
          
          <Button 
            variant="outline" 
            className="border-red-300 text-red-600 hover:bg-red-50 hover:text-red-700"
            onClick={() => setIsModalOpen(true)}
          >
            <AlertTriangle className="h-4 w-4 mr-2" />
            Solicitar exclusão da conta
          </Button>
        </>
      )}
      
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Solicitar exclusão da conta
            </DialogTitle>
            <DialogDescription className="text-left pt-2">
              Esta ação <strong>NÃO</strong> exclui sua conta imediatamente. Você estará enviando uma solicitação para nossa equipe.
              <br /><br />
              Podemos manter alguns dados mínimos por obrigação legal (ex.: registros financeiros e de consentimento), conforme a LGPD.
              <br /><br />
              Se você deseja apenas pausar sua loja, recomendamos "Desativar loja" nas configurações.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="reason">Motivo da solicitação *</Label>
              <Select value={reason} onValueChange={setReason}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um motivo" />
                </SelectTrigger>
                <SelectContent>
                  {DELETION_REASONS.map((r) => (
                    <SelectItem key={r.value} value={r.value}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="details">Conte mais detalhes (opcional)</Label>
              <Textarea
                id="details"
                placeholder="Escreva aqui os detalhes..."
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                rows={3}
              />
            </div>
            
            <div className="flex items-start space-x-3 pt-2">
              <Checkbox
                id="consent"
                checked={consent}
                onCheckedChange={(checked) => setConsent(checked as boolean)}
              />
              <Label htmlFor="consent" className="text-sm leading-relaxed cursor-pointer">
                Confirmo que estou solicitando a exclusão da minha conta e entendo que alguns registros podem ser mantidos por obrigação legal.
              </Label>
            </div>
          </div>
          
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setIsModalOpen(false)}
              disabled={isSubmitting}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSubmitRequest}
              disabled={!reason || !consent || isSubmitting}
              className="bg-amber-600 hover:bg-amber-700"
            >
              {isSubmitting ? "Enviando..." : "Enviar solicitação"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
};
