import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Store, Palette, ShoppingCart, BarChart3, Menu, X, Instagram, Facebook, Youtube, TrendingUp, Linkedin, Twitter, Percent, LayoutDashboard, ImagePlus, Tag, Heart, Gift, Truck, Shield, Star, Zap, Clock, Globe, MessageCircle } from "lucide-react";
import { PlansSection } from "@/components/plans/PlansSection";
import { Link, useNavigate } from "react-router-dom";
import { useState, useCallback } from "react";
import logoMenu from "@/assets/logo-menu.png";
import logoRodape from "@/assets/logo-footer.png";
import benefitsImageDefault from "@/assets/benefits-handshake.jpg";
import benefitsMobileDefault from "@/assets/benefits-mobile.jpg";
import editIcon from "@/assets/edit-icon.png";
import testimonialJuliana from "@/assets/testimonial-juliana.jpg";
import testimonialMarcos from "@/assets/testimonial-marcos.jpg";
import testimonialCarla from "@/assets/testimonial-carla.jpg";
import { useCMSBanners, getBannerUrl } from "@/hooks/useCMSBanners";
import { useCMSContent, getContent, getContentArray } from "@/hooks/useCMSContent";
import { HeroSection } from "@/components/landing";

// Icon mapping for dynamic icons
const iconMap: Record<string, any> = {
  Store, Palette, ShoppingCart, BarChart3, Percent, LayoutDashboard, ImagePlus, Tag,
  Heart, Gift, Truck, Shield, Star, Zap, Clock, Globe
};

// Social icon mapping for footer
const socialIconMap: Record<string, any> = {
  Instagram, 
  Facebook, 
  Youtube, 
  Twitter, 
  Linkedin,
  TikTok: () => (
    <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
      <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-5.2 1.74 2.89 2.89 0 012.31-4.64 2.93 2.93 0 01.88.13V9.4a6.84 6.84 0 00-1-.05A6.33 6.33 0 005 20.1a6.34 6.34 0 0010.86-4.43v-7a8.16 8.16 0 004.77 1.52v-3.4a4.85 4.85 0 01-1-.1z"/>
    </svg>
  ),
  Pinterest: () => (
    <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
      <path d="M12 0a12 12 0 00-4.37 23.17c-.1-.94-.2-2.4.04-3.43l1.43-6.04s-.36-.73-.36-1.81c0-1.7.98-2.96 2.2-2.96 1.04 0 1.54.78 1.54 1.71 0 1.04-.66 2.6-1 4.04-.29 1.2.6 2.18 1.78 2.18 2.14 0 3.78-2.26 3.78-5.52 0-2.88-2.07-4.9-5.03-4.9-3.43 0-5.44 2.57-5.44 5.22 0 1.03.4 2.14.9 2.75a.36.36 0 01.08.35l-.33 1.36c-.05.22-.18.27-.41.16-1.54-.72-2.5-2.96-2.5-4.77 0-3.88 2.82-7.44 8.14-7.44 4.27 0 7.59 3.04 7.59 7.12 0 4.25-2.68 7.67-6.4 7.67-1.25 0-2.43-.65-2.83-1.42l-.77 2.94c-.28 1.07-1.03 2.4-1.53 3.22A12 12 0 1012 0z"/>
    </svg>
  ),
  WhatsApp: MessageCircle,
};

