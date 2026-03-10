import { useEffect, useState } from "react";
import { Phone, MessageCircle, Mail, HelpCircle, ChevronDown } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useIsMobile } from "@/hooks/use-mobile";

interface CustomerServiceDropdownProps {
  storeOwnerId: string;
  storeName: string;
  primaryColor?: string;
  textColor?: string;
  accentColor?: string;
  onContactClick?: () => void;
}

interface ContactData {
  phone: string | null;
  whatsapp_number: string | null;
  email: string | null;
}

const CustomerServiceDropdown = ({
  storeOwnerId,
  storeName,
  primaryColor = "#6a1b9a",
  textColor = "#000000",
  accentColor,
  onContactClick,
}: CustomerServiceDropdownProps) => {
  const [contactData, setContactData] = useState<ContactData | null>(null);
  const [open, setOpen] = useState(false);
  const isMobile = useIsMobile();

  const effectiveAccent = accentColor || primaryColor;

  useEffect(() => {
    const fetchContact = async () => {
      const { data } = await supabase
        .from("profiles")
        .select("phone, whatsapp_number, email")
        .eq("id", storeOwnerId)
        .single();

      if (data) setContactData(data);
    };
    fetchContact();
  }, [storeOwnerId]);

  // If nothing to show, hide entirely
  const hasPhone = !!contactData?.phone;
  const hasWhatsApp = !!contactData?.whatsapp_number;
  const hasEmail = !!contactData?.email;
  const hasAnyContact = hasPhone || hasWhatsApp || hasEmail;

  if (!hasAnyContact) return null;

  const formatWhatsAppLink = (number: string) => {
    const clean = number.replace(/\D/g, "");
    if (isMobile) {
      return `https://wa.me/${clean}`;
    }
    return `https://web.whatsapp.com/send?phone=${clean}`;
  };

  const handleContactClick = () => {
    setOpen(false);
    if (onContactClick) {
      onContactClick();
    } else {
      // Dispatch custom event to trigger the WhatsApp contact dialog
      window.dispatchEvent(new CustomEvent("open-store-contact-dialog"));
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className="flex items-center gap-2 px-3 py-2 rounded-md hover:bg-gray-100 transition-colors cursor-pointer"
          aria-label="Central de atendimento"
        >
          <HelpCircle className="h-[26px] w-[26px]" style={{ color: textColor }} />
          <div className="hidden lg:flex flex-col items-start leading-tight">
            <span className="text-xs font-medium" style={{ color: textColor }}>Central de</span>
            <span className="text-xs font-medium" style={{ color: textColor }}>atendimento</span>
          </div>
          <ChevronDown className="h-3 w-3 hidden lg:block" style={{ color: textColor, opacity: 0.5 }} />
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-72 p-0 shadow-lg border rounded-xl"
        align="center"
        sideOffset={8}
      >
        <div className="p-4 space-y-4">
          {hasPhone && (
            <div className="space-y-1">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Fale por telefone:
              </p>
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">{contactData!.phone}</span>
              </div>
            </div>
          )}

          {hasWhatsApp && (
            <div className="space-y-1">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Fale por WhatsApp:
              </p>
              <a
                href={formatWhatsAppLink(contactData!.whatsapp_number!)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 hover:opacity-70 transition-opacity"
              >
                <MessageCircle className="h-4 w-4" style={{ color: effectiveAccent }} />
                <span className="text-sm font-medium" style={{ color: effectiveAccent }}>
                  {contactData!.whatsapp_number}
                </span>
              </a>
            </div>
          )}

          {hasEmail && (
            <div className="space-y-1">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Envie um e-mail:
              </p>
              <a
                href={`mailto:${contactData!.email}`}
                className="flex items-center gap-2 hover:opacity-70 transition-opacity"
              >
                <Mail className="h-4 w-4" style={{ color: effectiveAccent }} />
                <span className="text-sm font-medium underline" style={{ color: effectiveAccent }}>
                  {contactData!.email}
                </span>
              </a>
            </div>
          )}

          <div className="pt-2 border-t">
            <Button
              onClick={handleContactClick}
              className="w-full merchant-btn-outline-accent"
              variant="outline"
              style={{
                '--accent-color': effectiveAccent,
              } as React.CSSProperties}
            >
              FALE CONOSCO
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default CustomerServiceDropdown;
