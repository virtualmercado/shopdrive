import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Trash2, ImagePlus, RefreshCw } from "lucide-react";

export interface ContentBannerItem {
  enabled: boolean;
  title: string;
  subtitle: string;
  title_color: string;
  subtitle_color: string;
  url: string;
  image_url: string;
  cta_text: string;
  cta_bg_color: string;
  cta_text_color: string;
}

export const createEmptyBanner = (): ContentBannerItem => ({
  enabled: false,
  title: "",
  subtitle: "",
  title_color: "#ffffff",
  subtitle_color: "#ffffffcc",
  url: "",
  image_url: "",
  cta_text: "",
  cta_bg_color: "#000000",
  cta_text_color: "#ffffff",
});

interface ContentBannerCardProps {
  banners: ContentBannerItem[];
  onChange: (banners: ContentBannerItem[]) => void;
  onImageUpload: (file: File, index: number) => void;
  onImageRemove: (index: number) => void;
  uploading: boolean;
  buttonBgColor: string;
  buttonTextColor: string;
}

const ContentBannerCard = ({
  banners,
  onChange,
  onImageUpload,
  onImageRemove,
  uploading,
  buttonBgColor,
  buttonTextColor,
}: ContentBannerCardProps) => {
  const updateBanner = (index: number, partial: Partial<ContentBannerItem>) => {
    const updated = [...banners];
    updated[index] = { ...updated[index], ...partial };
    onChange(updated);
  };

  return (
    <Card className="p-6">
      <h2 className="text-xl font-semibold mb-1">Banner de Conteúdo</h2>
      <p className="text-sm text-muted-foreground mb-6">
        Insira até 3 banners promocionais clicáveis acima do rodapé da sua loja. Com mais de um banner ativo, será exibido um carrossel automático.
      </p>

      <div className="space-y-6">
        {banners.map((banner, index) => (
          <BannerItemCard
            key={index}
            index={index}
            banner={banner}
            onUpdate={(partial) => updateBanner(index, partial)}
            onImageUpload={(file) => onImageUpload(file, index)}
            onImageRemove={() => onImageRemove(index)}
            uploading={uploading}
            buttonBgColor={buttonBgColor}
            buttonTextColor={buttonTextColor}
          />
        ))}
      </div>
    </Card>
  );
};

interface BannerItemCardProps {
  index: number;
  banner: ContentBannerItem;
  onUpdate: (partial: Partial<ContentBannerItem>) => void;
  onImageUpload: (file: File) => void;
  onImageRemove: () => void;
  uploading: boolean;
  buttonBgColor: string;
  buttonTextColor: string;
}

