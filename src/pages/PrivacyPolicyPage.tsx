import { useCMSContent, getContent } from "@/hooks/useCMSContent";
import { Skeleton } from "@/components/ui/skeleton";
import LandingLayout from "@/components/layout/LandingLayout";

const PrivacyPolicyPage = () => {
  const { data: cmsContent, isLoading } = useCMSContent();

  // Privacy Policy content from CMS
  const privacyContent = {
    title: getContent(cmsContent, "privacy_policy", "title", "POLÍTICA DE PRIVACIDADE — VIRTUALMERCADO"),
    content: getContent(cmsContent, "privacy_policy", "content", defaultPrivacyContent),
    is_active: cmsContent?.privacy_policy?.is_active ?? true,
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
            {privacyContent.title}
          </h1>
          
          {/* Content */}
          <div className="prose prose-lg max-w-none">
            {renderContent(privacyContent.content)}
          </div>
        </div>
      </div>
    </LandingLayout>
  );
};

// Default privacy content in Portuguese
const defaultPrivacyContent = `INTRODUÇÃO

A VirtualMercado ("VM") respeita a privacidade e a proteção dos dados pessoais de seus usuários e opera em conformidade com a Lei Geral de Proteção de Dados (Lei nº 13.709/2018 – LGPD).

Esta Política descreve como os dados são coletados, utilizados, armazenados e protegidos.

DADOS COLETADOS

A VM pode coletar os seguintes dados:

- Nome completo
- E-mail
- CPF ou CNPJ
- Endereço
- Telefone
- Endereço IP
- Dados de pagamento (processados por gateways)
- Informações de navegação

DE QUEM OS DADOS SÃO COLETADOS

Os dados são coletados de:

- Lojistas cadastrados na plataforma
- Compradores finais que realizam pedidos nas lojas

FINALIDADE DO USO DOS DADOS

Os dados são utilizados para:

- Criar e gerenciar contas
- Processar pedidos e pagamentos
- Executar cobranças de assinatura
- Emitir comunicações
- Cumprir obrigações legais
- Prevenir fraudes

COMPARTILHAMENTO DE DADOS

Os dados podem ser compartilhados apenas com:

- Gateways de pagamento (Pix, cartão, boleto)
- Empresas de logística e Correios
- Plataformas de e-mail e notificação
- WhatsApp (quando usado como canal de comunicação)

Sempre apenas na medida necessária para execução do serviço.

ARMAZENAMENTO E SEGURANÇA

A VM utiliza:

- Servidores seguros
- Criptografia de dados
- Controle de acesso
- Boas práticas de segurança da informação

para proteger os dados contra acesso não autorizado, vazamento ou uso indevido.

DIREITOS DO USUÁRIO

O usuário pode, a qualquer momento:

- Solicitar acesso aos seus dados
- Solicitar correção
- Solicitar exclusão
- Solicitar portabilidade
- Revogar consentimento

conforme garantido pela LGPD.

CONTATO DO DPO (ENCARREGADO DE DADOS)

Para exercer seus direitos ou esclarecer dúvidas:

E-mail do DPO: [INSERIR E-MAIL DE PRIVACIDADE]`;

export default PrivacyPolicyPage;
