import AdminLayout from "@/components/layout/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  FileText,
  Upload,
  Image as ImageIcon,
  RefreshCw
} from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { toast } from "sonner";
import heroImage from "@/assets/hero-banner.jpg";
import benefitsImage from "@/assets/benefits-handshake.jpg";
import benefitsMobile from "@/assets/benefits-mobile.jpg";

interface BannerInfo {
  id: string;
  name: string;
  description: string;
  currentImage: string;
  width: number;
  height: number;
  format: string;
  aspectRatio: string;
}

const AdminCMS = () => {
  const [banners, setBanners] = useState<BannerInfo[]>([
    {
      id: 'banner_01',
      name: 'Banner 01',
      description: 'Banner principal da seção Hero (topo da landing page)',
      currentImage: heroImage,
      width: 0,
      height: 0,
      format: '',
      aspectRatio: ''
    },
    {
      id: 'banner_02',
      name: 'Banner 02',
      description: 'Imagem da seção "Seus produtos disponíveis em todos os lugares"',
      currentImage: benefitsImage,
      width: 0,
      height: 0,
      format: '',
      aspectRatio: ''
    },
    {
      id: 'banner_03',
      name: 'Banner 03',
      description: 'Imagem da seção "Venda através do WhatsApp ou aceite pagamentos"',
      currentImage: benefitsMobile,
      width: 0,
      height: 0,
      format: '',
      aspectRatio: ''
    }
  ]);

  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  // Calculate aspect ratio
  const calculateAspectRatio = (width: number, height: number): string => {
    const gcd = (a: number, b: number): number => b === 0 ? a : gcd(b, a % b);
    const divisor = gcd(width, height);
    const w = width / divisor;
    const h = height / divisor;
    
    // Common aspect ratios
    const ratio = width / height;
    if (Math.abs(ratio - 16/9) < 0.1) return '16:9';
    if (Math.abs(ratio - 4/3) < 0.1) return '4:3';
    if (Math.abs(ratio - 3/2) < 0.1) return '3:2';
    if (Math.abs(ratio - 1) < 0.1) return '1:1';
    if (Math.abs(ratio - 9/16) < 0.1) return '9:16';
    if (Math.abs(ratio - 3/4) < 0.1) return '3:4';
    if (Math.abs(ratio - 2/3) < 0.1) return '2:3';
    
    return `${w}:${h}`;
  };

  // Get format from URL
  const getFormat = (url: string): string => {
    const extension = url.split('.').pop()?.toLowerCase() || '';
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
      default:
        return 'JPG ou PNG';
    }
  };

  // Load image dimensions
  useEffect(() => {
    banners.forEach((banner, index) => {
      const img = new Image();
      img.onload = () => {
        setBanners(prev => prev.map((b, i) => 
          i === index ? {
            ...b,
            width: img.naturalWidth,
            height: img.naturalHeight,
            format: getFormat(b.currentImage),
            aspectRatio: calculateAspectRatio(img.naturalWidth, img.naturalHeight)
          } : b
        ));
      };
      img.src = banner.currentImage;
    });
  }, []);

  const handleUploadClick = (bannerId: string) => {
    fileInputRefs.current[bannerId]?.click();
  };

  const handleFileChange = (bannerId: string, event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      toast.error('Formato inválido. Use JPG, PNG ou WebP.');
      return;
    }

    // Create preview URL
    const previewUrl = URL.createObjectURL(file);
    
    // Get dimensions of new image
    const img = new Image();
    img.onload = () => {
      setBanners(prev => prev.map(b => 
        b.id === bannerId ? {
          ...b,
          currentImage: previewUrl,
          width: img.naturalWidth,
          height: img.naturalHeight,
          format: file.type.split('/')[1].toUpperCase(),
          aspectRatio: calculateAspectRatio(img.naturalWidth, img.naturalHeight)
        } : b
      ));
      toast.success(`Imagem do ${banners.find(b => b.id === bannerId)?.name} atualizada com sucesso!`);
      toast.info('Para aplicar na landing page, implemente a integração com o banco de dados.');
    };
    img.src = previewUrl;
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Main CMS Card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-xl flex items-center gap-3">
              <div className="p-2 bg-[#6a1b9a]/10 rounded-lg">
                <FileText className="h-6 w-6 text-[#6a1b9a]" />
              </div>
              CMS da Landing Page
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-6">
              Gerencie os banners e imagens da página inicial da VirtualMercado. As alterações serão refletidas na landing page após a implementação do vínculo com o banco de dados.
            </p>

            {/* Banners Grid */}
            <div className="space-y-6">
              {banners.map((banner) => (
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

                      {/* Upload Controls */}
                      <div className="flex flex-col sm:flex-row gap-3">
                        <div className="flex-1">
                          <Input
                            type="file"
                            accept="image/jpeg,image/png,image/webp"
                            className="hidden"
                            ref={(el) => fileInputRefs.current[banner.id] = el}
                            onChange={(e) => handleFileChange(banner.id, e)}
                          />
                          <Button
                            variant="outline"
                            className="w-full"
                            onClick={() => handleUploadClick(banner.id)}
                          >
                            <Upload className="h-4 w-4 mr-2" />
                            Selecionar Nova Imagem
                          </Button>
                        </div>
                        <Button
                          className="bg-[#FB8C00] hover:bg-[#FB8C00]/90 text-white"
                          onClick={() => handleUploadClick(banner.id)}
                        >
                          <RefreshCw className="h-4 w-4 mr-2" />
                          Substituir Banner
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Info Note */}
            <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-800">
                <strong>Nota:</strong> Este CMS está preparado para gerenciamento futuro dos banners. 
                Para ativar a funcionalidade completa de substituição de imagens na landing page, 
                será necessário implementar a integração com o armazenamento de arquivos no banco de dados.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
};

export default AdminCMS;
