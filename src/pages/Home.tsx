import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Check, Store, Palette, ShoppingCart, BarChart3, Zap } from "lucide-react";
import { Link } from "react-router-dom";
import heroBackground from "@/assets/hero-background.jpg";

const Home = () => {
  const plans = [
    {
      name: "Grátis",
      price: "R$ 0",
      period: "/mês",
      features: [
        "Até 10 produtos",
        "Loja personalizada",
        "Pagamentos online",
        "Suporte por email"
      ],
      cta: "Começar Grátis",
      highlight: false
    },
    {
      name: "Pro",
      price: "R$ 49",
      period: "/mês",
      features: [
        "Até 100 produtos",
        "Domínio personalizado",
        "Relatórios avançados",
        "Suporte prioritário",
        "Integrações ilimitadas"
      ],
      cta: "Escolher Pro",
      highlight: true
    },
    {
      name: "Premium",
      price: "R$ 99",
      period: "/mês",
      features: [
        "Produtos ilimitados",
        "Multi-lojas",
        "API completa",
        "Suporte 24/7",
        "Consultoria mensal"
      ],
      cta: "Escolher Premium",
      highlight: false
    }
  ];

  const benefits = [
    {
      icon: Store,
      title: "Loja Profissional",
      description: "Crie uma loja virtual com visual profissional em minutos"
    },
    {
      icon: Palette,
      title: "Personalização Total",
      description: "Customize cores, fontes e layout da sua loja"
    },
    {
      icon: ShoppingCart,
      title: "Carrinho Inteligente",
      description: "Sistema de carrinho e checkout otimizado para conversão"
    },
    {
      icon: BarChart3,
      title: "Relatórios Completos",
      description: "Acompanhe vendas e performance em tempo real"
    }
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-white/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Store className="h-8 w-8 text-primary" />
              <span className="text-2xl font-bold text-primary">VirtualMercado</span>
            </div>
            <nav className="hidden md:flex items-center gap-6">
              <a href="#beneficios" className="text-foreground hover:text-primary transition-colors">Benefícios</a>
              <a href="#planos" className="text-foreground hover:text-primary transition-colors">Planos</a>
              <a href="#como-funciona" className="text-foreground hover:text-primary transition-colors">Como Funciona</a>
            </nav>
            <div className="flex items-center gap-3">
              <Link to="/login">
                <Button variant="ghost">Entrar</Button>
              </Link>
              <Link to="/register">
                <Button className="bg-secondary hover:bg-secondary/90">Criar Loja Grátis</Button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative py-20 px-4 bg-cover bg-center bg-no-repeat" style={{backgroundImage: `url(${heroBackground})`}}>
        {/* Overlay para garantir contraste */}
        <div className="absolute inset-0 bg-gradient-to-br from-black/80 via-black/60 to-purple-900/50"></div>
        
        {/* Conteúdo */}
        <div className="container mx-auto text-center max-w-4xl relative z-10">
          <Badge variant="secondary" className="mb-6">
            🇧🇷 Plataforma 100% brasileira
          </Badge>
          <h1 className="text-5xl md:text-6xl font-bold mb-6 bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
            Crie sua Loja Virtual em Minutos
          </h1>
          <p className="text-xl text-white mb-8 max-w-2xl mx-auto">
            A maneira mais rápida e fácil de vender online. Sem complicação, sem burocracia. 
            Comece gratuitamente e escale seu negócio.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Button asChild size="lg" className="text-lg px-8">
              <Link to="/register">Criar Minha Loja Grátis</Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="text-lg px-8">
              <Link to="/login">Ver Demonstração</Link>
            </Button>
          </div>
          <p className="text-sm text-white/80 mt-4">Sem cartão de crédito • Comece em 2 minutos</p>
        </div>
      </section>

      {/* Benefits Section */}
      <section id="beneficios" className="py-20 px-4">
        <div className="container mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4">Por que escolher o VirtualMercado?</h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Tudo que você precisa para vender online em uma única plataforma
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {benefits.map((benefit, index) => (
              <Card key={index} className="p-6 hover:shadow-lg transition-all border-2 hover:border-primary/20">
                <div className="h-12 w-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4">
                  <benefit.icon className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-xl font-semibold mb-2">{benefit.title}</h3>
                <p className="text-muted-foreground">{benefit.description}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="planos" className="py-20 px-4 bg-muted/30">
        <div className="container mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4">Planos para todos os tamanhos</h2>
            <p className="text-xl text-muted-foreground">
              Comece grátis e cresça com seu negócio
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {plans.map((plan, index) => (
              <Card 
                key={index} 
                className={`p-8 relative ${plan.highlight ? 'border-2 border-secondary shadow-xl scale-105' : ''}`}
              >
                {plan.highlight && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-secondary text-white px-4 py-1 rounded-full text-sm font-medium">
                    Mais Popular
                  </div>
                )}
                <div className="text-center mb-6">
                  <h3 className="text-2xl font-bold mb-2">{plan.name}</h3>
                  <div className="flex items-baseline justify-center gap-1">
                    <span className="text-4xl font-bold">{plan.price}</span>
                    <span className="text-muted-foreground">{plan.period}</span>
                  </div>
                </div>
                <ul className="space-y-3 mb-8">
                  {plan.features.map((feature, fIndex) => (
                    <li key={fIndex} className="flex items-center gap-2">
                      <div className="h-5 w-5 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0">
                        <Check className="h-3 w-3 text-primary" />
                      </div>
                      <span className="text-sm">{feature}</span>
                    </li>
                  ))}
                </ul>
                <Link to="/register">
                  <Button 
                    className={`w-full ${plan.highlight ? 'bg-secondary hover:bg-secondary/90' : ''}`}
                    variant={plan.highlight ? 'default' : 'outline'}
                  >
                    {plan.cta}
                  </Button>
                </Link>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* How it Works */}
      <section id="como-funciona" className="py-20 px-4">
        <div className="container mx-auto max-w-4xl">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4">Como funciona</h2>
            <p className="text-xl text-muted-foreground">
              3 passos simples para começar a vender
            </p>
          </div>
          <div className="space-y-8">
            {[
              { step: "1", title: "Cadastre-se", description: "Crie sua conta gratuitamente em menos de 2 minutos" },
              { step: "2", title: "Configure sua loja", description: "Adicione produtos, personalize cores e layout" },
              { step: "3", title: "Comece a vender", description: "Compartilhe sua loja e receba pedidos online" }
            ].map((item, index) => (
              <div key={index} className="flex gap-6 items-start">
                <div className="h-12 w-12 bg-gradient-primary rounded-full flex items-center justify-center text-white font-bold text-xl flex-shrink-0">
                  {item.step}
                </div>
                <div>
                  <h3 className="text-2xl font-semibold mb-2">{item.title}</h3>
                  <p className="text-muted-foreground text-lg">{item.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 bg-gradient-primary text-white">
        <div className="container mx-auto text-center max-w-3xl">
          <h2 className="text-4xl md:text-5xl font-bold mb-6">
            Pronto para começar a vender?
          </h2>
          <p className="text-xl mb-8 opacity-90">
            Junte-se a milhares de lojistas que já vendem com o VirtualMercado
          </p>
          <Link to="/register">
            <Button size="lg" className="bg-white text-primary hover:bg-white/90 text-lg px-8">
              Criar Minha Loja Agora
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-4 border-t">
        <div className="container mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-2">
              <Store className="h-6 w-6 text-primary" />
              <span className="font-bold text-primary">VirtualMercado</span>
            </div>
            <p className="text-sm text-muted-foreground">
              © 2024 VirtualMercado. Todos os direitos reservados.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Home;