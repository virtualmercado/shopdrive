import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2 } from "lucide-react";

type State = "loading" | "valid" | "already" | "done" | "invalid";

const MESSAGES: Record<Exclude<State, "loading" | "valid">, string> = {
  done: "Pronto. Você não receberá mais campanhas comerciais da ShopDrive neste endereço. Comunicações essenciais relacionadas à sua conta poderão continuar sendo enviadas.",
  already: "Este endereço já está descadastrado das comunicações comerciais.",
  invalid: "Este link de descadastro não é válido ou não está mais disponível.",
};

const EmailUnsubscribe = () => {
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const [state, setState] = useState<State>("loading");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    document.title = "Comunicações comerciais | ShopDrive";
    if (!token) { setState("invalid"); return; }
    supabase.rpc("check_email_unsubscribe_token", { p_token: token }).then(({ data, error }) => {
      if (error) return setState("invalid");
      setState(data === "valid" ? "valid" : data === "already" ? "already" : "invalid");
    });
  }, [token]);

  const confirm = async () => {
    setSubmitting(true);
    const { data, error } = await supabase.rpc("confirm_email_unsubscribe", { p_token: token });
    setSubmitting(false);
    if (error) return setState("invalid");
    setState(data === "unsubscribed" ? "done" : data === "already" ? "already" : "invalid");
  };

  return (
    <main className="min-h-screen bg-muted/40 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardContent className="p-8 space-y-6 text-center">
          <p className="text-xl font-bold text-primary">ShopDrive</p>
          {state === "loading" && <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />}
          {state === "valid" && (
            <>
              <h1 className="text-lg font-semibold text-foreground">
                Cancelar recebimento de comunicações comerciais da ShopDrive
              </h1>
              <Button className="w-full" onClick={confirm} disabled={submitting}>
                {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Cancelar comunicações comerciais
              </Button>
            </>
          )}
          {(state === "done" || state === "already" || state === "invalid") && (
            <p className="text-foreground">{MESSAGES[state]}</p>
          )}
        </CardContent>
      </Card>
    </main>
  );
};

export default EmailUnsubscribe;
