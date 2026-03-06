import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Copy, Check, Share2, Users, QrCode } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import QRCode from 'qrcode';
import { Skeleton } from '@/components/ui/skeleton';

const ReferralCard = () => {
  const { user } = useAuth();
  const [copied, setCopied] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState('');

  // Get user profile to check if they have a template
  const { data: profile } = useQuery({
    queryKey: ['profile-referral', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data } = await supabase
        .from('profiles')
        .select('source_template_id, store_slug')
        .eq('id', user.id)
        .maybeSingle();
      return data;
    },
    enabled: !!user?.id,
  });

  // Get template slug for the referral link
  const { data: template } = useQuery({
    queryKey: ['referral-template', profile?.source_template_id],
    queryFn: async () => {
      if (!profile?.source_template_id) return null;
      const { data } = await supabase
        .from('brand_templates')
        .select('template_slug, name')
        .eq('id', profile.source_template_id)
        .maybeSingle();
      return data;
    },
    enabled: !!profile?.source_template_id,
  });

  // Get referral stats
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['referral-stats', user?.id],
    queryFn: async () => {
      if (!user?.id) return { total_referrals: 0, active_referrals: 0 };
      const { data } = await supabase.rpc('get_referral_stats', { p_store_id: user.id });
      if (data && Array.isArray(data) && data.length > 0) return data[0];
      if (data && !Array.isArray(data)) return data;
      return { total_referrals: 0, active_referrals: 0 };
    },
    enabled: !!user?.id,
  });

  // Don't show if user doesn't come from a template
  if (!profile?.source_template_id || !template?.template_slug) return null;

  const referralLink = `${window.location.origin}/revenda/${template.template_slug}?convite=${user?.id}`;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(referralLink);
    setCopied(true);
    toast.success('Link copiado!');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleWhatsApp = () => {
    const msg = encodeURIComponent(
      `Crie sua loja grátis com os produtos da marca ${template.name}! 🚀\n\n${referralLink}`
    );
    window.open(`https://wa.me/?text=${msg}`, '_blank');
  };

  const handleQRCode = async () => {
    try {
      const dataUrl = await QRCode.toDataURL(referralLink, { width: 300, margin: 2 });
      setQrDataUrl(dataUrl);
      setQrOpen(true);
    } catch {
      toast.error('Erro ao gerar QR Code');
    }
  };

  return (
    <>
      <Card className="p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Share2 className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-base">Convide revendedoras</h3>
            <p className="text-xs text-muted-foreground">Compartilhe e cresça sua rede</p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="bg-muted/50 rounded-lg p-3 text-center">
            <Users className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
            {statsLoading ? (
              <Skeleton className="h-6 w-8 mx-auto" />
            ) : (
              <p className="text-lg font-bold">{stats?.total_referrals || 0}</p>
            )}
            <p className="text-xs text-muted-foreground">Convidadas</p>
          </div>
          <div className="bg-muted/50 rounded-lg p-3 text-center">
            <Users className="h-4 w-4 mx-auto mb-1 text-green-600" />
            {statsLoading ? (
              <Skeleton className="h-6 w-8 mx-auto" />
            ) : (
              <p className="text-lg font-bold text-green-600">{stats?.active_referrals || 0}</p>
            )}
            <p className="text-xs text-muted-foreground">Ativas</p>
          </div>
        </div>

        {/* Link */}
        <div className="flex gap-2 mb-3">
          <Input
            readOnly
            value={referralLink}
            className="text-xs bg-muted/30"
          />
          <Button variant="outline" size="icon" onClick={handleCopy} className="shrink-0">
            {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
          </Button>
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="flex-1" onClick={handleWhatsApp}>
            WhatsApp
          </Button>
          <Button variant="outline" size="sm" onClick={handleQRCode}>
            <QrCode className="h-4 w-4" />
          </Button>
        </div>
      </Card>

      {/* QR Code Dialog */}
      <Dialog open={qrOpen} onOpenChange={setQrOpen}>
        <DialogContent className="max-w-xs">
          <DialogHeader>
            <DialogTitle>QR Code do convite</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center gap-4">
            {qrDataUrl && <img src={qrDataUrl} alt="QR Code" className="w-64 h-64" />}
            <p className="text-xs text-muted-foreground text-center">
              Compartilhe este QR Code para convidar novas revendedoras da marca {template.name}
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default ReferralCard;
