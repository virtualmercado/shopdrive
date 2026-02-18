import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Menu, X, Instagram, Facebook, Youtube, Linkedin, Twitter, MessageCircle } from "lucide-react";
import { useState, useCallback } from "react";
import logoMenu from "@/assets/logo-header-sd.png";
import logoRodape from "@/assets/logo-footer.png";
import { useCMSContent, getContent, getContentArray } from "@/hooks/useCMSContent";

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

interface LandingLayoutProps {
  children: React.ReactNode;
}

const LandingLayout = ({ children }: LandingLayoutProps) => {
  const { data: cmsContent } = useCMSContent();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const navigate = useNavigate();

  // Get CMS content with fallbacks
  const headerContent = {
    menuBenefits: getContent(cmsContent, "header", "menu_benefits", "Benefícios"),
    menuPlans: getContent(cmsContent, "header", "menu_plans", "Planos"),
    menuHowItWorks: getContent(cmsContent, "header", "menu_how_it_works", "Como Funciona"),
    buttonLogin: getContent(cmsContent, "header", "button_login", "Entrar"),
    buttonCta: getContent(cmsContent, "header", "button_cta", "Criar Loja Grátis"),
  };

  // Footer Content
  const footerContent = {
    logo_url: getContent(cmsContent, "footer", "logo_url", ""),
    logo_alt: getContent(cmsContent, "footer", "logo_alt", "ShopDrive"),
    subtitle: getContent(cmsContent, "footer", "subtitle", "Sua loja no digital."),
    social_links: getContentArray(cmsContent, "footer", "social_links", [
      { id: "1", name: "Instagram", icon: "Instagram", url: "https://instagram.com", open_new_tab: true, is_active: true },
      { id: "2", name: "Facebook", icon: "Facebook", url: "https://facebook.com", open_new_tab: true, is_active: true },
      { id: "3", name: "YouTube", icon: "Youtube", url: "https://youtube.com", open_new_tab: true, is_active: true },
    ]),
    columns: getContentArray(cmsContent, "footer", "columns", [
      { id: "1", title: "Institucional", links: [
        { id: "1", text: "Sobre Nós", type: "internal", route: "/sobre-nos", is_active: true },
        { id: "2", text: "Blog", type: "internal", route: "/blog", is_active: true },
      ]},
      { id: "2", title: "Suporte", links: [
        { id: "1", text: "Central de Ajuda", type: "internal", route: "/central-de-ajuda", is_active: true },
      ]},
      { id: "3", title: "Legal", links: [
        { id: "1", text: "Termos de Uso", type: "internal", route: "/termos-de-uso", is_active: true },
        { id: "2", text: "Política de Privacidade", type: "internal", route: "/politica-de-privacidade", is_active: true },
        { id: "3", text: "Política de Cookies", type: "internal", route: "/politica-de-cookies", is_active: true },
        { id: "4", text: "Gerenciar Cookies", type: "action", action: "open_cookie_settings", is_active: true },
      ]},
    ]),
    copyright: getContent(cmsContent, "footer", "copyright", "© 2025 ShopDrive. Todos os direitos reservados."),
  };

  // Preload route on hover
  const handleLinkHover = useCallback((route: string) => {
    // Trigger route prefetch by creating a hidden link
    const link = document.createElement('link');
    link.rel = 'prefetch';
    link.href = route;
    document.head.appendChild(link);
  }, []);

  // Smooth navigation with animation
  const handleSmoothNavigation = useCallback((e: React.MouseEvent<HTMLAnchorElement>, route: string) => {
    e.preventDefault();
    
    // Get the content container
    const contentContainer = document.querySelector('[data-page-content]');
    if (contentContainer) {
      contentContainer.classList.add('page-exit');
      
      setTimeout(() => {
        navigate(route);
        // Scroll to top
        window.scrollTo({ top: 0, behavior: 'instant' });
      }, 250);
    } else {
      navigate(route);
      window.scrollTo({ top: 0, behavior: 'instant' });
    }
  }, [navigate]);

  // Handle navigation to home sections
  const handleNavClick = useCallback((e: React.MouseEvent<HTMLAnchorElement>, hash: string) => {
    e.preventDefault();
    const currentPath = window.location.pathname;
    
    if (currentPath === '/') {
      // Already on home, just scroll
      const element = document.getElementById(hash);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth' });
      }
    } else {
      // Navigate to home with hash
      navigate(`/#${hash}`);
      setTimeout(() => {
        const element = document.getElementById(hash);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth' });
        }
      }, 100);
    }
    setIsMobileMenuOpen(false);
  }, [navigate]);

  // Normalize external URLs to ensure https:// prefix
  const normalizeExternalUrl = (url: string): string => {
    if (!url) return "";
    let trimmed = url.trim();
    // Block dangerous schemes
    if (/^(javascript|data|vbscript):/i.test(trimmed)) return "";
    // Add https:// if missing protocol
    if (/^(www\.|youtube\.com|youtu\.be|instagram\.com|facebook\.com|twitter\.com|tiktok\.com|linkedin\.com|pinterest\.com)/i.test(trimmed)) {
      trimmed = `https://${trimmed}`;
    }
    if (!/^https?:\/\//i.test(trimmed)) return "";
    return trimmed;
  };

  // Helper to render footer link with smooth navigation
  const renderFooterLink = (link: any) => {
    if (!link.is_active) return null;
    const href = link.type === "internal" ? link.route : link.url;
    const isExternal = link.type === "external";
    const isCookieSettings = link.type === "action" && link.action === "open_cookie_settings";
    
    if (isCookieSettings) {
      return (
        <li key={link.id}>
          <button 
            onClick={() => (window as any).openCookieSettings?.()}
            className="transition-colors hover:opacity-80 cursor-pointer text-left" 
            style={{ color: '#6A1B9A' }}
          >
            {link.text}
          </button>
        </li>
      );
    }
    
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

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header - Persistent */}
      <header className="border-b bg-white/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-3 md:py-4">
          <div className="flex items-center justify-between">
            <Link to="/" className="flex items-center gap-2">
              <img src={logoMenu} alt="ShopDrive" className="h-8 md:h-10" />
            </Link>
            
            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center gap-6">
              <a 
                href="/#beneficios"
                onClick={(e) => handleNavClick(e, 'beneficios')}
                className="text-lg font-bold text-foreground hover:text-primary transition-colors cursor-pointer"
              >
                {headerContent.menuBenefits}
              </a>
              <a 
                href="/#planos"
                onClick={(e) => handleNavClick(e, 'planos')}
                className="text-lg font-bold text-foreground hover:text-primary transition-colors cursor-pointer"
              >
                {headerContent.menuPlans}
              </a>
              <a 
                href="/#como-funciona"
                onClick={(e) => handleNavClick(e, 'como-funciona')}
                className="text-lg font-bold text-foreground hover:text-primary transition-colors cursor-pointer"
              >
                {headerContent.menuHowItWorks}
              </a>
            </nav>
            
            {/* Desktop Buttons */}
            <div className="hidden md:flex items-center gap-3">
              <Link to="/login">
                <Button variant="outline" className="border-primary text-primary hover:bg-primary hover:text-primary-foreground transition-all">
                  {headerContent.buttonLogin}
                </Button>
              </Link>
              <Link to="/register">
                <Button className="bg-secondary hover:bg-secondary/90">{headerContent.buttonCta}</Button>
              </Link>
            </div>
            
            {/* Mobile Menu Button and Actions */}
            <div className="flex md:hidden items-center gap-2">
              <Link to="/login">
                <Button variant="outline" size="sm" className="border-primary text-primary hover:bg-primary hover:text-primary-foreground transition-all text-xs h-8 px-3">
                  {headerContent.buttonLogin}
                </Button>
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
                  href="/#beneficios" 
                  onClick={(e) => handleNavClick(e, 'beneficios')} 
                  className="text-base font-bold text-foreground hover:text-primary transition-colors cursor-pointer py-2"
                >
                  {headerContent.menuBenefits}
                </a>
                <a 
                  href="/#planos" 
                  onClick={(e) => handleNavClick(e, 'planos')} 
                  className="text-base font-bold text-foreground hover:text-primary transition-colors cursor-pointer py-2"
                >
                  {headerContent.menuPlans}
                </a>
                <a 
                  href="/#como-funciona" 
                  onClick={(e) => handleNavClick(e, 'como-funciona')} 
                  className="text-base font-bold text-foreground hover:text-primary transition-colors cursor-pointer py-2"
                >
                  {headerContent.menuHowItWorks}
                </a>
              </div>
            </nav>
          )}
        </div>
      </header>

      {/* Main Content - Animated Container */}
      <main 
        data-page-content
        className="flex-1 page-enter"
      >
        {children}
      </main>

      {/* Footer - Persistent */}
      <footer className="bg-[#EDE5F8] py-16 px-4">
        <div className="container mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12">
            <div>
              <Link to="/" className="footer-logo-link flex items-center gap-2 mb-4">
                <img 
                  src={footerContent.logo_url || logoRodape} 
                  alt={footerContent.logo_alt} 
                  className="footer-logo-img h-8" 
                />
              </Link>
              <p className="mb-6" style={{ color: '#6A1B9A' }}>{footerContent.subtitle}</p>
              <div className="flex gap-4">
                {footerContent.social_links
                  .filter((link: any) => link.is_active && link.url)
                  .map((link: any) => {
                    const IconComponent = socialIconMap[link.icon];
                    if (!IconComponent) return null;
                    const normalizedUrl = normalizeExternalUrl(link.url);
                    if (!normalizedUrl) return null;
                    return (
                      <a 
                        key={link.id}
                        href={normalizedUrl} 
                        target="_blank"
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
    </div>
  );
};

export default LandingLayout;
