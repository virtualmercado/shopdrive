import { Instagram, Facebook, Youtube } from "lucide-react";
import { Link } from "react-router-dom";

interface StoreFooterProps {
  storeData: {
    store_name: string;
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
    footer_bg_color: string;
    footer_text_color: string;
    cpf_cnpj?: string;
  };
}

const StoreFooter = ({ storeData }: StoreFooterProps) => {
  const currentYear = new Date().getFullYear();

  // Formatar endereço completo
  const formatFullAddress = () => {
    const parts = [];
    if (storeData.address) parts.push(storeData.address);
    if (storeData.address_number) parts.push(storeData.address_number);
    if (storeData.address_complement) parts.push(storeData.address_complement);
    
    const street = parts.join(", ");
    const city = [
      storeData.address_neighborhood,
      storeData.address_city,
      storeData.address_state
    ].filter(Boolean).join(" - ");
    
    return [street, city].filter(Boolean).join(" | ");
  };

  const fullAddress = formatFullAddress();

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
                  className="h-12 object-contain brightness-0 invert"
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
                    href={storeData.instagram_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:opacity-70 transition-opacity"
                  >
                    <Instagram className="h-5 w-5" />
                  </a>
                )}
                {storeData.facebook_url && (
                  <a
                    href={storeData.facebook_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:opacity-70 transition-opacity"
                  >
                    <Facebook className="h-5 w-5" />
                  </a>
                )}
                {storeData.x_url && (
                  <a
                    href={storeData.x_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:opacity-70 transition-opacity"
                  >
                    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                    </svg>
                  </a>
                )}
                {storeData.youtube_url && (
                  <a
                    href={storeData.youtube_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:opacity-70 transition-opacity"
                  >
                    <Youtube className="h-5 w-5" />
                  </a>
                )}
              </div>
            </div>

            {/* Coluna Central */}
            <div className="space-y-4">
              <h4 className="font-semibold text-lg">Links Úteis</h4>
              <div className="space-y-2">
                <Link to="#" className="block text-sm hover:opacity-70 transition-opacity">
                  Home
                </Link>
                <Link to="#" className="block text-sm hover:opacity-70 transition-opacity">
                  Produtos
                </Link>
                <Link to="#" className="block text-sm hover:opacity-70 transition-opacity">
                  Sobre
                </Link>
                <Link to="#" className="block text-sm hover:opacity-70 transition-opacity">
                  Trocas e Devoluções
                </Link>
                <Link to="#" className="block text-sm hover:opacity-70 transition-opacity">
                  Entrar
                </Link>
              </div>
            </div>

            {/* Coluna Direita */}
            <div className="space-y-4">
              <h4 className="font-semibold text-lg">Contato</h4>
              <div className="space-y-2 text-sm">
                {storeData.email && (
                  <p className="hover:opacity-70 transition-opacity">
                    📧 {storeData.email}
                  </p>
                )}
                {storeData.phone && (
                  <p className="hover:opacity-70 transition-opacity">
                    📞 {storeData.phone}
                  </p>
                )}
                {storeData.whatsapp_number && (
                  <p className="hover:opacity-70 transition-opacity">
                    💬 {storeData.whatsapp_number}
                  </p>
                )}
                {fullAddress && (
                  <p className="hover:opacity-70 transition-opacity">
                    📍 {fullAddress}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </footer>

      {/* Seção Final */}
      <div className="bg-black text-white py-4">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4 text-sm">
            <div className="text-center md:text-left">
              <p>
                {storeData.store_name}
                {storeData.cpf_cnpj && ` - ${storeData.cpf_cnpj}`} • Todos os direitos
                reservados © {currentYear}
              </p>
            </div>
            <div className="flex flex-col items-center gap-2">
              <div className="flex gap-4">
                <img
                  src="https://upload.wikimedia.org/wikipedia/commons/5/5a/Ssl_logo.png"
                  alt="SSL"
                  className="h-8"
                />
                <img
                  src="https://upload.wikimedia.org/wikipedia/commons/thumb/9/9a/Google_Safe_Browsing.svg/512px-Google_Safe_Browsing.svg.png"
                  alt="Google Safe Browsing"
                  className="h-8"
                />
              </div>
              <p className="text-xs opacity-70">
                Criado com{" "}
                <span className="font-semibold text-[#FB8C00]">VirtualMercado</span>
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default StoreFooter;
