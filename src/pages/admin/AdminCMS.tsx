import AdminLayout from "@/components/layout/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { 
  FileText,
  Image as ImageIcon,
  RefreshCw,
  Loader2,
  AlertCircle,
  Type,
  Layout,
  Layers,
  MessageSquare,
  TrendingUp,
  CreditCard,
  Box,
  Grid3X3,
  Crown,
  Users,
  ListOrdered,
  Edit,
  HelpCircle,
  Phone
} from "lucide-react";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import MediaSelectorModal from "@/components/admin/MediaSelectorModal";
import heroImage from "@/assets/hero-banner.jpg";
import benefitsImage from "@/assets/benefits-handshake.jpg";
import benefitsMobile from "@/assets/benefits-mobile.jpg";

// CMS Content Modals
import CMSHeaderModal from "@/components/admin/cms/CMSHeaderModal";
import CMSHeroModal from "@/components/admin/cms/CMSHeroModal";
import CMSProductsModal from "@/components/admin/cms/CMSProductsModal";
import CMSSocialProofModal from "@/components/admin/cms/CMSSocialProofModal";
import CMSSalesPaymentsModal from "@/components/admin/cms/CMSSalesPaymentsModal";
import CMSResourcesModal from "@/components/admin/cms/CMSResourcesModal";
import CMSResourceCardsModal from "@/components/admin/cms/CMSResourceCardsModal";
import CMSTestimonialsModal from "@/components/admin/cms/CMSTestimonialsModal";
import CMSHowItWorksModal from "@/components/admin/cms/CMSHowItWorksModal";
import CMSPlansModal from "@/components/admin/cms/CMSPlansModal";
import CMSFaqModal from "@/components/admin/cms/CMSFaqModal";
import CMSFooterModal from "@/components/admin/cms/CMSFooterModal";
import CMSAboutUsModal from "@/components/admin/cms/CMSAboutUsModal";
import CMSTermsOfUseModal from "@/components/admin/cms/CMSTermsOfUseModal";
import CMSPrivacyPolicyModal from "@/components/admin/cms/CMSPrivacyPolicyModal";
import CMSCookiePolicyModal from "@/components/admin/cms/CMSCookiePolicyModal";
import CMSHelpCenterModal from "@/components/admin/cms/CMSHelpCenterModal";
import CMSContactModal from "@/components/admin/cms/CMSContactModal";
import { useCMSContentAdmin, useUpdateCMSContent } from "@/hooks/useCMSContent";

interface CMSBanner {
  id: string;
  banner_key: string;
  name: string;
  description: string | null;
  media_id: string | null;
  media_url: string | null;
  media_type: string | null;
  display_order: number;
  is_active: boolean;
}

interface BannerDisplay {
  id: string;
  banner_key: string;
  name: string;
  description: string;
  currentImage: string;
  width: number;
  height: number;
  format: string;
  aspectRatio: string;
  media_id: string | null;
  hasCustomImage: boolean;
}

// Default images mapping
const defaultImages: Record<string, string> = {
  'banner_01': heroImage,
  'banner_02': benefitsImage,
  'banner_03': benefitsMobile,
  'hero_01': heroImage,
  'hero_02': '',
  'hero_03': '',
};

// Content sections configuration
const contentSections = [
  { key: "header", name: "Header da Landing Page", icon: Layout, description: "Menu de navegação e botões" },
  { key: "hero", name: "Hero da Landing Page", icon: Type, description: "Título, subtítulo e CTAs principais" },
  { key: "products", name: "Bloco Seus Produtos", icon: Box, description: "Seção de produtos disponíveis" },
  { key: "social_proof_1", name: "Prova Social 01", icon: TrendingUp, description: "Destaque de credibilidade" },
  { key: "sales_payments", name: "Bloco Vendas e Pagamentos", icon: CreditCard, description: "WhatsApp e métodos de pagamento" },
  { key: "resources", name: "Bloco Recursos", icon: Layers, description: "Título e subtítulo da seção" },
  { key: "resource_cards", name: "Cards de Recursos", icon: Grid3X3, description: "8 cards com ícones e textos" },
  { key: "testimonials", name: "Prova Social (Depoimentos)", icon: Users, description: "Depoimentos de clientes" },
  { key: "how_it_works", name: "Como Funciona", icon: ListOrdered, description: "3 passos e CTA final" },
  { key: "plans", name: "Planos da Plataforma", icon: Crown, description: "Textos, preços e recursos dos planos" },
  { key: "faq", name: "Dúvidas Frequentes", icon: MessageSquare, description: "Perguntas e respostas do FAQ" },
];

