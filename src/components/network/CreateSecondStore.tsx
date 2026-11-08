import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Lock, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useMerchantStore } from "@/hooks/useMerchantStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  MARCA_LIMIT_MESSAGE, parseSlots, resolveCreationResponse, secondStoreSchema, slotView, type CreationOutcome,
} from "@/lib/marcaSecondStore";

const keyName = (actor: string) => `shopdrive_marca_second_store_key:${actor}`;
function idempotencyKey(actor: string, rotate = false) {
  try {
    const saved = sessionStorage.getItem(keyName(actor));
    if (saved && !rotate) return saved;
    const next = crypto.randomUUID();
    sessionStorage.setItem(keyName(actor), next);
    return next;
  } catch { return crypto.randomUUID(); }
}
const clearKey = (actor: string) => { try { sessionStorage.removeItem(keyName(actor)); } catch { /* optional */ } };

async function requestCreation(body: Record<string, string>): Promise<CreationOutcome> {
  const { data, error } = await supabase.functions.invoke("create-marca-second-store", { body });
  if (!error) return resolveCreationResponse(data);
  const context = (error as { context?: Response }).context;
  const parsed = context && typeof context.json === "function" ? await context.json().catch(() => null) : null;
  return resolveCreationResponse(parsed);
}

export function CreateSecondStore() {
  const { actorId, refreshStores } = useMerchantStore();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ ownerName: "", email: "", storeName: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const busy = useRef(false);
  const slotsQuery = useQuery({
    queryKey: ["marca-store-slots", actorId],
    enabled: !!actorId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_my_marca_store_slots" as never);
      if (error) throw error;
      return parseSlots(data);
    },
  });
  const view = slotView(slotsQuery.data ?? null);
  if (!actorId || view === "hidden") return null;

  const refresh = async () => {
    await Promise.all([refreshStores(), queryClient.invalidateQueries({ queryKey: ["marca-store-slots", actorId] })]);
  };

  const submit = async () => {
    if (busy.current) return;
    const parsed = secondStoreSchema.safeParse(form);
    if (!parsed.success) {
      setErrors(Object.fromEntries(parsed.error.issues.map((i) => [String(i.path[0]), i.message])));
      return;
    }
    setErrors({});
    busy.current = true; setSubmitting(true);
    try {
      const body = { ...parsed.data, idempotencyKey: idempotencyKey(actorId) } as Record<string, string>;
      let outcome = await requestCreation(body);
      // Same key: the server returns the same request's state, never a second store.
      for (let i = 0; outcome.kind === "in_progress" && i < 10; i++) {
        await new Promise((r) => setTimeout(r, 3000));
        outcome = await requestCreation(body);
      }
      if (outcome.kind === "completed") {
        clearKey(actorId);
        await refresh();
        setOpen(false); setForm({ ownerName: "", email: "", storeName: "" });
        toast.success(outcome.accessEmailSent
          ? "Loja criada. O responsável receberá um e-mail para definir a senha."
          : "Loja criada. O responsável deve usar \"Esqueci minha senha\" para definir o acesso.");
      } else if (outcome.kind === "limit_reached") {
        clearKey(actorId);
        await refresh();
        setOpen(false);
        toast.error(MARCA_LIMIT_MESSAGE);
      } else if (outcome.kind === "in_progress") {
        toast.info("A criação da loja ainda está em andamento. Atualize a página em instantes.");
        await refresh();
      } else {
        if (outcome.rotateKey) idempotencyKey(actorId, true);
        toast.error(outcome.message);
      }
    } finally { busy.current = false; setSubmitting(false); }
  };

  if (view === "limit") {
    return <article className="border border-dashed border-border rounded-lg p-4 flex flex-col items-start justify-center gap-3 min-h-40">
      <Button variant="outline" disabled aria-disabled="true" className="gap-2"><Lock className="h-4 w-4" />Criar segunda loja</Button>
      <p className="text-sm text-muted-foreground">{MARCA_LIMIT_MESSAGE}</p>
    </article>;
  }

  return <article className="border border-dashed border-border rounded-lg p-4 flex flex-col items-start justify-center gap-3 min-h-40">
    {view === "pending"
      ? <><Button variant="outline" disabled className="gap-2"><Loader2 className="h-4 w-4 animate-spin" />Criação em andamento</Button>
          <p className="text-sm text-muted-foreground">A segunda loja está sendo criada.</p></>
      : <><Button className="gap-2" onClick={() => setOpen(true)}><Plus className="h-4 w-4" />Criar segunda loja</Button>
          <p className="text-sm text-muted-foreground">Seu Plano MARCA inclui uma segunda loja independente.</p></>}
    <Dialog open={open} onOpenChange={(next) => { if (!submitting) setOpen(next); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Criar segunda loja</DialogTitle>
          <DialogDescription>A nova loja nasce vazia, com conta própria e endereço próprio na ShopDrive. Nenhum dado da loja atual é copiado.</DialogDescription>
        </DialogHeader>
        <form noValidate className="space-y-4" onSubmit={(e) => { e.preventDefault(); void submit(); }}>
          {([
            ["ownerName", "Nome do responsável", "text"],
            ["email", "E-mail da conta da nova loja", "email"],
            ["storeName", "Nome da loja", "text"],
          ] as const).map(([field, label, type]) => <div key={field} className="space-y-1.5">
            <Label htmlFor={`second-store-${field}`}>{label}</Label>
            <Input id={`second-store-${field}`} type={type} value={form[field]} disabled={submitting} maxLength={field === "email" ? 255 : 100}
              onChange={(e) => setForm((f) => ({ ...f, [field]: e.target.value }))} />
            {errors[field] && <p className="text-sm text-destructive">{errors[field]}</p>}
          </div>)}
          <p className="text-xs text-muted-foreground">Use um e-mail diferente do seu. O responsável receberá um e-mail para definir a senha da nova loja.</p>
          <DialogFooter>
            <Button type="button" variant="outline" disabled={submitting} onClick={() => setOpen(false)}>Cancelar</Button>
            <Button type="submit" disabled={submitting} className="gap-2">{submitting && <Loader2 className="h-4 w-4 animate-spin" />}Criar loja</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  </article>;
}
