import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Save, Plus, Trash2, ArrowUp, ArrowDown, Image as ImageIcon, Link as LinkIcon, Globe } from "lucide-react";
import { toast } from "sonner";
import MediaSelectorModal from "@/components/admin/MediaSelectorModal";

interface SocialLink {
  id: string;
  name: string;
  icon: string;
  url: string;
  open_new_tab: boolean;
  is_active: boolean;
}

interface FooterContent {
  logo_url: string;
  logo_alt: string;
  subtitle: string;
  social_links: SocialLink[];
  copyright: string;
}

interface CMSFooterModalProps {
  isOpen: boolean;
  onClose: () => void;
  content: Record<string, any> | undefined;
  onSave: (content: Record<string, any>) => Promise<void>;
}

const socialIcons = [
  { value: "Instagram", label: "Instagram" },
  { value: "Facebook", label: "Facebook" },
  { value: "Youtube", label: "YouTube" },
  { value: "Twitter", label: "X (Twitter)" },
  { value: "Linkedin", label: "LinkedIn" },
  { value: "TikTok", label: "TikTok" },
  { value: "Pinterest", label: "Pinterest" },
  { value: "WhatsApp", label: "WhatsApp" },
];

const defaultContent: FooterContent = {
  logo_url: "",
  logo_alt: "VirtualMercado",
  subtitle: "Sua loja virtual em minutos.",
  social_links: [],
  copyright: "© 2025 VirtualMercado. Todos os direitos reservados.",
};

