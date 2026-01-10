import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Store, Palette, ShoppingCart, BarChart3, Menu, X, Instagram, Facebook, Youtube, TrendingUp, Linkedin, Twitter, Percent, LayoutDashboard, ImagePlus, Tag } from "lucide-react";
import { PlansSection } from "@/components/plans/PlansSection";
import { Link } from "react-router-dom";
import { useState } from "react";
import logoMenu from "@/assets/logo-menu.png";
import logoRodape from "@/assets/logo-footer.png";
import heroImage from "@/assets/hero-banner.jpg";
import benefitsImage from "@/assets/benefits-handshake.jpg";
import benefitsMobile from "@/assets/benefits-mobile.jpg";
import snapchatIcon from "@/assets/snapchat-icon.png";
import editIcon from "@/assets/edit-icon.png";
import testimonialJuliana from "@/assets/testimonial-juliana.jpg";
import testimonialMarcos from "@/assets/testimonial-marcos.jpg";
import testimonialCarla from "@/assets/testimonial-carla.jpg";
const Home = () => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
  const handleNavClick = (id: string) => {
    setIsMobileMenuOpen(false);
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  
  
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
  }, {
    icon: Percent,
    title: "Sem Taxa de Venda",
    description: "A plataforma não cobra nenhum valor ou comissão nas suas vendas."
  }, {
    icon: LayoutDashboard,
    title: "Painel Administrativo",
    description: "Controle total sobre estoque, clientes, pedidos e envios."
  }, {
    icon: ImagePlus,
    title: "Editor de Imagens",
    description: "Edite de forma profissional as imagens e o cadastro dos seus produtos."
  }, {
    icon: Tag,
    title: "Criador de Cupons",
    description: "Gere cupons de desconto e aumente o número de vendas e clientes."
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
          <p className="text-base md:text-lg mb-8" style={{ color: '#5A5A5A' }}>Grátis para sempre, sem taxas ou cartão de crédito</p>
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
          <div className="flex flex-col md:grid md:grid-cols-2 gap-12 items-center">
            {/* Left Side - Text and Icons */}
            <div className="space-y-8 order-1">
              <div>
                <h2 className="text-3xl md:text-4xl font-bold mb-4 text-left">
                  Seus produtos disponíveis em todos os lugares
                </h2>
                <p className="text-lg text-justify" style={{ color: '#5A5A5A' }}>
                  Adicione o link da sua loja em todas as suas redes sociais, e envie para seus clientes a qualquer hora em qualquer lugar.
                </p>
              </div>
              
              {/* Social Media Icons - All Purple #6a1b9a - Minimalist Flat Design */}
              <div className="grid grid-cols-4 md:grid-cols-4 lg:grid-cols-7 gap-8 justify-items-center">
                {/* Instagram */}
                <svg className="h-10 w-10 md:h-8 md:w-8 lg:h-10 lg:w-10 transition-all duration-300 hover:scale-125 hover:opacity-70 cursor-pointer" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <rect x="2" y="2" width="20" height="20" rx="5" stroke="#6a1b9a" strokeWidth="1.5"/>
                  <circle cx="12" cy="12" r="4" stroke="#6a1b9a" strokeWidth="1.5"/>
                  <circle cx="17.5" cy="6.5" r="1" fill="#6a1b9a"/>
                </svg>
                {/* Facebook */}
                <svg className="h-10 w-10 md:h-8 md:w-8 lg:h-10 lg:w-10 transition-all duration-300 hover:scale-125 hover:opacity-70 cursor-pointer" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <circle cx="12" cy="12" r="10" stroke="#6a1b9a" strokeWidth="1.5"/>
                  <path d="M15.5 12.5h-2v7h-3v-7h-2v-2.5h2V8.5c0-1.7 1-3 3-3h2v2.5h-1.5c-.5 0-.5.3-.5.8v1.7h2l-.5 2.5z" fill="#6a1b9a"/>
                </svg>
                {/* YouTube */}
                <svg className="h-10 w-10 md:h-8 md:w-8 lg:h-10 lg:w-10 transition-all duration-300 hover:scale-125 hover:opacity-70 cursor-pointer" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <rect x="2" y="5" width="20" height="14" rx="3" stroke="#6a1b9a" strokeWidth="1.5"/>
                  <path d="M10 8.5L15 12L10 15.5V8.5Z" fill="#6a1b9a" stroke="#6a1b9a" strokeWidth="1"/>
                </svg>
                {/* TikTok */}
                <svg className="h-10 w-10 md:h-8 md:w-8 lg:h-10 lg:w-10 transition-all duration-300 hover:scale-125 hover:opacity-70 cursor-pointer" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-5.2 1.74 2.89 2.89 0 012.31-4.64 2.93 2.93 0 01.88.13V9.4a6.84 6.84 0 00-1-.05A6.33 6.33 0 005 20.1a6.34 6.34 0 0010.86-4.43v-7a8.16 8.16 0 004.77 1.52v-3.4a4.85 4.85 0 01-1-.1z" fill="#6a1b9a" strokeWidth="0"/>
                </svg>
                {/* LinkedIn */}
                <svg className="h-10 w-10 md:h-8 md:w-8 lg:h-10 lg:w-10 transition-all duration-300 hover:scale-125 hover:opacity-70 cursor-pointer" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <rect x="2" y="2" width="20" height="20" rx="2" stroke="#6a1b9a" strokeWidth="1.5"/>
                  <rect x="5" y="9" width="3" height="9" fill="#6a1b9a"/>
                  <circle cx="6.5" cy="6" r="1.5" fill="#6a1b9a"/>
                  <path d="M12 9c1.5 0 2.5.5 3 1.5V9h3v9h-3v-5c0-1-.5-2-1.5-2s-1.5 1-1.5 2v5h-3V9h3z" fill="#6a1b9a"/>
                </svg>
                {/* Pinterest - E-commerce Standard Model */}
                <svg className="h-10 w-10 md:h-8 md:w-8 lg:h-10 lg:w-10 transition-all duration-300 hover:scale-125 hover:opacity-70 cursor-pointer" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <circle cx="12" cy="12" r="10" stroke="#6a1b9a" strokeWidth="1.5"/>
                  <path d="M12.5 6c2.5 0 4.5 2 4.5 4.5 0 2-1.2 3.5-2.8 3.5-.6 0-1.1-.3-1.3-.8 0 0-.3 1.2-.4 1.4-.2.8-.8 1.6-1.2 2.1-.3.1-.5.1-.6 0 0-.2-.1-.8-.1-1.2 0-.4.5-2.2.5-2.2s-.1-.5-.1-1.1c0-1.1.6-1.9 1.4-1.9.6 0 1 .5 1 1.1 0 .7-.4 1.7-.7 2.6-.2.8.4 1.4 1.2 1.4 1.4 0 2.4-1.8 2.4-3.9 0-1.6-1.1-2.8-3.1-2.8-2.3 0-3.7 1.7-3.7 3.6 0 .7.2 1.2.5 1.6.1.1.1.2.1.3-.1.3-.2.8-.2.9-.1.2-.2.2-.4.1-1-.4-1.5-1.5-1.5-2.7 0-2.1 1.8-4.6 5.3-4.6z" fill="#6a1b9a"/>
                </svg>
                {/* X (Twitter) */}
                <svg className="h-10 w-10 md:h-8 md:w-8 lg:h-10 lg:w-10 transition-all duration-300 hover:scale-125 hover:opacity-70 cursor-pointer" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" fill="#6a1b9a" strokeWidth="0"/>
                </svg>
              </div>
              
              {/* Mobile Image - Only visible on mobile, positioned after social icons */}
              <div className="md:hidden mt-8">
                <img 
                  src={benefitsImage} 
                  alt="Empreendedores de sucesso" 
                  className="w-full h-auto rounded-lg shadow-lg"
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
            
            {/* Right Side - Image - Hidden on mobile, visible on desktop/tablet */}
            <div className="hidden md:block order-2">
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
              
              {/* Features List with Smaller Edit Icons */}
              <div className="space-y-4">
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-9 h-9 transition-all duration-300 hover:scale-110 cursor-pointer">
                    <img 
                      src={editIcon} 
                      alt="Editar" 
                      className="w-full h-full object-contain"
                    />
                  </div>
                  <p className="text-lg pt-1" style={{ color: '#5A5A5A' }}>
                    Gerador de catálogo de produtos em PDF.
                  </p>
                </div>
                
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-9 h-9 transition-all duration-300 hover:scale-110 cursor-pointer">
                    <img 
                      src={editIcon} 
                      alt="Editar" 
                      className="w-full h-full object-contain"
                    />
                  </div>
                  <p className="text-lg pt-1" style={{ color: '#5A5A5A' }}>
                    Confirmação e lista do pedido diretamente no seu WhatsApp.
                  </p>
                </div>
                
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-9 h-9 transition-all duration-300 hover:scale-110 cursor-pointer">
                    <img 
                      src={editIcon} 
                      alt="Editar" 
                      className="w-full h-full object-contain"
                    />
                  </div>
                  <p className="text-lg pt-1" style={{ color: '#5A5A5A' }}>
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
            <h2 className="text-4xl font-bold mb-4">Recursos poderosos para suas vendas decolarem</h2>
            <p className="text-xl max-w-2xl mx-auto" style={{ color: '#5A5A5A' }}>
              Ferramentas simples que geram resultados rápidos e lucrativos.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
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
          <div className="text-center mb-10">
            <h2 className="text-4xl font-bold mb-4">Planos para todos os tamanhos</h2>
            <p className="text-xl" style={{ color: '#5A5A5A' }}>
              Comece grátis e escale seu negócio
            </p>
          </div>
          <PlansSection isLandingPage={true} />
        </div>
      </section>

      {/* Testimonials Section - Prova Social */}
      <section className="py-20 px-4 bg-background">
        <div className="container mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4">Quem usa, aprova!</h2>
            <p className="text-xl max-w-2xl mx-auto" style={{ color: '#5A5A5A' }}>
              Histórias reais de quem transformou e melhorou o jeito de vender.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {/* Card 1 - Juliana */}
            <Card className="p-6 bg-white shadow-sm hover:shadow-lg transition-all">
              <p className="text-lg mb-6 text-black leading-relaxed">
                "Em menos de um dia, minha loja estava no ar! A plataforma é super intuitiva e o suporte é nota 10."
              </p>
              <div className="flex items-center gap-4">
                <img 
                  src={testimonialJuliana} 
                  alt="Juliana S." 
                  className="w-14 h-14 rounded-full object-cover"
                />
                <div>
                  <p className="font-bold text-black">Juliana S.</p>
                  <p className="text-sm" style={{ color: '#4A4A4A' }}>Dona da @doceju</p>
                </div>
              </div>
            </Card>

            {/* Card 2 - Marcos */}
            <Card className="p-6 bg-white shadow-sm hover:shadow-lg transition-all">
              <p className="text-lg mb-6 text-black leading-relaxed">
                "Consegui organizar meus produtos e agora vendo para todo o Brasil. O editor de fotos me ajudou a deixar tudo mais profissional."
              </p>
              <div className="flex items-center gap-4">
                <img 
                  src={testimonialMarcos} 
                  alt="Marcos P." 
                  className="w-14 h-14 rounded-full object-cover"
                />
                <div>
                  <p className="font-bold text-black">Marcos P.</p>
                  <p className="text-sm" style={{ color: '#4A4A4A' }}>Artesão na @arteemmadeira</p>
                </div>
              </div>
            </Card>

            {/* Card 3 - Carla */}
            <Card className="p-6 bg-white shadow-sm hover:shadow-lg transition-all">
              <p className="text-lg mb-6 text-black leading-relaxed">
                "Meus clientes amaram a facilidade de comprar pelo site. A integração com o WhatsApp é perfeita para fechar vendas."
              </p>
              <div className="flex items-center gap-4">
                <img 
                  src={testimonialCarla} 
                  alt="Carla F." 
                  className="w-14 h-14 rounded-full object-cover"
                />
                <div>
                  <p className="font-bold text-black">Carla F.</p>
                  <p className="text-sm" style={{ color: '#4A4A4A' }}>Consultora de Beleza</p>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </section>

      {/* How it Works */}
      <section id="como-funciona" className="py-20 px-4">
        <div className="container mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4">Como funciona</h2>
            <p className="text-xl" style={{ color: '#5A5A5A' }}>
              3 passos simples para começar a vender
            </p>
          </div>
          <div className="grid md:grid-cols-2 gap-12 items-center max-w-6xl mx-auto">
            {/* Left Side - Steps */}
            <div className="space-y-10">
              {[{
                step: "1",
                title: "Cadastre-se",
                description: "Crie sua conta gratuitamente em menos de 1 minuto"
              }, {
                step: "2",
                title: "Configure sua loja",
                description: "Adicione produtos, personalize cores e layout"
              }, {
                step: "3",
                title: "Comece a vender",
                description: "Compartilhe sua loja e seu catálogo PDF e receba pedidos online"
              }].map((item, index) => (
                <div key={index} className="flex gap-6 items-start">
                  <div className="text-7xl md:text-8xl font-bold flex-shrink-0" style={{ 
                    color: '#B0B0B0',
                    fontFamily: 'Century Gothic, sans-serif',
                    lineHeight: '1'
                  }}>
                    {item.step}
                  </div>
                  <div className="text-left pt-2">
                    <h3 className="text-2xl font-semibold mb-2">{item.title}</h3>
                    <p className="text-lg" style={{ color: '#5A5A5A' }}>{item.description}</p>
                  </div>
                </div>
              ))}
            </div>
            
            {/* Right Side - CTA */}
            <div className="flex flex-col items-center justify-center space-y-6">
              <Link to="/register" className="w-full max-w-sm">
                <Button 
                  size="lg" 
                  className="w-full bg-secondary hover:bg-secondary/90 text-white font-semibold text-lg h-14"
                >
                  Criar Loja Agora
                </Button>
              </Link>
              <p className="text-center text-lg max-w-sm" style={{ color: '#333333' }}>
                Junte-se a milhares de lojistas que já vendem com a VirtualMercado
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-20 px-4 bg-gray-50">
        <div className="container mx-auto max-w-4xl">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold mb-4">Dúvidas Frequentes</h2>
            <p className="text-xl" style={{ color: '#5A5A5A' }}>
              Encontre aqui as respostas para as perguntas mais comuns.
            </p>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6 md:p-8">
            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="item-1">
                <AccordionTrigger className="text-left text-lg font-semibold hover:no-underline">
                  A VirtualMercado é grátis mesmo?
                </AccordionTrigger>
                <AccordionContent className="text-base" style={{ color: '#5A5A5A' }}>
                  Sim! Você pode ter uma loja totalmente gratuita, e caso queira recursos exclusivos, pode assinar um plano pago.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="item-2">
                <AccordionTrigger className="text-left text-lg font-semibold hover:no-underline">
                  Preciso ter CNPJ para começar?
                </AccordionTrigger>
                <AccordionContent className="text-base" style={{ color: '#5A5A5A' }}>
                  Não! Você pode começar a vender usando apenas seu CPF e, quando seu negócio crescer, pode migrar para um CNPJ facilmente.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="item-3">
                <AccordionTrigger className="text-left text-lg font-semibold hover:no-underline">
                  Como funciona o recebimento das minhas vendas?
                </AccordionTrigger>
                <AccordionContent className="text-base" style={{ color: '#5A5A5A' }}>
                  Você pode receber via PIX, que cai na hora na sua conta, ou integrar com outras soluções de pagamento para aceitar cartão e boleto. Tudo de forma segura.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="item-4">
                <AccordionTrigger className="text-left text-lg font-semibold hover:no-underline">
                  Posso usar um domínio que já tenho?
                </AccordionTrigger>
                <AccordionContent className="text-base" style={{ color: '#5A5A5A' }}>
                  Sim! No plano PREMIUM, você pode conectar seu próprio domínio (ex: www.sualoja.com.br) para deixar sua loja ainda mais profissional.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="item-5">
                <AccordionTrigger className="text-left text-lg font-semibold hover:no-underline">
                  Posso cancelar a assinatura quando quiser?
                </AccordionTrigger>
                <AccordionContent className="text-base" style={{ color: '#5A5A5A' }}>
                  Sim, você pode cancelar sua assinatura a qualquer momento.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="item-6">
                <AccordionTrigger className="text-left text-lg font-semibold hover:no-underline">
                  Posso usar meu site na plataforma como catálogo de produtos?
                </AccordionTrigger>
                <AccordionContent className="text-base" style={{ color: '#5A5A5A' }}>
                  Sim! Você pode usar sua loja como um catálogo digital em PDF, exibindo fotos, descrições e preços dos produtos mesmo sem ativar o sistema de vendas online.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="item-7">
                <AccordionTrigger className="text-left text-lg font-semibold hover:no-underline">
                  Como faço o pagamento da minha assinatura aqui na VirtualMercado?
                </AccordionTrigger>
                <AccordionContent className="text-base" style={{ color: '#5A5A5A' }}>
                  Você paga uma mensalidade ou anuidade diretamente pela plataforma. Aceitamos PIX, cartão de crédito, cartão de débito e boleto bancário.
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-[#EDE5F8] py-16 px-4">
        <div className="container mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12">
            {/* Coluna 1: VirtualMercado */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <img src={logoRodape} alt="VirtualMercado" className="h-8" />
            </div>
              <p className="mb-6" style={{ color: '#6A1B9A' }}>Sua loja virtual em minutos.</p>
              <div className="flex gap-4">
                <a href="https://instagram.com" target="_blank" rel="noopener noreferrer" className="transition-all duration-300 hover:scale-110 hover:opacity-80" style={{ color: '#6A1B9A' }}>
                  <Instagram size={24} strokeWidth={1.5} />
                </a>
                <a href="https://facebook.com" target="_blank" rel="noopener noreferrer" className="transition-all duration-300 hover:scale-110 hover:opacity-80" style={{ color: '#6A1B9A' }}>
                  <Facebook size={24} strokeWidth={1.5} />
                </a>
                <a href="https://youtube.com" target="_blank" rel="noopener noreferrer" className="transition-all duration-300 hover:scale-110 hover:opacity-80" style={{ color: '#6A1B9A' }}>
                  <Youtube size={24} strokeWidth={1.5} />
                </a>
              </div>
            </div>

            {/* Coluna 2: Institucional */}
            <div>
              <h3 className="font-bold text-lg mb-4" style={{ color: '#6A1B9A' }}>Institucional</h3>
              <ul className="space-y-3">
                <li>
                  <a href="#sobre" className="transition-colors hover:opacity-80" style={{ color: '#6A1B9A' }}>
                    Sobre Nós
                  </a>
                </li>
                <li>
                  <a href="#blog" className="transition-colors hover:opacity-80" style={{ color: '#6A1B9A' }}>
                    Blog
                  </a>
                </li>
                <li>
                  <a href="#afiliados" className="transition-colors hover:opacity-80" style={{ color: '#6A1B9A' }}>
                    Programa de Afiliados
                  </a>
                </li>
              </ul>
            </div>

            {/* Coluna 3: Suporte */}
            <div>
              <h3 className="font-bold text-lg mb-4" style={{ color: '#6A1B9A' }}>Suporte</h3>
              <ul className="space-y-3">
                <li>
                  <a href="#ajuda" className="transition-colors hover:opacity-80" style={{ color: '#6A1B9A' }}>
                    Central de Ajuda
                  </a>
                </li>
                <li>
                  <a href="#contato" className="transition-colors hover:opacity-80" style={{ color: '#6A1B9A' }}>
                    Fale Conosco
                  </a>
                </li>
              </ul>
            </div>

            {/* Coluna 4: Legal */}
            <div>
              <h3 className="font-bold text-lg mb-4" style={{ color: '#6A1B9A' }}>Legal</h3>
              <ul className="space-y-3">
                <li>
                  <a href="#termos" className="transition-colors hover:opacity-80" style={{ color: '#6A1B9A' }}>
                    Termos de Uso
                  </a>
                </li>
                <li>
                  <a href="#privacidade" className="transition-colors hover:opacity-80" style={{ color: '#6A1B9A' }}>
                    Política de Privacidade
                  </a>
                </li>
                <li>
                  <a href="#cookies" className="transition-colors hover:opacity-80" style={{ color: '#6A1B9A' }}>
                    Política de Cookies
                  </a>
                </li>
              </ul>
            </div>
          </div>

          {/* Copyright */}
          <div className="mt-12 pt-8 border-t text-center" style={{ borderColor: '#D1C4E9', color: '#6A1B9A' }}>
            <p className="text-sm">© 2025 VirtualMercado. Todos os direitos reservados.</p>
          </div>
        </div>
      </footer>
    </div>;
};
export default Home;