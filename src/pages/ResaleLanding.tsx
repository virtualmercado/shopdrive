import { useEffect, useRef } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { useTemplateBySlug } from '@/hooks/useBrandTemplates';
import { useBrandTemplateProducts } from '@/hooks/useBrandTemplateProducts';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Loader2, ShoppingBag, Star, ArrowRight } from 'lucide-react';
import logoHeaderSD from '@/assets/logo-header-sd.png';

const BOT_PATTERNS = /facebookexternalhit|WhatsApp|TelegramBot|Discordbot|Twitterbot|Slackbot|LinkedInBot|Googlebot|bingbot|Baiduspider|YandexBot|Sogou|DuckDuckBot|ia_archiver|AhrefsBot|SemrushBot|MJ12bot|DotBot|PetalBot|Bytespider/i;

const generateSessionId = (): string => `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;

const getOrCreateSessionId = (slug: string): string => {
  const key = `resale_click_session_${slug}`;
  let sessionId = sessionStorage.getItem(key);
  if (!sessionId) {
    sessionId = generateSessionId();
    sessionStorage.setItem(key, sessionId);
  }
  return sessionId;
};

const ResaleLanding = () => {
  const { slug } = useParams<{ slug: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const trackingRef = useRef(false);
  const convite = searchParams.get('convite');

  const { data: template, isLoading } = useTemplateBySlug(slug || null);

  // Get template products for display
  const { data: products } = useBrandTemplateProducts(template?.id || '');

  // Track click on mount
  useEffect(() => {
    if (!template || !template.is_link_active || !slug || trackingRef.current) return;
    trackingRef.current = true;

    const userAgent = navigator.userAgent;
    if (BOT_PATTERNS.test(userAgent)) return;

    const sessionId = getOrCreateSessionId(slug);
    supabase.rpc('track_template_click', {
      p_template_slug: slug,
      p_ip_address: null,
      p_user_agent: userAgent,
      p_session_id: sessionId,
    }).catch(console.error);
  }, [template, slug]);

  const handleCreateStore = () => {
    const params = new URLSearchParams();
    params.set('template', slug || '');
    if (convite) params.set('convite', convite);
    navigate(`/register?${params.toString()}`);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-secondary/5">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!template || !template.is_link_active) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-primary/5 via-background to-secondary/5 p-4">
        <Card className="max-w-md p-8 text-center">
          <h1 className="text-2xl font-bold mb-2">Link indisponível</h1>
          <p className="text-muted-foreground mb-4">Este link de revenda não está ativo no momento.</p>
          <Button variant="outline" onClick={() => navigate('/')}>Voltar ao início</Button>
        </Card>
      </div>
    );
  }

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

  const activeProducts = products?.filter(p => p.is_active) || [];

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/5">
      {/* Header */}
      <header className="border-b bg-background/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <img src={logoHeaderSD} alt="ShopDrive" className="h-7" />
          <Button size="sm" onClick={handleCreateStore}>
            Criar minha loja <ArrowRight className="ml-1 h-4 w-4" />
          </Button>
        </div>
      </header>

      {/* Hero */}
      <section className="container mx-auto px-4 py-12 md:py-20">
        <div className="max-w-3xl mx-auto text-center">
          <div className="flex items-center justify-center mb-6">
            {template.logo_url ? (
              <img src={template.logo_url} alt={template.name} className="h-16 md:h-20 object-contain" />
            ) : (
              <div className="h-16 w-16 rounded-xl bg-primary/10 flex items-center justify-center">
                <ShoppingBag className="h-8 w-8 text-primary" />
              </div>
            )}
          </div>
          <h1 className="text-3xl md:text-5xl font-bold mb-4">
            Revenda {template.name}
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground mb-2">
            {template.description || `Abra sua loja online com os produtos da marca ${template.name} e comece a vender hoje mesmo.`}
          </p>
          <p className="text-muted-foreground mb-8">
            Loja pronta, com produtos cadastrados, layout personalizado e checkout ativo. Tudo grátis.
          </p>
          <Button size="lg" className="text-lg px-8 py-6" onClick={handleCreateStore}>
            Criar minha loja grátis <ArrowRight className="ml-2 h-5 w-5" />
          </Button>
        </div>
      </section>

      {/* Benefits */}
      <section className="container mx-auto px-4 py-12">
        <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
          {[
            { icon: '🚀', title: 'Loja pronta em minutos', desc: 'Comece com produtos, layout e configurações já definidos pela marca.' },
            { icon: '💰', title: '100% grátis', desc: 'Sem mensalidade, sem taxa de adesão. Venda sem custos fixos.' },
            { icon: '📦', title: 'Produtos cadastrados', desc: `Sua loja já nasce com até ${template.products_count || 20} produtos prontos para venda.` },
          ].map((benefit, i) => (
            <Card key={i} className="p-6 text-center hover:shadow-md transition-shadow">
              <span className="text-4xl mb-4 block">{benefit.icon}</span>
              <h3 className="font-semibold text-lg mb-2">{benefit.title}</h3>
              <p className="text-sm text-muted-foreground">{benefit.desc}</p>
            </Card>
          ))}
        </div>
      </section>

      {/* Products Preview */}
      {activeProducts.length > 0 && (
        <section className="container mx-auto px-4 py-12">
          <h2 className="text-2xl md:text-3xl font-bold text-center mb-2">
            Produtos da marca
          </h2>
          <p className="text-muted-foreground text-center mb-8">
            Esses produtos já estarão na sua loja
          </p>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 max-w-5xl mx-auto">
            {activeProducts.slice(0, 8).map((product) => (
              <Card key={product.id} className="overflow-hidden hover:shadow-md transition-shadow">
                <div className="aspect-square bg-muted relative">
                  {product.images && product.images.length > 0 ? (
                    <img
                      src={product.images[0]}
                      alt={product.name}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <ShoppingBag className="h-8 w-8 text-muted-foreground/40" />
                    </div>
                  )}
                </div>
                <div className="p-3">
                  <p className="text-sm font-medium line-clamp-2">{product.name}</p>
                  <p className="text-sm font-bold text-primary mt-1">{formatCurrency(product.price)}</p>
                </div>
              </Card>
            ))}
          </div>
          {activeProducts.length > 8 && (
            <p className="text-center text-sm text-muted-foreground mt-4">
              +{activeProducts.length - 8} outros produtos incluídos
            </p>
          )}
        </section>
      )}

      {/* CTA Final */}
      <section className="container mx-auto px-4 py-16">
        <Card className="max-w-2xl mx-auto p-8 md:p-12 text-center bg-primary/5 border-primary/20">
          <Star className="h-10 w-10 text-primary mx-auto mb-4" />
          <h2 className="text-2xl md:text-3xl font-bold mb-3">Comece agora</h2>
          <p className="text-muted-foreground mb-6">
            Crie sua loja em poucos minutos e comece a revender {template.name} com uma loja profissional e completa.
          </p>
          <Button size="lg" className="text-lg px-8 py-6" onClick={handleCreateStore}>
            Criar minha loja grátis <ArrowRight className="ml-2 h-5 w-5" />
          </Button>
        </Card>
      </section>

      {/* Footer */}
      <footer className="border-t py-6">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>Powered by <strong>ShopDrive</strong> — A plataforma de e-commerce para revendedoras</p>
        </div>
      </footer>
    </div>
  );
};

export default ResaleLanding;
