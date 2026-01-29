import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Loader2, Play, ExternalLink, Trash2, Youtube } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface YouTubeVideoCardProps {
  buttonBgColor: string;
  buttonTextColor: string;
  initialData?: {
    home_video_enabled: boolean;
    home_video_id: string | null;
    home_video_url_original: string | null;
    home_video_title: string | null;
    home_video_description: string | null;
  };
  onSaved?: () => void;
}

// Function to extract YouTube video ID from various URL formats
const extractYouTubeVideoId = (url: string): string | null => {
  if (!url) return null;
  
  const patterns = [
    // Standard watch URL: youtube.com/watch?v=VIDEO_ID
    /(?:youtube\.com\/watch\?v=|youtube\.com\/watch\?.*&v=)([a-zA-Z0-9_-]{11})/,
    // Short URL: youtu.be/VIDEO_ID
    /youtu\.be\/([a-zA-Z0-9_-]{11})/,
    // Embed URL: youtube.com/embed/VIDEO_ID
    /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
    // Shorts URL: youtube.com/shorts/VIDEO_ID
    /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
    // Mobile URL: m.youtube.com/watch?v=VIDEO_ID
    /m\.youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }
  
  return null;
};

// Function to validate if URL is from YouTube
const isValidYouTubeUrl = (url: string): boolean => {
  if (!url) return false;
  
  const youtubePatterns = [
    /^https?:\/\/(www\.)?youtube\.com\//,
    /^https?:\/\/m\.youtube\.com\//,
    /^https?:\/\/youtu\.be\//,
  ];
  
  return youtubePatterns.some(pattern => pattern.test(url));
};

