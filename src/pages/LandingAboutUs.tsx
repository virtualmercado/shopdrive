import { useCMSContent, getContent } from "@/hooks/useCMSContent";
import { Skeleton } from "@/components/ui/skeleton";
import LandingLayout from "@/components/layout/LandingLayout";

const LandingAboutUs = () => {
  const { data: cmsContent, isLoading } = useCMSContent();

  // About Us content from CMS
  const aboutUsContent = {
    title: getContent(cmsContent, "about_us", "title", "Sobre Nós"),
    content: getContent(cmsContent, "about_us", "content", "Informações sobre a ShopDrive..."),
    image_url: getContent(cmsContent, "about_us", "image_url", ""),
    image_alt: getContent(cmsContent, "about_us", "image_alt", "Sobre a ShopDrive"),
    is_active: cmsContent?.about_us?.is_active ?? true,
  };

  if (isLoading) {
    return (
      <LandingLayout>
        <div className="container mx-auto px-4 py-16">
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-12">
            <div className="lg:col-span-3 space-y-4">
              <Skeleton className="h-10 w-1/2" />
              <Skeleton className="h-48 w-full" />
            </div>
            <div className="lg:col-span-2">
              <Skeleton className="h-96 w-full" />
            </div>
          </div>
        </div>
      </LandingLayout>
    );
  }

  return (
    <LandingLayout>
      {/* Main Content - Two Column Layout */}
      <div className="py-24 md:py-32 px-4 bg-background">
        <div className="container mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 lg:gap-12">
            {/* Left Column - Text Content (60%) */}
            <div className="lg:col-span-3 space-y-6">
              <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-foreground">
                {aboutUsContent.title}
              </h1>
              
              <div className="prose prose-lg max-w-none">
                {aboutUsContent.content.split('\n\n').map((paragraph, index) => (
                  <p 
                    key={index} 
                    className="text-lg leading-relaxed mb-4"
                    style={{ color: '#5A5A5A' }}
                  >
                    {paragraph}
                  </p>
                ))}
              </div>
            </div>
            
            {/* Right Column - Image (40%) */}
            <div className="lg:col-span-2">
              {aboutUsContent.image_url ? (
                <img 
                  src={aboutUsContent.image_url} 
                  alt={aboutUsContent.image_alt}
                  className="w-full h-auto rounded-lg shadow-lg object-cover aspect-[3/4]"
                />
              ) : (
                <div className="w-full aspect-[3/4] bg-gradient-to-br from-primary/20 to-secondary/20 rounded-lg flex items-center justify-center">
                  <div className="text-center p-8">
                    <div className="text-6xl mb-4">🏪</div>
                    <p className="text-muted-foreground text-lg">
                      Imagem não configurada
                    </p>
                    <p className="text-sm text-muted-foreground mt-2">
                      Configure no CMS do Painel Master
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </LandingLayout>
  );
};

export default LandingAboutUs;
