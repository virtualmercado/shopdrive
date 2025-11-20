import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Check, Store, Palette, ShoppingCart, BarChart3, Zap } from "lucide-react";
import { Link } from "react-router-dom";
import heroBackground from "@/assets/hero-background.jpg";
import logoMenu from "@/assets/logo-menu.png";
import logoRodape from "@/assets/logo-rodape.png";
const Home = () => {
  const plans = [{
    name: "Grátis",
    price: "R$ 0",
    period: "/mês",
    features: ["Até 10 produtos", "Loja personalizada", "Pagamentos online", "Suporte por email"],
    cta: "Começar Grátis",
    highlight: false
  }, {
    name: "Pro",
    price: "R$ 49",
    period: "/mês",
    features: ["Até 100 produtos", "Domínio personalizado", "Relatórios avançados", "Suporte prioritário", "Integrações ilimitadas"],
    cta: "Escolher Pro",
    highlight: true
  }, {
    name: "Premium",
    price: "R$ 99",
    period: "/mês",
    features: ["Produtos ilimitados", "Multi-lojas", "API completa", "Suporte 24/7", "Consultoria mensal"],
    cta: "Escolher Premium",
    highlight: false
  }];
  const benefits = [{
    icon: Store,
    title: "Loja Profissional",
    description: "Crie uma loja virtual com visual profissional em minutos"
  }, {
    icon: Palette,
    title: "Personalização Total",
    description: "Customize cores, fontes e layout da sua loja"
  }, {
    icon: ShoppingCart,
    title: "Carrinho Inteligente",
    description: "Sistema de carrinho e checkout otimizado para conversão"
  }, {
    icon: BarChart3,
    title: "Relatórios Completos",
    description: "Acompanhe vendas e performance em tempo real"
  }];
  return <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-white/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <img src={logoMenu} alt="VirtualMercado" className="h-10" />
            </div>
          <nav className="hidden md:flex items-center gap-6">
            <a href="#beneficios" className="text-lg font-bold text-foreground hover:text-primary transition-colors">Benefícios</a>
            <a href="#planos" className="text-lg font-bold text-foreground hover:text-primary transition-colors">Planos</a>
            <a href="#como-funciona" className="text-lg font-bold text-foreground hover:text-primary transition-colors">Como Funciona</a>
          </nav>
            <div className="flex items-center gap-3">
              <Link to="/login">
                <Button variant="outline" className="border-gray-700 text-gray-700 hover:bg-gray-100">Entrar</Button>
              </Link>
              <Link to="/register">
                <Button className="bg-secondary hover:bg-secondary/90">Criar Loja Grátis</Button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative py-20 px-4 bg-cover bg-center bg-no-repeat" style={{
      backgroundImage: `url(${heroBackground})`
    }}>
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
            {benefits.map((benefit, index) => <Card key={index} className="p-6 hover:shadow-lg transition-all border-2 hover:border-primary/20">
                <div className="h-12 w-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4">
                  <benefit.icon className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-xl font-semibold mb-2">{benefit.title}</h3>
                <p className="text-muted-foreground">{benefit.description}</p>
              </Card>)}
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
            {plans.map((plan, index) => <Card key={index} className={`p-8 relative ${plan.highlight ? 'border-2 border-secondary shadow-xl scale-105' : ''}`}>
                {plan.highlight && <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-secondary text-white px-4 py-1 rounded-full text-sm font-medium">
                    Mais Popular
                  </div>}
                <div className="text-center mb-6">
                  <h3 className="text-2xl font-bold mb-2">{plan.name}</h3>
                  <div className="flex items-baseline justify-center gap-1">
                    <span className="text-4xl font-bold">{plan.price}</span>
                    <span className="text-muted-foreground">{plan.period}</span>
                  </div>
                </div>
                <ul className="space-y-3 mb-8">
                  {plan.features.map((feature, fIndex) => <li key={fIndex} className="flex items-center gap-2">
                      <div className="h-5 w-5 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0">
                        <Check className="h-3 w-3 text-primary" />
                      </div>
                      <span className="text-sm">{feature}</span>
                    </li>)}
                </ul>
                <Link to="/register">
                  <Button className={`w-full ${plan.highlight ? 'bg-secondary hover:bg-secondary/90' : ''}`} variant={plan.highlight ? 'default' : 'outline'}>
                    {plan.cta}
                  </Button>
                </Link>
              </Card>)}
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
            {[{
            step: "1",
            title: "Cadastre-se",
            description: "Crie sua conta gratuitamente em menos de 2 minutos"
          }, {
            step: "2",
            title: "Configure sua loja",
            description: "Adicione produtos, personalize cores e layout"
          }, {
            step: "3",
            title: "Comece a vender",
            description: "Compartilhe sua loja e receba pedidos online"
          }].map((item, index) => <div key={index} className="flex gap-6 items-start">
                <div className="h-12 w-12 bg-gradient-primary rounded-full flex items-center justify-center text-white font-bold text-xl flex-shrink-0">
                  {item.step}
                </div>
                <div>
                  <h3 className="text-2xl font-semibold mb-2">{item.title}</h3>
                  <p className="text-muted-foreground text-lg">{item.description}</p>
                </div>
              </div>)}
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
      <footer className="bg-[#1E1E1E] py-16 px-4">
        <div className="container mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12">
            {/* Coluna 1: VirtualMercado */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <img src={logoRodape} alt="VirtualMercado" className="h-10" />
            </div>
              <p className="text-gray-300 mb-6">Sua loja virtual em minutos.</p>
              <div className="flex gap-4">
                <a href="https://instagram.com" target="_blank" rel="noopener noreferrer" className="text-white hover:text-[#FB8C00] transition-colors">
                  <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path fillRule="evenodd" d="M12.315 2c2.43 0 2.784.013 3.808.06 1.064.049 1.791.218 2.427.465a4.902 4.902 0 011.772 1.153 4.902 4.902 0 011.153 1.772c.247.636.416 1.363.465 2.427.048 1.067.06 1.407.06 4.123v.08c0 2.643-.012 2.987-.06 4.043-.049 1.064-.218 1.791-.465 2.427a4.902 4.902 0 01-1.153 1.772 4.902 4.902 0 01-1.772 1.153c-.636.247-1.363.416-2.427.465-1.067.048-1.407.06-4.123.06h-.08c-2.643 0-2.987-.012-4.043-.06-1.064-.049-1.791-.218-2.427-.465a4.902 4.902 0 01-1.772-1.153 4.902 4.902 0 01-1.153-1.772c-.247-.636-.416-1.363-.465-2.427-.047-1.024-.06-1.379-.06-3.808v-.63c0-2.43.013-2.784.06-3.808.049-1.064.218-1.791.465-2.427a4.902 4.902 0 011.153-1.772A4.902 4.902 0 015.45 2.525c.636-.247 1.363-.416 2.427-.465C8.901 2.013 9.256 2 11.685 2h.63zm-.081 1.802h-.468c-2.456 0-2.784.011-3.807.058-.975.045-1.504.207-1.857.344-.467.182-.8.398-1.15.748-.35.35-.566.683-.748 1.15-.137.353-.3.882-.344 1.857-.047 1.023-.058 1.351-.058 3.807v.468c0 2.456.011 2.784.058 3.807.045.975.207 1.504.344 1.857.182.466.399.8.748 1.15.35.35.683.566 1.15.748.353.137.882.3 1.857.344 1.054.048 1.37.058 4.041.058h.08c2.597 0 2.917-.01 3.96-.058.976-.045 1.505-.207 1.858-.344.466-.182.8-.398 1.15-.748.35-.35.566-.683.748-1.15.137-.353.3-.882.344-1.857.048-1.055.058-1.37.058-4.041v-.08c0-2.597-.01-2.917-.058-3.96-.045-.976-.207-1.505-.344-1.858a3.097 3.097 0 00-.748-1.15 3.098 3.098 0 00-1.15-.748c-.353-.137-.882-.3-1.857-.344-1.023-.047-1.351-.058-3.807-.058zM12 6.865a5.135 5.135 0 110 10.27 5.135 5.135 0 010-10.27zm0 1.802a3.333 3.333 0 100 6.666 3.333 3.333 0 000-6.666zm5.338-3.205a1.2 1.2 0 110 2.4 1.2 1.2 0 010-2.4z" clipRule="evenodd" />
                  </svg>
                </a>
                <a href="https://facebook.com" target="_blank" rel="noopener noreferrer" className="text-white hover:text-[#FB8C00] transition-colors">
                  <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path fillRule="evenodd" d="M22 12c0-5.523-4.477-10-10-10S2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.878v-6.987h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.988C18.343 21.128 22 16.991 22 12z" clipRule="evenodd" />
                  </svg>
                </a>
              </div>
            </div>

            {/* Coluna 2: Institucional */}
            <div>
              <h3 className="font-bold text-white text-lg mb-4">Institucional</h3>
              <ul className="space-y-3">
                <li>
                  <a href="#sobre" className="text-gray-300 hover:text-[#FB8C00] transition-colors">
                    Sobre Nós
                  </a>
                </li>
                <li>
                  <a href="#blog" className="text-gray-300 hover:text-[#FB8C00] transition-colors">
                    Blog
                  </a>
                </li>
                <li>
                  <a href="#midias" className="text-gray-300 hover:text-[#FB8C00] transition-colors">
                    Mídias Sociais
                  </a>
                </li>
              </ul>
            </div>

            {/* Coluna 3: Suporte */}
            <div>
              <h3 className="font-bold text-white text-lg mb-4">Suporte</h3>
              <ul className="space-y-3">
                <li>
                  <a href="#ajuda" className="text-gray-300 hover:text-[#FB8C00] transition-colors">
                    Central de Ajuda
                  </a>
                </li>
                <li>
                  <a href="#contato" className="text-gray-300 hover:text-[#FB8C00] transition-colors">
                    Fale Conosco
                  </a>
                </li>
              </ul>
            </div>

            {/* Coluna 4: Legal */}
            <div>
              <h3 className="font-bold text-white text-lg mb-4">Legal</h3>
              <ul className="space-y-3">
                <li>
                  <a href="#termos" className="text-gray-300 hover:text-[#FB8C00] transition-colors">
                    Termos de Uso
                  </a>
                </li>
                <li>
                  <a href="#privacidade" className="text-gray-300 hover:text-[#FB8C00] transition-colors">
                    Política de Privacidade
                  </a>
                </li>
                <li>
                  <a href="#cookies" className="text-gray-300 hover:text-[#FB8C00] transition-colors">
                    Política de Cookies
                  </a>
                </li>
              </ul>
            </div>
          </div>

          {/* Copyright */}
          <div className="mt-12 pt-8 border-t border-gray-700 text-center">
            <p className="text-gray-400 text-sm">© 2025 VirtualMercado. Todos os direitos reservados.</p>
          </div>
        </div>
      </footer>
    </div>;
};
export default Home;