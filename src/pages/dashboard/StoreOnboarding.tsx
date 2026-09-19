import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  Loader2,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  Store,
  Palette,
  Upload,
  Image as ImageIcon,
  FolderTree,
  Package,
  ClipboardCheck,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useStoreOnboarding, ONBOARDING_STEPS } from "@/hooks/useStoreOnboarding";
import { useOnboardingFlags } from "@/hooks/useOnboardingFlags";
import ShowcaseStep from "@/components/onboarding/ShowcaseStep";
import CategoriesStep from "@/components/onboarding/CategoriesStep";
import ProductsStep from "@/components/onboarding/ProductsStep";
import ReviewStep from "@/components/onboarding/ReviewStep";
import { toast } from "sonner";

type StepKey = "company" | "visual" | "showcase" | "categories" | "products" | "review";

const UI_STEPS: { key: StepKey; label: string; icon: typeof Store }[] = [
  { key: "company", label: "Empresa", icon: Store },
  { key: "visual", label: "Identidade visual", icon: Palette },
  { key: "showcase", label: "Vitrine", icon: ImageIcon },
  { key: "categories", label: "Categorias", icon: FolderTree },
  { key: "products", label: "Produtos", icon: Package },
  { key: "review", label: "Revisão", icon: ClipboardCheck },
];

const COMPANY_FIELDS = [
  "store_name",
  "store_category",
  "store_description",
  "city",
  "whatsapp_number",
  "instagram_url",
  "phone",
] as const;

const VISUAL_FIELDS = ["store_logo_url", "primary_color", "secondary_color"] as const;

// Passo salvo no estado -> passo da interface (retomada do ponto salvo)
const RESUME_MAP: Record<string, StepKey> = {
  company: "company",
  contacts: "company",
  visual: "visual",
  banner: "showcase",
  categories: "categories",
  products: "products",
  navigation: "review",
  institutional: "review",
};