const BannerItemCard = ({
  index,
  banner,
  onUpdate,
  onImageUpload,
  onImageRemove,
  uploading,
  buttonBgColor,
  buttonTextColor,
}: BannerItemCardProps) => {
  return (
    <div className="border rounded-lg p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-medium">Banner {index + 1}</h3>
        <Switch
          checked={banner.enabled}
          onCheckedChange={(checked) => onUpdate({ enabled: checked })}
          className="data-[state=unchecked]:bg-input"
          style={{
            backgroundColor: banner.enabled ? buttonBgColor : undefined,
          }}
        />
      </div>

      {/* Title */}
      <div className="space-y-2">
        <Label>Título</Label>
        <Input
          value={banner.title}
          onChange={(e) => onUpdate({ title: e.target.value.slice(0, 60) })}
          placeholder="Ex: Conheça nosso blog"
          maxLength={60}
        />
        <p className="text-xs text-muted-foreground">Máx. 60 caracteres</p>
      </div>

      {/* Subtitle */}
      <div className="space-y-2">
        <Label>Subtítulo</Label>
        <Input
          value={banner.subtitle}
          onChange={(e) => onUpdate({ subtitle: e.target.value.slice(0, 120) })}
          placeholder="Ex: Dicas, novidades e promoções exclusivas"
          maxLength={120}
        />
        <p className="text-xs text-muted-foreground">Máx. 120 caracteres</p>
      </div>

      {/* CTA Text */}
      <div className="space-y-2">
        <Label>Texto do botão (CTA)</Label>
        <Input
          value={banner.cta_text}
          onChange={(e) => onUpdate({ cta_text: e.target.value.slice(0, 30) })}
          placeholder="Ex: Ver produtos"
          maxLength={30}
        />
        <p className="text-xs text-muted-foreground">Máx. 30 caracteres. Deixe vazio para ocultar o botão.</p>
      </div>

      {/* Colors */}
      <div className="grid sm:grid-cols-2 gap-4">
        <ColorField label="Cor do título" value={banner.title_color} onChange={(v) => onUpdate({ title_color: v })} />
        <ColorField label="Cor do subtítulo" value={banner.subtitle_color} onChange={(v) => onUpdate({ subtitle_color: v })} />
        <ColorField label="Cor do botão" value={banner.cta_bg_color} onChange={(v) => onUpdate({ cta_bg_color: v })} />
        <ColorField label="Cor do texto do botão" value={banner.cta_text_color} onChange={(v) => onUpdate({ cta_text_color: v })} />
      </div>

      {/* URL */}
      <div className="space-y-2">
        <Label>URL de destino</Label>
        <Input
          type="url"
          value={banner.url}
          onChange={(e) => onUpdate({ url: e.target.value })}
          placeholder="https://exemplo.com/pagina"
        />
      </div>

      {/* Image Upload */}
      <div className="space-y-2">
        <Label>Imagem do banner</Label>
        <p className="text-xs text-muted-foreground">
          Tamanho recomendado: 1360 × 460 px (proporção 3:1). Formatos: JPG, PNG ou WEBP.
        </p>
        <div className="relative group">
          {banner.image_url ? (
            <>
              <img
                src={banner.image_url}
                alt={`Banner ${index + 1}`}
                className="w-full h-40 object-cover rounded-lg"
              />
              <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <label
                  htmlFor={`cb_replace_${index}`}
                  className="rounded-full p-1.5 cursor-pointer transition-all"
                  style={{ backgroundColor: buttonBgColor, color: buttonTextColor }}
                  title="Substituir"
                >
                  <RefreshCw className="w-3 h-3" />
                </label>
                <input
                  type="file"
                  id={`cb_replace_${index}`}
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) onImageUpload(file);
                  }}
                  disabled={uploading}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={onImageRemove}
                  className="rounded-full p-1.5 transition-all"
                  style={{ backgroundColor: buttonBgColor, color: buttonTextColor }}
                  title="Excluir"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            </>
          ) : (
            <label
              htmlFor={`cb_add_${index}`}
              className="flex flex-col items-center justify-center w-full h-40 border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted/50 transition-colors"
            >
              <ImagePlus className="w-8 h-8 text-muted-foreground mb-2" />
              <span className="text-sm text-muted-foreground">
                Clique para enviar a imagem do banner
              </span>
              <input
                type="file"
                id={`cb_add_${index}`}
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) onImageUpload(file);
                }}
                disabled={uploading}
                className="hidden"
              />
            </label>
          )}
        </div>
      </div>

      {/* Preview */}
      {banner.image_url && (
        <div className="space-y-2 pt-2 border-t">
          <Label className="text-sm font-medium">Pré-visualização</Label>
          <div
            className="relative w-full overflow-hidden rounded-xl"
            style={{ aspectRatio: "16 / 5" }}
          >
            <img
              src={banner.image_url}
              alt="Preview"
              className="absolute inset-0 w-full h-full object-cover"
            />
            <div className="absolute inset-0 z-10 flex items-center justify-center">
              <div
                className="rounded-lg px-6 py-4 max-w-[80%] text-center shadow-lg"
                style={{
                  background: "rgba(255, 255, 255, 0.65)",
                  backdropFilter: "blur(8px)",
                  WebkitBackdropFilter: "blur(8px)",
                }}
              >
                {banner.title && (
                  <h3
                    className="text-base sm:text-lg font-semibold leading-tight"
                    style={{ color: banner.title_color }}
                  >
                    {banner.title}
                  </h3>
                )}
                {banner.subtitle && (
                  <p
                    className="text-xs sm:text-sm mt-1 leading-snug"
                    style={{ color: banner.subtitle_color }}
                  >
                    {banner.subtitle}
                  </p>
                )}
                {banner.cta_text && (
                  <button
                    type="button"
                    className="mt-3 px-5 py-1.5 rounded-md text-sm font-medium transition-opacity hover:opacity-90"
                    style={{ backgroundColor: banner.cta_bg_color, color: banner.cta_text_color }}
                  >
                    {banner.cta_text}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

interface ColorFieldProps {
  label: string;
  value: string;
  onChange: (val: string) => void;
}

const ColorField = ({ label, value, onChange }: ColorFieldProps) => (
  <div className="space-y-2">
    <Label>{label}</Label>
    <div className="flex gap-2">
      <Input type="color" value={value} onChange={(e) => onChange(e.target.value)} className="w-20 h-10" />
      <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder="#ffffff" className="flex-1" />
    </div>
  </div>
);

export default ContentBannerCard;
