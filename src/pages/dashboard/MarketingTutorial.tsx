import { useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, ExternalLink, CheckCircle2, AlertTriangle, Info, BookOpen } from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";

interface TutorialStep {
  title: string;
  content: string;
  tip?: string;
  warning?: string;
}

interface TutorialData {
  title: string;
  subtitle: string;
  version: string;
  requirements?: string[];
  steps: TutorialStep[];
  importantNotes?: string[];
  externalLink?: {
    label: string;
    url: string;
  };
}

const tutorials: Record<string, TutorialData> = {
  'instagram-shopping': {
    title: 'Como ativar o Instagram Shopping na VM',
    subtitle: 'Conecte sua loja da VM à sacolinha do Instagram para marcar produtos nas suas postagens e stories.',
    version: '2026.01',
    requirements: [
      'Conta comercial no Instagram',
      'Conta no Gerenciador de Negócios da Meta',
      'Um catálogo de produtos aprovado pela Meta',
      'Domínio da sua loja verificado'
    ],
    steps: [
      {
        title: 'Transformar o Instagram em conta comercial',
        content: 'Acesse seu perfil no Instagram, vá em Configurações → Conta e ative a opção Conta profissional.',
      },
      {
        title: 'Vincular o Instagram ao Gerenciador de Negócios',
        content: 'Acesse o Gerenciador de Negócios da Meta, vá em Configurações → Contas → Contas do Instagram e adicione sua conta do Instagram.',
      },
      {
        title: 'Criar ou selecionar um catálogo de produtos',
        content: 'No Gerenciador da Meta, acesse Catálogos, crie um catálogo ou selecione um existente e escolha Comércio eletrônico.',
        tip: 'Esse catálogo será usado para a sacolinha.'
      },
      {
        title: 'Verificar o domínio da sua loja',
        content: 'A Meta exige que o domínio da loja seja verificado. Siga o tutorial específico de verificação de domínio dentro da VM.',
        warning: 'Sem a verificação do domínio, a sacolinha não será liberada.'
      },
      {
        title: 'Solicitar ativação da sacolinha',
        content: 'No Instagram, vá em Configurações → Empresa → Compras e solicite a ativação. Aguarde a análise da Meta (pode levar alguns dias).',
      }
    ],
    importantNotes: [
      'A aprovação não é imediata',
      'A Meta pode recusar e pedir ajustes',
      'O status aparece como "Em análise" durante o processo'
    ],
    externalLink: {
      label: 'Acessar página oficial da Meta Shops',
      url: 'https://www.facebook.com/business/shops'
    }
  },
  'domain-verification': {
    title: 'Como verificar seu domínio para o Instagram Shopping',
    subtitle: 'A verificação de domínio é obrigatória para ativar a sacolinha e usar pixels de conversão.',
    version: '2026.01',
    steps: [
      {
        title: 'Acessar o Gerenciador de Negócios',
        content: 'Entre no Gerenciador de Negócios da Meta e vá em Configurações do negócio.',
      },
      {
        title: 'Acessar Domínios',
        content: 'Clique em Segurança da marca, depois em Domínios e clique em Adicionar domínio.',
      },
      {
        title: 'Escolher método HTML',
        content: 'Selecione a opção Verificação por código HTML.',
        tip: 'Copie somente o código fornecido (meta tag).'
      },
      {
        title: 'Inserir o código na VM',
        content: 'Volte ao painel da VM, acesse Marketing → Pixels de Conversão, clique em Inserir código HTML, cole o código copiado e salve.',
      },
      {
        title: 'Confirmar verificação',
        content: 'Volte ao Gerenciador da Meta e clique em Verificar domínio. Se estiver correto, o domínio será aprovado.',
      }
    ],
    externalLink: {
      label: 'Acessar Gerenciador de Negócios da Meta',
      url: 'https://business.facebook.com/'
    }
  },
  'meta-pixel': {
    title: 'Como encontrar e inserir o Pixel da Meta na VM',
    subtitle: 'O Pixel da Meta permite medir visitas, carrinhos e vendas do Facebook e Instagram.',
    version: '2026.01',
    steps: [
      {
        title: 'Criar o Pixel',
        content: 'Acesse o Gerenciador de Eventos da Meta, clique em Conectar fonte de dados e escolha Web → Pixel da Meta.',
      },
      {
        title: 'Copiar o ID do Pixel',
        content: 'Copie somente o número do Pixel (15-16 dígitos).',
        warning: 'Não copie o código completo, apenas o ID numérico.'
      },
      {
        title: 'Inserir o Pixel na VM',
        content: 'Vá em Marketing → Pixels de Conversão, cole o ID no campo Pixel da Meta e clique em Salvar.',
      }
    ],
    importantNotes: [
      'O Pixel começa a coletar dados automaticamente após ser salvo',
      'Use o Facebook Pixel Helper (extensão do Chrome) para testar',
      'Eventos padrão como "AddToCart" e "Purchase" melhoram resultados de anúncios'
    ],
    externalLink: {
      label: 'Acessar Gerenciador de Eventos da Meta',
      url: 'https://www.facebook.com/events_manager/'
    }
  },
  'tiktok-pixel': {
    title: 'Como integrar o Pixel do TikTok na VM',
    subtitle: 'Configure o pixel para rastrear conversões das suas campanhas no TikTok Ads.',
    version: '2026.01',
    steps: [
      {
        title: 'Criar o Pixel no TikTok Ads',
        content: 'Acesse o TikTok Ads Manager, vá em Ferramentas → Eventos e crie um novo Pixel.',
      },
      {
        title: 'Copiar o ID do Pixel',
        content: 'Copie somente o ID do Pixel fornecido pelo TikTok.',
        tip: 'O ID geralmente começa com letras e números.'
      },
      {
        title: 'Inserir o Pixel na VM',
        content: 'No painel da VM, acesse Marketing → Pixels de Conversão, cole o ID no campo TikTok Pixel e clique em Salvar.',
      }
    ],
    importantNotes: [
      'O TikTok pode levar algumas horas para validar eventos',
      'Eventos avançados exigem configurações adicionais no TikTok',
      'Recomendamos configurar eventos que cubram toda jornada do cliente'
    ],
    externalLink: {
      label: 'Acessar TikTok Ads Manager',
      url: 'https://ads.tiktok.com/'
    }
  },
  'google-ads': {
    title: 'Como encontrar o ID da Google Tag (Google Ads)',
    subtitle: 'Configure a tag do Google Ads para rastrear conversões das suas campanhas.',
    version: '2026.01',
    steps: [
      {
        title: 'Acessar o Google Ads',
        content: 'Entre na sua conta do Google Ads.',
      },
      {
        title: 'Abrir Ferramentas',
        content: 'Clique em Ferramentas e Configurações e depois em Tags do Google.',
      },
      {
        title: 'Copiar o ID',
        content: 'Copie somente o código no formato AW-XXXXXXXXXX.',
        tip: 'O código sempre começa com "AW-" seguido de números.'
      },
      {
        title: 'Inserir na VM',
        content: 'Acesse Marketing → Pixels de Conversão, cole o ID no campo Google Ads e clique em Salvar.',
      }
    ],
    externalLink: {
      label: 'Acessar Google Ads',
      url: 'https://ads.google.com/'
    }
  },
  'gtm': {
    title: 'Como encontrar a Tag do Google Tag Manager',
    subtitle: 'O GTM permite gerenciar todas as suas tags de marketing em um só lugar.',
    version: '2026.01',
    steps: [
      {
        title: 'Acessar o Google Tag Manager',
        content: 'Faça login no Google Tag Manager.',
      },
      {
        title: 'Copiar o ID',
        content: 'Copie o código no formato GTM-XXXXXXX (visível no topo da tela após selecionar seu container).',
        tip: 'O código sempre começa com "GTM-" seguido de letras e números.'
      },
      {
        title: 'Inserir na VM',
        content: 'Vá em Marketing → Pixels de Conversão, cole o ID no campo Google Tag Manager e clique em Salvar.',
      }
    ],
    importantNotes: [
      'Com o GTM você pode adicionar outros pixels e tags sem precisar editar código',
      'Recomendado para lojas que usam múltiplas plataformas de anúncios'
    ],
    externalLink: {
      label: 'Acessar Google Tag Manager',
      url: 'https://tagmanager.google.com/'
    }
  }
};

