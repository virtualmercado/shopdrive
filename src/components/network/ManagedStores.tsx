import { Store, ChevronDown, Check, ExternalLink } from "lucide-react";
import { useMerchantStore } from "@/hooks/useMerchantStore";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { CreateSecondStore } from "./CreateSecondStore";

export function StoreSwitcher() {
  const { stores, storeId, switchStore, switching } = useMerchantStore();
  if (stores.length < 2) return null;
  return <DropdownMenu><DropdownMenuTrigger asChild><Button variant="outline" disabled={switching} className="gap-2"><Store className="h-4 w-4" />Trocar loja<ChevronDown className="h-4 w-4" /></Button></DropdownMenuTrigger>
    <DropdownMenuContent align="end">{stores.map((store) => <DropdownMenuItem key={store.storeId} onSelect={() => {
      void switchStore(store.storeId).then((ok) => { if (!ok) toast.error("Não foi possível acessar esta loja."); });
    }} className="gap-2">{store.storeId === storeId ? <Check className="h-4 w-4" /> : <Store className="h-4 w-4" />}<span>{store.storeName}</span></DropdownMenuItem>)}</DropdownMenuContent></DropdownMenu>;
}

export function ManagedStores() {
  const { stores, storeId, switchStore, switching } = useMerchantStore();
  if (!stores.length) return null;
  return <section className="space-y-3"><h2 className="text-lg font-semibold">Minhas Lojas</h2>
    <div className="grid gap-4 lg:grid-cols-2">{stores.map((store) => <article key={store.storeId} className="border border-border rounded-lg p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-semibold">{store.storeName}</h3><Badge variant={store.storeId === storeId ? "default" : "secondary"}>{store.storeId === storeId ? "Loja atual" : store.status === "active" ? "Ativa" : store.status}</Badge></div>
      <p className="text-sm text-muted-foreground">{store.storeRole === "primary" ? "Loja principal" : "Loja vinculada"}</p>
      <a className="inline-flex items-start gap-1 text-sm text-primary break-all" href={store.publicUrl} target="_blank" rel="noopener noreferrer">{store.publicUrl}<ExternalLink className="h-3.5 w-3.5 shrink-0 mt-0.5" /></a>
      <p className="text-sm">{store.paidUntil ? `${store.plan.toUpperCase()} até ${new Date(store.paidUntil).toLocaleDateString("pt-BR", { timeZone: "UTC" })} → MARCA` : store.plan.toUpperCase()}</p>
      <Button variant="outline" disabled={switching} onClick={() => { void switchStore(store.storeId).then((ok) => { if (!ok) toast.error("Não foi possível acessar esta loja."); }); }}>Acessar painel</Button>
    </article>)}<CreateSecondStore /></div></section>;
}