const Home = () => {
  const { data: cmsBanners } = useCMSBanners();
  const { data: cmsContent } = useCMSContent();
  const navigate = useNavigate();
  
  // Get banner URLs from CMS or use defaults (for non-hero sections)
  const benefitsImage = getBannerUrl(cmsBanners, 'banner_02', benefitsImageDefault);
  const benefitsMobile = getBannerUrl(cmsBanners, 'banner_03', benefitsMobileDefault);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
  const handleNavClick = (id: string) => {
    setIsMobileMenuOpen(false);
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  // Preload route on hover for smooth navigation
  const handleLinkHover = useCallback((route: string) => {
    const link = document.createElement('link');
    link.rel = 'prefetch';
    link.href = route;
    document.head.appendChild(link);
  }, []);

  // Smooth navigation with animation for footer links
  const handleSmoothNavigation = useCallback((e: React.MouseEvent<HTMLAnchorElement>, route: string) => {
    e.preventDefault();
    
    // Apply exit animation to main content
    const mainContent = document.querySelector('main');
    if (mainContent) {
      mainContent.style.transition = 'opacity 250ms ease-in-out, transform 250ms ease-in-out';
      mainContent.style.opacity = '0';
      mainContent.style.transform = 'translateY(-5px)';
      
      setTimeout(() => {
        navigate(route);
        window.scrollTo({ top: 0, behavior: 'instant' });
      }, 250);
    } else {
      navigate(route);
      window.scrollTo({ top: 0, behavior: 'instant' });
    }
  }, [navigate]);

  // Get CMS content with fallbacks
  const headerContent = {
    menuBenefits: getContent(cmsContent, "header", "menu_benefits", "Benefícios"),
    menuPlans: getContent(cmsContent, "header", "menu_plans", "Planos"),
    menuHowItWorks: getContent(cmsContent, "header", "menu_how_it_works", "Como Funciona"),
    buttonLogin: getContent(cmsContent, "header", "button_login", "Entrar"),
    buttonCta: getContent(cmsContent, "header", "button_cta", "Criar Loja Grátis"),
  };

  const heroContent = {
    badge: getContent(cmsContent, "hero", "badge", "🇧🇷 Plataforma 100% Nacional"),
    title: getContent(cmsContent, "hero", "title", "Crie sua loja virtual e seu catálogo digital em menos de 01 minuto. É GRÁTIS, FÁCIL e 100% online!"),
    subtitle: getContent(cmsContent, "hero", "subtitle", "Plataforma simples e moderna, venda 24h por dia o ano inteiro direto do celular. Comece gratuitamente hoje mesmo."),
    buttonPrimary: getContent(cmsContent, "hero", "button_primary", "Criar Minha Loja Grátis"),
    buttonSecondary: getContent(cmsContent, "hero", "button_secondary", "Ver Demonstração"),
    infoText: getContent(cmsContent, "hero", "info_text", "Grátis para sempre, sem taxas ou cartão de crédito"),
  };

  const productsContent = {
    title: getContent(cmsContent, "products", "title", "Seus produtos disponíveis em todos os lugares"),
    description: getContent(cmsContent, "products", "description", "Adicione o link da sua loja em todas as suas redes sociais, e envie para seus clientes a qualquer hora em qualquer lugar."),
  };

  const socialProofText = getContent(cmsContent, "social_proof_1", "text", "Mais de 10 mil empreendedores já criaram suas lojas com a VirtualMercado");

  const salesPaymentsContent = {
    title: getContent(cmsContent, "sales_payments", "title", "Venda através do WhatsApp ou aceite pagamentos no site."),
    highlight: getContent(cmsContent, "sales_payments", "highlight", "LUCRO 24h por dia."),
    description: getContent(cmsContent, "sales_payments", "description", "Receba pagamentos no cartão de crédito, débito ou via PIX de forma automática e segura, direto na sua conta."),
    benefits: getContentArray(cmsContent, "sales_payments", "benefits", [
      "Gerador de catálogo de produtos em PDF.",
      "Confirmação e lista do pedido diretamente no seu WhatsApp.",
      "Transparência, organização e segurança nas suas vendas."
    ]),
  };

  const resourcesContent = {
    title: getContent(cmsContent, "resources", "title", "Recursos poderosos para suas vendas decolarem"),
    subtitle: getContent(cmsContent, "resources", "subtitle", "Ferramentas simples que geram resultados rápidos e lucrativos."),
  };

  const defaultCards = [
    { title: "Loja Profissional", description: "Crie uma loja virtual com visual profissional em minutos", icon: "Store" },
    { title: "Personalização Total", description: "Customize cores, fontes e layout da sua loja", icon: "Palette" },
    { title: "Carrinho Inteligente", description: "Sistema de carrinho e checkout otimizado para conversão", icon: "ShoppingCart" },
    { title: "Relatórios Completos", description: "Acompanhe vendas e performance em tempo real", icon: "BarChart3" },
    { title: "Sem Taxa de Venda", description: "A plataforma não cobra nenhum valor ou comissão nas suas vendas.", icon: "Percent" },
    { title: "Painel Administrativo", description: "Controle total sobre estoque, clientes, pedidos e envios.", icon: "LayoutDashboard" },
    { title: "Editor de Imagens", description: "Edite de forma profissional as imagens e o cadastro dos seus produtos.", icon: "ImagePlus" },
    { title: "Criador de Cupons", description: "Gere cupons de desconto e aumente o número de vendas e clientes.", icon: "Tag" },
  ];
  const resourceCards = getContentArray(cmsContent, "resource_cards", "cards", defaultCards);

  const testimonialsContent = {
    title: getContent(cmsContent, "testimonials", "title", "Quem usa, aprova!"),
    subtitle: getContent(cmsContent, "testimonials", "subtitle", "Histórias reais de quem transformou e melhorou o jeito de vender."),
    items: getContentArray(cmsContent, "testimonials", "items", [
      { name: "Juliana S.", role: "Dona da @doceju", text: "Em menos de um dia, minha loja estava no ar! A plataforma é super intuitiva e o suporte é nota 10." },
      { name: "Marcos P.", role: "Artesão na @arteemmadeira", text: "Consegui organizar meus produtos e agora vendo para todo o Brasil. O editor de fotos me ajudou a deixar tudo mais profissional." },
      { name: "Carla F.", role: "Consultora de Beleza", text: "Meus clientes amaram a facilidade de comprar pelo site. A integração com o WhatsApp é perfeita para fechar vendas." },
    ]),
  };
  const testimonialImages = [testimonialJuliana, testimonialMarcos, testimonialCarla];

  const howItWorksContent = {
    title: getContent(cmsContent, "how_it_works", "title", "Como funciona"),
    subtitle: getContent(cmsContent, "how_it_works", "subtitle", "3 passos simples para começar a vender"),
    steps: getContentArray(cmsContent, "how_it_works", "steps", [
      { step: "1", title: "Cadastre-se", description: "Crie sua conta gratuitamente em menos de 1 minuto" },
      { step: "2", title: "Configure sua loja", description: "Adicione produtos, personalize cores e layout" },
      { step: "3", title: "Comece a vender", description: "Compartilhe sua loja e seu catálogo PDF e receba pedidos online" },
    ]),
    ctaButton: getContent(cmsContent, "how_it_works", "cta_button", "Criar Loja Agora"),
    ctaText: getContent(cmsContent, "how_it_works", "cta_text", "Junte-se a milhares de lojistas que já vendem com a VirtualMercado"),
  };

  // FAQ Content
  const faqContent = {
    title: getContent(cmsContent, "faq", "title", "Dúvidas Frequentes"),
    subtitle: getContent(cmsContent, "faq", "subtitle", "Encontre aqui as respostas para as perguntas mais comuns."),
    items: getContentArray(cmsContent, "faq", "items", [
      { question: "A VirtualMercado é grátis mesmo?", answer: "Sim! Você pode ter uma loja totalmente gratuita, e caso queira recursos exclusivos, pode assinar um plano pago." },
      { question: "Preciso ter CNPJ para começar?", answer: "Não! Você pode começar a vender usando apenas seu CPF e, quando seu negócio crescer, pode migrar para um CNPJ facilmente." },
      { question: "Como funciona o recebimento das minhas vendas?", answer: "Você pode receber via PIX, que cai na hora na sua conta, ou integrar com outras soluções de pagamento para aceitar cartão e boleto. Tudo de forma segura." },
      { question: "Posso usar um domínio que já tenho?", answer: "Sim! No plano PREMIUM, você pode conectar seu próprio domínio (ex: www.sualoja.com.br) para deixar sua loja ainda mais profissional." },
      { question: "Posso cancelar a assinatura quando quiser?", answer: "Sim, você pode cancelar sua assinatura a qualquer momento." },
      { question: "Posso usar meu site na plataforma como catálogo de produtos?", answer: "Sim! Você pode usar sua loja como um catálogo digital em PDF, exibindo fotos, descrições e preços dos produtos mesmo sem ativar o sistema de vendas online." },
      { question: "Como faço o pagamento da minha assinatura aqui na VirtualMercado?", answer: "Você paga uma mensalidade ou anuidade diretamente pela plataforma. Aceitamos PIX, cartão de crédito, cartão de débito e boleto bancário." },
    ]),
  };

  // Footer Content
  const footerContent = {
    logo_url: getContent(cmsContent, "footer", "logo_url", ""),
    logo_alt: getContent(cmsContent, "footer", "logo_alt", "VirtualMercado"),
    subtitle: getContent(cmsContent, "footer", "subtitle", "Sua loja virtual em minutos."),
    social_links: getContentArray(cmsContent, "footer", "social_links", [
      { id: "1", name: "Instagram", icon: "Instagram", url: "https://instagram.com", open_new_tab: true, is_active: true },
      { id: "2", name: "Facebook", icon: "Facebook", url: "https://facebook.com", open_new_tab: true, is_active: true },
      { id: "3", name: "YouTube", icon: "Youtube", url: "https://youtube.com", open_new_tab: true, is_active: true },
    ]),
    columns: getContentArray(cmsContent, "footer", "columns", [
      { id: "1", title: "Institucional", links: [
        { id: "1", text: "Sobre Nós", type: "internal", route: "/sobre-nos", is_active: true },
        { id: "2", text: "Blog", type: "internal", route: "/blog", is_active: true },
        { id: "3", text: "Programa de Afiliados", type: "internal", route: "/programa-de-afiliados", is_active: true },
      ]},
      { id: "2", title: "Suporte", links: [
        { id: "1", text: "Central de Ajuda", type: "internal", route: "/central-de-ajuda", is_active: true },
        { id: "2", text: "Fale Conosco", type: "internal", route: "/fale-conosco", is_active: true },
      ]},
      { id: "3", title: "Legal", links: [
        { id: "1", text: "Termos de Uso", type: "internal", route: "/termos-de-uso", is_active: true },
        { id: "2", text: "Política de Privacidade", type: "internal", route: "/politica-de-privacidade", is_active: true },
        { id: "3", text: "Política de Cookies", type: "internal", route: "/politica-de-cookies", is_active: true },
      ]},
    ]),
    copyright: getContent(cmsContent, "footer", "copyright", "© 2025 VirtualMercado. Todos os direitos reservados."),
  };

  // Helper to render footer link with smooth navigation
  const renderFooterLink = (link: any) => {
    if (!link.is_active) return null;
    const href = link.type === "internal" ? link.route : link.url;
    const isExternal = link.type === "external";
    
    if (isExternal) {
      return (
        <li key={link.id}>
          <a 
            href={href} 
            target="_blank" 
            rel="noopener noreferrer"
            className="transition-colors hover:opacity-80" 
            style={{ color: '#6A1B9A' }}
          >
            {link.text}
          </a>
        </li>
      );
    }
    
    return (
      <li key={link.id}>
        <a 
          href={href || "#"}
          onClick={(e) => handleSmoothNavigation(e, href || "/")}
          onMouseEnter={() => handleLinkHover(href || "/")}
          className="transition-colors hover:opacity-80 cursor-pointer" 
          style={{ color: '#6A1B9A' }}
        >
          {link.text}
        </a>
      </li>
    );
  };

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
                onClick={(e) => { e.preventDefault(); document.getElementById('beneficios')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }}
                className="text-lg font-bold text-foreground hover:text-primary transition-colors cursor-pointer"
              >
                {headerContent.menuBenefits}
              </a>
              <a 
                href="#planos" 
                onClick={(e) => { e.preventDefault(); document.getElementById('planos')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }}
                className="text-lg font-bold text-foreground hover:text-primary transition-colors cursor-pointer"
              >
                {headerContent.menuPlans}
              </a>
              <a 
                href="#como-funciona" 
                onClick={(e) => { e.preventDefault(); document.getElementById('como-funciona')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }}
                className="text-lg font-bold text-foreground hover:text-primary transition-colors cursor-pointer"
              >
                {headerContent.menuHowItWorks}
              </a>
            </nav>
            
            {/* Desktop Buttons */}
            <div className="hidden md:flex items-center gap-3">
              <Link to="/login">
                <Button variant="outline" className="border-primary text-primary hover:bg-primary hover:text-primary-foreground transition-all">{headerContent.buttonLogin}</Button>
              </Link>
              <Link to="/register">
                <Button className="bg-secondary hover:bg-secondary/90">{headerContent.buttonCta}</Button>
              </Link>
            </div>
            
            {/* Mobile Menu Button and Actions */}
            <div className="flex md:hidden items-center gap-2">
              <Link to="/login">
                <Button variant="outline" size="sm" className="border-primary text-primary hover:bg-primary hover:text-primary-foreground transition-all text-xs h-8 px-3">{headerContent.buttonLogin}</Button>
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
                <a href="#beneficios" onClick={(e) => { e.preventDefault(); handleNavClick('beneficios'); }} className="text-base font-bold text-foreground hover:text-primary transition-colors cursor-pointer py-2">{headerContent.menuBenefits}</a>
                <a href="#planos" onClick={(e) => { e.preventDefault(); handleNavClick('planos'); }} className="text-base font-bold text-foreground hover:text-primary transition-colors cursor-pointer py-2">{headerContent.menuPlans}</a>
                <a href="#como-funciona" onClick={(e) => { e.preventDefault(); handleNavClick('como-funciona'); }} className="text-base font-bold text-foreground hover:text-primary transition-colors cursor-pointer py-2">{headerContent.menuHowItWorks}</a>
              </div>
            </nav>
          )}
        </div>
      </header>

      {/* Main Content - Animated Container */}
      <main className="page-enter">
      {/* Hero Section - New Bling-style layout */}
      <HeroSection heroContent={heroContent} />

      {/* Products Section */}
      <section className="py-20 px-4 bg-background">
        <div className="container mx-auto">
          <div className="flex flex-col md:grid md:grid-cols-2 gap-12 items-center">
            <div className="space-y-8 order-1">
              <div>
                <h2 className="text-3xl md:text-4xl font-bold mb-4 text-left">{productsContent.title}</h2>
                <p className="text-lg text-justify" style={{ color: '#5A5A5A' }}>{productsContent.description}</p>
              </div>
              
              {/* Social Media Icons */}
              <div className="grid grid-cols-4 md:grid-cols-4 lg:grid-cols-7 gap-8 justify-items-center">
                <svg className="h-10 w-10 md:h-8 md:w-8 lg:h-10 lg:w-10 transition-all duration-300 hover:scale-125 hover:opacity-70 cursor-pointer" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="2" y="2" width="20" height="20" rx="5" stroke="#6a1b9a" strokeWidth="1.5"/><circle cx="12" cy="12" r="4" stroke="#6a1b9a" strokeWidth="1.5"/><circle cx="17.5" cy="6.5" r="1" fill="#6a1b9a"/></svg>
                <svg className="h-10 w-10 md:h-8 md:w-8 lg:h-10 lg:w-10 transition-all duration-300 hover:scale-125 hover:opacity-70 cursor-pointer" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="10" stroke="#6a1b9a" strokeWidth="1.5"/><path d="M15.5 12.5h-2v7h-3v-7h-2v-2.5h2V8.5c0-1.7 1-3 3-3h2v2.5h-1.5c-.5 0-.5.3-.5.8v1.7h2l-.5 2.5z" fill="#6a1b9a"/></svg>
                <svg className="h-10 w-10 md:h-8 md:w-8 lg:h-10 lg:w-10 transition-all duration-300 hover:scale-125 hover:opacity-70 cursor-pointer" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="2" y="5" width="20" height="14" rx="3" stroke="#6a1b9a" strokeWidth="1.5"/><path d="M10 8.5L15 12L10 15.5V8.5Z" fill="#6a1b9a" stroke="#6a1b9a" strokeWidth="1"/></svg>
                <svg className="h-10 w-10 md:h-8 md:w-8 lg:h-10 lg:w-10 transition-all duration-300 hover:scale-125 hover:opacity-70 cursor-pointer" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-5.2 1.74 2.89 2.89 0 012.31-4.64 2.93 2.93 0 01.88.13V9.4a6.84 6.84 0 00-1-.05A6.33 6.33 0 005 20.1a6.34 6.34 0 0010.86-4.43v-7a8.16 8.16 0 004.77 1.52v-3.4a4.85 4.85 0 01-1-.1z" fill="#6a1b9a" strokeWidth="0"/></svg>
                <svg className="h-10 w-10 md:h-8 md:w-8 lg:h-10 lg:w-10 transition-all duration-300 hover:scale-125 hover:opacity-70 cursor-pointer" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="2" y="2" width="20" height="20" rx="2" stroke="#6a1b9a" strokeWidth="1.5"/><rect x="5" y="9" width="3" height="9" fill="#6a1b9a"/><circle cx="6.5" cy="6" r="1.5" fill="#6a1b9a"/><path d="M12 9c1.5 0 2.5.5 3 1.5V9h3v9h-3v-5c0-1-.5-2-1.5-2s-1.5 1-1.5 2v5h-3V9h3z" fill="#6a1b9a"/></svg>
                <svg className="h-10 w-10 md:h-8 md:w-8 lg:h-10 lg:w-10 transition-all duration-300 hover:scale-125 hover:opacity-70 cursor-pointer" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="10" stroke="#6a1b9a" strokeWidth="1.5"/><path d="M12.5 6c2.5 0 4.5 2 4.5 4.5 0 2-1.2 3.5-2.8 3.5-.6 0-1.1-.3-1.3-.8 0 0-.3 1.2-.4 1.4-.2.8-.8 1.6-1.2 2.1-.3.1-.5.1-.6 0 0-.2-.1-.8-.1-1.2 0-.4.5-2.2.5-2.2s-.1-.5-.1-1.1c0-1.1.6-1.9 1.4-1.9.6 0 1 .5 1 1.1 0 .7-.4 1.7-.7 2.6-.2.8.4 1.4 1.2 1.4 1.4 0 2.4-1.8 2.4-3.9 0-1.6-1.1-2.8-3.1-2.8-2.3 0-3.7 1.7-3.7 3.6 0 .7.2 1.2.5 1.6.1.1.1.2.1.3-.1.3-.2.8-.2.9-.1.2-.2.2-.4.1-1-.4-1.5-1.5-1.5-2.7 0-2.1 1.8-4.6 5.3-4.6z" fill="#6a1b9a"/></svg>
                <svg className="h-10 w-10 md:h-8 md:w-8 lg:h-10 lg:w-10 transition-all duration-300 hover:scale-125 hover:opacity-70 cursor-pointer" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" fill="#6a1b9a" strokeWidth="0"/></svg>
              </div>
              
              <div className="md:hidden mt-8">
                <img src={benefitsImage} alt="Empreendedores de sucesso" className="w-full h-auto rounded-lg shadow-lg" />
              </div>
              
              <div className="flex items-center gap-4 pt-2">
                <div className="flex-shrink-0 p-3 bg-[#FB8C00] rounded-lg transition-all duration-300 hover:scale-110 hover:opacity-80 cursor-pointer">
                  <TrendingUp className="h-10 w-10 text-white" />
                </div>
                <p className="text-lg md:text-xl font-semibold text-left">{socialProofText}</p>
              </div>
            </div>
            
            <div className="hidden md:block order-2">
              <img src={benefitsImage} alt="Empreendedores de sucesso" className="w-full h-auto rounded-lg shadow-lg" />
            </div>
          </div>
        </div>
      </section>

      {/* Sales & Payments Section */}
      <section className="py-20 px-4 bg-background">
        <div className="container mx-auto">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <img src={benefitsMobile} alt="Pagamentos e WhatsApp" className="w-full h-auto rounded-lg shadow-lg max-w-md mx-auto" />
            </div>
            
            <div className="space-y-6">
              <div>
                <h2 className="text-3xl md:text-4xl font-bold mb-4 text-left">
                  <span style={{ color: '#000000' }}>{salesPaymentsContent.title} </span>
                  <span style={{ color: '#6a1b9a' }}>{salesPaymentsContent.highlight}</span>
                </h2>
                <p className="text-lg mb-8" style={{ color: '#5A5A5A' }}>{salesPaymentsContent.description}</p>
              </div>
              
              <div className="space-y-4">
                {salesPaymentsContent.benefits.map((benefit: string, index: number) => (
                  <div key={index} className="flex items-start gap-4">
                    <div className="flex-shrink-0 w-9 h-9 transition-all duration-300 hover:scale-110 cursor-pointer">
                      <img src={editIcon} alt="Editar" className="w-full h-full object-contain" />
                    </div>
                    <p className="text-lg pt-1" style={{ color: '#5A5A5A' }}>{benefit}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section id="beneficios" className="py-20 px-4">
        <div className="container mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4">{resourcesContent.title}</h2>
            <p className="text-xl max-w-2xl mx-auto" style={{ color: '#5A5A5A' }}>{resourcesContent.subtitle}</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {resourceCards.map((card: any, index: number) => {
              const IconComponent = iconMap[card.icon] || Store;
              return (
                <Card key={index} className="p-6 hover:shadow-lg transition-all border-2 hover:border-primary/20">
                  <div className="h-12 w-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4">
                    <IconComponent className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="text-xl font-semibold mb-2">{card.title}</h3>
                  <p style={{ color: '#5A5A5A' }}>{card.description}</p>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="planos" className="py-20 px-4 bg-muted/30">
        <div className="container mx-auto">
          <div className="text-center mb-10">
            <h2 className="text-4xl font-bold mb-4">Planos para todos os tamanhos</h2>
            <p className="text-xl" style={{ color: '#5A5A5A' }}>Comece grátis e escale seu negócio</p>
          </div>
          <PlansSection isLandingPage={true} />
        </div>
      </section>

      {/* Testimonials Section */}
      <section className="py-20 px-4 bg-background">
        <div className="container mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4">{testimonialsContent.title}</h2>
            <p className="text-xl max-w-2xl mx-auto" style={{ color: '#5A5A5A' }}>{testimonialsContent.subtitle}</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {testimonialsContent.items.map((item: any, index: number) => (
              <Card key={index} className="p-6 bg-white shadow-sm hover:shadow-lg transition-all">
                <p className="text-lg mb-6 text-black leading-relaxed">"{item.text}"</p>
                <div className="flex items-center gap-4">
                  <img src={testimonialImages[index] || testimonialImages[0]} alt={item.name} className="w-14 h-14 rounded-full object-cover" />
                  <div>
                    <p className="font-bold text-black">{item.name}</p>
                    <p className="text-sm" style={{ color: '#4A4A4A' }}>{item.role}</p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* How it Works */}
      <section id="como-funciona" className="py-20 px-4">
        <div className="container mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4">{howItWorksContent.title}</h2>
            <p className="text-xl" style={{ color: '#5A5A5A' }}>{howItWorksContent.subtitle}</p>
          </div>
          <div className="grid md:grid-cols-2 gap-12 items-center max-w-6xl mx-auto">
            <div className="space-y-10">
              {howItWorksContent.steps.map((item: any, index: number) => (
                <div key={index} className="flex gap-6 items-start">
                  <div className="text-7xl md:text-8xl font-bold flex-shrink-0" style={{ color: '#B0B0B0', fontFamily: 'Century Gothic, sans-serif', lineHeight: '1' }}>{item.step}</div>
                  <div className="text-left pt-2">
                    <h3 className="text-2xl font-semibold mb-2">{item.title}</h3>
                    <p className="text-lg" style={{ color: '#5A5A5A' }}>{item.description}</p>
                  </div>
                </div>
              ))}
            </div>
            
            <div className="flex flex-col items-center justify-center space-y-6">
              <Link to="/register" className="w-full max-w-sm">
                <Button size="lg" className="w-full bg-secondary hover:bg-secondary/90 text-white font-semibold text-lg h-14">{howItWorksContent.ctaButton}</Button>
              </Link>
              <p className="text-center text-lg max-w-sm" style={{ color: '#333333' }}>{howItWorksContent.ctaText}</p>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-20 px-4 bg-gray-50">
        <div className="container mx-auto max-w-4xl">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold mb-4">{faqContent.title}</h2>
            <p className="text-xl" style={{ color: '#5A5A5A' }}>{faqContent.subtitle}</p>
          </div>
          <div className="bg-white rounded-lg shadow-md p-6 md:p-8">
            <Accordion type="single" collapsible className="w-full">
              {faqContent.items.map((item: any, index: number) => (
                <AccordionItem key={index} value={`item-${index}`}>
                  <AccordionTrigger className="text-left text-lg font-semibold hover:no-underline">
                    {item.question}
                  </AccordionTrigger>
                  <AccordionContent className="text-base" style={{ color: '#5A5A5A' }}>
                    {item.answer}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </div>
      </section>
      </main>

      {/* Footer */}
      <footer className="bg-[#EDE5F8] py-16 px-4">
        <div className="container mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <img 
                  src={footerContent.logo_url || logoRodape} 
                  alt={footerContent.logo_alt} 
                  className="h-8" 
                />
              </div>
              <p className="mb-6" style={{ color: '#6A1B9A' }}>{footerContent.subtitle}</p>
              <div className="flex gap-4">
                {footerContent.social_links
                  .filter((link: any) => link.is_active && link.url)
                  .map((link: any) => {
                    const IconComponent = socialIconMap[link.icon];
                    if (!IconComponent) return null;
                    return (
                      <a 
                        key={link.id}
                        href={link.url} 
                        target={link.open_new_tab ? "_blank" : "_self"}
                        rel="noopener noreferrer" 
                        className="transition-all duration-300 hover:scale-110 hover:opacity-80" 
                        style={{ color: '#6A1B9A' }}
                      >
                        <IconComponent size={24} strokeWidth={1.5} />
                      </a>
                    );
                  })}
              </div>
            </div>
            {footerContent.columns.map((column: any) => (
              <div key={column.id}>
                <h3 className="font-bold text-lg mb-4" style={{ color: '#6A1B9A' }}>{column.title}</h3>
                <ul className="space-y-3">
                  {column.links.map((link: any) => renderFooterLink(link))}
                </ul>
              </div>
            ))}
          </div>
          <div className="mt-12 pt-8 border-t text-center" style={{ borderColor: '#D1C4E9', color: '#6A1B9A' }}>
            <p className="text-sm">{footerContent.copyright}</p>
          </div>
        </div>
      </footer>
    </div>;
};
export default Home;
