import { Instagram, Facebook, Youtube, Phone, Mail, Home, MessageCircle } from "lucide-react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useCustomerAuth } from "@/hooks/useCustomerAuth";

interface StoreFooterProps {
  storeData: {
    store_name: string;
    store_slug?: string;
    store_logo_url?: string;
    store_description?: string;
    instagram_url?: string;
    facebook_url?: string;
    x_url?: string;
    youtube_url?: string;
    email?: string;
    phone?: string;
    whatsapp_number?: string;
    address?: string;
    address_number?: string;
    address_complement?: string;
    address_neighborhood?: string;
    address_city?: string;
    address_state?: string;
    address_zip_code?: string;
    footer_bg_color: string;
    footer_text_color: string;
    cpf_cnpj?: string;
    primary_color?: string;
  };
}

const StoreFooter = ({ storeData }: StoreFooterProps) => {
  const currentYear = new Date().getFullYear();
  const { user } = useCustomerAuth();
  const navigate = useNavigate();
  const location = useLocation();
  
  const getAccountLink = () => {
    if (user) {
      return `/loja/${storeData.store_slug}/conta`;
    }
    return `/loja/${storeData.store_slug}/auth`;
  };

  const handleHomeClick = (e: React.MouseEvent) => {
    e.preventDefault();
    const storeHomePath = `/loja/${storeData.store_slug}`;
    
    if (location.pathname === storeHomePath) {
      // Already on home page, just scroll to top
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else {
      // Navigate to home page and scroll to top
      navigate(storeHomePath);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  // Formatar endereço completo em duas linhas
  const formatFullAddress = () => {
    const line1Parts = [];
    if (storeData.address) line1Parts.push(storeData.address);
    if (storeData.address_number) line1Parts.push(storeData.address_number);
    if (storeData.address_complement) line1Parts.push(storeData.address_complement);
    if (storeData.address_neighborhood) line1Parts.push(storeData.address_neighborhood);
    
    const line1 = line1Parts.join(", ");
    
    const line2Parts = [
      storeData.address_city,
      storeData.address_state,
      storeData.address_zip_code ? `CEP ${storeData.address_zip_code}` : null
    ].filter(Boolean);
    
    const line2 = line2Parts.join(" - ");
    
    return { line1, line2, hasAddress: line1 || line2 };
  };

  const addressData = formatFullAddress();
  const iconColor = storeData.primary_color || "#6a1b9a";

  return (
    <>
      <footer
        className="mt-16"
        style={{
          backgroundColor: storeData.footer_bg_color,
          color: storeData.footer_text_color,
        }}
      >
        <div className="container mx-auto px-4 py-12">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Coluna Esquerda */}
            <div className="space-y-4">
              {storeData.store_logo_url ? (
                <img
                  src={storeData.store_logo_url}
                  alt={storeData.store_name}
                  className="max-w-[50px] md:max-w-[70px] h-auto object-contain"
                />
              ) : (
                <h3 className="text-xl font-bold">{storeData.store_name}</h3>
              )}
              {storeData.store_description && (
                <p className="text-sm opacity-80">{storeData.store_description}</p>
              )}
              <div className="flex gap-4">
                {storeData.instagram_url && (
                  <a
                    href={storeData.instagram_url.startsWith('http') ? storeData.instagram_url : `https://${storeData.instagram_url}`}
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                    referrerPolicy="no-referrer"
                    onClick={(e) => {
                      e.preventDefault();
                      const url = storeData.instagram_url?.startsWith('http') ? storeData.instagram_url : `https://${storeData.instagram_url}`;
                      window.open(url, '_blank', 'noopener,noreferrer');
                    }}
                    className="hover:opacity-70 transition-opacity cursor-pointer"
                  >
                    <Instagram className="h-5 w-5" style={{ color: iconColor }} />
                  </a>
                )}
                {storeData.facebook_url && (
                  <a
                    href={storeData.facebook_url.startsWith('http') ? storeData.facebook_url : `https://${storeData.facebook_url}`}
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                    referrerPolicy="no-referrer"
                    onClick={(e) => {
                      e.preventDefault();
                      const url = storeData.facebook_url?.startsWith('http') ? storeData.facebook_url : `https://${storeData.facebook_url}`;
                      window.open(url, '_blank', 'noopener,noreferrer');
                    }}
                    className="hover:opacity-70 transition-opacity cursor-pointer"
                  >
                    <Facebook className="h-5 w-5" style={{ color: iconColor }} />
                  </a>
                )}
                {storeData.x_url && (
                  <a
                    href={storeData.x_url.startsWith('http') ? storeData.x_url : `https://${storeData.x_url}`}
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                    referrerPolicy="no-referrer"
                    onClick={(e) => {
                      e.preventDefault();
                      const url = storeData.x_url?.startsWith('http') ? storeData.x_url : `https://${storeData.x_url}`;
                      window.open(url, '_blank', 'noopener,noreferrer');
                    }}
                    className="hover:opacity-70 transition-opacity cursor-pointer"
                  >
                    <svg className="h-5 w-5" viewBox="0 0 24 24" fill={iconColor}>
                      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                    </svg>
                  </a>
                )}
                {storeData.youtube_url && (
                  <a
                    href={storeData.youtube_url.startsWith('http') ? storeData.youtube_url : `https://${storeData.youtube_url}`}
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                    referrerPolicy="no-referrer"
                    onClick={(e) => {
                      e.preventDefault();
                      const url = storeData.youtube_url?.startsWith('http') ? storeData.youtube_url : `https://${storeData.youtube_url}`;
                      window.open(url, '_blank', 'noopener,noreferrer');
                    }}
                    className="hover:opacity-70 transition-opacity cursor-pointer"
                  >
                    <Youtube className="h-5 w-5" style={{ color: iconColor }} />
                  </a>
                )}
              </div>
            </div>

            {/* Coluna Central */}
            <div className="space-y-4">
              <h4 className="font-semibold text-lg">Links Úteis</h4>
              <div className="space-y-2">
                <a 
                  href="#" 
                  onClick={handleHomeClick}
                  className="block text-sm hover:opacity-70 transition-opacity cursor-pointer"
                >
                  Home
                </a>
                <Link to={`/loja/${storeData.store_slug}/produtos`} className="block text-sm hover:opacity-70 transition-opacity">
                  Produtos
                </Link>
                <Link to={`/loja/${storeData.store_slug}/sobre-nos`} className="block text-sm hover:opacity-70 transition-opacity">
                  Sobre Nós
                </Link>
                <Link to={`/loja/${storeData.store_slug}/trocas-e-devolucoes`} className="block text-sm hover:opacity-70 transition-opacity">
                  Trocas e Devoluções
                </Link>
                <Link to={getAccountLink()} className="block text-sm hover:opacity-70 transition-opacity">
                  Entrar
                </Link>
              </div>
            </div>

            {/* Coluna Direita */}
            <div className="space-y-4">
              <h4 className="font-semibold text-lg">Contato</h4>
              <div className="space-y-2 text-sm">
                {storeData.email && (
                  <div className="flex items-center gap-2 hover:opacity-70 transition-opacity">
                    <Mail className="h-4 w-4" style={{ color: iconColor }} />
                    <span>{storeData.email}</span>
                  </div>
                )}
                {storeData.phone && (
                  <div className="flex items-center gap-2 hover:opacity-70 transition-opacity">
                    <Phone className="h-4 w-4" style={{ color: iconColor }} />
                    <span>{storeData.phone}</span>
                  </div>
                )}
                {storeData.whatsapp_number && (
                  <div className="flex items-center gap-2 hover:opacity-70 transition-opacity">
                    <MessageCircle className="h-4 w-4" style={{ color: iconColor }} />
                    <span>{storeData.whatsapp_number}</span>
                  </div>
                )}
                {addressData.hasAddress && (
                  <div className="flex items-start gap-2 hover:opacity-70 transition-opacity">
                    <Home className="h-4 w-4 mt-1" style={{ color: iconColor }} />
                    <div className="flex flex-col">
                      {addressData.line1 && <span>{addressData.line1}</span>}
                      {addressData.line2 && <span>{addressData.line2}</span>}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Linha separadora e Bloco de Formas de Pagamento e Segurança */}
        <div className="container mx-auto px-4">
          <div className="border-t border-gray-300">
          <div className="container mx-auto px-4 py-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
              {/* Formas de Pagamento - Alinhado à esquerda */}
              <div className="space-y-2">
                <p className="text-base font-light text-gray-500">Formas de pagamento</p>
                <div className="flex flex-wrap gap-2">
                  {/* Mastercard */}
                  <div className="w-16 h-10 border border-gray-300 rounded flex flex-col items-center justify-center bg-white">
                    <svg viewBox="0 0 60 40" className="w-8 h-6">
                      <circle cx="22" cy="20" r="12" fill="#808080"/>
                      <circle cx="38" cy="20" r="12" fill="#A0A0A0"/>
                    </svg>
                    <span className="text-[6px] text-gray-500 -mt-1">mastercard</span>
                  </div>
                  {/* Visa */}
                  <div className="w-16 h-10 border border-gray-300 rounded flex items-center justify-center bg-white">
                    <span className="text-sm font-bold text-gray-500 italic tracking-tight">VISA</span>
                  </div>
                  {/* Elo */}
                  <div className="w-16 h-10 border border-gray-300 rounded flex items-center justify-center bg-white">
                    <span className="text-sm font-bold text-gray-500 tracking-wide">elo</span>
                  </div>
                  {/* American Express - Fiel ao modelo */}
                  <div className="w-16 h-10 border border-gray-300 rounded flex items-center justify-center bg-white p-1">
                    <svg viewBox="0 0 50 30" className="w-full h-full">
                      <rect x="2" y="2" width="46" height="26" fill="#6B6B6B" rx="1"/>
                      <text x="25" y="13" textAnchor="middle" fill="white" fontSize="5" fontWeight="bold" fontFamily="Arial, sans-serif">AMERICAN</text>
                      <text x="25" y="20" textAnchor="middle" fill="white" fontSize="5" fontWeight="bold" fontFamily="Arial, sans-serif">EXPRESS</text>
                    </svg>
                  </div>
                  {/* Diners Club - Fiel ao modelo */}
                  <div className="w-16 h-10 border border-gray-300 rounded flex flex-col items-center justify-center bg-white p-1">
                    <svg viewBox="0 0 50 20" className="w-10 h-4">
                      <ellipse cx="16" cy="10" rx="9" ry="9" fill="none" stroke="#6B6B6B" strokeWidth="1.5"/>
                      <ellipse cx="13" cy="10" rx="4" ry="7" fill="#6B6B6B"/>
                      <ellipse cx="19" cy="10" rx="4" ry="7" fill="none" stroke="#6B6B6B" strokeWidth="1"/>
                    </svg>
                    <span className="text-[6px] text-gray-500 font-serif">Diners Club<sup className="text-[4px]">®</sup></span>
                  </div>
                  {/* Pix - Fiel ao modelo */}
                  <div className="w-16 h-10 border border-gray-300 rounded flex flex-col items-center justify-center bg-white p-1">
                    <div className="flex items-center gap-1">
                      <svg viewBox="0 0 24 24" className="w-4 h-4">
                        <path d="M13.6 13.47l3.22 3.22c.2.16.48.24.76.24s.56-.09.76-.26l2.93-2.93c.84-.84.84-2.21 0-3.05l-2.93-2.93c-.2-.17-.48-.26-.76-.26s-.56.09-.76.26l-3.22 3.22c-.29.29-.29.77 0 1.06 0 .12.01.24.01.36-.01.11-.01.22-.01.33zm-3.21-3.22l-3.22-3.22c-.2-.16-.48-.24-.76-.24s-.56.09-.76.26L2.71 9.97c-.84.84-.84 2.21 0 3.05l2.93 2.93c.2.17.48.26.76.26s.56-.09.76-.26l3.22-3.22c.29-.29.29-.77 0-1.06v-.36c0-.11.01-.22.01-.33zM9.93 9.93l2.93-2.93c.2-.16.48-.24.76-.24s.56.09.76.26l2.93 2.93c.29.29.29.77 0 1.06l-2.93 2.93c-.2.17-.48.26-.76.26s-.56-.09-.76-.26l-2.93-2.93c-.29-.3-.29-.78 0-1.08z" fill="#6B6B6B"/>
                      </svg>
                      <span className="text-xs font-medium text-gray-500">pix</span>
                    </div>
                    <span className="text-[5px] text-gray-400">Powered by Banco Central</span>
                  </div>
                  {/* Boleto Bancário */}
                  <div className="w-16 h-10 border border-gray-300 rounded flex items-center justify-center bg-white gap-1">
                    <svg viewBox="0 0 24 24" className="w-4 h-4">
                      <rect x="2" y="4" width="1.5" height="16" fill="#666666"/>
                      <rect x="5" y="4" width="1" height="16" fill="#666666"/>
                      <rect x="7.5" y="4" width="2" height="16" fill="#666666"/>
                      <rect x="11" y="4" width="1" height="16" fill="#666666"/>
                      <rect x="13.5" y="4" width="1.5" height="16" fill="#666666"/>
                      <rect x="16.5" y="4" width="1" height="16" fill="#666666"/>
                      <rect x="19" y="4" width="1" height="16" fill="#666666"/>
                      <rect x="21" y="4" width="1.5" height="16" fill="#666666"/>
                    </svg>
                    <div className="flex flex-col text-[6px] text-gray-500 leading-tight">
                      <span>Boleto</span>
                      <span>Bancário</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Selos de Segurança - Alinhados à direita */}
              <div className="space-y-2">
                <p className="text-sm font-medium opacity-80 md:text-right">Segurança</p>
                <div className="flex gap-3 items-center">
                  {/* SSL Badge */}
                  <div className="flex items-center gap-1 bg-gray-500 text-white px-2 py-1 rounded text-[8px] font-bold">
                    <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor">
                      <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z"/>
                    </svg>
                    <div className="flex flex-col leading-tight">
                      <span>SITE SEGURO</span>
                      <span className="text-[10px] font-bold">SSL</span>
                      <span className="text-[6px]">256 BITS</span>
                    </div>
                  </div>
                  {/* Google Safe Browsing */}
                  <div className="flex items-center gap-2">
                    <div className="flex flex-col text-[8px] text-gray-500 leading-tight text-right">
                      <span>Safe browsing</span>
                    </div>
                    <svg viewBox="0 0 24 24" className="w-6 h-6" fill="#666666">
                      <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm-2 16l-4-4 1.41-1.41L10 14.17l6.59-6.59L18 9l-8 8z"/>
                    </svg>
                    <span className="text-sm font-medium text-gray-600">Google</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        </div>
      </footer>

      {/* Subrodapé - Sem selos de segurança */}
      <div className="bg-[#f2f2f2] text-[#333] py-4">
        <div className="container mx-auto px-4 max-w-screen-xl">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4 text-sm">
            <div className="text-center md:text-left">
              <p>
                {storeData.store_name}
                {storeData.cpf_cnpj && ` - ${storeData.cpf_cnpj}`} • Todos os direitos
                reservados © {currentYear}
              </p>
            </div>
            <div className="flex items-center">
              <p className="text-xs opacity-70">
                Criado com{" "}
                <span className="font-semibold text-[#333]">VirtualMercado</span>
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default StoreFooter;