const StoreOnboarding = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { flags, loading: flagsLoading } = useOnboardingFlags();
  const { state, loading: stateLoading, recompute, logEvent } = useStoreOnboarding();

  const [step, setStep] = useState<StepKey>("company");
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [storeSlug, setStoreSlug] = useState<string | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const resumed = useRef(false);
  const recomputedOnMount = useRef(false);

  // Carrega dados reais já existentes no perfil da loja
  useEffect(() => {
    if (!user?.id) return;
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select(
          "store_slug, store_name, store_category, store_description, city, whatsapp_number, instagram_url, phone, store_logo_url, primary_color, secondary_color"
        )
        .eq("id", user.id)
        .maybeSingle();
      setStoreSlug(data?.store_slug ?? null);
      setForm({
        store_name: data?.store_name ?? "",
        store_category: data?.store_category ?? "",
        store_description: data?.store_description ?? "",
        city: data?.city ?? "",
        whatsapp_number: data?.whatsapp_number ?? "",
        instagram_url: data?.instagram_url ?? "",
        phone: data?.phone ?? "",
        store_logo_url: data?.store_logo_url ?? "",
        primary_color: data?.primary_color ?? "#000000",
        secondary_color: data?.secondary_color ?? "#ffffff",
      });
      setLoaded(true);
    })();
  }, [user?.id]);

  // Recalcula o progresso ao abrir (pega alterações feitas em Produtos/Categorias)
  useEffect(() => {
    if (!user?.id || recomputedOnMount.current) return;
    recomputedOnMount.current = true;
    void recompute();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // Retoma do ponto salvo
  useEffect(() => {
    if (resumed.current || !state) return;
    resumed.current = true;
    if (state.onboarding_completed) {
      setStep("review");
      return;
    }
    const resume = state.current_step ? RESUME_MAP[state.current_step] : undefined;
    if (resume) setStep(resume);
  }, [state]);

  const persist = async (patch: Record<string, string>) => {
    if (!user?.id) return;
    setSaving(true);
    const payload: Record<string, string | null> = {};
    Object.entries(patch).forEach(([k, v]) => {
      payload[k] = v.trim() === "" ? null : v;
    });
    const { error } = await supabase
      .from("profiles")
      .update(payload as never)
      .eq("id", user.id);
    setSaving(false);
    if (error) {
      toast.error("Não foi possível salvar agora. Tente novamente.");
      return;
    }
    await recompute();
  };

  const setField = (key: string, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      persist({ [key]: value });
    }, 900);
  };

  const goTo = async (next: StepKey) => {
    if (step === "company" || step === "visual") {
      const keys = step === "company" ? COMPANY_FIELDS : VISUAL_FIELDS;
      const patch: Record<string, string> = {};
      keys.forEach((k) => (patch[k] = form[k] ?? ""));
      await persist(patch);
    }
    await logEvent("step_completed", step);
    setStep(next);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleLogoUpload = async (file: File) => {
    if (!user?.id) return;
    setUploading(true);
    const ext = file.name.split(".").pop()?.toLowerCase() || "png";
    const path = `${user.id}/logo/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("media").upload(path, file, { upsert: true });
    if (error) {
      setUploading(false);
      toast.error("Não foi possível enviar a logo. Use a página Personalizar para enviá-la.");
      return;
    }
    const { data } = supabase.storage.from("media").getPublicUrl(path);
    setForm((prev) => ({ ...prev, store_logo_url: data.publicUrl }));
    await persist({ store_logo_url: data.publicUrl });
    setUploading(false);
    toast.success("Logo atualizada!");
  };

  const progress = state?.progress_percent ?? 0;
  const stepsStatus = state?.steps_status ?? {};

  const checklist = useMemo(
    () =>
      ONBOARDING_STEPS.map((s) => ({
        ...s,
        done: !!stepsStatus?.[s.key]?.done,
      })),
    [stepsStatus]
  );

  const stepIndex = UI_STEPS.findIndex((s) => s.key === step);

  if (flagsLoading || stateLoading || !loaded) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  if (!flags.ENABLE_STORE_ONBOARDING) {
    return (
      <DashboardLayout>
        <Card>
          <CardContent className="py-10 text-center space-y-4">
            <p className="text-muted-foreground">
              A configuração guiada da loja não está disponível no momento.
            </p>
            <Button onClick={() => navigate("/lojista")}>Voltar ao painel</Button>
          </CardContent>
        </Card>
      </DashboardLayout>
    );
  }

  const StepIcon = UI_STEPS[Math.max(0, stepIndex)].icon;

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-3xl">
        <div>
          <h1 className="text-2xl font-bold">Configuração guiada da loja</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Passos curtos para deixar sua loja pública pronta para vender. Tudo é salvo automaticamente.
          </p>
        </div>

        <Card>
          <CardContent className="pt-6 space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">Progresso da loja</span>
              <span className="font-semibold">{progress}%</span>
            </div>
            <Progress value={progress} />
            <div className="flex flex-wrap gap-2 pt-1">
              {checklist.map((c) => (
                <Badge key={c.key} variant={c.done ? "default" : "outline"} className="gap-1">
                  {c.done && <CheckCircle2 className="h-3 w-3" />}
                  {c.label}
                </Badge>
              ))}
            </div>
            {saving && (
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Loader2 className="h-3 w-3 animate-spin" /> Salvando...
              </p>
            )}
          </CardContent>
        </Card>

        <div className="flex flex-wrap gap-2">
          {UI_STEPS.map((s, i) => (
            <Button
              key={s.key}
              size="sm"
              variant={step === s.key ? "default" : "outline"}
              onClick={() => setStep(s.key)}
            >
              {i + 1}. {s.label}
            </Button>
          ))}
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <StepIcon className="h-5 w-5 text-primary" /> Passo {stepIndex + 1} —{" "}
              {UI_STEPS[Math.max(0, stepIndex)].label}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {step === "company" && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="store_name">Nome da loja *</Label>
                  <Input
                    id="store_name"
                    value={form.store_name ?? ""}
                    onChange={(e) => setField("store_name", e.target.value)}
                  />
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="store_category">Segmento</Label>
                    <Input
                      id="store_category"
                      placeholder="Ex: Moda e Acessórios"
                      value={form.store_category ?? ""}
                      onChange={(e) => setField("store_category", e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="city">Cidade / região</Label>
                    <Input
                      id="city"
                      value={form.city ?? ""}
                      onChange={(e) => setField("city", e.target.value)}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="store_description">Descrição da loja e diferenciais</Label>
                  <Textarea
                    id="store_description"
                    rows={4}
                    placeholder="Conte o que você vende, para quem vende e o que torna sua loja diferente."
                    value={form.store_description ?? ""}
                    onChange={(e) => setField("store_description", e.target.value)}
                  />
                </div>
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor="whatsapp_number">WhatsApp</Label>
                    <Input
                      id="whatsapp_number"
                      value={form.whatsapp_number ?? ""}
                      onChange={(e) => setField("whatsapp_number", e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Telefone</Label>
                    <Input
                      id="phone"
                      value={form.phone ?? ""}
                      onChange={(e) => setField("phone", e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="instagram_url">Instagram</Label>
                    <Input
                      id="instagram_url"
                      placeholder="https://instagram.com/sualoja"
                      value={form.instagram_url ?? ""}
                      onChange={(e) => setField("instagram_url", e.target.value)}
                    />
                  </div>
                </div>
              </>
            )}

            {step === "visual" && (
              <>
                <div className="space-y-2">
                  <Label>Logo da loja</Label>
                  <div className="flex items-center gap-4">
                    {form.store_logo_url ? (
                      <img
                        src={form.store_logo_url}
                        alt="Logo da loja"
                        className="h-16 w-16 rounded border object-contain bg-muted"
                      />
                    ) : (
                      <div className="h-16 w-16 rounded border flex items-center justify-center text-muted-foreground text-xs">
                        sem logo
                      </div>
                    )}
                    <div>
                      <input
                        id="logo-input"
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleLogoUpload(file);
                        }}
                      />
                      <Button
                        variant="outline"
                        onClick={() => document.getElementById("logo-input")?.click()}
                        disabled={uploading}
                      >
                        {uploading ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <Upload className="mr-2 h-4 w-4" />
                        )}
                        {form.store_logo_url ? "Substituir logo" : "Enviar logo"}
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="primary_color">Cor principal</Label>
                    <div className="flex gap-2">
                      <Input
                        type="color"
                        className="w-14 p-1"
                        value={form.primary_color || "#000000"}
                        onChange={(e) => setField("primary_color", e.target.value)}
                      />
                      <Input
                        id="primary_color"
                        value={form.primary_color ?? ""}
                        onChange={(e) => setField("primary_color", e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="secondary_color">Cor secundária</Label>
                    <div className="flex gap-2">
                      <Input
                        type="color"
                        className="w-14 p-1"
                        value={form.secondary_color || "#ffffff"}
                        onChange={(e) => setField("secondary_color", e.target.value)}
                      />
                      <Input
                        id="secondary_color"
                        value={form.secondary_color ?? ""}
                        onChange={(e) => setField("secondary_color", e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              </>
            )}

            {step === "showcase" && user?.id && (
              <ShowcaseStep storeId={user.id} onChanged={recompute} />
            )}

            {step === "categories" && user?.id && (
              <CategoriesStep storeId={user.id} onChanged={recompute} />
            )}

            {step === "products" && user?.id && <ProductsStep storeId={user.id} />}

            {step === "review" && (
              <ReviewStep state={state} storeSlug={storeSlug} onCompleted={recompute} />
            )}

            <div className="flex justify-between border-t pt-4">
              <Button
                variant="outline"
                disabled={stepIndex <= 0}
                onClick={() => setStep(UI_STEPS[Math.max(0, stepIndex - 1)].key)}
              >
                <ArrowLeft className="mr-2 h-4 w-4" /> Voltar
              </Button>
              {stepIndex < UI_STEPS.length - 1 ? (
                <Button onClick={() => goTo(UI_STEPS[stepIndex + 1].key)} disabled={saving}>
                  Continuar <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              ) : (
                <Button variant="outline" onClick={() => navigate("/lojista")}>
                  Voltar ao painel
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default StoreOnboarding;