const CMSFooterModal = ({ isOpen, onClose, content, onSave }: CMSFooterModalProps) => {
  const [formData, setFormData] = useState<FooterContent>(defaultContent);
  const [isSaving, setIsSaving] = useState(false);
  const [mediaOpen, setMediaOpen] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);

  // Carregar conteúdo APENAS quando o modal abre (não a cada mudança de referência)
  useEffect(() => {
    if (isOpen && !hasLoaded && content) {
      const socialLinks = content.social_links || [];
      
      // Garantir que YouTube exista na lista
      const hasYoutube = socialLinks.some((link: SocialLink) => 
        link.icon === "Youtube" || link.name?.toLowerCase().includes("youtube")
      );
      
      const finalSocialLinks = hasYoutube ? socialLinks : [
        ...socialLinks,
        {
          id: crypto.randomUUID(),
          name: "YouTube",
          icon: "Youtube",
          url: "https://youtube.com",
          open_new_tab: true,
          is_active: true,
        }
      ];

      setFormData({
        logo_url: content.logo_url || "",
        logo_alt: content.logo_alt || "VirtualMercado",
        subtitle: content.subtitle || "Sua loja virtual em minutos.",
        social_links: finalSocialLinks,
        copyright: content.copyright || "© 2025 VirtualMercado. Todos os direitos reservados.",
      });
      setHasLoaded(true);
    }
    
    // Resetar flag quando o modal fecha
    if (!isOpen) {
      setHasLoaded(false);
    }
  }, [isOpen, content, hasLoaded]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave(formData);
      toast.success("Conteúdo do rodapé atualizado com sucesso!");
      onClose();
    } catch (error) {
      toast.error("Erro ao salvar conteúdo.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSelectLogo = (file: { id: string; url: string }) => {
    setFormData(prev => ({ ...prev, logo_url: file.url }));
    setMediaOpen(false);
  };

  // Social Links handlers
  const addSocialLink = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const newLink: SocialLink = {
      id: crypto.randomUUID(),
      name: "Nova Rede",
      icon: "Instagram",
      url: "https://",
      open_new_tab: true,
      is_active: true,
    };
    setFormData(prev => {
      const updated = { ...prev, social_links: [...prev.social_links, newLink] };
      console.log("Nova rede adicionada:", updated.social_links);
      return updated;
    });
  };

  const updateSocialLink = (id: string, field: keyof SocialLink, value: any) => {
    setFormData(prev => ({
      ...prev,
      social_links: prev.social_links.map(link => 
        link.id === id ? { ...link, [field]: value } : link
      ),
    }));
  };

  const removeSocialLink = (id: string) => {
    setFormData(prev => ({
      ...prev,
      social_links: prev.social_links.filter(link => link.id !== id),
    }));
  };

  const moveSocialLink = (id: string, direction: "up" | "down") => {
    const index = formData.social_links.findIndex(link => link.id === id);
    if (
      (direction === "up" && index === 0) ||
      (direction === "down" && index === formData.social_links.length - 1)
    ) return;

    const newLinks = [...formData.social_links];
    const swapIndex = direction === "up" ? index - 1 : index + 1;
    [newLinks[index], newLinks[swapIndex]] = [newLinks[swapIndex], newLinks[index]];
    setFormData(prev => ({ ...prev, social_links: newLinks }));
  };

  const isValidUrl = (url: string) => {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5 text-[#6a1b9a]" />
              Conteúdo do Rodapé da Landing Page
            </DialogTitle>
            <p className="text-sm text-muted-foreground">
              Gerencie logo, subtítulo, redes sociais e links exibidos no rodapé da Landing Page.
            </p>
          </DialogHeader>

          {/* Área de conteúdo scrollável (apenas o miolo do modal) */}
          <div className="flex-1 min-h-0 overflow-y-auto pr-4 cms-footer-scroll overscroll-contain max-h-[calc(90vh-180px)]">
            <div className="space-y-6 pb-4">
              {/* Logo Section */}
              <div className="p-4 border rounded-lg bg-muted/30">
                <h4 className="font-medium mb-4 flex items-center gap-2">
                  <ImageIcon className="h-4 w-4 text-[#6a1b9a]" />
                  Logo da Landing Page (Rodapé)
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm">Arquivo da Logo</Label>
                    <div className="mt-2 flex items-center gap-3">
                      {formData.logo_url ? (
                        <div className="relative h-12 w-32 border rounded bg-white flex items-center justify-center">
                          <img src={formData.logo_url} alt="Logo" className="max-h-full max-w-full object-contain" />
                        </div>
                      ) : (
                        <div className="h-12 w-32 border rounded bg-muted flex items-center justify-center text-xs text-muted-foreground">
                          Logo padrão
                        </div>
                      )}
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => setMediaOpen(true)}
                      >
                        <ImageIcon className="h-4 w-4 mr-1" />
                        Selecionar
                      </Button>
                      {formData.logo_url && (
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => setFormData(prev => ({ ...prev, logo_url: "" }))}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Formatos: SVG, PNG (preferência SVG)
                    </p>
                  </div>
                  <div>
                    <Label htmlFor="logo_alt" className="text-sm">Texto Alternativo (ALT)</Label>
                    <Input
                      id="logo_alt"
                      value={formData.logo_alt}
                      onChange={(e) => setFormData(prev => ({ ...prev, logo_alt: e.target.value }))}
                      className="mt-2"
                      placeholder="Ex: VirtualMercado"
                    />
                  </div>
                </div>
              </div>

              {/* Subtitle Section */}
              <div className="space-y-2">
                <Label htmlFor="subtitle">Texto de Apoio / Slogan do Rodapé</Label>
                <Input
                  id="subtitle"
                  value={formData.subtitle}
                  onChange={(e) => setFormData(prev => ({ ...prev, subtitle: e.target.value }))}
                  placeholder="Ex: Sua loja virtual em minutos."
                />
              </div>

              {/* Social Links Section */}
              <div className="p-4 border rounded-lg bg-muted/30">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="font-medium flex items-center gap-2">
                    <LinkIcon className="h-4 w-4 text-[#6a1b9a]" />
                    Redes Sociais (Rodapé)
                  </h4>
                  <Button 
                    type="button" 
                    size="sm" 
                    onClick={(e) => addSocialLink(e)}
                    className="relative z-10"
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Adicionar
                  </Button>
                </div>

                {formData.social_links.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Nenhuma rede social adicionada
                  </p>
                ) : (
                  <div className="space-y-3">
                    {formData.social_links.map((link, index) => (
                      <div key={link.id} className="p-3 border rounded-lg bg-background">
                        <div className="flex items-start gap-3">
                          <div className="flex flex-col gap-1">
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              className="h-6 w-6"
                              onClick={() => moveSocialLink(link.id, "up")}
                              disabled={index === 0}
                            >
                              <ArrowUp className="h-3 w-3" />
                            </Button>
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              className="h-6 w-6"
                              onClick={() => moveSocialLink(link.id, "down")}
                              disabled={index === formData.social_links.length - 1}
                            >
                              <ArrowDown className="h-3 w-3" />
                            </Button>
                          </div>
                          
                          <div className="flex-1 grid grid-cols-1 md:grid-cols-4 gap-3">
                            <div>
                              <Label className="text-xs">Nome</Label>
                              <Input
                                value={link.name}
                                onChange={(e) => updateSocialLink(link.id, "name", e.target.value)}
                                className="mt-1"
                                placeholder="Instagram"
                              />
                            </div>
                            <div>
                              <Label className="text-xs">Ícone</Label>
                              <Select
                                value={link.icon}
                                onValueChange={(v) => updateSocialLink(link.id, "icon", v)}
                              >
                                <SelectTrigger className="mt-1">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {socialIcons.map((icon) => (
                                    <SelectItem key={icon.value} value={icon.value}>
                                      {icon.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="md:col-span-2">
                              <Label className="text-xs">URL</Label>
                              <Input
                                value={link.url}
                                onChange={(e) => updateSocialLink(link.id, "url", e.target.value)}
                                className={`mt-1 ${link.url && !isValidUrl(link.url) ? "border-destructive" : ""}`}
                                placeholder="https://..."
                              />
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <div className="flex items-center gap-1">
                              <Switch
                                checked={link.is_active}
                                onCheckedChange={(v) => updateSocialLink(link.id, "is_active", v)}
                              />
                              <span className="text-xs text-muted-foreground">Ativo</span>
                            </div>
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              onClick={() => removeSocialLink(link.id)}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Copyright Section */}
              <div className="space-y-2">
                <Label htmlFor="copyright">Texto de Copyright</Label>
                <Input
                  id="copyright"
                  value={formData.copyright}
                  onChange={(e) => setFormData(prev => ({ ...prev, copyright: e.target.value }))}
                  placeholder="© 2025 VirtualMercado. Todos os direitos reservados."
                />
              </div>
            </div>
          </div>

          <DialogFooter className="pt-4 border-t">
            <Button variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button
              onClick={handleSave}
              disabled={isSaving}
              className="bg-[#FB8C00] hover:bg-[#FB8C00]/90 text-white"
            >
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Salvando...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Salvar Alterações
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <MediaSelectorModal
        isOpen={mediaOpen}
        onClose={() => setMediaOpen(false)}
        onSelect={handleSelectLogo}
        allowedTypes={["image"]}
        title="Selecionar Logo do Rodapé"
      />
    </>
  );
};

export default CMSFooterModal;
