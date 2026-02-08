import { useCMSContent, getContent } from "@/hooks/useCMSContent";
import { Skeleton } from "@/components/ui/skeleton";
import LandingLayout from "@/components/layout/LandingLayout";

const CookiePolicyPage = () => {
  const { data: cmsContent, isLoading } = useCMSContent();

  // Cookie Policy content from CMS
  const cookieContent = {
    title: getContent(cmsContent, "cookie_policy", "title", "POLÍTICA DE COOKIES — SHOPDRIVE"),
    content: getContent(cmsContent, "cookie_policy", "content", defaultCookieContent),
    is_active: cmsContent?.cookie_policy?.is_active ?? true,
  };

  if (isLoading) {
    return (
      <LandingLayout>
        <div className="py-24 md:py-32 px-4 bg-background">
          <div className="container mx-auto max-w-[900px]">
            <Skeleton className="h-12 w-2/3 mb-8" />
            <div className="space-y-4">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
            </div>
          </div>
        </div>
      </LandingLayout>
    );
  }

  // Parse content to render sections properly
  const renderContent = (content: string) => {
    const lines = content.split('\n');
    const elements: JSX.Element[] = [];
    let currentParagraph: string[] = [];

    const flushParagraph = () => {
      if (currentParagraph.length > 0) {
        const text = currentParagraph.join(' ');
        elements.push(
          <p 
            key={`p-${elements.length}`} 
            className="text-base leading-relaxed mb-4 text-justify"
            style={{ color: '#515151' }}
          >
            {text}
          </p>
        );
        currentParagraph = [];
      }
    };

    lines.forEach((line, index) => {
      const trimmedLine = line.trim();
      
      // Empty line = paragraph break
      if (trimmedLine === '') {
        flushParagraph();
        return;
      }

      // Section headers (all caps or ending with specific patterns)
      if (
        (trimmedLine === trimmedLine.toUpperCase() && trimmedLine.length > 3 && !trimmedLine.startsWith('-')) ||
        trimmedLine.match(/^[A-ZÁÉÍÓÚÂÊÎÔÛÃÕÇ\s]+$/)
      ) {
        flushParagraph();
        elements.push(
          <h2 
            key={`h2-${index}`} 
            className="text-xl font-bold mt-8 mb-4 text-foreground"
          >
            {trimmedLine}
          </h2>
        );
        return;
      }

      // List items (starting with -)
      if (trimmedLine.startsWith('-') || trimmedLine.startsWith('•')) {
        flushParagraph();
        elements.push(
          <li 
            key={`li-${index}`} 
            className="ml-6 mb-2 text-base leading-relaxed list-disc"
            style={{ color: '#515151' }}
          >
            {trimmedLine.substring(1).trim()}
          </li>
        );
        return;
      }

      // Regular text
      currentParagraph.push(trimmedLine);
    });

    // Flush any remaining paragraph
    flushParagraph();

    return elements;
  };

  return (
    <LandingLayout>
      {/* Main Content - Single Column Centered Layout */}
      <div className="py-24 md:py-32 px-4 bg-background">
        <div className="container mx-auto max-w-[900px]">
          {/* Title */}
          <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-8 text-center">
            {cookieContent.title}
          </h1>
          
          {/* Content */}
          <div className="prose prose-lg max-w-none">
            {renderContent(cookieContent.content)}
          </div>
        </div>
      </div>
    </LandingLayout>
  );
};

// Default cookie policy content in Portuguese
const defaultCookieContent = `O QUE SÃO COOKIES

Cookies são pequenos arquivos armazenados no seu navegador que permitem reconhecer preferências e melhorar sua experiência.

QUAIS COOKIES UTILIZAMOS

A ShopDrive utiliza:

- Cookies necessários: funcionamento da plataforma
- Cookies de desempenho: análise de uso
- Cookies de funcionalidade: lembrar preferências
- Cookies de marketing: anúncios e remarketing

PARA QUE USAMOS COOKIES

Os cookies são usados para:

- Manter você logado
- Salvar preferências
- Melhorar desempenho
- Analisar comportamento
- Exibir anúncios relevantes

COMO GERENCIAR

Você pode aceitar, recusar ou configurar cookies pelo banner ou pelo link no rodapé.

COMPARTILHAMENTO

Cookies podem ser definidos por:

- Gateways de pagamento
- Ferramentas de análise
- Plataformas de marketing

CONFORMIDADE LGPD

O uso de cookies respeita a Lei Geral de Proteção de Dados. Nenhum cookie não essencial é ativado sem consentimento.`;

export default CookiePolicyPage;
