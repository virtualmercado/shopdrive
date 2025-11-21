import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Check, Store, Palette, ShoppingCart, BarChart3, Zap, Menu, X, Instagram, Facebook, Youtube, TrendingUp, Linkedin, Twitter } from "lucide-react";
import { Link } from "react-router-dom";
import { useState } from "react";
import logoMenu from "@/assets/logo-menu.png";
import logoRodape from "@/assets/logo-rodape.png";
import heroImage from "@/assets/hero-banner.jpg";
import benefitsImage from "@/assets/benefits-handshake.jpg";
import benefitsMobile from "@/assets/benefits-mobile.jpg";
import snapchatIcon from "@/assets/snapchat-icon.png";
import editIcon from "@/assets/edit-icon.png";
const Home = () => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
  const handleNavClick = (id: string) => {
    setIsMobileMenuOpen(false);
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  
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
        <div className="container mx-auto px-4 py-3 md:py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <img src={logoMenu} alt="VirtualMercado" className="h-8 md:h-10" />
            </div>
            
            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center gap-6">
              <a 
                href="#beneficios" 
                onClick={(e) => {
                  e.preventDefault();
                  document.getElementById('beneficios')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }}
                className="text-lg font-bold text-foreground hover:text-primary transition-colors cursor-pointer"
              >
                Benefícios
              </a>
              <a 
                href="#planos" 
                onClick={(e) => {
                  e.preventDefault();
                  document.getElementById('planos')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }}
                className="text-lg font-bold text-foreground hover:text-primary transition-colors cursor-pointer"
              >
                Planos
              </a>
              <a 
                href="#como-funciona" 
                onClick={(e) => {
                  e.preventDefault();
                  document.getElementById('como-funciona')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }}
                className="text-lg font-bold text-foreground hover:text-primary transition-colors cursor-pointer"
              >
                Como Funciona
              </a>
            </nav>
            
            {/* Desktop Buttons */}
            <div className="hidden md:flex items-center gap-3">
              <Link to="/login">
                <Button variant="outline" className="border-primary text-primary hover:bg-primary hover:text-primary-foreground transition-all">Entrar</Button>
              </Link>
              <Link to="/register">
                <Button className="bg-secondary hover:bg-secondary/90">Criar Loja Grátis</Button>
              </Link>
            </div>
            
            {/* Mobile Menu Button and Actions */}
            <div className="flex md:hidden items-center gap-2">
              <Link to="/login">
                <Button variant="outline" size="sm" className="border-primary text-primary hover:bg-primary hover:text-primary-foreground transition-all text-xs h-8 px-3">Entrar</Button>
              </Link>
              <Link to="/register">
                <Button size="sm" className="bg-secondary hover:bg-secondary/90 text-xs h-8 px-3">Criar Loja</Button>
              </Link>
              <Button 
                variant="ghost" 
                size="sm"
                className="h-8 w-8 p-0"
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              >
                {isMobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </Button>
            </div>
          </div>
          
          {/* Mobile Navigation Menu */}
          {isMobileMenuOpen && (
            <nav className="md:hidden mt-4 pb-4 border-t pt-4">
              <div className="flex flex-col gap-3">
                <a 
                  href="#beneficios" 
                  onClick={(e) => {
                    e.preventDefault();
                    handleNavClick('beneficios');
                  }}
                  className="text-base font-bold text-foreground hover:text-primary transition-colors cursor-pointer py-2"
                >
                  Benefícios
                </a>
                <a 
                  href="#planos" 
                  onClick={(e) => {
                    e.preventDefault();
                    handleNavClick('planos');
                  }}
                  className="text-base font-bold text-foreground hover:text-primary transition-colors cursor-pointer py-2"
                >
                  Planos
                </a>
                <a 
                  href="#como-funciona" 
                  onClick={(e) => {
                    e.preventDefault();
                    handleNavClick('como-funciona');
                  }}
                  className="text-base font-bold text-foreground hover:text-primary transition-colors cursor-pointer py-2"
                >
                  Como Funciona
                </a>
              </div>
            </nav>
          )}
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative py-24 px-4 bg-gradient-to-br from-primary/10 via-background to-secondary/10">
        {/* Conteúdo */}
        <div className="container mx-auto text-center max-w-4xl">
          <Badge variant="secondary" className="mb-6">
            🇧🇷 Plataforma 100% Nacional
          </Badge>
          <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-6 text-black leading-tight">
            Crie sua loja virtual e seu catálogo digital em menos de 01 minuto. É GRÁTIS, FÁCIL e 100% online!
          </h1>
          <p className="text-xl mb-8 max-w-2xl mx-auto" style={{ color: '#5A5A5A' }}>
            Plataforma simples e moderna, venda 24h por dia o ano inteiro direto do celular. Comece gratuitamente hoje mesmo.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-4">
            <Button asChild size="lg" className="text-lg px-8">
              <Link to="/register">Criar Minha Loja Grátis</Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="text-lg px-8">
              <Link to="/login">Ver Demonstração</Link>
            </Button>
          </div>
          <p className="text-sm mb-8" style={{ color: '#5A5A5A' }}>Plano FREE, vitalício, sem taxas ou cartão de crédito.</p>
          <div className="flex justify-center">
            <img 
              src={heroImage} 
              alt="VirtualMercado Preview" 
              className="max-w-full w-full md:max-w-[600px] h-auto shadow-lg"
            />
          </div>
        </div>
      </section>

      {/* New Benefits Section with Image */}
      <section className="py-20 px-4 bg-background">
        <div className="container mx-auto">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            {/* Left Side - Text and Icons */}
            <div className="space-y-8">
              <div>
                <h2 className="text-3xl md:text-4xl font-bold mb-4 text-left">
                  Seus produtos disponíveis em todos os lugares
                </h2>
                <p className="text-lg text-justify" style={{ color: '#5A5A5A' }}>
                  Adicione o link da sua loja em todas as suas redes sociais, e envie para seus clientes a qualquer hora em qualquer lugar.
                </p>
              </div>
              
              {/* Social Media Icons - Minimalist Flat Design */}
              <div className="grid grid-cols-4 md:grid-cols-4 lg:grid-cols-8 gap-6 justify-items-center">
                {/* Instagram */}
                <svg className="h-10 w-10 md:h-8 md:w-8 lg:h-10 lg:w-10 text-primary transition-all duration-300 hover:scale-125 hover:opacity-70 cursor-pointer" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="2" width="20" height="20" rx="5" ry="5"/>
                  <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/>
                  <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/>
                </svg>
                {/* Facebook */}
                <svg className="h-10 w-10 md:h-8 md:w-8 lg:h-10 lg:w-10 text-primary transition-all duration-300 hover:scale-125 hover:opacity-70 cursor-pointer" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/>
                </svg>
                {/* YouTube */}
                <svg className="h-10 w-10 md:h-8 md:w-8 lg:h-10 lg:w-10 text-primary transition-all duration-300 hover:scale-125 hover:opacity-70 cursor-pointer" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22.54 6.42a2.78 2.78 0 0 0-1.94-2C18.88 4 12 4 12 4s-6.88 0-8.6.46a2.78 2.78 0 0 0-1.94 2A29 29 0 0 0 1 11.75a29 29 0 0 0 .46 5.33A2.78 2.78 0 0 0 3.4 19c1.72.46 8.6.46 8.6.46s6.88 0 8.6-.46a2.78 2.78 0 0 0 1.94-2 29 29 0 0 0 .46-5.25 29 29 0 0 0-.46-5.33z"/>
                  <polygon points="9.75 15.02 15.5 11.75 9.75 8.48 9.75 15.02"/>
                </svg>
                {/* TikTok */}
                <svg className="h-10 w-10 md:h-8 md:w-8 lg:h-10 lg:w-10 text-primary transition-all duration-300 hover:scale-125 hover:opacity-70 cursor-pointer" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 12a4 4 0 1 0 4 4V4a5 5 0 0 0 5 5"/>
                </svg>
                {/* LinkedIn */}
                <svg className="h-10 w-10 md:h-8 md:w-8 lg:h-10 lg:w-10 text-primary transition-all duration-300 hover:scale-125 hover:opacity-70 cursor-pointer" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"/>
                  <rect x="2" y="9" width="4" height="12"/>
                  <circle cx="4" cy="4" r="2"/>
                </svg>
                {/* Pinterest */}
                <svg className="h-10 w-10 md:h-8 md:w-8 lg:h-10 lg:w-10 text-primary transition-all duration-300 hover:scale-125 hover:opacity-70 cursor-pointer" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"/>
                  <path d="M8 14s1.5 2 4 2 4-6 4-6-1-2-3-2-4 2-4 5c0 2.5 2.5 4.5 5 4.5"/>
                </svg>
                {/* X (Twitter) */}
                <svg className="h-10 w-10 md:h-8 md:w-8 lg:h-10 lg:w-10 text-primary transition-all duration-300 hover:scale-125 hover:opacity-70 cursor-pointer" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 4l11.733 16h4.267l-11.733-16z"/>
                  <path d="M4 20l6.768-6.768m2.46-2.46L20 4"/>
                </svg>
                {/* Snapchat */}
                <img 
                  src={snapchatIcon} 
                  alt="Snapchat" 
                  className="h-10 w-10 md:h-8 md:w-8 lg:h-10 lg:w-10 transition-all duration-300 hover:scale-125 hover:opacity-70 cursor-pointer"
                />
              </div>
              
              {/* Credibility Text */}
              <div className="flex items-center gap-4 pt-2">
                <div className="flex-shrink-0 p-3 bg-[#FB8C00] rounded-lg transition-all duration-300 hover:scale-110 hover:opacity-80 cursor-pointer">
                  <TrendingUp className="h-10 w-10 text-white" />
                </div>
                <p className="text-lg md:text-xl font-semibold text-left">
                  Mais de 10 mil empreendedores já criaram suas lojas com a VirtualMercado
                </p>
              </div>
            </div>
            
            {/* Right Side - Image */}
            <div className="order-first md:order-last">
              <img 
                src={benefitsImage} 
                alt="Empreendedores de sucesso" 
                className="w-full h-auto rounded-lg shadow-lg"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Second Benefits Section - WhatsApp & Payment */}
      <section className="py-20 px-4 bg-background">
        <div className="container mx-auto">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            {/* Left Side - Image */}
            <div>
              <img 
                src={benefitsMobile} 
                alt="Pagamentos e WhatsApp" 
                className="w-full h-auto rounded-lg shadow-lg max-w-md mx-auto"
              />
            </div>
            
            {/* Right Side - Text and Features */}
            <div className="space-y-6">
              <div>
                <h2 className="text-3xl md:text-4xl font-bold mb-4 text-left">
                  <span style={{ color: '#000000' }}>Venda através do WhatsApp ou aceite pagamentos no site. </span>
                  <span style={{ color: '#6a1b9a' }}>LUCRO 24h por dia.</span>
                </h2>
                <p className="text-lg mb-8" style={{ color: '#5A5A5A' }}>
                  Receba pagamentos no cartão de crédito, débito ou via PIX de forma automática e segura, direto na sua conta.
                </p>
              </div>
              
              {/* Features List with Minimalist Edit Icons */}
              <div className="space-y-4">
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-11 h-11 transition-all duration-300 hover:scale-110 cursor-pointer">
                    <img 
                      src={editIcon} 
                      alt="Editar" 
                      className="w-full h-full object-contain"
                    />
                  </div>
                  <p className="text-lg pt-2" style={{ color: '#5A5A5A' }}>
                    Gerador de catálogo de produtos em PDF.
                  </p>
                </div>
                
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-11 h-11 transition-all duration-300 hover:scale-110 cursor-pointer">
                    <img 
                      src={editIcon} 
                      alt="Editar" 
                      className="w-full h-full object-contain"
                    />
                  </div>
                  <p className="text-lg pt-2" style={{ color: '#5A5A5A' }}>
                    Confirmação e lista do pedido diretamente no seu WhatsApp.
                  </p>
                </div>
                
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-11 h-11 transition-all duration-300 hover:scale-110 cursor-pointer">
                    <img 
                      src={editIcon} 
                      alt="Editar" 
                      className="w-full h-full object-contain"
                    />
                  </div>
                  <p className="text-lg pt-2" style={{ color: '#5A5A5A' }}>
                    Transparência, organização e segurança nas suas vendas.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>


      {/* Benefits Section */}
      <section id="beneficios" className="py-20 px-4">
        <div className="container mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4">Por que escolher o VirtualMercado?</h2>
            <p className="text-xl max-w-2xl mx-auto" style={{ color: '#5A5A5A' }}>
              Tudo que você precisa para vender online em uma única plataforma
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {benefits.map((benefit, index) => <Card key={index} className="p-6 hover:shadow-lg transition-all border-2 hover:border-primary/20">
                <div className="h-12 w-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4">
                  <benefit.icon className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-xl font-semibold mb-2">{benefit.title}</h3>
                <p style={{ color: '#5A5A5A' }}>{benefit.description}</p>
              </Card>)}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="planos" className="py-20 px-4 bg-muted/30">
        <div className="container mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4">Planos para todos os tamanhos</h2>
            <p className="text-xl" style={{ color: '#5A5A5A' }}>
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
            <p className="text-xl" style={{ color: '#5A5A5A' }}>
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
                  <p className="text-lg" style={{ color: '#5A5A5A' }}>{item.description}</p>
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