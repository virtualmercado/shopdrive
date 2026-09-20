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
  Image as ImageIcon,
  FolderTree,
  Package,
  ClipboardCheck,
  Sparkles,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useStoreOnboarding, ONBOARDING_STEPS } from "@/hooks/useStoreOnboarding";
import { useOnboardingFlags } from "@/hooks/useOnboardingFlags";
import ShowcaseStep from "@/components/onboarding/ShowcaseStep";
import CategoriesStep from "@/components/onboarding/CategoriesStep";
import ProductsStep from "@/components/onboarding/ProductsStep";
import ReviewStep from "@/components/onboarding/ReviewStep";
import IdentityRecommendationStep, {
  type BrandRecommendation,
} from "@/components/onboarding/IdentityRecommendationStep";
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

// Campos públicos do perfil editados no Passo 1.
// store_description NÃO é editado aqui: é o slogan público do rodapé,
// gerenciado apenas no menu Personalizar.
const COMPANY_FIELDS = [
  "store_name",
  "store_category",
  "city",
  "whatsapp_number",
  "instagram_url",
  "phone",
] as const;

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

const CONTEXT_HINTS = [
  "o que você vende",
  "quem são seus clientes",
  "estilo dos produtos",
  "faixa de preço/posicionamento",
  "seus diferenciais",
  "região de atuação",
  "ocasiões de compra",
  "a imagem que quer transmitir",
];

function contextQuality(text: string) {
  const clean = text.trim();
  const words = clean ? clean.split(/\s+/).length : 0;
  if (clean.length < 80 || words < 15) return { label: "Pouco detalhado", tone: "outline" as const };
  if (clean.length < 200) return { label: "Bom nível de detalhes", tone: "secondary" as const };
  return { label: "Ótimo contexto para personalização", tone: "default" as const };
}

const StoreOnboarding = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { flags, loading: flagsLoading } = useOnboardingFlags();
  const { state, loading: stateLoading, recompute, refetch, logEvent } = useStoreOnboarding();

  const [step, setStep] = useState<StepKey>("company");
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [storeSlug, setStoreSlug] = useState<string | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const [businessContext, setBusinessContext] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [recommendation, setRecommendation] = useState<BrandRecommendation | null>(null);
  const [contextHash, setContextHash] = useState<string | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const contextTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const resumed = useRef(false);
  const recomputedOnMount = useRef(false);
  const contextLoaded = useRef(false);

  useEffect(() => {
    if (!user?.id) return;
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select(
          "store_slug, store_name, store_category, city, whatsapp_number, instagram_url, phone, store_logo_url"
        )
        .eq("id", user.id)
        .maybeSingle();
      setStoreSlug(data?.store_slug ?? null);
      setForm({
        store_name: data?.store_name ?? "",
        store_category: data?.store_category ?? "",
        city: data?.city ?? "",
        whatsapp_number: data?.whatsapp_number ?? "",
        instagram_url: data?.instagram_url ?? "",
        phone: data?.phone ?? "",
        store_logo_url: data?.store_logo_url ?? "",
      });
      setLoaded(true);
    })();
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id || recomputedOnMount.current) return;
    recomputedOnMount.current = true;
    void recompute();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // Carrega o contexto do negócio e a recomendação já salvos
  useEffect(() => {
    if (!state || contextLoaded.current) return;
    contextLoaded.current = true;
    setBusinessContext(state.business_context ?? "");
    setContextHash(state.context_hash ?? null);
    if (state.brand_profile) setRecommendation(state.brand_profile as BrandRecommendation);
  }, [state]);

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

  // Contexto do negócio: uso interno (IA). Nunca vai para a loja pública.
  const saveBusinessContext = async (value: string) => {
    if (!user?.id) return;
    setSaving(true);
    const { error } = await supabase.rpc("set_onboarding_business_context", {
      p_store_id: user.id,
      p_business_context: value,
    });
    setSaving(false);
    if (error) toast.error("Não foi possível salvar o contexto do negócio agora.");
  };

  const setContext = (value: string) => {
    setBusinessContext(value);
    if (contextTimer.current) clearTimeout(contextTimer.current);
    contextTimer.current = setTimeout(() => void saveBusinessContext(value), 900);
  };

  const analyze = async (force = false) => {
    if (!user?.id) return;
    setAnalyzing(true);
    try {
      const { data, error } = await supabase.functions.invoke("analyze-store-brand-profile", {
        body: { store_id: user.id, force },
      });
      if (error) throw error;
      if (data?.brand_profile) {
        setRecommendation(data.brand_profile as BrandRecommendation);
        setContextHash(data.context_hash ?? null);
      }
      await refetch();
    } catch {
      // A configuração continua utilizável mesmo sem a análise.
      toast.error("Não conseguimos gerar a sugestão agora. Você pode escolher manualmente no Passo 2.");
    } finally {
      setAnalyzing(false);
    }
  };

  const goTo = async (next: StepKey) => {
    if (step === "company") {
      const patch: Record<string, string> = {};
      COMPANY_FIELDS.forEach((k) => (patch[k] = form[k] ?? ""));
      await persist(patch);
      if (contextTimer.current) clearTimeout(contextTimer.current);
      await saveBusinessContext(businessContext);
      await logEvent("step_completed", step);
      setStep(next);
      window.scrollTo({ top: 0, behavior: "smooth" });
      void analyze(false);
      return;
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

  const quality = contextQuality(businessContext);
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
            Passos simples para deixar sua loja pública completa, organizada e com uma identidade
            profissional. Tudo é salvo automaticamente.
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

                <div className="space-y-3 rounded-lg border-2 border-primary/30 bg-primary/5 p-4">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-primary" />
                    <Label htmlFor="business_context" className="text-base">
                      Conte para a ShopDrive sobre o seu negócio
                    </Label>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Quanto mais detalhes você informar, melhor a ShopDrive poderá escolher as cores, o
                    estilo visual, o layout e criar imagens adequadas ao seu negócio. Este texto é de
                    uso interno: ele não aparece na sua loja pública.
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Se fizer sentido, fale sobre: {CONTEXT_HINTS.join(", ")}.
                  </p>
                  <Textarea
                    id="business_context"
                    rows={6}
                    placeholder="Ex: Vendo tênis esportivos masculinos e femininos para quem treina e busca conforto no dia a dia. Atendo Manaus e região, com preços acessíveis e atendimento pelo WhatsApp."
                    value={businessContext}
                    onChange={(e) => setContext(e.target.value)}
                  />
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <Badge variant={quality.tone}>{quality.label}</Badge>
                    <span className="text-xs text-muted-foreground">
                      {businessContext.trim().length} caracteres — recomendamos de 150 a 300 ou mais.
                    </span>
                  </div>
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

            {step === "visual" && user?.id && (
              <IdentityRecommendationStep
                storeId={user.id}
                logoUrl={form.store_logo_url ?? ""}
                uploading={uploading}
                onLogoUpload={handleLogoUpload}
                recommendation={recommendation}
                analyzing={analyzing}
                contextHash={contextHash}
                appliedPaletteId={state?.applied_palette_id ?? null}
                appliedLayoutId={state?.applied_layout_id ?? null}
                onReanalyze={() => void analyze(true)}
                onApplied={async () => {
                  await recompute();
                  await refetch();
                }}
              />
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