const MarketingTutorial = () => {
  const { tutorialId } = useParams<{ tutorialId: string }>();
  const navigate = useNavigate();
  const { buttonBgColor, buttonTextColor } = useTheme();

  const handleSmoothNavigation = useCallback((path: string) => {
    const pageContent = document.querySelector('[data-page-content]');
    if (pageContent) {
      pageContent.classList.add('page-exit');
      setTimeout(() => {
        navigate(path);
      }, 700);
    } else {
      navigate(path);
    }
  }, [navigate]);

  const tutorial = tutorialId ? tutorials[tutorialId] : null;

  if (!tutorial) {
    return (
      <div className="min-h-screen bg-muted/30 p-6">
        <div className="max-w-3xl mx-auto">
          <Card>
            <CardContent className="py-12 text-center">
              <BookOpen className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h2 className="text-xl font-semibold mb-2">Tutorial não encontrado</h2>
              <p className="text-muted-foreground mb-4">O tutorial solicitado não está disponível.</p>
              <Button onClick={() => handleSmoothNavigation('/lojista/marketing')}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Voltar ao painel
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Minimal Header */}
      <div className="bg-white border-b sticky top-0 z-40">
        <div className="max-w-3xl mx-auto px-6 py-4">
          <Button 
            variant="ghost" 
            onClick={() => handleSmoothNavigation('/lojista/marketing')}
            className="gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar ao painel
          </Button>
        </div>
      </div>

      {/* Tutorial Content */}
      <main className="max-w-3xl mx-auto px-6 py-8 page-enter" data-page-content>
        <div className="space-y-8">
          {/* Title */}
          <div>
            <h1 className="text-2xl font-bold text-foreground">{tutorial.title}</h1>
            <p className="text-[#515151] mt-2">{tutorial.subtitle}</p>
            <p className="text-xs text-muted-foreground mt-2">
              Versão do tutorial: {tutorial.version} – Última revisão oficial das plataformas
            </p>
          </div>

          {/* Requirements */}
          {tutorial.requirements && tutorial.requirements.length > 0 && (
            <Card className="bg-yellow-50 border-yellow-200">
              <CardContent className="py-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-medium text-yellow-800">✅ Antes de começar (requisitos obrigatórios)</p>
                    <p className="text-sm text-yellow-700 mt-1">Você precisa ter:</p>
                    <ul className="list-disc list-inside text-sm text-yellow-700 mt-2 space-y-1">
                      {tutorial.requirements.map((req, index) => (
                        <li key={index}>{req}</li>
                      ))}
                    </ul>
                    <p className="text-sm text-yellow-800 font-medium mt-3">
                      ⚠️ Sem esses requisitos, a integração não será liberada.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Steps */}
          <div className="space-y-6">
            {tutorial.steps.map((step, index) => (
              <Card key={index}>
                <CardContent className="py-5">
                  <div className="flex items-start gap-4">
                    <div 
                      className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm"
                      style={{ backgroundColor: buttonBgColor }}
                    >
                      {index + 1}
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-foreground">Passo {index + 1} — {step.title}</h3>
                      <p className="text-[#515151] mt-2">{step.content}</p>
                      
                      {step.tip && (
                        <div className="flex items-start gap-2 mt-3 p-3 bg-blue-50 rounded-lg">
                          <Info className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                          <p className="text-sm text-blue-700">📌 {step.tip}</p>
                        </div>
                      )}
                      
                      {step.warning && (
                        <div className="flex items-start gap-2 mt-3 p-3 bg-red-50 rounded-lg">
                          <AlertTriangle className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
                          <p className="text-sm text-red-700">⚠️ {step.warning}</p>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Important Notes */}
          {tutorial.importantNotes && tutorial.importantNotes.length > 0 && (
            <>
              <Separator />
              <Card className="bg-blue-50 border-blue-200">
                <CardContent className="py-4">
                  <div className="flex items-start gap-3">
                    <Info className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="font-medium text-blue-800">📌 Importante saber</p>
                      <ul className="list-disc list-inside text-sm text-blue-700 mt-2 space-y-1">
                        {tutorial.importantNotes.map((note, index) => (
                          <li key={index}>{note}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </>
          )}

          {/* Actions */}
          <Separator />
          <div className="flex flex-wrap gap-4">
            <Button 
              onClick={() => handleSmoothNavigation('/lojista/marketing')}
              style={{ backgroundColor: buttonBgColor, color: buttonTextColor }}
            >
              <CheckCircle2 className="h-4 w-4 mr-2" />
              Voltar ao painel
            </Button>
            
            {tutorial.externalLink && (
              <Button 
                variant="outline"
                onClick={() => window.open(tutorial.externalLink?.url, '_blank')}
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                {tutorial.externalLink.label}
              </Button>
            )}
          </div>

          {/* Completion Note */}
          <Card className="bg-green-50 border-green-200">
            <CardContent className="py-4">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5" />
                <div>
                  <p className="font-medium text-green-800">🔁 Concluiu todos os passos?</p>
                  <p className="text-sm text-green-700 mt-1">
                    Clique em "Voltar ao painel" e acompanhe o status da integração.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default MarketingTutorial;
