import { useState } from "react";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, AlertTriangle, Copy, ExternalLink, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Props {
  subscriber: { id: string; store_name?: string | null; email?: string | null; store_slug?: string | null } | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

type CloneType = "varejo" | "atacado" | "outro";
type Plan = "gratis" | "pro" | "premium" | "same";
type PwdStrategy = "reset_link" | "temporary_password";

const slugify = (v: string) =>
  v.toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim().replace(/\s+/g, "-").replace(/-+/g, "-");

export function CloneStoreModal({ subscriber, open, onOpenChange }: Props) {
  const [newStoreName, setNewStoreName] = useState("");
  const [newSlug, setNewSlug] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [cloneType, setCloneType] = useState<CloneType>("varejo");
  const [plan, setPlan] = useState<Plan>("same");
  const [pwdStrategy, setPwdStrategy] = useState<PwdStrategy>("reset_link");
  const [tempPwd, setTempPwd] = useState("");

  const [copyProducts, setCopyProducts] = useState(true);
  const [copyCategories, setCopyCategories] = useState(true);
  const [copyBrands, setCopyBrands] = useState(true);
  const [copyImages, setCopyImages] = useState(true);
  const [copyAppearance, setCopyAppearance] = useState(true);
  const [copyBanners, setCopyBanners] = useState(true);
  const [copyPersonalization, setCopyPersonalization] = useState(true);
  const [copyShipping, setCopyShipping] = useState(true);
  const [copyCoupons, setCopyCoupons] = useState(false);
  const [copyCustomerGroups, setCopyCustomerGroups] = useState(false);
  const [copyMarketing, setCopyMarketing] = useState(false);
  const [copyPayments, setCopyPayments] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<null | {
    publicUrl: string; email: string; storeName: string; storeSlug: string;
    counts: { products: number; categories: number; brands: number; images: number };
    resetLink: string | null; temporaryPassword: string | null;
  }>(null);

  const reset = () => {
    setNewStoreName(""); setNewSlug(""); setNewEmail("");
    setCloneType("varejo"); setPlan("same"); setPwdStrategy("reset_link"); setTempPwd("");
    setResult(null);
  };

  const handleClose = (v: boolean) => {
    if (!submitting) { if (!v) reset(); onOpenChange(v); }
  };

  const handleSubmit = async () => {
    if (!subscriber) return;
    if (!newStoreName.trim() || !newSlug.trim() || !newEmail.trim()) {
      toast.error("Preencha nome, slug e e-mail.");
      return;
    }
    if (!/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(newSlug)) {
      toast.error("Slug inválido. Use apenas letras minúsculas, números e hífens.");
      return;
    }
    if (!/^\S+@\S+\.\S+$/.test(newEmail)) {
      toast.error("E-mail inválido.");
      return;
    }
    if (pwdStrategy === "temporary_password" && tempPwd.length < 8) {
      toast.error("Senha temporária deve ter pelo menos 8 caracteres.");
      return;
    }

    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("clone-store", {
        body: {
          sourceProfileId: subscriber.id,
          newStoreName: newStoreName.trim(),
          newSlug: newSlug.trim(),
          newEmail: newEmail.trim().toLowerCase(),
          cloneType,
          passwordStrategy: pwdStrategy,
          temporaryPassword: pwdStrategy === "temporary_password" ? tempPwd : undefined,
          plan,
          options: {
            copyProducts, copyCategories, copyBrands, copyImages,
            copyAppearance, copyBanners, copyPersonalization, copyShipping,
            copyCoupons, copyCustomerGroups, copyMarketing, copyPayments,
          },
        },
      });
      if (error) throw error;
      const payload = data as { success: boolean; error?: string; newStore?: any; counts?: any; resetLink?: string | null; temporaryPassword?: string | null };
      if (!payload?.success) throw new Error(payload?.error || "Falha desconhecida");

      setResult({
        publicUrl: payload.newStore.publicUrl,
        email: payload.newStore.email,
        storeName: payload.newStore.storeName,
        storeSlug: payload.newStore.storeSlug,
        counts: payload.counts,
        resetLink: payload.resetLink ?? null,
        temporaryPassword: payload.temporaryPassword ?? null,
      });
      toast.success("Loja duplicada com sucesso!");
    } catch (e: any) {
      const msg = e?.message || "Erro ao duplicar loja";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  if (!subscriber) return null;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Duplicar Loja</DialogTitle>
          <DialogDescription>
            Criar uma nova conta-loja independente baseada em <strong>{subscriber.store_name}</strong>.
          </DialogDescription>
        </DialogHeader>

        {result ? (
          <div className="space-y-4">
            <Alert className="border-green-500 bg-green-50 dark:bg-green-950">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-900 dark:text-green-100">
                Loja <strong>{result.storeName}</strong> criada com sucesso.
              </AlertDescription>
            </Alert>

            <div className="rounded-lg border p-4 space-y-2 text-sm">
              <div><span className="text-muted-foreground">E-mail:</span> {result.email}</div>
              <div><span className="text-muted-foreground">Slug:</span> /{result.storeSlug}</div>
              <div><span className="text-muted-foreground">Produtos:</span> {result.counts.products}</div>
              <div><span className="text-muted-foreground">Categorias:</span> {result.counts.categories}</div>
              <div><span className="text-muted-foreground">Marcas:</span> {result.counts.brands}</div>
              <div><span className="text-muted-foreground">Imagens:</span> {result.counts.images}</div>
            </div>

            {result.temporaryPassword && (
              <Alert>
                <AlertDescription className="font-mono text-sm">
                  Senha temporária: <strong>{result.temporaryPassword}</strong>
                </AlertDescription>
              </Alert>
            )}
            {result.resetLink && (
              <div className="space-y-2">
                <Label>Link de redefinição de senha</Label>
                <div className="flex gap-2">
                  <Input readOnly value={result.resetLink} className="font-mono text-xs" />
                  <Button variant="outline" size="icon"
                    onClick={() => { navigator.clipboard.writeText(result.resetLink!); toast.success("Link copiado"); }}>
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}

            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => window.open(result.publicUrl, "_blank")}>
                <ExternalLink className="h-4 w-4 mr-2" /> Abrir loja pública
              </Button>
              <Button onClick={() => handleClose(false)}>Concluir</Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-5">
            <div className="rounded-lg bg-muted p-3 text-sm space-y-1">
              <div><span className="text-muted-foreground">Loja original:</span> {subscriber.store_name}</div>
              <div><span className="text-muted-foreground">E-mail original:</span> {subscriber.email}</div>
              <div><span className="text-muted-foreground">Slug original:</span> /{subscriber.store_slug}</div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Nome da nova loja *</Label>
                <Input value={newStoreName}
                  onChange={(e) => {
                    setNewStoreName(e.target.value);
                    if (!newSlug) setNewSlug(slugify(e.target.value));
                  }}
                  placeholder="Ex: Aroma Varejo" />
              </div>
              <div className="space-y-2">
                <Label>Slug público *</Label>
                <Input value={newSlug}
                  onChange={(e) => setNewSlug(slugify(e.target.value))}
                  placeholder="aroma-varejo" />
              </div>
              <div className="space-y-2">
                <Label>E-mail de acesso *</Label>
                <Input type="email" value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="aroma.varejo@email.com" />
              </div>
              <div className="space-y-2">
                <Label>Tipo de clone</Label>
                <Select value={cloneType} onValueChange={(v) => setCloneType(v as CloneType)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="varejo">Varejo</SelectItem>
                    <SelectItem value="atacado">Atacado</SelectItem>
                    <SelectItem value="outro">Outro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Plano da nova loja</Label>
                <Select value={plan} onValueChange={(v) => setPlan(v as Plan)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="same">Mesmo da loja original</SelectItem>
                    <SelectItem value="gratis">Grátis</SelectItem>
                    <SelectItem value="pro">Pro</SelectItem>
                    <SelectItem value="premium">Premium</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Estratégia de senha</Label>
                <Select value={pwdStrategy} onValueChange={(v) => setPwdStrategy(v as PwdStrategy)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="reset_link">Enviar link de redefinição (recomendado)</SelectItem>
                    <SelectItem value="temporary_password">Definir senha temporária</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {pwdStrategy === "temporary_password" && (
                <div className="space-y-2 md:col-span-2">
                  <Label>Senha temporária (mín. 8 caracteres)</Label>
                  <Input type="text" value={tempPwd}
                    onChange={(e) => setTempPwd(e.target.value)} />
                </div>
              )}
            </div>

            <div className="space-y-3">
              <Label className="text-base">O que copiar</Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                {[
                  ["Produtos", copyProducts, setCopyProducts],
                  ["Categorias", copyCategories, setCopyCategories],
                  ["Marcas", copyBrands, setCopyBrands],
                  ["Imagens dos produtos", copyImages, setCopyImages],
                  ["Aparência visual", copyAppearance, setCopyAppearance],
                  ["Banners e topbar", copyBanners, setCopyBanners],
                  ["Personalização (textos, redes)", copyPersonalization, setCopyPersonalization],
                  ["Frete", copyShipping, setCopyShipping],
                  ["Cupons", copyCoupons, setCopyCoupons],
                  ["Grupos de clientes", copyCustomerGroups, setCopyCustomerGroups],
                  ["Configurações de marketing", copyMarketing, setCopyMarketing],
                ].map(([label, val, set]) => (
                  <label key={label as string} className="flex items-center gap-2 cursor-pointer">
                    <Checkbox checked={val as boolean}
                      onCheckedChange={(c) => (set as (v: boolean) => void)(!!c)} />
                    <span>{label as string}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="space-y-2 rounded-lg border border-amber-500/40 bg-amber-50 dark:bg-amber-950/30 p-3">
              <label className="flex items-center gap-2 cursor-pointer text-sm font-medium">
                <Checkbox checked={copyPayments}
                  onCheckedChange={(c) => setCopyPayments(!!c)} />
                <span>Copiar configurações de pagamento (gateways)</span>
              </label>
              {copyPayments && (
                <Alert variant="default" className="border-amber-500">
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                  <AlertDescription className="text-xs">
                    Atenção: credenciais e tokens de gateways serão copiados. Revise webhooks
                    e referências antes de transacionar na loja clonada.
                  </AlertDescription>
                </Alert>
              )}
            </div>

            <Alert>
              <AlertDescription className="text-xs">
                Pedidos, clientes, histórico financeiro, mensagens e avaliações <strong>não</strong> serão copiados.
                A loja clonada começa com histórico limpo.
              </AlertDescription>
            </Alert>

            <DialogFooter>
              <Button variant="outline" onClick={() => handleClose(false)} disabled={submitting}>
                Cancelar
              </Button>
              <Button onClick={handleSubmit} disabled={submitting}>
                {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Duplicar loja
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
