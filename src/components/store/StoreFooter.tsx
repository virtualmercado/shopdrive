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
          <div className="container mx-auto px-4 py-4">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              {/* Formas de Pagamento - Alinhado à esquerda */}
              <div className="space-y-1.5">
                <p className="text-sm font-light text-gray-500">Formas de pagamento</p>
                <div className="flex flex-wrap gap-1.5">
                  {/* Mastercard */}
                  <div className="w-14 h-8 border border-gray-300 rounded flex flex-col items-center justify-center bg-white">
                    <svg viewBox="0 0 60 40" className="w-7 h-5">
                      <circle cx="22" cy="20" r="12" fill="#808080"/>
                      <circle cx="38" cy="20" r="12" fill="#A0A0A0"/>
                    </svg>
                    <span className="text-[5px] text-gray-500 -mt-1">mastercard</span>
                  </div>
                  {/* Visa */}
                  <div className="w-14 h-8 border border-gray-300 rounded flex items-center justify-center bg-white">
                    <span className="text-xs font-bold text-gray-500 italic tracking-tight">VISA</span>
                  </div>
                  {/* Elo */}
                  <div className="w-14 h-8 border border-gray-300 rounded flex items-center justify-center bg-white">
                    <span className="text-xs font-bold text-gray-500 tracking-wide">elo</span>
                  </div>
                  {/* American Express */}
                  <div className="w-14 h-8 border border-gray-300 rounded flex items-center justify-center bg-white p-0.5">
                    <svg viewBox="0 0 50 30" className="w-full h-full">
                      <rect x="2" y="2" width="46" height="26" fill="#6B6B6B" rx="1"/>
                      <text x="25" y="13" textAnchor="middle" fill="white" fontSize="5" fontWeight="bold" fontFamily="Arial, sans-serif">AMERICAN</text>
                      <text x="25" y="20" textAnchor="middle" fill="white" fontSize="5" fontWeight="bold" fontFamily="Arial, sans-serif">EXPRESS</text>
                    </svg>
                  </div>
                  {/* Diners Club - Fiel ao modelo da imagem */}
                  <div className="w-14 h-8 border border-gray-300 rounded flex flex-col items-center justify-center bg-white">
                    <svg viewBox="0 0 40 24" className="w-8 h-4">
                      {/* Logo oval com círculos internos */}
                      <rect x="5" y="2" width="30" height="14" rx="7" fill="#5C5C5C"/>
                      <circle cx="16" cy="9" r="5" fill="white"/>
                      <circle cx="24" cy="9" r="5" fill="none" stroke="white" strokeWidth="1"/>
                      <line x1="20" y1="4" x2="20" y2="14" stroke="white" strokeWidth="1"/>
                    </svg>
                    <span className="text-[6px] text-gray-500 font-serif italic mt-0.5">Diners Club</span>
                  </div>
                  {/* Pix - Fiel ao modelo da imagem */}
                  <div className="w-14 h-8 border border-gray-300 rounded flex items-center justify-center bg-white gap-0.5 px-1">
                    <svg viewBox="0 0 32 32" className="w-5 h-5">
                      {/* Símbolo Pix - losangos conectados */}
                      <path d="M16 6.5l-4.5 4.5 4.5 4.5 4.5-4.5L16 6.5z" fill="#5C5C5C"/>
                      <path d="M6.5 16l4.5-4.5 4.5 4.5-4.5 4.5L6.5 16z" fill="#5C5C5C"/>
                      <path d="M25.5 16l-4.5-4.5-4.5 4.5 4.5 4.5 4.5-4.5z" fill="#5C5C5C"/>
                      <path d="M16 25.5l4.5-4.5-4.5-4.5-4.5 4.5 4.5 4.5z" fill="#5C5C5C"/>
                      <path d="M11 11l5 5-5 5" stroke="#5C5C5C" strokeWidth="1" fill="none"/>
                      <path d="M21 11l-5 5 5 5" stroke="#5C5C5C" strokeWidth="1" fill="none"/>
                    </svg>
                    <span className="text-sm font-medium text-gray-400">pix</span>
                  </div>
                  {/* Boleto Bancário */}
                  <div className="w-14 h-8 border border-gray-300 rounded flex items-center justify-center bg-white gap-0.5">
                    <svg viewBox="0 0 24 24" className="w-3 h-3">
                      <rect x="2" y="4" width="1.5" height="16" fill="#666666"/>
                      <rect x="5" y="4" width="1" height="16" fill="#666666"/>
                      <rect x="7.5" y="4" width="2" height="16" fill="#666666"/>
                      <rect x="11" y="4" width="1" height="16" fill="#666666"/>
                      <rect x="13.5" y="4" width="1.5" height="16" fill="#666666"/>
                      <rect x="16.5" y="4" width="1" height="16" fill="#666666"/>
                      <rect x="19" y="4" width="1" height="16" fill="#666666"/>
                      <rect x="21" y="4" width="1.5" height="16" fill="#666666"/>
                    </svg>
                    <div className="flex flex-col text-[5px] text-gray-500 leading-tight">
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
