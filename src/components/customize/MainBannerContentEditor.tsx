import { AlignCenter, AlignLeft, AlignRight } from "lucide-react";
import HeroBannerSlide from "@/components/store/HeroBannerSlide";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";
import {
  EMPTY_MAIN_BANNER_CONTENT,
  HEX_COLOR_PATTERN,
  isSafeBannerUrl,
  type MainBannerSlideContent,
} from "@/lib/mainBannerContent";

interface MainBannerContentEditorProps {
  imageUrl: string;
  slideIndex: number;
  value?: MainBannerSlideContent;
  onChange: (value: MainBannerSlideContent) => void;
}

const ColorField = ({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) => (
  <div className="space-y-2">
    <Label>{label}</Label>
    <div className="flex gap-2">
      <Input
        type="color"
        value={HEX_COLOR_PATTERN.test(value) ? value : "#FFFFFF"}
        onChange={(event) => onChange(event.target.value.toUpperCase())}
        className="h-10 w-14 cursor-pointer p-1"
        aria-label={label}
      />
      <Input
        value={value}
        maxLength={7}
        onChange={(event) => onChange(event.target.value.toUpperCase())}
        onBlur={(event) => {
          if (!HEX_COLOR_PATTERN.test(event.target.value)) onChange(label === "Cor do botão" ? "#6A1B9A" : "#FFFFFF");
        }}
        aria-invalid={!HEX_COLOR_PATTERN.test(value)}
      />
    </div>
  </div>
);

const MainBannerContentEditor = ({ imageUrl, slideIndex, value, onChange }: MainBannerContentEditorProps) => {
  const content = value ?? { ...EMPTY_MAIN_BANNER_CONTENT };
  const update = (partial: Partial<MainBannerSlideContent>) => onChange({ ...content, ...partial });
  const missingCtaUrl = Boolean(content.ctaText.trim() && !isSafeBannerUrl(content.ctaUrl));

  return (
    <div className="space-y-5 pt-2">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-2">
          <div className="flex items-center justify-between gap-3">
            <Label htmlFor={`main-banner-title-${slideIndex}`}>Título do banner</Label>
            <span className="text-xs text-muted-foreground">{content.title.length}/60</span>
          </div>
          <Input id={`main-banner-title-${slideIndex}`} value={content.title} maxLength={60} onChange={(event) => update({ title: event.target.value })} placeholder="Descubra uma nova forma de comprar" />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <div className="flex items-center justify-between gap-3">
            <Label htmlFor={`main-banner-subtitle-${slideIndex}`}>Subtítulo</Label>
            <span className="text-xs text-muted-foreground">{content.subtitle.length}/120</span>
          </div>
          <Input id={`main-banner-subtitle-${slideIndex}`} value={content.subtitle} maxLength={120} onChange={(event) => update({ subtitle: event.target.value })} placeholder="Apresente sua coleção em uma frase curta." />
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <Label htmlFor={`main-banner-cta-${slideIndex}`}>Texto do botão (CTA)</Label>
            <span className="text-xs text-muted-foreground">{content.ctaText.length}/30</span>
          </div>
          <Input id={`main-banner-cta-${slideIndex}`} value={content.ctaText} maxLength={30} onChange={(event) => update({ ctaText: event.target.value })} placeholder="Comprar agora" />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`main-banner-url-${slideIndex}`}>URL de destino</Label>
          <Input
            id={`main-banner-url-${slideIndex}`}
            value={content.ctaUrl}
            maxLength={2048}
            onChange={(event) => update({ ctaUrl: event.target.value })}
            placeholder="/promocoes ou https://exemplo.com"
            aria-invalid={missingCtaUrl}
            className={cn(missingCtaUrl && "border-destructive focus-visible:ring-destructive")}
          />
          {missingCtaUrl && <p className="text-xs text-destructive">Informe um destino válido para exibir o botão.</p>}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-2">
          <Label>Posição do conteúdo</Label>
          <ToggleGroup
            type="single"
            value={content.contentPosition}
            onValueChange={(position) => {
              if (position === "left" || position === "center" || position === "right") update({ contentPosition: position });
            }}
            variant="outline"
            className="justify-start"
          >
            <ToggleGroupItem value="left" aria-label="Alinhar à esquerda" title="Esquerda"><AlignLeft /></ToggleGroupItem>
            <ToggleGroupItem value="center" aria-label="Centralizar" title="Centro"><AlignCenter /></ToggleGroupItem>
            <ToggleGroupItem value="right" aria-label="Alinhar à direita" title="Direita"><AlignRight /></ToggleGroupItem>
          </ToggleGroup>
        </div>
        <ColorField label="Cor do texto" value={content.textColor} onChange={(textColor) => update({ textColor })} />
        <ColorField label="Cor do botão" value={content.buttonColor} onChange={(buttonColor) => update({ buttonColor })} />
      </div>

      <div className="space-y-2 border-t pt-4">
        <Label>Pré-visualização</Label>
        <div className="group relative aspect-[1920/680] w-full overflow-hidden rounded-md border bg-muted">
          <HeroBannerSlide imageUrl={imageUrl} imageAlt={`Prévia do banner ${slideIndex + 1}`} content={content} loading="eager" interactive={false} />
        </div>
      </div>
    </div>
  );
};

export default MainBannerContentEditor;