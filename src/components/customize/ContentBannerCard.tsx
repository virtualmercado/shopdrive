import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Trash2, ImagePlus, RefreshCw } from "lucide-react";

interface ContentBannerData {
  content_banner_enabled: boolean;
  content_banner_title: string;
  content_banner_subtitle: string;
  content_banner_title_color: string;
  content_banner_subtitle_color: string;
  content_banner_url: string;
  content_banner_image_url: string;
}

interface ContentBannerCardProps {
  data: ContentBannerData;
  onChange: (data: Partial<ContentBannerData>) => void;
  onImageUpload: (file: File) => void;
  onImageRemove: () => void;
  uploading: boolean;
  buttonBgColor: string;
  buttonTextColor: string;
}

const ContentBannerCard = ({
  data,
  onChange,
  onImageUpload,
  onImageRemove,
  uploading,
  buttonBgColor,
  buttonTextColor,
}: ContentBannerCardProps) => {
  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-xl font-semibold">Banner de Conteúdo</h2>
        <Switch
          checked={data.content_banner_enabled}
          onCheckedChange={(checked) =>
            onChange({ content_banner_enabled: checked })
          }
          className="data-[state=unchecked]:bg-input"
          style={{
            backgroundColor: data.content_banner_enabled ? buttonBgColor : undefined,
          }}
        />
      </div>
      <p className="text-sm text-muted-foreground mb-6">
        Insira um banner promocional clicável acima do rodapé da sua loja.
      </p>

      <div className="space-y-4">
        {/* Title */}
        <div className="space-y-2">
          <Label htmlFor="cb_title">Título</Label>
          <Input
            id="cb_title"
            value={data.content_banner_title}
            onChange={(e) =>
              onChange({ content_banner_title: e.target.value.slice(0, 60) })
            }
            placeholder="Ex: Conheça nosso blog"
            maxLength={60}
          />
          <p className="text-xs text-muted-foreground">Máx. 60 caracteres</p>
        </div>

        {/* Subtitle */}
        <div className="space-y-2">
          <Label htmlFor="cb_subtitle">Subtítulo</Label>
          <Input
            id="cb_subtitle"
            value={data.content_banner_subtitle}
            onChange={(e) =>
              onChange({ content_banner_subtitle: e.target.value.slice(0, 120) })
            }
            placeholder="Ex: Dicas, novidades e promoções exclusivas"
            maxLength={120}
          />
          <p className="text-xs text-muted-foreground">Máx. 120 caracteres</p>
        </div>

        {/* Colors */}
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Cor do título</Label>
            <div className="flex gap-2">
              <Input
                type="color"
                value={data.content_banner_title_color}
                onChange={(e) =>
                  onChange({ content_banner_title_color: e.target.value })
                }
                className="w-20 h-10"
              />
              <Input
                value={data.content_banner_title_color}
                onChange={(e) =>
                  onChange({ content_banner_title_color: e.target.value })
                }
                placeholder="#ffffff"
                className="flex-1"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Cor do subtítulo</Label>
            <div className="flex gap-2">
              <Input
                type="color"
                value={data.content_banner_subtitle_color}
                onChange={(e) =>
                  onChange({ content_banner_subtitle_color: e.target.value })
                }
                className="w-20 h-10"
              />
              <Input
                value={data.content_banner_subtitle_color}
                onChange={(e) =>
                  onChange({ content_banner_subtitle_color: e.target.value })
                }
                placeholder="#ffffffcc"
                className="flex-1"
              />
            </div>
          </div>
        </div>

        {/* URL */}
        <div className="space-y-2">
          <Label htmlFor="cb_url">URL de destino</Label>
          <Input
            id="cb_url"
            type="url"
            value={data.content_banner_url}
            onChange={(e) => onChange({ content_banner_url: e.target.value })}
            placeholder="https://exemplo.com/pagina"
          />
        </div>

        {/* Image Upload */}
        <div className="space-y-2">
          <Label>Imagem do banner</Label>
          <p className="text-xs text-muted-foreground">
            Tamanho recomendado: 1200 × 375 px (proporção 16:5). Formatos: JPG,
            PNG ou WEBP.
          </p>
          <div className="relative group">
            {data.content_banner_image_url ? (
              <>
                <img
                  src={data.content_banner_image_url}
                  alt="Banner de conteúdo"
                  className="w-full h-40 object-cover rounded-lg"
                />
                <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <label
                    htmlFor="cb_image_replace"
                    className="rounded-full p-1.5 cursor-pointer transition-all"
                    style={{ backgroundColor: buttonBgColor, color: buttonTextColor }}
                    title="Substituir"
                  >
                    <RefreshCw className="w-3 h-3" />
                  </label>
                  <input
                    type="file"
                    id="cb_image_replace"
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
                htmlFor="cb_image_add"
                className="flex flex-col items-center justify-center w-full h-40 border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted/50 transition-colors"
              >
                <ImagePlus className="w-8 h-8 text-muted-foreground mb-2" />
                <span className="text-sm text-muted-foreground">
                  Clique para enviar a imagem do banner
                </span>
                <input
                  type="file"
                  id="cb_image_add"
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
        {data.content_banner_image_url && (
          <div className="space-y-2 pt-2 border-t">
            <Label className="text-sm font-medium">Pré-visualização</Label>
            <div
              className="relative w-full overflow-hidden rounded-xl"
              style={{ aspectRatio: "16 / 5" }}
            >
              <img
                src={data.content_banner_image_url}
                alt="Preview"
                className="absolute inset-0 w-full h-full object-cover"
              />
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="bg-white/30 backdrop-blur-sm rounded-lg px-6 py-4 max-w-[80%] text-center">
                  {data.content_banner_title && (
                    <h3
                      className="text-base sm:text-lg font-semibold leading-tight"
                      style={{ color: data.content_banner_title_color }}
                    >
                      {data.content_banner_title}
                    </h3>
                  )}
                  {data.content_banner_subtitle && (
                    <p
                      className="text-xs sm:text-sm mt-1 leading-snug"
                      style={{ color: data.content_banner_subtitle_color }}
                    >
                      {data.content_banner_subtitle}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
};

export default ContentBannerCard;