const AdminCMS = () => {
  const [selectorOpen, setSelectorOpen] = useState(false);
  const [selectedBannerId, setSelectedBannerId] = useState<string | null>(null);
  const [bannerDimensions, setBannerDimensions] = useState<Record<string, { width: number; height: number; format: string; aspectRatio: string }>>({});
  
  // Content modal states
  const [activeModal, setActiveModal] = useState<string | null>(null);
  
  const queryClient = useQueryClient();

  // Fetch CMS content
  const { data: cmsContentList } = useCMSContentAdmin();
  const updateContentMutation = useUpdateCMSContent();

  // Convert list to map for easy access
  const cmsContent: Record<string, Record<string, any>> = {};
  cmsContentList?.forEach((item) => {
    cmsContent[item.section_key] = item.content;
  });

  // Fetch CMS banners from database
  const { data: cmsBanners, isLoading, error } = useQuery({
    queryKey: ["cms-banners"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cms_banners")
        .select("*")
        .order("display_order", { ascending: true });
      
      if (error) {
        console.error("Error fetching CMS banners:", error);
        throw error;
      }
      
      return data as CMSBanner[];
    },
  });

  // Update banner mutation
  const updateBannerMutation = useMutation({
    mutationFn: async ({ bannerId, mediaId, mediaUrl, mediaType }: { 
      bannerId: string; 
      mediaId: string; 
      mediaUrl: string;
      mediaType: string;
    }) => {
      const { error } = await supabase
        .from("cms_banners")
        .update({
          media_id: mediaId,
          media_url: mediaUrl,
          media_type: mediaType,
          updated_at: new Date().toISOString(),
        })
        .eq("id", bannerId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cms-banners"] });
      toast.success("Banner atualizado com sucesso! A alteração será refletida na landing page.");
    },
    onError: (error) => {
      console.error("Error updating banner:", error);
      toast.error("Erro ao atualizar banner.");
    },
  });

  // Calculate aspect ratio
  const calculateAspectRatio = (width: number, height: number): string => {
    const ratio = width / height;
    if (Math.abs(ratio - 16/9) < 0.1) return '16:9';
    if (Math.abs(ratio - 4/3) < 0.1) return '4:3';
    if (Math.abs(ratio - 3/2) < 0.1) return '3:2';
    if (Math.abs(ratio - 1) < 0.1) return '1:1';
    if (Math.abs(ratio - 9/16) < 0.1) return '9:16';
    if (Math.abs(ratio - 3/4) < 0.1) return '3:4';
    if (Math.abs(ratio - 2/3) < 0.1) return '2:3';
    
    const gcd = (a: number, b: number): number => b === 0 ? a : gcd(b, a % b);
    const divisor = gcd(width, height);
    return `${width / divisor}:${height / divisor}`;
  };

  // Get format from URL
  const getFormat = (url: string): string => {
    const extension = url.split('.').pop()?.split('?')[0]?.toLowerCase() || '';
    switch (extension) {
      case 'jpg':
      case 'jpeg':
        return 'JPG';
      case 'png':
        return 'PNG';
      case 'webp':
        return 'WebP';
      case 'gif':
        return 'GIF';
      case 'svg':
        return 'SVG';
      default:
        return 'JPG ou PNG';
    }
  };

  // Transform CMS banners to display format
  const banners: BannerDisplay[] = (cmsBanners || []).map(banner => {
    const currentImage = banner.media_url || defaultImages[banner.banner_key] || heroImage;
    const dims = bannerDimensions[banner.id] || { width: 0, height: 0, format: '', aspectRatio: '' };
    
    return {
      id: banner.id,
      banner_key: banner.banner_key,
      name: banner.name,
      description: banner.description || '',
      currentImage,
      width: dims.width,
      height: dims.height,
      format: dims.format,
      aspectRatio: dims.aspectRatio,
      media_id: banner.media_id,
      hasCustomImage: !!banner.media_url,
    };
  });

  // Load image dimensions when banners change
  useEffect(() => {
    banners.forEach((banner) => {
      if (!bannerDimensions[banner.id] || bannerDimensions[banner.id].width === 0) {
        const img = new Image();
        img.onload = () => {
          setBannerDimensions(prev => ({
            ...prev,
            [banner.id]: {
              width: img.naturalWidth,
              height: img.naturalHeight,
              format: getFormat(banner.currentImage),
              aspectRatio: calculateAspectRatio(img.naturalWidth, img.naturalHeight),
            }
          }));
        };
        img.src = banner.currentImage;
      }
    });
  }, [cmsBanners]);

  const handleOpenSelector = (bannerId: string) => {
    setSelectedBannerId(bannerId);
    setSelectorOpen(true);
  };

  const handleSelectMedia = (file: { id: string; url: string; file_type: string; mime_type?: string | null }) => {
    if (!selectedBannerId) return;

    updateBannerMutation.mutate({
      bannerId: selectedBannerId,
      mediaId: file.id,
      mediaUrl: file.url,
      mediaType: file.mime_type || file.file_type,
    });
  };

  const handleSaveContent = async (sectionKey: string, content: Record<string, any>) => {
    await updateContentMutation.mutateAsync({ sectionKey, content });
  };

  if (isLoading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-[#6a1b9a]" />
        </div>
      </AdminLayout>
    );
  }

  if (error) {
    return (
      <AdminLayout>
        <div className="flex flex-col items-center justify-center h-64 gap-4">
          <AlertCircle className="h-12 w-12 text-red-500" />
          <p className="text-muted-foreground">Erro ao carregar banners do CMS.</p>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Hero Carousel Banners Section */}
        <Card>
          <CardHeader>
            <CardTitle className="text-xl flex items-center gap-3">
              <div className="p-2 bg-[#6a1b9a]/10 rounded-lg">
                <ImageIcon className="h-6 w-6 text-[#6a1b9a]" />
              </div>
              Carrossel do Hero (Topo da Landing Page)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-4">
              Gerencie as 3 imagens do carrossel exibido no topo da landing page. As imagens alternam automaticamente a cada 3 segundos.
            </p>
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg mb-6">
              <p className="text-sm text-amber-800">
                <strong>Dica:</strong> Proporção recomendada: 1:1 ou 4:5 (quadrada ou retrato). Formato: JPG ou PNG.
              </p>
            </div>

            {/* Hero Banners Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {banners
                .filter((banner) => banner.banner_key.startsWith('hero_'))
                .sort((a, b) => a.banner_key.localeCompare(b.banner_key))
                .map((banner) => (
                  <div 
                    key={banner.id}
                    className="p-4 border rounded-xl bg-card"
                  >
                    {/* Preview */}
                    <div className="mb-4">
                      <Label className="text-sm font-medium mb-2 block">
                        {banner.name}
                      </Label>
                      <div className="relative aspect-[4/5] bg-muted rounded-lg overflow-hidden border">
                        {banner.currentImage ? (
                          <img 
                            src={banner.currentImage}
                            alt={banner.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                            Nenhuma imagem
                          </div>
                        )}
                        {banner.hasCustomImage && (
                          <div className="absolute top-2 left-2 bg-green-500 text-white text-xs px-2 py-1 rounded">
                            ✓
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Media Selector Button */}
                    <Button
                      className="bg-[#FB8C00] hover:bg-[#FB8C00]/90 text-white w-full"
                      onClick={() => handleOpenSelector(banner.id)}
                      disabled={updateBannerMutation.isPending}
                      size="sm"
                    >
                      {updateBannerMutation.isPending && selectedBannerId === banner.id ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <RefreshCw className="h-4 w-4 mr-2" />
                      )}
                      Substituir
                    </Button>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>

        {/* Other Banners Section */}
        <Card>
          <CardHeader>
            <CardTitle className="text-xl flex items-center gap-3">
              <div className="p-2 bg-[#6a1b9a]/10 rounded-lg">
                <FileText className="h-6 w-6 text-[#6a1b9a]" />
              </div>
              Banners das Seções da Landing Page
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-6">
              Gerencie os banners das demais seções. As alterações são refletidas automaticamente na landing page.
            </p>

            {/* Other Banners Grid */}
            <div className="space-y-6">
              {banners
                .filter((banner) => banner.banner_key.startsWith('banner_'))
                .map((banner) => (
                  <div 
                    key={banner.id}
                    className="p-6 border rounded-xl bg-card"
                  >
                    <div className="flex flex-col lg:flex-row gap-6">
                      {/* Preview */}
                      <div className="lg:w-1/3">
                        <Label className="text-sm font-medium mb-2 block">
                          Preview Atual
                        </Label>
                        <div className="relative aspect-video bg-muted rounded-lg overflow-hidden border">
                          <img 
                            src={banner.currentImage}
                            alt={banner.name}
                            className="w-full h-full object-cover"
                          />
                          {banner.hasCustomImage && (
                            <div className="absolute top-2 left-2 bg-green-500 text-white text-xs px-2 py-1 rounded">
                              Personalizado
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Info and Controls */}
                      <div className="lg:w-2/3 space-y-4">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <ImageIcon className="h-5 w-5 text-[#6a1b9a]" />
                            <h3 className="text-lg font-semibold">{banner.name}</h3>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {banner.description}
                          </p>
                        </div>

                        {/* Technical Info */}
                        <div className="p-4 bg-muted/50 rounded-lg">
                          <p className="text-sm font-medium text-muted-foreground">
                            Tamanho recomendado: {banner.width > 0 ? (
                              <>
                                <span className="text-foreground font-semibold">
                                  {banner.width} × {banner.height} px
                                </span>
                                {' · '}Formato: <span className="text-foreground font-semibold">
                                  {banner.format}
                                </span>
                                {' · '}Proporção: <span className="text-foreground font-semibold">
                                  {banner.aspectRatio}
                                </span>
                              </>
                            ) : (
                              <span className="text-muted-foreground">Carregando...</span>
                            )}
                          </p>
                        </div>

                        {/* Media Selector Button */}
                        <div>
                          <Button
                            className="bg-[#FB8C00] hover:bg-[#FB8C00]/90 text-white w-full sm:w-auto"
                            onClick={() => handleOpenSelector(banner.id)}
                            disabled={updateBannerMutation.isPending}
                          >
                            {updateBannerMutation.isPending && selectedBannerId === banner.id ? (
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            ) : (
                              <RefreshCw className="h-4 w-4 mr-2" />
                            )}
                            Substituir Banner
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>

        {/* Content Sections Card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-xl flex items-center gap-3">
              <div className="p-2 bg-[#6a1b9a]/10 rounded-lg">
                <MessageSquare className="h-6 w-6 text-[#6a1b9a]" />
              </div>
              Conteúdo Textual da Landing Page
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-6">
              Edite os textos, títulos, subtítulos e CTAs de cada seção da landing page. As alterações são refletidas automaticamente.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {contentSections.map((section) => {
                  const IconComponent = section.icon;
                  return (
                    <div
                      key={section.key}
                      className="p-4 border rounded-lg bg-card hover:border-[#6a1b9a]/30 transition-colors"
                    >
                      <div className="flex items-start gap-3">
                        <div className="p-2 bg-[#6a1b9a]/10 rounded-lg shrink-0">
                          <IconComponent className="h-5 w-5 text-[#6a1b9a]" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium text-sm mb-1">{section.name}</h4>
                          <p className="text-xs text-muted-foreground mb-3">{section.description}</p>
                          <Button
                            size="sm"
                            variant="outline"
                            className="w-full border-[#FB8C00] text-[#FB8C00] hover:bg-[#FB8C00] hover:text-white"
                            onClick={() => setActiveModal(section.key)}
                          >
                            <Edit className="h-3 w-3 mr-1" />
                            Editar
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>
          </CardContent>
        </Card>

        {/* Footer Content Section Card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-xl flex items-center gap-3">
              <div className="p-2 bg-[#6a1b9a]/10 rounded-lg">
                <Layout className="h-6 w-6 text-[#6a1b9a]" />
              </div>
              Conteúdo do Rodapé da Landing Page
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-6">
              Gerencie logo, subtítulo, redes sociais e links exibidos no rodapé da Landing Page.
            </p>

            <div
              className="p-4 border rounded-lg bg-card hover:border-[#6a1b9a]/30 transition-colors max-w-sm"
            >
              <div className="flex items-start gap-3">
                <div className="p-2 bg-[#6a1b9a]/10 rounded-lg shrink-0">
                  <Layout className="h-5 w-5 text-[#6a1b9a]" />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-medium text-sm mb-1">CMS – Rodapé</h4>
                  <p className="text-xs text-muted-foreground mb-3">Logo, slogan, redes sociais e colunas de links</p>
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full border-[#FB8C00] text-[#FB8C00] hover:bg-[#FB8C00] hover:text-white"
                    onClick={() => setActiveModal("footer")}
                  >
                    <Edit className="h-3 w-3 mr-1" />
                    Editar
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Institutional Pages Section Card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-xl flex items-center gap-3">
              <div className="p-2 bg-[#6a1b9a]/10 rounded-lg">
                <FileText className="h-6 w-6 text-[#6a1b9a]" />
              </div>
              Páginas Institucionais
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-6">
              Gerencie o conteúdo das páginas institucionais vinculadas ao rodapé da Landing Page (Sobre Nós, Blog, etc).
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {/* Sobre Nós Page */}
                <div
                  className="p-4 border rounded-lg bg-card hover:border-[#6a1b9a]/30 transition-colors"
                >
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-[#6a1b9a]/10 rounded-lg shrink-0">
                      <FileText className="h-5 w-5 text-[#6a1b9a]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-sm mb-1">Sobre Nós</h4>
                      <p className="text-xs text-muted-foreground mb-3">Página institucional com texto e imagem</p>
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full border-[#FB8C00] text-[#FB8C00] hover:bg-[#FB8C00] hover:text-white"
                        onClick={() => setActiveModal("about_us")}
                      >
                        <Edit className="h-3 w-3 mr-1" />
                        Editar
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Política de Cookies Page */}
                <div
                  className="p-4 border rounded-lg bg-card hover:border-[#6a1b9a]/30 transition-colors"
                >
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-[#6a1b9a]/10 rounded-lg shrink-0">
                      <FileText className="h-5 w-5 text-[#6a1b9a]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-sm mb-1">Política de Cookies</h4>
                      <p className="text-xs text-muted-foreground mb-3">Conformidade com a LGPD</p>
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full border-[#FB8C00] text-[#FB8C00] hover:bg-[#FB8C00] hover:text-white"
                        onClick={() => setActiveModal("cookie_policy")}
                      >
                        <Edit className="h-3 w-3 mr-1" />
                        Editar
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Termos de Uso Page */}
                <div
                  className="p-4 border rounded-lg bg-card hover:border-[#6a1b9a]/30 transition-colors"
                >
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-[#6a1b9a]/10 rounded-lg shrink-0">
                      <FileText className="h-5 w-5 text-[#6a1b9a]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-sm mb-1">Termos de Uso</h4>
                      <p className="text-xs text-muted-foreground mb-3">Termos legais e condições de uso</p>
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full border-[#FB8C00] text-[#FB8C00] hover:bg-[#FB8C00] hover:text-white"
                        onClick={() => setActiveModal("terms_of_use")}
                      >
                        <Edit className="h-3 w-3 mr-1" />
                        Editar
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Política de Privacidade Page */}
                <div
                  className="p-4 border rounded-lg bg-card hover:border-[#6a1b9a]/30 transition-colors"
                >
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-[#6a1b9a]/10 rounded-lg shrink-0">
                      <FileText className="h-5 w-5 text-[#6a1b9a]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-sm mb-1">Política de Privacidade</h4>
                      <p className="text-xs text-muted-foreground mb-3">Conformidade com a LGPD</p>
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full border-[#FB8C00] text-[#FB8C00] hover:bg-[#FB8C00] hover:text-white"
                        onClick={() => setActiveModal("privacy_policy")}
                      >
                        <Edit className="h-3 w-3 mr-1" />
                        Editar
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Central de Ajuda Page */}
                <div
                  className="p-4 border rounded-lg bg-card hover:border-[#6a1b9a]/30 transition-colors"
                >
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-[#6a1b9a]/10 rounded-lg shrink-0">
                      <HelpCircle className="h-5 w-5 text-[#6a1b9a]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-sm mb-1">Central de Ajuda</h4>
                      <p className="text-xs text-muted-foreground mb-3">Categorias e artigos de suporte</p>
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full border-[#FB8C00] text-[#FB8C00] hover:bg-[#FB8C00] hover:text-white"
                        onClick={() => setActiveModal("help_center")}
                      >
                        <Edit className="h-3 w-3 mr-1" />
                        Editar
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Fale Conosco Page */}
                <div
                  className="p-4 border rounded-lg bg-card hover:border-[#6a1b9a]/30 transition-colors"
                >
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-[#6a1b9a]/10 rounded-lg shrink-0">
                      <Phone className="h-5 w-5 text-[#6a1b9a]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-sm mb-1">Fale Conosco</h4>
                      <p className="text-xs text-muted-foreground mb-3">Formulários de contato e e-mails</p>
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full border-[#FB8C00] text-[#FB8C00] hover:bg-[#FB8C00] hover:text-white"
                        onClick={() => setActiveModal("contact")}
                      >
                        <Edit className="h-3 w-3 mr-1" />
                        Editar
                      </Button>
                    </div>
                  </div>
              </div>
            </div>

          </CardContent>
        </Card>
      </div>

      {/* Media Selector Modal */}
      <MediaSelectorModal
        isOpen={selectorOpen}
        onClose={() => {
          setSelectorOpen(false);
          setSelectedBannerId(null);
        }}
        onSelect={handleSelectMedia}
        allowedTypes={["image"]}
        title="Selecionar Imagem da Biblioteca"
      />

      {/* Content Modals */}
      <CMSHeaderModal
        isOpen={activeModal === "header"}
        onClose={() => setActiveModal(null)}
        content={cmsContent["header"]}
        onSave={(content) => handleSaveContent("header", content)}
      />
      <CMSHeroModal
        isOpen={activeModal === "hero"}
        onClose={() => setActiveModal(null)}
        content={cmsContent["hero"]}
        onSave={(content) => handleSaveContent("hero", content)}
      />
      <CMSProductsModal
        isOpen={activeModal === "products"}
        onClose={() => setActiveModal(null)}
        content={cmsContent["products"]}
        onSave={(content) => handleSaveContent("products", content)}
      />
      <CMSSocialProofModal
        isOpen={activeModal === "social_proof_1"}
        onClose={() => setActiveModal(null)}
        content={cmsContent["social_proof_1"]}
        onSave={(content) => handleSaveContent("social_proof_1", content)}
      />
      <CMSSalesPaymentsModal
        isOpen={activeModal === "sales_payments"}
        onClose={() => setActiveModal(null)}
        content={cmsContent["sales_payments"]}
        onSave={(content) => handleSaveContent("sales_payments", content)}
      />
      <CMSResourcesModal
        isOpen={activeModal === "resources"}
        onClose={() => setActiveModal(null)}
        content={cmsContent["resources"]}
        onSave={(content) => handleSaveContent("resources", content)}
      />
      <CMSResourceCardsModal
        isOpen={activeModal === "resource_cards"}
        onClose={() => setActiveModal(null)}
        content={cmsContent["resource_cards"]}
        onSave={(content) => handleSaveContent("resource_cards", content)}
      />
      <CMSTestimonialsModal
        isOpen={activeModal === "testimonials"}
        onClose={() => setActiveModal(null)}
        content={cmsContent["testimonials"]}
        onSave={(content) => handleSaveContent("testimonials", content)}
      />
      <CMSHowItWorksModal
        isOpen={activeModal === "how_it_works"}
        onClose={() => setActiveModal(null)}
        content={cmsContent["how_it_works"]}
        onSave={(content) => handleSaveContent("how_it_works", content)}
      />
      <CMSPlansModal
        isOpen={activeModal === "plans"}
        onClose={() => setActiveModal(null)}
        content={cmsContent["plans"]}
        onSave={(content) => handleSaveContent("plans", content)}
      />
      <CMSFaqModal
        isOpen={activeModal === "faq"}
        onClose={() => setActiveModal(null)}
        content={cmsContent["faq"]}
        onSave={(content) => handleSaveContent("faq", content)}
      />
      <CMSFooterModal
        isOpen={activeModal === "footer"}
        onClose={() => setActiveModal(null)}
        content={cmsContent["footer"]}
        onSave={(content) => handleSaveContent("footer", content)}
      />
      <CMSAboutUsModal
        isOpen={activeModal === "about_us"}
        onClose={() => setActiveModal(null)}
        content={cmsContent["about_us"]}
        onSave={(content) => handleSaveContent("about_us", content)}
      />
      <CMSTermsOfUseModal
        isOpen={activeModal === "terms_of_use"}
        onClose={() => setActiveModal(null)}
        content={cmsContent["terms_of_use"]}
        onSave={(content) => handleSaveContent("terms_of_use", content)}
      />
      <CMSPrivacyPolicyModal
        isOpen={activeModal === "privacy_policy"}
        onClose={() => setActiveModal(null)}
        content={cmsContent["privacy_policy"]}
        onSave={(content) => handleSaveContent("privacy_policy", content)}
      />
      <CMSCookiePolicyModal
        isOpen={activeModal === "cookie_policy"}
        onClose={() => setActiveModal(null)}
        content={cmsContent["cookie_policy"]}
        onSave={(content) => handleSaveContent("cookie_policy", content)}
      />
      <CMSHelpCenterModal
        isOpen={activeModal === "help_center"}
        onClose={() => setActiveModal(null)}
      />
      <CMSContactModal
        open={activeModal === "contact"}
        onOpenChange={(open) => !open && setActiveModal(null)}
      />
    </AdminLayout>
  );
};

export default AdminCMS;
