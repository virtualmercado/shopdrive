import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Upload, Sparkles, Check, RefreshCw, Trash2, Info } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAiBannerGeneration } from "@/hooks/useAiBannerGeneration";
import MainBannerContentEditor from "@/components/customize/MainBannerContentEditor";
import {
  EMPTY_MAIN_BANNER_CONTENT,
  MAIN_BANNER_MAX_SLIDES,
  normalizeMainBannerContent,
  type MainBannerSlideContent,
} from "@/lib/mainBannerContent";
import { MAX_TOTAL_BANNERS } from "@/lib/defaultBanners";

const OBJECTIVES = [
  { value: "apresentar_loja", label: "Apresentar minha loja" },
  { value: "destacar_produtos", label: "Destacar meus produtos" },
  { value: "divulgar_categoria", label: "Divulgar uma categoria" },
  { value: "institucional", label: "Campanha institucional" },
  { value: "promocao", label: "Promoção" },
  { value: "outro", label: "Outro" },
];

interface ShowcaseStepProps {
  storeId: string;
  onChanged: () => void | Promise<unknown>;
}

const ShowcaseStep = ({ storeId, onChanged }: ShowcaseStepProps) => {
  const [loading, setLoading] = useState(true);
  const [desktop, setDesktop] = useState<string[]>([]);
  const [mobile, setMobile] = useState<string[]>([]);
  const [content, setContent] = useState<MainBannerSlideContent[]>([]);
  const [slideIndex, setSlideIndex] = useState(0);
  const [uploading, setUploading] = useState<"desktop" | "mobile" | null>(null);
  const [savingContent, setSavingContent] = useState(false);
  const [objective, setObjective] = useState("apresentar_loja");
  const [guidance, setGuidance] = useState("");
  const contentTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const ai = useAiBannerGeneration(storeId);

  const load = async () => {
    const { data } = await supabase
      .from("profiles")
      .select("banner_desktop_urls, banner_mobile_urls, main_banner_content")
      .eq("id", storeId)
      .maybeSingle();
    const d = Array.isArray(data?.banner_desktop_urls) ? (data!.banner_desktop_urls as string[]) : [];
    const m = Array.isArray(data?.banner_mobile_urls) ? (data!.banner_mobile_urls as string[]) : [];
    setDesktop(d);
    setMobile(m);
    setContent(normalizeMainBannerContent(data?.main_banner_content));
    setLoading(false);
  };

  useEffect(() => {
    void load();
    void ai.loadStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeId]);

  const uploadBanner = async (file: File, variant: "desktop" | "mobile") => {
    const field = variant === "desktop" ? "banner_desktop_urls" : "banner_mobile_urls";
    const current = variant === "desktop" ? desktop : mobile;
    const max = variant === "desktop" ? MAX_TOTAL_BANNERS : 3;
    if (current.length >= max) {
      toast.error(`Você já tem ${max} banners de ${variant === "desktop" ? "computador" : "celular"}. Remova um em Personalizar.`);
      return;
    }
    setUploading(variant);
    const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const path = `${storeId}/${field}_${Date.now()}.${ext}`;
    const { error: upError } = await supabase.storage
      .from("product-images")
      .upload(path, file, { upsert: true });
    if (upError) {
      setUploading(null);
      toast.error("Não foi possível enviar a imagem. Tente novamente.");
      return;
    }
    const url = supabase.storage.from("product-images").getPublicUrl(path).data.publicUrl;
    const next = [...current, url];
    const { error } = await supabase
      .from("profiles")
      .update({ [field]: next, [variant === "desktop" ? "banner_desktop_url" : "banner_mobile_url"]: null } as never)
      .eq("id", storeId);
    setUploading(null);
    if (error) {
      toast.error("Não foi possível salvar o banner.");
      return;
    }
    if (variant === "desktop") setDesktop(next);
    else setMobile(next);
    await onChanged();
    toast.success("Banner adicionado!");
  };

  const saveContent = async (list: MainBannerSlideContent[]) => {
    setSavingContent(true);
    const { error } = await supabase
      .from("profiles")
      .update({ main_banner_content: list as never })
      .eq("id", storeId);
    setSavingContent(false);
    if (error) toast.error("Não foi possível salvar o texto do banner.");
  };

  const updateSlideContent = (value: MainBannerSlideContent) => {
    const list = [...content];
    while (list.length <= slideIndex) list.push({ ...EMPTY_MAIN_BANNER_CONTENT });
    list[slideIndex] = value;
    setContent(list);
    if (contentTimer.current) clearTimeout(contentTimer.current);
    contentTimer.current = setTimeout(() => void saveContent(list), 900);
  };

  const handleGenerate = async () => {
    try {
      await ai.generate(objective, guidance);
      toast.success("Imagens criadas! Confira a prévia antes de aplicar.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível criar a imagem.");
    }
  };

  const handleApply = async () => {
    try {
      await ai.apply();
      await load();
      await onChanged();
      await ai.loadStatus();
      toast.success("Banner aplicado na sua loja!");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível aplicar o banner.");
    }
  };

  const handleDiscard = async () => {
    try {
      await ai.discard();
      toast.success("Imagens descartadas. Seu banner atual não foi alterado.");
    } catch {
      toast.error("Não foi possível descartar agora.");
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-10">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
      </div>
    );
  }

  const hasBanner = desktop.length > 0 || mobile.length > 0;
  const aiEnabled = !!ai.status?.ai_image_enabled;
  const remaining = ai.status?.remaining ?? 0;

  return (
    <div className="space-y-6">
      {hasBanner ? (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Badge variant="default" className="gap-1">
              <Check className="h-3 w-3" /> Banner configurado
            </Badge>
            <span className="text-xs text-muted-foreground">
              Seus banners atuais continuam como estão. Você pode adicionar outro sem perder nenhum.
            </span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {desktop.map((url, i) => (
              <img
                key={url + i}
                src={url}
                alt={`Banner ${i + 1}`}
                className="aspect-[1920/680] w-full rounded-md border object-cover"
              />
            ))}
          </div>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          Sua loja ainda não tem banner principal. Envie sua própria imagem ou crie uma com a ajuda da ShopDrive.
        </p>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardContent className="pt-6 space-y-3">
            <h3 className="font-medium">Enviar minha imagem</h3>
            <p className="text-xs text-muted-foreground">
              Computador: 1920x680. Celular: 800x1000.
            </p>
            <div className="flex flex-wrap gap-2">
              <input
                id="banner-desktop-input"
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void uploadBanner(f, "desktop");
                  e.currentTarget.value = "";
                }}
              />
              <input
                id="banner-mobile-input"
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void uploadBanner(f, "mobile");
                  e.currentTarget.value = "";
                }}
              />
              <Button
                variant="outline"
                disabled={uploading !== null}
                onClick={() => document.getElementById("banner-desktop-input")?.click()}
              >
                {uploading === "desktop" ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="mr-2 h-4 w-4" />
                )}
                Computador
              </Button>
              <Button
                variant="outline"
                disabled={uploading !== null}
                onClick={() => document.getElementById("banner-mobile-input")?.click()}
              >
                {uploading === "mobile" ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="mr-2 h-4 w-4" />
                )}
                Celular
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6 space-y-3">
            <h3 className="font-medium flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" /> Criar imagem com ajuda da ShopDrive
            </h3>
            {!aiEnabled ? (
              <p className="text-xs text-muted-foreground flex gap-2">
                <Info className="h-4 w-4 shrink-0" />
                A criação automática de imagens está em teste e ainda não foi liberada para a sua loja. Você pode enviar sua própria imagem acima.
              </p>
            ) : (
              <>
                <div className="space-y-2">
                  <Label>Qual o objetivo deste banner?</Label>
                  <Select value={objective} onValueChange={setObjective}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {OBJECTIVES.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ai-guidance">Quer dar alguma orientação? (opcional)</Label>
                  <Textarea
                    id="ai-guidance"
                    rows={2}
                    maxLength={400}
                    placeholder="Ex: clima natural, tons de verde, luz suave"
                    value={guidance}
                    onChange={(e) => setGuidance(e.target.value)}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  A imagem é criada sem textos: os títulos e botões são escritos abaixo pela própria ShopDrive.
                  Restam {remaining} de {ai.status?.quota_24h ?? 3} criações nas próximas 24 horas.
                </p>
                <Button onClick={handleGenerate} disabled={ai.busy || remaining <= 0}>
                  {ai.busy ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Sparkles className="mr-2 h-4 w-4" />
                  )}
                  Criar imagens
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {ai.generation && (
        <Card className="border-primary/40">
          <CardContent className="pt-6 space-y-4">
            <div>
              <h3 className="font-medium">Prévia — nada foi aplicado na sua loja ainda</h3>
              <p className="text-xs text-muted-foreground">
                Confira as duas versões e escolha o que fazer.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-[2fr_1fr]">
              <div className="space-y-1">
                <span className="text-xs text-muted-foreground">Computador (1920x680)</span>
                <img src={ai.generation.desktop_url} alt="Prévia computador" className="w-full rounded-md border" />
              </div>
              <div className="space-y-1">
                <span className="text-xs text-muted-foreground">Celular (800x1000)</span>
                <img src={ai.generation.mobile_url} alt="Prévia celular" className="w-full rounded-md border" />
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={handleApply} disabled={ai.busy}>
                {ai.busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
                Aplicar
              </Button>
              <Button variant="outline" onClick={handleGenerate} disabled={ai.busy || remaining <= 0}>
                <RefreshCw className="mr-2 h-4 w-4" /> Gerar novamente
              </Button>
              <Button variant="ghost" onClick={handleDiscard} disabled={ai.busy}>
                <Trash2 className="mr-2 h-4 w-4" /> Descartar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {desktop.length > 0 && (
        <Card>
          <CardContent className="pt-6 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-medium">Texto sobre o banner (opcional)</h3>
              {savingContent && (
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Loader2 className="h-3 w-3 animate-spin" /> Salvando...
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Se você não preencher nada, o banner continua aparecendo apenas como imagem.
            </p>
            {desktop.length > 1 && (
              <div className="flex flex-wrap gap-2">
                {desktop.slice(0, MAIN_BANNER_MAX_SLIDES).map((_, i) => (
                  <Button
                    key={i}
                    size="sm"
                    variant={slideIndex === i ? "default" : "outline"}
                    onClick={() => setSlideIndex(i)}
                  >
                    Banner {i + 1}
                  </Button>
                ))}
              </div>
            )}
            <MainBannerContentEditor
              imageUrl={desktop[slideIndex] ?? desktop[0]}
              slideIndex={slideIndex}
              value={content[slideIndex] ?? { ...EMPTY_MAIN_BANNER_CONTENT }}
              onChange={updateSlideContent}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default ShowcaseStep;
