import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Cookie, Settings, X } from "lucide-react";

interface CookiePreferences {
  necessary: boolean;
  performance: boolean;
  marketing: boolean;
}

const COOKIE_CONSENT_KEY = "vm_cookie_consent";
const COOKIE_PREFERENCES_KEY = "vm_cookie_preferences";

const CookieConsentBanner = () => {
  const [isVisible, setIsVisible] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [preferences, setPreferences] = useState<CookiePreferences>({
    necessary: true,
    performance: false,
    marketing: false,
  });

  useEffect(() => {
    // Check if user has already given consent
    const consent = localStorage.getItem(COOKIE_CONSENT_KEY);
    if (!consent) {
      // Delay banner display slightly for better UX
      const timer = setTimeout(() => setIsVisible(true), 1000);
      return () => clearTimeout(timer);
    } else {
      // Load saved preferences
      const savedPrefs = localStorage.getItem(COOKIE_PREFERENCES_KEY);
      if (savedPrefs) {
        try {
          setPreferences(JSON.parse(savedPrefs));
        } catch (e) {
          // Use default preferences on parse error
        }
      }
    }
  }, []);

  const handleAcceptAll = () => {
    const allAccepted = {
      necessary: true,
      performance: true,
      marketing: true,
    };
    setPreferences(allAccepted);
    saveConsent(allAccepted);
    setIsVisible(false);
  };

  const handleRejectNonEssential = () => {
    const essentialOnly = {
      necessary: true,
      performance: false,
      marketing: false,
    };
    setPreferences(essentialOnly);
    saveConsent(essentialOnly);
    setIsVisible(false);
    setShowSettings(false);
  };

  const handleSavePreferences = () => {
    saveConsent(preferences);
    setIsVisible(false);
    setShowSettings(false);
  };

  const saveConsent = (prefs: CookiePreferences) => {
    localStorage.setItem(COOKIE_CONSENT_KEY, "true");
    localStorage.setItem(COOKIE_PREFERENCES_KEY, JSON.stringify(prefs));
  };

  // Function to open settings modal (can be called from footer link)
  const openCookieSettings = () => {
    // Load current preferences
    const savedPrefs = localStorage.getItem(COOKIE_PREFERENCES_KEY);
    if (savedPrefs) {
      try {
        setPreferences(JSON.parse(savedPrefs));
      } catch (e) {
        // Use default preferences on parse error
      }
    }
    setShowSettings(true);
  };

  // Expose function globally for footer link
  useEffect(() => {
    (window as any).openCookieSettings = openCookieSettings;
    return () => {
      delete (window as any).openCookieSettings;
    };
  }, []);

  if (!isVisible && !showSettings) return null;

  return (
    <>
      {/* Cookie Banner */}
      {isVisible && !showSettings && (
        <div className="fixed bottom-0 left-0 right-0 z-[9999] p-4 md:p-6 bg-white border-t shadow-lg animate-in slide-in-from-bottom-4 duration-500">
          <div className="container mx-auto max-w-6xl">
            <div className="flex flex-col md:flex-row items-start md:items-center gap-4">
              {/* Icon and Text */}
              <div className="flex items-start gap-3 flex-1">
                <div className="p-2 bg-[#6a1b9a]/10 rounded-lg shrink-0">
                  <Cookie className="h-6 w-6 text-[#6a1b9a]" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground mb-1">
                    Este site utiliza cookies
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Utilizamos cookies para melhorar sua experiência, analisar o tráfego e personalizar conteúdo. 
                    Ao clicar em "Aceitar", você concorda com o uso de todos os cookies.{" "}
                    <Link 
                      to="/politica-de-cookies" 
                      className="text-[#6a1b9a] hover:underline font-medium"
                    >
                      Saiba mais
                    </Link>
                  </p>
                </div>
              </div>

              {/* Buttons */}
              <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowSettings(true)}
                  className="border-[#6a1b9a] text-[#6a1b9a] hover:bg-[#6a1b9a] hover:text-white"
                >
                  <Settings className="h-4 w-4 mr-1" />
                  Configurar
                </Button>
                <Button
                  size="sm"
                  onClick={handleAcceptAll}
                  className="bg-[#6a1b9a] hover:bg-[#6a1b9a]/90 text-white"
                >
                  Aceitar
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Cookie Settings Modal */}
      <Dialog open={showSettings} onOpenChange={setShowSettings}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Cookie className="h-5 w-5 text-[#6a1b9a]" />
              Configurações de Cookies
            </DialogTitle>
            <p className="text-sm text-muted-foreground">
              Gerencie suas preferências de cookies. Cookies necessários são sempre ativos.
            </p>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Necessary Cookies */}
            <div className="flex items-center justify-between p-4 border rounded-lg bg-muted/30">
              <div className="flex-1 pr-4">
                <Label className="text-base font-medium">Cookies Necessários</Label>
                <p className="text-sm text-muted-foreground">
                  Essenciais para o funcionamento da plataforma. Não podem ser desativados.
                </p>
              </div>
              <Switch
                checked={true}
                disabled
                className="data-[state=checked]:bg-[#6a1b9a]"
              />
            </div>

            {/* Performance Cookies */}
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="flex-1 pr-4">
                <Label className="text-base font-medium">Cookies de Desempenho</Label>
                <p className="text-sm text-muted-foreground">
                  Permitem analisar o uso da plataforma para melhorar a experiência.
                </p>
              </div>
              <Switch
                checked={preferences.performance}
                onCheckedChange={(v) => setPreferences(prev => ({ ...prev, performance: v }))}
                className="data-[state=checked]:bg-[#6a1b9a]"
              />
            </div>

            {/* Marketing Cookies */}
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="flex-1 pr-4">
                <Label className="text-base font-medium">Cookies de Marketing</Label>
                <p className="text-sm text-muted-foreground">
                  Utilizados para exibir anúncios relevantes e remarketing.
                </p>
              </div>
              <Switch
                checked={preferences.marketing}
                onCheckedChange={(v) => setPreferences(prev => ({ ...prev, marketing: v }))}
                className="data-[state=checked]:bg-[#6a1b9a]"
              />
            </div>

            {/* Link to full policy */}
            <div className="text-center pt-2">
              <Link 
                to="/politica-de-cookies" 
                onClick={() => setShowSettings(false)}
                className="text-sm text-[#6a1b9a] hover:underline"
              >
                Ver Política de Cookies completa
              </Link>
            </div>
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              onClick={handleRejectNonEssential}
              className="w-full sm:w-auto"
            >
              Rejeitar Não Essenciais
            </Button>
            <Button
              onClick={handleSavePreferences}
              className="w-full sm:w-auto bg-[#6a1b9a] hover:bg-[#6a1b9a]/90"
            >
              Salvar Preferências
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default CookieConsentBanner;