const YouTubeVideoCard = ({ 
  buttonBgColor, 
  buttonTextColor, 
  initialData,
  onSaved 
}: YouTubeVideoCardProps) => {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  
  const [enabled, setEnabled] = useState(initialData?.home_video_enabled || false);
  const [videoUrl, setVideoUrl] = useState(initialData?.home_video_url_original || "");
  const [title, setTitle] = useState(initialData?.home_video_title || "");
  const [description, setDescription] = useState(initialData?.home_video_description || "");
  const [urlError, setUrlError] = useState<string | null>(null);

  const videoId = extractYouTubeVideoId(videoUrl);
  const thumbnailUrl = videoId ? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg` : null;

  const validateUrl = (url: string): boolean => {
    if (!url.trim()) {
      setUrlError("Informe um link do YouTube.");
      return false;
    }
    
    if (!isValidYouTubeUrl(url)) {
      setUrlError("Cole um link válido do YouTube (ex: youtube.com/watch?v=… ou youtu.be/…).");
      return false;
    }
    
    const extractedId = extractYouTubeVideoId(url);
    if (!extractedId) {
      setUrlError("Não foi possível identificar o vídeo. Verifique o link.");
      return false;
    }
    
    setUrlError(null);
    return true;
  };

  const handleUrlChange = (value: string) => {
    setVideoUrl(value);
    if (value.trim()) {
      validateUrl(value);
    } else {
      setUrlError(null);
    }
  };

  const handleSave = async () => {
    if (enabled && !validateUrl(videoUrl)) {
      return;
    }

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error("Usuário não autenticado");
      }

      const extractedVideoId = enabled ? extractYouTubeVideoId(videoUrl) : null;

      const { error } = await supabase
        .from("profiles")
        .update({
          home_video_enabled: enabled,
          home_video_provider: "youtube",
          home_video_id: extractedVideoId,
          home_video_url_original: enabled ? videoUrl : null,
          home_video_title: enabled ? title.trim() || null : null,
          home_video_description: enabled ? description.trim() || null : null,
        })
        .eq("id", user.id);

      if (error) throw error;

      toast({
        title: "Configurações salvas!",
        description: enabled 
          ? "O vídeo será exibido na página inicial da sua loja." 
          : "O vídeo foi desativado.",
      });
      
      onSaved?.();
    } catch (error: any) {
      toast({
        title: "Erro ao salvar",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveVideo = async () => {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const { error } = await supabase
        .from("profiles")
        .update({
          home_video_enabled: false,
          home_video_id: null,
          home_video_url_original: null,
          home_video_title: null,
          home_video_description: null,
        })
        .eq("id", user.id);

      if (error) throw error;

      setEnabled(false);
      setVideoUrl("");
      setTitle("");
      setDescription("");
      setUrlError(null);

      toast({
        title: "Vídeo removido",
        description: "O vídeo foi removido da página inicial.",
      });
      
      onSaved?.();
    } catch (error: any) {
      toast({
        title: "Erro ao remover",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="p-6">
      <div className="flex items-center gap-3 mb-2">
        <Youtube className="w-5 h-5 text-red-600" />
        <h2 className="text-xl font-semibold">Vídeo do YouTube (Home)</h2>
      </div>
      <p className="text-sm text-muted-foreground mb-6">
        Exiba um vídeo do YouTube na página inicial da sua loja, logo abaixo das marcas.
      </p>

      <div className="space-y-6">
        {/* Toggle */}
        <div className="flex items-center justify-between p-4 rounded-lg bg-muted/30">
          <div className="space-y-1">
            <Label htmlFor="home_video_toggle" className="text-base font-medium">
              Ativar vídeo na Home
            </Label>
            <p className="text-sm text-muted-foreground">
              {enabled 
                ? "O vídeo está visível na página inicial." 
                : "Ative para adicionar o link do vídeo."}
            </p>
          </div>
          <Switch
            id="home_video_toggle"
            checked={enabled}
            onCheckedChange={setEnabled}
            className="data-[state=unchecked]:bg-input"
            style={{
              backgroundColor: enabled ? buttonBgColor : undefined,
            }}
          />
        </div>

        {/* Fields - only show when enabled */}
        {enabled && (
          <div className="space-y-4 animate-in fade-in-50 duration-200">
            {/* YouTube URL */}
            <div className="space-y-2">
              <Label htmlFor="video_url">Link do vídeo no YouTube *</Label>
              <Input
                id="video_url"
                value={videoUrl}
                onChange={(e) => handleUrlChange(e.target.value)}
                placeholder="Cole aqui: https://www.youtube.com/watch?v=…"
                className={urlError ? "border-red-500 focus-visible:ring-red-500" : ""}
              />
              {urlError ? (
                <p className="text-sm text-red-500">{urlError}</p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Aceitamos links do YouTube (watch, youtu.be e shorts).
                </p>
              )}
            </div>

            {/* Title */}
            <div className="space-y-2">
              <Label htmlFor="video_title">Título acima do vídeo (opcional)</Label>
              <Input
                id="video_title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ex: Assista e conheça nossa marca"
                maxLength={100}
              />
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="video_description">Descrição curta (opcional)</Label>
              <Input
                id="video_description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Ex: Dicas, lançamentos e bastidores"
                maxLength={200}
              />
            </div>

            {/* Preview */}
            {videoId && !urlError && (
              <div className="space-y-2 p-4 rounded-lg bg-muted/30">
                <Label className="text-sm font-medium">Pré-visualização do vídeo</Label>
                <div className="relative aspect-video w-full max-w-sm rounded-lg overflow-hidden bg-black/10">
                  {thumbnailUrl ? (
                    <>
                      <img 
                        src={thumbnailUrl} 
                        alt="Thumbnail do vídeo" 
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                        <div className="w-16 h-16 rounded-full bg-red-600 flex items-center justify-center">
                          <Play className="w-8 h-8 text-white fill-white ml-1" />
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Play className="w-12 h-12 text-muted-foreground" />
                    </div>
                  )}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  onClick={() => window.open(videoUrl, "_blank")}
                >
                  <ExternalLink className="w-4 h-4" />
                  Testar vídeo
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-3 pt-4 border-t">
          <Button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 transition-all hover:opacity-90"
            style={{ backgroundColor: buttonBgColor, color: buttonTextColor }}
          >
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Salvar
          </Button>
          {(enabled || videoUrl) && (
            <Button
              type="button"
              variant="outline"
              onClick={handleRemoveVideo}
              disabled={saving}
              className="gap-2"
            >
              <Trash2 className="w-4 h-4" />
              Remover vídeo
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
};

export default YouTubeVideoCard;
