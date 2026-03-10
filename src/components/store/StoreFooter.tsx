import { Instagram, Facebook, Youtube, Phone, Mail, Home, MessageCircle, MapPin, CheckCircle2 } from "lucide-react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useCustomerAuth } from "@/hooks/useCustomerAuth";


import { buildGoogleMapsSearchUrl, buildAddressString } from "@/lib/maps";

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

  // Build Google Maps URL from structured address
  const fullAddressForMaps = buildAddressString({
    street: storeData.address,
    number: storeData.address_number,
    complement: storeData.address_complement,
    neighborhood: storeData.address_neighborhood,
    city: storeData.address_city,
    state: storeData.address_state,
    zipCode: storeData.address_zip_code,
    country: 'Brasil'
  });
  
  const mapsUrl = buildGoogleMapsSearchUrl(fullAddressForMaps);

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
                {addressData.hasAddress ? (
                  mapsUrl ? (
                    <a
                      href={mapsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="Abrir no Google Maps"
                      className="flex items-start gap-2 transition-all duration-150 ease-in-out hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary rounded group"
                      style={{ 
                        cursor: 'pointer',
                      }}
                    >
                      <MapPin className="h-4 w-4 mt-1 flex-shrink-0 group-hover:scale-110 transition-transform" style={{ color: iconColor }} />
                      <div className="flex flex-col group-hover:opacity-80 transition-opacity">
                        {addressData.line1 && <span>{addressData.line1}</span>}
                        {addressData.line2 && <span>{addressData.line2}</span>}
                      </div>
                    </a>
                  ) : (
                    <div className="flex items-start gap-2">
                      <MapPin className="h-4 w-4 mt-1 flex-shrink-0" style={{ color: iconColor }} />
                      <div className="flex flex-col">
                        {addressData.line1 && <span>{addressData.line1}</span>}
                        {addressData.line2 && <span>{addressData.line2}</span>}
                      </div>
                    </div>
                  )
                ) : (
                  <div className="flex items-start gap-2 opacity-60">
                    <MapPin className="h-4 w-4 mt-1 flex-shrink-0" style={{ color: iconColor }} />
                    <span>Endereço não informado</span>
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
              {/* Formas de Pagamento - SVG vetorial */}
              <div className="flex items-center gap-3 flex-wrap" role="img" aria-label="Formas de pagamento: Mastercard, Visa, Elo, American Express, Diners Club, Pix, Boleto Bancário">
                {/* Mastercard */}
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 32" className="h-8 md:h-10 w-auto">
                  <rect width="48" height="32" rx="4" fill="#fff" stroke="#e5e7eb" strokeWidth="1"/>
                  <circle cx="19" cy="16" r="9" fill="#EB001B"/>
                  <circle cx="29" cy="16" r="9" fill="#F79E1B"/>
                  <path d="M24 9.13a9 9 0 0 1 0 13.74 9 9 0 0 1 0-13.74z" fill="#FF5F00"/>
                </svg>
                {/* Visa */}
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 32" className="h-8 md:h-10 w-auto">
                  <rect width="48" height="32" rx="4" fill="#fff" stroke="#e5e7eb" strokeWidth="1"/>
                  <path d="M20.4 21h-2.7l1.7-10.5h2.7L20.4 21zm11.3-10.2c-.5-.2-1.4-.4-2.4-.4-2.6 0-4.5 1.4-4.5 3.4 0 1.5 1.3 2.3 2.4 2.8 1 .5 1.4.8 1.4 1.3 0 .7-.8 1-1.6 1-1.1 0-1.6-.2-2.5-.5l-.3-.2-.4 2.2c.6.3 1.8.5 3 .5 2.8 0 4.6-1.4 4.6-3.5 0-1.2-.7-2-2.2-2.8-.9-.5-1.5-.8-1.5-1.2 0-.4.5-.8 1.5-.8.9 0 1.5.2 2 .4l.2.1.3-2.3zm6.8 0h-2c-.6 0-1.1.2-1.4.8L31.6 21h2.8l.6-1.5h3.4l.3 1.5H41l-2.1-10.5h-2.4v.3zm-2.3 6.7l1.4-3.9.2-.6.1.3.8 4.2h-2.5zM17.5 10.5L14.9 18l-.3-1.4c-.5-1.6-2-3.4-3.7-4.3l2.4 8.7h2.8l4.2-10.5h-2.8z" fill="#1A1F71"/>
                  <path d="M12.7 10.5H8.6l0 .2c3.3.8 5.5 2.9 6.4 5.4l-.9-4.7c-.2-.6-.6-.8-1.2-.9h-.2z" fill="#F7A600"/>
                </svg>
                {/* Elo */}
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 32" className="h-8 md:h-10 w-auto">
                  <rect width="48" height="32" rx="4" fill="#fff" stroke="#e5e7eb" strokeWidth="1"/>
                  <path d="M16.5 12.5c.8-.3 1.7-.5 2.6-.5 3.6 0 6.5 2.7 6.9 6.2l3-.7c-.6-5-4.8-8.8-9.9-8.8-1.3 0-2.5.2-3.6.7l1 3.1z" fill="#FFF100"/>
                  <path d="M13.2 14.6c-1.3 1.5-2 3.4-2 5.4 0 2.1.8 4 2.1 5.5l2.3-2c-.9-1.1-1.4-2.2-1.4-3.5s.5-2.5 1.3-3.5l-2.3-1.9z" fill="#00A4E0"/>
                  <path d="M15.7 27.4c1.2.5 2.4.8 3.7.8 5 0 9.2-3.7 9.9-8.6l-3-.7c-.5 3.3-3.3 5.9-6.9 5.9-.9 0-1.8-.2-2.6-.5l-1.1 3.1z" fill="#EF4123"/>
                  <ellipse cx="35" cy="16" rx="3.5" ry="6" fill="#000"/>
                  <text x="33" y="18.5" fontSize="6" fill="#fff" fontFamily="Arial,sans-serif" fontWeight="bold">e</text>
                </svg>
                {/* American Express */}
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 32" className="h-8 md:h-10 w-auto">
                  <rect width="48" height="32" rx="4" fill="#016FD0"/>
                  <text x="24" y="14" textAnchor="middle" fontSize="5.5" fill="#fff" fontFamily="Arial,sans-serif" fontWeight="bold" letterSpacing="0.5">AMERICAN</text>
                  <text x="24" y="21" textAnchor="middle" fontSize="5.5" fill="#fff" fontFamily="Arial,sans-serif" fontWeight="bold" letterSpacing="0.5">EXPRESS</text>
                </svg>
                {/* Diners Club */}
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 32" className="h-8 md:h-10 w-auto">
                  <rect width="48" height="32" rx="4" fill="#fff" stroke="#e5e7eb" strokeWidth="1"/>
                  <circle cx="22" cy="16" r="10" fill="none" stroke="#0079BE" strokeWidth="1.5"/>
                  <path d="M18 10.4v11.2A8 8 0 0 1 14 16a8 8 0 0 1 4-5.6z" fill="#0079BE"/>
                  <path d="M26 10.4v11.2A8 8 0 0 0 30 16a8 8 0 0 0-4-5.6z" fill="#0079BE"/>
                  <text x="37" y="14" fontSize="3.2" fill="#555" fontFamily="Arial,sans-serif" fontWeight="bold">DINERS</text>
                  <text x="37" y="19" fontSize="3.2" fill="#555" fontFamily="Arial,sans-serif" fontWeight="bold">CLUB</text>
                </svg>
                {/* Pix */}
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 32" className="h-8 md:h-10 w-auto">
                  <rect width="48" height="32" rx="4" fill="#fff" stroke="#e5e7eb" strokeWidth="1"/>
                  <g transform="translate(14, 6) scale(0.04)">
                    <path d="M377.7 338.8l113-113c8.5-8.5 8.5-22.3 0-30.8l-113-113c-8.5-8.5-22.3-8.5-30.8 0l-29.5 29.5c23.3.2 46.7 9.2 64.5 27l57.5 57.5c4.7 4.7 4.7 12.3 0 17l-57.5 57.5c-17.8 17.8-41.2 26.8-64.5 27l29.5 29.5c8.6 8.5 22.3 8.5 30.8 0z" fill="#32BCAD"/>
                    <path d="M153.1 338.8l-113-113c-8.5-8.5-8.5-22.3 0-30.8l113-113c8.5-8.5 22.3-8.5 30.8 0l29.5 29.5c-23.3.2-46.7 9.2-64.5 27l-57.5 57.5c-4.7 4.7-4.7 12.3 0 17l57.5 57.5c17.8 17.8 41.2 26.8 64.5 27l-29.5 29.5c-8.5 8.5-22.3 8.5-30.8 0z" fill="#32BCAD"/>
                    <path d="M315.5 233.5l-57.5-57.5c-12.5-12.5-32.8-12.5-45.2 0l-57.5 57.5c-12.5 12.5-12.5 32.8 0 45.2l57.5 57.5c12.5 12.5 32.8 12.5 45.2 0l57.5-57.5c12.5-12.5 12.5-32.8 0-45.2z" fill="#32BCAD"/>
                  </g>
                  <text x="24" y="27" textAnchor="middle" fontSize="5" fill="#32BCAD" fontFamily="Arial,sans-serif" fontWeight="bold">PIX</text>
                </svg>
                {/* Boleto */}
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 32" className="h-8 md:h-10 w-auto">
                  <rect width="48" height="32" rx="4" fill="#fff" stroke="#e5e7eb" strokeWidth="1"/>
                  {[6,9,11,13,16,18,19,22,24,26,28,30,33,35,37,39,42].map((x, i) => (
                    <rect key={i} x={x} y="6" width={i % 3 === 0 ? 1.5 : 0.8} height="16" fill="#333" rx="0.2"/>
                  ))}
                  <text x="24" y="27" textAnchor="middle" fontSize="4" fill="#555" fontFamily="Arial,sans-serif" fontWeight="bold">BOLETO</text>
                </svg>
              </div>

              {/* Selos de Segurança - Alinhados à direita */}
              <div className="flex flex-col md:flex-row items-center md:items-center gap-4">
                <div className="flex flex-col gap-1.5 items-center md:items-start order-2 md:order-1">
                  {[
                    "Pagamento 100% seguro",
                    "Dados protegidos por criptografia SSL",
                    "Ambiente verificado contra fraudes",
                  ].map((text) => (
                    <div key={text} className="flex items-center gap-1.5">
                      <CheckCircle2 className="h-3.5 w-3.5 flex-shrink-0 text-green-600" />
                      <span className="text-xs text-gray-500">{text}</span>
                    </div>
                  ))}
                </div>
                {/* SVG Vectorial Security Seals — pixel-perfect at any resolution */}
                <div className="order-1 md:order-2 flex flex-col items-center gap-3">
                  <span className="text-[11px] md:text-xs font-semibold tracking-[0.15em] text-gray-500 uppercase">Qualidade e Segurança</span>
                  <div className="flex items-center gap-5">
                    {/* Selo 1 – Compra Segura / SSL */}
                    <div className="flex items-center gap-2.5">
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 48" className="w-8 h-10 md:w-10 md:h-12 flex-shrink-0">
                        <path d="M20 2L4 10v12c0 11.1 6.8 21.4 16 26 9.2-4.6 16-14.9 16-26V10L20 2z" fill="#22c55e" opacity="0.15" stroke="#22c55e" strokeWidth="2"/>
                        <path d="M20 2L4 10v12c0 11.1 6.8 21.4 16 26 9.2-4.6 16-14.9 16-26V10L20 2z" fill="none" stroke="#16a34a" strokeWidth="2.5" strokeLinejoin="round"/>
                        <path d="M13 24l5 5 9-10" fill="none" stroke="#16a34a" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                      <div className="flex flex-col leading-tight">
                        <span className="text-[10px] md:text-[11px] font-bold text-gray-700 tracking-wide uppercase">Compra Segura</span>
                        <span className="text-[9px] md:text-[10px] font-medium text-gray-500 tracking-wide uppercase">Site Protegido</span>
                        <span className="text-[9px] md:text-[10px] font-medium text-gray-500 tracking-wide uppercase">Certificado SSL</span>
                      </div>
                    </div>
                    {/* Divider */}
                    <div className="w-px h-10 bg-gray-300" />
                    {/* Selo 2 – Safe Browsing Google */}
                    <div className="flex items-center gap-2.5">
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 48" className="w-8 h-10 md:w-10 md:h-12 flex-shrink-0">
                        <path d="M20 2L4 10v12c0 11.1 6.8 21.4 16 26 9.2-4.6 16-14.9 16-26V10L20 2z" fill="#3b82f6" opacity="0.12" stroke="#3b82f6" strokeWidth="2"/>
                        <path d="M20 2L4 10v12c0 11.1 6.8 21.4 16 26 9.2-4.6 16-14.9 16-26V10L20 2z" fill="none" stroke="#2563eb" strokeWidth="2.5" strokeLinejoin="round"/>
                        <path d="M13 24l5 5 9-10" fill="none" stroke="#2563eb" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                      <div className="flex flex-col leading-tight">
                        <span className="text-[10px] md:text-[11px] font-bold text-gray-700 tracking-wide uppercase">Safe Browsing</span>
                        <span className="text-[13px] md:text-sm font-semibold text-gray-600">Google</span>
                      </div>
                    </div>
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
                <span className="font-semibold text-[#333]">ShopDrive</span>
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default StoreFooter;
