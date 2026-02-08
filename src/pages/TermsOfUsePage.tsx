import { useCMSContent, getContent } from "@/hooks/useCMSContent";
import { Skeleton } from "@/components/ui/skeleton";
import LandingLayout from "@/components/layout/LandingLayout";

const TermsOfUsePage = () => {
  const { data: cmsContent, isLoading } = useCMSContent();

  // Terms of Use content from CMS
  const termsContent = {
    title: getContent(cmsContent, "terms_of_use", "title", "TERMOS DE USO — SHOPDRIVE"),
    content: getContent(cmsContent, "terms_of_use", "content", defaultTermsContent),
    is_active: cmsContent?.terms_of_use?.is_active ?? true,
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
            {termsContent.title}
          </h1>
          
          {/* Content */}
          <div className="prose prose-lg max-w-none">
            {renderContent(termsContent.content)}
          </div>
        </div>
      </div>
    </LandingLayout>
  );
};

// Default terms content in Portuguese
const defaultTermsContent = `IDENTIFICAÇÃO DA PLATAFORMA

A ShopDrive é operada por:
Razão Social: [INSERIR RAZÃO SOCIAL]
CNPJ: [INSERIR CNPJ]
E-mail jurídico: [INSERIR E-MAIL JURÍDICO]

DEFINIÇÕES

"ShopDrive" significa a plataforma ShopDrive.
"Lojista" é a pessoa física ou jurídica que cria uma loja na plataforma.
"Loja" é a página de vendas criada pelo lojista dentro da ShopDrive.
"Cliente final" é o consumidor que compra diretamente do lojista.

SERVIÇOS OFERECIDOS

A ShopDrive fornece:

- Plataforma de criação de lojas online
- Catálogo de produtos
- Checkout e integração com meios de pagamento
- Hospedagem das páginas
- Ferramentas de gestão e automação

O QUE A SHOPDRIVE NÃO FAZ

A ShopDrive não:

- Vende produtos ao consumidor final
- Possui estoque
- Realiza entregas
- Emite notas fiscais pelos lojistas
- Se responsabiliza por defeitos, atrasos ou qualidade dos produtos

RESPONSABILIDADE DO LOJISTA

O lojista é o único responsável por:

- Produtos anunciados
- Preços e promoções
- Estoque e logística
- Emissão de notas fiscais
- Tributos e obrigações legais
- Atendimento ao cliente
- Garantias e devoluções

PAGAMENTOS E PLANOS

A ShopDrive opera por meio de planos de assinatura.
O lojista paga para utilizar a plataforma, independentemente de suas vendas.
A ShopDrive não garante volume de vendas, faturamento ou lucro.

CANCELAMENTO E ENCERRAMENTO

O lojista pode cancelar sua conta a qualquer momento conforme regras do painel.
A ShopDrive pode encerrar contas que:

- Violem a lei
- Vendam produtos proibidos
- Causem danos à plataforma ou terceiros
- Utilizem a plataforma de forma fraudulenta

LIMITAÇÃO DE RESPONSABILIDADE

A ShopDrive não se responsabiliza por:

- Perdas financeiras do lojista
- Problemas entre lojista e cliente final
- Chargebacks, fraudes ou disputas
- Erros causados por integrações externas

A responsabilidade da ShopDrive se limita ao valor pago pelo lojista à plataforma.

FORO JURÍDICO

Fica eleito o foro da cidade de [INSERIR CIDADE] – [INSERIR ESTADO], para dirimir quaisquer conflitos.`;

export default TermsOfUsePage;
