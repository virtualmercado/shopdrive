import { useState, useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Copy, Check, Download, Loader2 } from 'lucide-react';
import { BrandTemplate, getTemplateActivationLink } from '@/hooks/useBrandTemplates';
import { toast } from 'sonner';

interface QRCodeModalProps {
  template: BrandTemplate | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const QRCodeModal = ({ template, open, onOpenChange }: QRCodeModalProps) => {
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const activationLink = template ? getTemplateActivationLink(template.template_slug) : '';

  useEffect(() => {
    if (open && activationLink && canvasRef.current) {
      generateQRCode();
    }
  }, [open, activationLink]);

  const generateQRCode = async () => {
    if (!activationLink || !canvasRef.current) return;

    setIsGenerating(true);
    try {
      await QRCode.toCanvas(canvasRef.current, activationLink, {
        width: 280,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#ffffff',
        },
      });

      // Also generate data URL for download
      const dataUrl = await QRCode.toDataURL(activationLink, {
        width: 400,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#ffffff',
        },
      });
      setQrCodeDataUrl(dataUrl);
    } catch (error) {
      console.error('Error generating QR code:', error);
      toast.error('Erro ao gerar QR Code');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopyLink = async () => {
    if (!activationLink) return;

    try {
      await navigator.clipboard.writeText(activationLink);
      setCopied(true);
      toast.success('Link copiado!');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Erro ao copiar link');
    }
  };

  const handleDownload = () => {
    if (!qrCodeDataUrl || !template) return;

    const link = document.createElement('a');
    link.download = `qrcode-${template.template_slug || template.name}.png`;
    link.href = qrCodeDataUrl;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('QR Code baixado!');
  };

  if (!template) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>QR Code - {template.name}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col items-center py-6 space-y-6">
          {/* QR Code Canvas */}
          <div className="bg-white p-4 rounded-lg shadow-sm border">
            {isGenerating ? (
              <div className="w-[280px] h-[280px] flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <canvas ref={canvasRef} />
            )}
          </div>

          {/* URL Display */}
          <div className="w-full space-y-2">
            <p className="text-sm text-muted-foreground text-center">Link de ativação:</p>
            <div className="flex gap-2">
              <Input
                value={activationLink}
                readOnly
                className="flex-1 text-xs bg-muted"
              />
              <Button
                variant="outline"
                size="icon"
                onClick={handleCopyLink}
              >
                {copied ? (
                  <Check className="h-4 w-4 text-green-500" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button
            variant="outline"
            className="w-full sm:w-auto"
            onClick={handleCopyLink}
          >
            <Copy className="h-4 w-4 mr-2" />
            Copiar Link
          </Button>
          <Button
            className="w-full sm:w-auto bg-primary hover:bg-primary/90"
            onClick={handleDownload}
            disabled={!qrCodeDataUrl}
          >
            <Download className="h-4 w-4 mr-2" />
            Baixar PNG
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default QRCodeModal;
