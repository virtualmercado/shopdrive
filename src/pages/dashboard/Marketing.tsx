import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { 
  Instagram, 
  ShoppingBag, 
  Facebook, 
  BookOpen, 
  Save, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  HelpCircle,
  AlertCircle,
  ExternalLink,
  Megaphone
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { useTheme } from "@/contexts/ThemeContext";
import CouponsSection from "@/components/marketing/CouponsSection";

interface MarketingSettings {
  instagram_shopping_status: 'connected' | 'disconnected' | 'pending';
  meta_pixel_id: string;
  meta_pixel_enabled: boolean;
  tiktok_pixel_id: string;
  tiktok_pixel_enabled: boolean;
  google_ads_id: string;
  google_ads_enabled: boolean;
  gtm_id: string;
  gtm_enabled: boolean;
  domain_verification_code: string;
  domain_verified: boolean;
}

const Marketing = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { buttonBgColor, buttonTextColor } = useTheme();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  
  const [settings, setSettings] = useState<MarketingSettings>({
    instagram_shopping_status: 'disconnected',
    meta_pixel_id: '',
    meta_pixel_enabled: false,
    tiktok_pixel_id: '',
    tiktok_pixel_enabled: false,
    google_ads_id: '',
    google_ads_enabled: false,
    gtm_id: '',
    gtm_enabled: false,
    domain_verification_code: '',
    domain_verified: false
  });
  
  const [showHtmlCodeModal, setShowHtmlCodeModal] = useState(false);
  const [htmlCodeInput, setHtmlCodeInput] = useState('');

  useEffect(() => {
    const fetchSettings = async () => {
      if (!user) return;
      
      try {
        const { data, error } = await supabase
          .from('marketing_settings')
          .select('*')
          .eq('user_id', user.id)
          .maybeSingle();
        
        if (error && error.code !== 'PGRST116') throw error;
        
        if (data) {
          setSettings({
            instagram_shopping_status: data.instagram_shopping_status as 'connected' | 'disconnected' | 'pending',
            meta_pixel_id: data.meta_pixel_id || '',
            meta_pixel_enabled: data.meta_pixel_enabled || false,
            tiktok_pixel_id: data.tiktok_pixel_id || '',
            tiktok_pixel_enabled: data.tiktok_pixel_enabled || false,
            google_ads_id: data.google_ads_id || '',
            google_ads_enabled: data.google_ads_enabled || false,
            gtm_id: data.gtm_id || '',
            gtm_enabled: data.gtm_enabled || false,
            domain_verification_code: data.domain_verification_code || '',
            domain_verified: data.domain_verified || false
          });
        }
      } catch (error) {
        console.error('Error fetching marketing settings:', error);
        toast.error('Erro ao carregar configurações de marketing');
      } finally {
        setLoading(false);
      }
    };
    
    fetchSettings();
  }, [user]);

  const handleSmoothNavigation = useCallback((path: string) => {
    const pageContent = document.querySelector('[data-page-content]');
    if (pageContent) {
      pageContent.classList.add('page-exit');
      setTimeout(() => {
        navigate(path);
      }, 700);
    } else {
      navigate(path);
    }
  }, [navigate]);

  const savePixelSetting = async (field: string, value: string, enabledField: string) => {
    if (!user) return;
    
    setSaving(field);
    try {
      const updateData: Record<string, unknown> = {
        [field]: value,
        [enabledField]: value.trim() !== '',
        updated_at: new Date().toISOString()
      };
      
      const { data: existing } = await supabase
        .from('marketing_settings')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();
      
      if (existing) {
        const { error } = await supabase
          .from('marketing_settings')
          .update(updateData)
          .eq('user_id', user.id);
        
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('marketing_settings')
          .insert({
            user_id: user.id,
            ...updateData
          });
        
        if (error) throw error;
      }
      
      setSettings(prev => ({
        ...prev,
        [field]: value,
        [enabledField]: value.trim() !== ''
      }));
      
      toast.success('Configuração salva com sucesso!');
    } catch (error) {
      console.error('Error saving pixel setting:', error);
      toast.error('Erro ao salvar configuração');
    } finally {
      setSaving(null);
    }
  };

  const handleInstagramConnect = () => {
    setShowHtmlCodeModal(true);
  };

  const handleSubmitHtmlCode = async () => {
    if (!user || !htmlCodeInput.trim()) {
      toast.error('Por favor, insira o código HTML do Facebook');
      return;
    }
    
    setSaving('instagram');
    try {
      const { data: existing } = await supabase
        .from('marketing_settings')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();
      
      const updateData = {
        instagram_shopping_status: 'pending',
        domain_verification_code: htmlCodeInput.trim(),
        updated_at: new Date().toISOString()
      };
      
      if (existing) {
        const { error } = await supabase
          .from('marketing_settings')
          .update(updateData)
          .eq('user_id', user.id);
        
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('marketing_settings')
          .insert({
            user_id: user.id,
            ...updateData
          });
        
        if (error) throw error;
      }
      
      setSettings(prev => ({
        ...prev,
        instagram_shopping_status: 'pending',
        domain_verification_code: htmlCodeInput.trim()
      }));
      
      setShowHtmlCodeModal(false);
      setHtmlCodeInput('');
      toast.success('Código HTML salvo! Aguarde a verificação da Meta.');
    } catch (error) {
      console.error('Error saving HTML code:', error);
      toast.error('Erro ao salvar código HTML');
    } finally {
      setSaving(null);
    }
  };

  const getStatusBadge = (status: 'connected' | 'disconnected' | 'pending') => {
    switch (status) {
      case 'connected':
        return (
          <Badge className="bg-green-100 text-green-700 border-green-200">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Conectado / Ativo
          </Badge>
        );
      case 'pending':
        return (
          <Badge className="bg-yellow-100 text-yellow-700 border-yellow-200">
            <Clock className="h-3 w-3 mr-1" />
            Em análise
          </Badge>
        );
      default:
        return (
          <Badge className="bg-red-100 text-red-700 border-red-200">
            <XCircle className="h-3 w-3 mr-1" />
            Desconectado
          </Badge>
        );
    }
  };

  const getPixelStatusIcon = (enabled: boolean, value: string) => {
    if (!value || value.trim() === '') {
      return <XCircle className="h-5 w-5 text-red-500" />;
    }
    return enabled ? (
      <CheckCircle2 className="h-5 w-5 text-green-500" />
    ) : (
      <AlertCircle className="h-5 w-5 text-yellow-500" />
    );
  };

  // Validation functions
  const validateMetaPixelId = (id: string) => /^\d{15,16}$/.test(id);
  const validateTiktokPixelId = (id: string) => /^[A-Z0-9]{20,}$/i.test(id);
  const validateGoogleAdsId = (id: string) => /^AW-\d{9,11}$/.test(id);
  const validateGtmId = (id: string) => /^GTM-[A-Z0-9]{6,8}$/i.test(id);

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <TooltipProvider>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Megaphone className="h-6 w-6 text-purple-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Marketing</h1>
              <p className="text-sm text-[#515151]">
                Gerencie suas integrações de marketing e rastreamento
              </p>
            </div>
          </div>

          {/* Coupons Section */}
          <CouponsSection />

          {/* Instagram Shopping Section */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg">
                    <Instagram className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">Instagram Shopping</CardTitle>
                    <CardDescription className="text-[#515151]">
                      Conecte sua loja da VM ao Instagram para marcar produtos nas publicações (sacolinha).
                    </CardDescription>
                  </div>
                </div>
                {getStatusBadge(settings.instagram_shopping_status)}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-3">
                {settings.instagram_shopping_status === 'disconnected' && (
                  <Button
                    onClick={handleInstagramConnect}
                    disabled={saving === 'instagram'}
                    style={{ backgroundColor: buttonBgColor, color: buttonTextColor }}
                  >
                    <ShoppingBag className="h-4 w-4 mr-2" />
                    {saving === 'instagram' ? 'Conectando...' : 'Conectar Instagram Shopping'}
                  </Button>
                )}
                <Button
                  variant="outline"
                  onClick={() => handleSmoothNavigation('/lojista/marketing/tutorial/instagram-shopping')}
                >
                  <BookOpen className="h-4 w-4 mr-2" />
                  Ver tutorial
                </Button>
              </div>
              
              {settings.instagram_shopping_status === 'pending' && (
                <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <div className="flex items-start gap-2">
                    <Clock className="h-5 w-5 text-yellow-600 mt-0.5" />
                    <div>
                      <p className="font-medium text-yellow-800">Aguardando análise da Meta</p>
                      <p className="text-sm text-yellow-700 mt-1">
                        A Meta está analisando sua solicitação. Esse processo pode levar alguns dias.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Pixels de Conversão Section */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Facebook className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <CardTitle className="text-lg">Pixels de Conversão</CardTitle>
                  <CardDescription className="text-[#515151]">
                    Configure seus pixels de rastreamento para medir conversões e otimizar campanhas.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              
              {/* Meta Pixel */}
              <div className="p-4 border rounded-lg space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-100 rounded-lg">
                      <Facebook className="h-4 w-4 text-blue-600" />
                    </div>
                    <div>
                      <h4 className="font-medium">Pixel da Meta (Facebook + Instagram)</h4>
                      <p className="text-sm text-[#515151]">Rastreie conversões do Facebook e Instagram Ads</p>
                    </div>
                  </div>
                  {getPixelStatusIcon(settings.meta_pixel_enabled, settings.meta_pixel_id)}
                </div>
                
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="meta_pixel_id">Pixel ID</Label>
                    <Tooltip>
                      <TooltipTrigger>
                        <HelpCircle className="h-4 w-4 text-muted-foreground" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs bg-white border shadow-lg">
                        <p>Copie somente o número do Pixel (15-16 dígitos). Não copie o código completo.</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <div className="flex gap-2">
                    <Input
                      id="meta_pixel_id"
                      placeholder="Ex: 1234567890123456"
                      value={settings.meta_pixel_id}
                      onChange={(e) => setSettings(prev => ({ ...prev, meta_pixel_id: e.target.value }))}
                      className={settings.meta_pixel_id && !validateMetaPixelId(settings.meta_pixel_id) ? 'border-red-300' : ''}
                    />
                    <Button
                      onClick={() => savePixelSetting('meta_pixel_id', settings.meta_pixel_id, 'meta_pixel_enabled')}
                      disabled={saving === 'meta_pixel_id'}
                      style={{ backgroundColor: buttonBgColor, color: buttonTextColor }}
                    >
                      <Save className="h-4 w-4 mr-2" />
                      {saving === 'meta_pixel_id' ? 'Salvando...' : 'Salvar'}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => handleSmoothNavigation('/lojista/marketing/tutorial/meta-pixel')}
                    >
                      <BookOpen className="h-4 w-4 mr-2" />
                      Ver tutorial
                    </Button>
                  </div>
                  {settings.meta_pixel_id && !validateMetaPixelId(settings.meta_pixel_id) && (
                    <p className="text-sm text-red-500">O Pixel ID deve conter 15-16 dígitos numéricos</p>
                  )}
                </div>
              </div>

              <Separator />

              {/* TikTok Pixel */}
              <div className="p-4 border rounded-lg space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-black rounded-lg">
                      <svg className="h-4 w-4 text-white" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z"/>
                      </svg>
                    </div>
                    <div>
                      <h4 className="font-medium">TikTok Pixel</h4>
                      <p className="text-sm text-[#515151]">Rastreie conversões do TikTok Ads</p>
                    </div>
                  </div>
                  {getPixelStatusIcon(settings.tiktok_pixel_enabled, settings.tiktok_pixel_id)}
                </div>
                
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="tiktok_pixel_id">Pixel ID</Label>
                    <Tooltip>
                      <TooltipTrigger>
                        <HelpCircle className="h-4 w-4 text-muted-foreground" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs bg-white border shadow-lg">
                        <p>Copie somente o ID do Pixel do TikTok Ads Manager.</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <div className="flex gap-2">
                    <Input
                      id="tiktok_pixel_id"
                      placeholder="Ex: C3ABCD1234567890"
                      value={settings.tiktok_pixel_id}
                      onChange={(e) => setSettings(prev => ({ ...prev, tiktok_pixel_id: e.target.value }))}
                    />
                    <Button
                      onClick={() => savePixelSetting('tiktok_pixel_id', settings.tiktok_pixel_id, 'tiktok_pixel_enabled')}
                      disabled={saving === 'tiktok_pixel_id'}
                      style={{ backgroundColor: buttonBgColor, color: buttonTextColor }}
                    >
                      <Save className="h-4 w-4 mr-2" />
                      {saving === 'tiktok_pixel_id' ? 'Salvando...' : 'Salvar'}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => handleSmoothNavigation('/lojista/marketing/tutorial/tiktok-pixel')}
                    >
                      <BookOpen className="h-4 w-4 mr-2" />
                      Ver tutorial
                    </Button>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Google Ads */}
              <div className="p-4 border rounded-lg space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-yellow-100 rounded-lg">
                      <svg className="h-4 w-4" viewBox="0 0 24 24">
                        <path fill="#FBBC04" d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z"/>
                      </svg>
                    </div>
                    <div>
                      <h4 className="font-medium">Google Ads</h4>
                      <p className="text-sm text-[#515151]">Rastreie conversões do Google Ads</p>
                    </div>
                  </div>
                  {getPixelStatusIcon(settings.google_ads_enabled, settings.google_ads_id)}
                </div>
                
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="google_ads_id">Google Tag ID</Label>
                    <Tooltip>
                      <TooltipTrigger>
                        <HelpCircle className="h-4 w-4 text-muted-foreground" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs bg-white border shadow-lg">
                        <p>Copie somente o código no formato AW-XXXXXXXXXX</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <div className="flex gap-2">
                    <Input
                      id="google_ads_id"
                      placeholder="Ex: AW-1234567890"
                      value={settings.google_ads_id}
                      onChange={(e) => setSettings(prev => ({ ...prev, google_ads_id: e.target.value }))}
                      className={settings.google_ads_id && !validateGoogleAdsId(settings.google_ads_id) ? 'border-red-300' : ''}
                    />
                    <Button
                      onClick={() => savePixelSetting('google_ads_id', settings.google_ads_id, 'google_ads_enabled')}
                      disabled={saving === 'google_ads_id'}
                      style={{ backgroundColor: buttonBgColor, color: buttonTextColor }}
                    >
                      <Save className="h-4 w-4 mr-2" />
                      {saving === 'google_ads_id' ? 'Salvando...' : 'Salvar'}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => handleSmoothNavigation('/lojista/marketing/tutorial/google-ads')}
                    >
                      <BookOpen className="h-4 w-4 mr-2" />
                      Ver tutorial
                    </Button>
                  </div>
                  {settings.google_ads_id && !validateGoogleAdsId(settings.google_ads_id) && (
                    <p className="text-sm text-red-500">O formato deve ser AW-XXXXXXXXXX</p>
                  )}
                </div>
              </div>

              <Separator />

              {/* Google Tag Manager */}
              <div className="p-4 border rounded-lg space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-100 rounded-lg">
                      <svg className="h-4 w-4" viewBox="0 0 24 24">
                        <path fill="#4285F4" d="M12 0L1.5 6v12L12 24l10.5-6V6L12 0zm0 3.6l7.5 4.32v8.16L12 20.4l-7.5-4.32V7.92L12 3.6z"/>
                        <path fill="#4285F4" d="M12 7.2l-4.5 2.6v5.2l4.5 2.6 4.5-2.6V9.8L12 7.2z"/>
                      </svg>
                    </div>
                    <div>
                      <h4 className="font-medium">Google Tag Manager</h4>
                      <p className="text-sm text-[#515151]">Gerencie todas as suas tags em um só lugar</p>
                    </div>
                  </div>
                  {getPixelStatusIcon(settings.gtm_enabled, settings.gtm_id)}
                </div>
                
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="gtm_id">GTM ID</Label>
                    <Tooltip>
                      <TooltipTrigger>
                        <HelpCircle className="h-4 w-4 text-muted-foreground" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs bg-white border shadow-lg">
                        <p>Copie o código no formato GTM-XXXXXXX</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <div className="flex gap-2">
                    <Input
                      id="gtm_id"
                      placeholder="Ex: GTM-ABC1234"
                      value={settings.gtm_id}
                      onChange={(e) => setSettings(prev => ({ ...prev, gtm_id: e.target.value }))}
                      className={settings.gtm_id && !validateGtmId(settings.gtm_id) ? 'border-red-300' : ''}
                    />
                    <Button
                      onClick={() => savePixelSetting('gtm_id', settings.gtm_id, 'gtm_enabled')}
                      disabled={saving === 'gtm_id'}
                      style={{ backgroundColor: buttonBgColor, color: buttonTextColor }}
                    >
                      <Save className="h-4 w-4 mr-2" />
                      {saving === 'gtm_id' ? 'Salvando...' : 'Salvar'}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => handleSmoothNavigation('/lojista/marketing/tutorial/gtm')}
                    >
                      <BookOpen className="h-4 w-4 mr-2" />
                      Ver tutorial
                    </Button>
                  </div>
                  {settings.gtm_id && !validateGtmId(settings.gtm_id) && (
                    <p className="text-sm text-red-500">O formato deve ser GTM-XXXXXXX</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Tutorial Info */}
          <Card className="bg-blue-50 border-blue-200">
            <CardContent className="py-4">
              <div className="flex items-start gap-3">
                <HelpCircle className="h-5 w-5 text-blue-600 mt-0.5" />
                <div>
                  <p className="font-medium text-blue-800">Precisa de ajuda?</p>
                  <p className="text-sm text-blue-700 mt-1">
                    Clique em "Ver tutorial" em qualquer integração para acessar o passo a passo completo.
                    Os tutoriais são atualizados regularmente conforme as mudanças das plataformas.
                  </p>
                  <p className="text-xs text-blue-600 mt-2">
                    Versão do sistema: 2026.01 – Última revisão oficial das plataformas
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Modal de Código HTML do Facebook */}
          <Dialog open={showHtmlCodeModal} onOpenChange={setShowHtmlCodeModal}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Adicionar código HTML</DialogTitle>
                <DialogDescription>
                  Cole abaixo o código HTML do Facebook para fazer a verificação do domínio
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <Textarea
                  placeholder="Insira o código HTML aqui"
                  value={htmlCodeInput}
                  onChange={(e) => setHtmlCodeInput(e.target.value)}
                  className="min-h-[100px] font-mono text-sm"
                />
                <div className="text-xs text-muted-foreground">
                  <p>📌 Você encontra esse código no Gerenciador de Negócios da Meta, em Configurações → Segurança da marca → Domínios.</p>
                </div>
              </div>
              <DialogFooter>
                <Button
                  onClick={handleSubmitHtmlCode}
                  disabled={saving === 'instagram' || !htmlCodeInput.trim()}
                  className="w-full"
                  style={{ backgroundColor: buttonBgColor, color: buttonTextColor }}
                >
                  {saving === 'instagram' ? 'Salvando...' : 'Continuar'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </TooltipProvider>
    </DashboardLayout>
  );
};

export default Marketing;
