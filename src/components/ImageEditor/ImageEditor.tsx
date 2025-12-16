import { useState, useEffect, useRef, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { useTheme } from "@/contexts/ThemeContext";
import { 
  RotateCcw, 
  RotateCw, 
  Undo2, 
  Save, 
  Loader2,
  Sun,
  Contrast,
  Sparkles,
  Cloud,
  CircleDot,
  Square,
  Info,
  RefreshCw,
  Check
} from "lucide-react";
import { removeBackground, loadImageFromUrl, loadImageFromDataUrl } from "./backgroundRemoval";

interface ImageEditorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  imageUrl: string;
  onSave: (editedImageUrl: string) => void;
}

interface ImageAdjustments {
  exposure: number;
  contrast: number;
  highlights: number;
  shadows: number;
  whites: number;
  blacks: number;
}

type BackgroundType = 'original' | 'white' | 'black' | 'transparent' | 
  'neutral-light' | 'pastel-pink' | 'pastel-blue' | 'pastel-green' | 'auto-contrast' |
  'wood' | 'marble' | 'neutral-surface' | 'light-texture';

type ShadowType = 'none' | 'base' | 'around';

const defaultAdjustments: ImageAdjustments = {
  exposure: 0,
  contrast: 0,
  highlights: 0,
  shadows: 0,
  whites: 0,
  blacks: 0,
};

const backgroundPresets: Record<BackgroundType, { label: string; color?: string; pattern?: string }> = {
  original: { label: 'Original' },
  white: { label: 'Branco', color: '#FFFFFF' },
  black: { label: 'Preto', color: '#000000' },
  transparent: { label: 'Transparente' },
  'neutral-light': { label: 'Neutro Claro', color: '#F5F5F5' },
  'pastel-pink': { label: 'Rosa Pastel', color: '#FFE4E6' },
  'pastel-blue': { label: 'Azul Pastel', color: '#E0F2FE' },
  'pastel-green': { label: 'Verde Pastel', color: '#DCFCE7' },
  'auto-contrast': { label: 'Auto Contraste' },
  'wood': { label: 'Madeira', pattern: 'wood' },
  'marble': { label: 'Mármore', pattern: 'marble' },
  'neutral-surface': { label: 'Superfície Neutra', pattern: 'neutral' },
  'light-texture': { label: 'Textura Leve', pattern: 'light' },
};

export const ImageEditor = ({ open, onOpenChange, imageUrl, onSave }: ImageEditorProps) => {
  const [originalImage, setOriginalImage] = useState<HTMLImageElement | null>(null);
  const [processedImage, setProcessedImage] = useState<ImageData | null>(null);
  const [backgroundRemovedImage, setBackgroundRemovedImage] = useState<ImageData | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingProgress, setProcessingProgress] = useState(0);
  const [processingStep, setProcessingStep] = useState('');
  const [adjustments, setAdjustments] = useState<ImageAdjustments>(defaultAdjustments);
  const [rotation, setRotation] = useState(0);
  const [selectedBackground, setSelectedBackground] = useState<BackgroundType>('original');
  const [shadowType, setShadowType] = useState<ShadowType>('none');
  const [isBackgroundRemoved, setIsBackgroundRemoved] = useState(false);
  const [showComparison, setShowComparison] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  const { toast } = useToast();
  const { buttonBgColor, buttonTextColor, buttonBorderStyle } = useTheme();
  
  const buttonRadius = buttonBorderStyle === 'rounded' ? 'rounded-full' : 'rounded-md';

  // Load original image when dialog opens
  useEffect(() => {
    if (open && imageUrl) {
      loadImage();
    }
  }, [open, imageUrl]);

  const loadImage = async () => {
    try {
      setIsProcessing(true);
      setProcessingStep('Carregando imagem...');
      setProcessingProgress(20);

      let img: HTMLImageElement;
      if (imageUrl.startsWith('data:')) {
        img = await loadImageFromDataUrl(imageUrl);
      } else {
        img = await loadImageFromUrl(imageUrl);
      }

      setOriginalImage(img);
      setProcessingProgress(100);
      setIsProcessing(false);
      setProcessingStep('');
      
      // Draw initial image
      drawImage(img);
    } catch (error) {
      console.error('Error loading image:', error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar a imagem",
        variant: "destructive",
      });
      setIsProcessing(false);
    }
  };

  const drawImage = useCallback((img: HTMLImageElement, imgData?: ImageData) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size to image size
    canvas.width = img.width;
    canvas.height = img.height;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Apply rotation
    ctx.save();
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.translate(-canvas.width / 2, -canvas.height / 2);

    if (imgData) {
      ctx.putImageData(imgData, 0, 0);
    } else {
      ctx.drawImage(img, 0, 0);
    }

    ctx.restore();
  }, [rotation]);

  // Handle background removal
  const handleRemoveBackground = async () => {
    if (!originalImage) return;

    setIsProcessing(true);
    setProcessingStep('Preparando imagem...');
    setProcessingProgress(10);

    try {
      // Create canvas with original image
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = originalImage.width;
      tempCanvas.height = originalImage.height;
      const tempCtx = tempCanvas.getContext('2d');
      if (!tempCtx) throw new Error('Could not get canvas context');
      
      tempCtx.drawImage(originalImage, 0, 0);

      setProcessingStep('Removendo fundo...');
      setProcessingProgress(30);

      // Use @huggingface/transformers for background removal
      const resultBlob = await removeBackground(originalImage, (progress) => {
        setProcessingProgress(30 + progress * 60);
      });

      setProcessingStep('Processando resultado...');
      setProcessingProgress(90);

      // Convert blob to ImageData
      const resultImg = new Image();
      resultImg.src = URL.createObjectURL(resultBlob);
      
      await new Promise<void>((resolve) => {
        resultImg.onload = () => {
          const resultCanvas = document.createElement('canvas');
          resultCanvas.width = resultImg.width;
          resultCanvas.height = resultImg.height;
          const resultCtx = resultCanvas.getContext('2d');
          if (resultCtx) {
            resultCtx.drawImage(resultImg, 0, 0);
            const imageData = resultCtx.getImageData(0, 0, resultCanvas.width, resultCanvas.height);
            setBackgroundRemovedImage(imageData);
            setProcessedImage(imageData);
            setIsBackgroundRemoved(true);
            setShowComparison(true);
            setHasChanges(true);
          }
          URL.revokeObjectURL(resultImg.src);
          resolve();
        };
      });

      setProcessingProgress(100);
      
      toast({
        title: "Sucesso",
        description: "Fundo removido com sucesso!",
      });
    } catch (error) {
      console.error('Error removing background:', error);
      toast({
        title: "Erro na remoção de fundo",
        description: "Tente novamente com uma imagem diferente",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
      setProcessingStep('');
    }
  };

  // Apply background to removed image
  const applyBackground = useCallback(() => {
    if (!backgroundRemovedImage || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = backgroundRemovedImage.width;
    canvas.height = backgroundRemovedImage.height;

    // Draw background first
    if (selectedBackground !== 'transparent' && selectedBackground !== 'original') {
      const preset = backgroundPresets[selectedBackground];
      
      if (preset.pattern) {
        // Draw texture pattern
        drawTextureBackground(ctx, canvas.width, canvas.height, preset.pattern);
      } else if (preset.color) {
        ctx.fillStyle = preset.color;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      } else if (selectedBackground === 'auto-contrast') {
        // Calculate auto contrast color based on image
        const avgColor = calculateAverageColor(backgroundRemovedImage);
        const contrastColor = getContrastingColor(avgColor);
        ctx.fillStyle = contrastColor;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
    } else if (selectedBackground === 'transparent') {
      // Draw checkerboard for transparency
      drawCheckerboard(ctx, canvas.width, canvas.height);
    }

    // Apply shadow if needed
    if (shadowType !== 'none' && isBackgroundRemoved) {
      applyShadow(ctx, backgroundRemovedImage, shadowType);
    }

    // Draw the image
    ctx.putImageData(backgroundRemovedImage, 0, 0);

    // Apply adjustments
    applyAdjustments(ctx, canvas.width, canvas.height);
  }, [backgroundRemovedImage, selectedBackground, shadowType, adjustments, isBackgroundRemoved]);

  useEffect(() => {
    if (isBackgroundRemoved && backgroundRemovedImage) {
      applyBackground();
    }
  }, [applyBackground, isBackgroundRemoved, backgroundRemovedImage]);

  const drawTextureBackground = (ctx: CanvasRenderingContext2D, width: number, height: number, pattern: string) => {
    // Create texture patterns
    switch (pattern) {
      case 'wood':
        const woodGradient = ctx.createLinearGradient(0, 0, width, height);
        woodGradient.addColorStop(0, '#D4A574');
        woodGradient.addColorStop(0.3, '#C9956C');
        woodGradient.addColorStop(0.6, '#D4A574');
        woodGradient.addColorStop(1, '#B8845C');
        ctx.fillStyle = woodGradient;
        ctx.fillRect(0, 0, width, height);
        break;
      case 'marble':
        ctx.fillStyle = '#F5F5F5';
        ctx.fillRect(0, 0, width, height);
        // Add marble veins
        ctx.strokeStyle = 'rgba(180, 180, 180, 0.3)';
        ctx.lineWidth = 2;
        for (let i = 0; i < 5; i++) {
          ctx.beginPath();
          ctx.moveTo(Math.random() * width, 0);
          ctx.bezierCurveTo(
            Math.random() * width, height * 0.3,
            Math.random() * width, height * 0.6,
            Math.random() * width, height
          );
          ctx.stroke();
        }
        break;
      case 'neutral':
        ctx.fillStyle = '#E5E5E5';
        ctx.fillRect(0, 0, width, height);
        break;
      case 'light':
        ctx.fillStyle = '#FAFAFA';
        ctx.fillRect(0, 0, width, height);
        // Add subtle noise
        const imageData = ctx.getImageData(0, 0, width, height);
        for (let i = 0; i < imageData.data.length; i += 4) {
          const noise = (Math.random() - 0.5) * 10;
          imageData.data[i] += noise;
          imageData.data[i + 1] += noise;
          imageData.data[i + 2] += noise;
        }
        ctx.putImageData(imageData, 0, 0);
        break;
    }
  };

  const drawCheckerboard = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
    const size = 10;
    for (let x = 0; x < width; x += size) {
      for (let y = 0; y < height; y += size) {
        ctx.fillStyle = ((x / size + y / size) % 2 === 0) ? '#FFFFFF' : '#CCCCCC';
        ctx.fillRect(x, y, size, size);
      }
    }
  };

  const applyShadow = (ctx: CanvasRenderingContext2D, imageData: ImageData, type: ShadowType) => {
    ctx.save();
    
    if (type === 'base') {
      // Base shadow
      ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
      ctx.shadowBlur = 20;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 10;
    } else if (type === 'around') {
      // Around shadow
      ctx.shadowColor = 'rgba(0, 0, 0, 0.2)';
      ctx.shadowBlur = 30;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 0;
    }
    
    // Draw shadow layer
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = imageData.width;
    tempCanvas.height = imageData.height;
    const tempCtx = tempCanvas.getContext('2d');
    if (tempCtx) {
      tempCtx.putImageData(imageData, 0, 0);
      ctx.drawImage(tempCanvas, 0, 0);
    }
    
    ctx.restore();
  };

  const calculateAverageColor = (imageData: ImageData): { r: number; g: number; b: number } => {
    let r = 0, g = 0, b = 0, count = 0;
    
    for (let i = 0; i < imageData.data.length; i += 4) {
      if (imageData.data[i + 3] > 128) { // Only count non-transparent pixels
        r += imageData.data[i];
        g += imageData.data[i + 1];
        b += imageData.data[i + 2];
        count++;
      }
    }
    
    return {
      r: Math.round(r / count),
      g: Math.round(g / count),
      b: Math.round(b / count),
    };
  };

  const getContrastingColor = (color: { r: number; g: number; b: number }): string => {
    const luminance = (0.299 * color.r + 0.587 * color.g + 0.114 * color.b) / 255;
    return luminance > 0.5 ? '#2D2D2D' : '#F5F5F5';
  };

  const applyAdjustments = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
    if (Object.values(adjustments).every(v => v === 0)) return;

    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;

    for (let i = 0; i < data.length; i += 4) {
      let r = data[i];
      let g = data[i + 1];
      let b = data[i + 2];

      // Exposure
      const exposureFactor = Math.pow(2, adjustments.exposure / 100);
      r *= exposureFactor;
      g *= exposureFactor;
      b *= exposureFactor;

      // Contrast
      const contrastFactor = (100 + adjustments.contrast) / 100;
      r = ((r / 255 - 0.5) * contrastFactor + 0.5) * 255;
      g = ((g / 255 - 0.5) * contrastFactor + 0.5) * 255;
      b = ((b / 255 - 0.5) * contrastFactor + 0.5) * 255;

      // Highlights (affect bright areas)
      const luminance = (r + g + b) / 3;
      if (luminance > 128) {
        const highlightEffect = ((luminance - 128) / 127) * (adjustments.highlights / 100);
        r += highlightEffect * 50;
        g += highlightEffect * 50;
        b += highlightEffect * 50;
      }

      // Shadows (affect dark areas)
      if (luminance < 128) {
        const shadowEffect = ((128 - luminance) / 128) * (adjustments.shadows / 100);
        r += shadowEffect * 50;
        g += shadowEffect * 50;
        b += shadowEffect * 50;
      }

      // Whites
      if (luminance > 200) {
        const whiteEffect = adjustments.whites / 100;
        r += whiteEffect * 30;
        g += whiteEffect * 30;
        b += whiteEffect * 30;
      }

      // Blacks
      if (luminance < 55) {
        const blackEffect = adjustments.blacks / 100;
        r -= blackEffect * 30;
        g -= blackEffect * 30;
        b -= blackEffect * 30;
      }

      // Clamp values
      data[i] = Math.max(0, Math.min(255, r));
      data[i + 1] = Math.max(0, Math.min(255, g));
      data[i + 2] = Math.max(0, Math.min(255, b));
    }

    ctx.putImageData(imageData, 0, 0);
  };

  // Rotation handlers
  const handleRotateLeft = () => {
    setRotation((prev) => (prev - 90) % 360);
    setHasChanges(true);
  };

  const handleRotateRight = () => {
    setRotation((prev) => (prev + 90) % 360);
    setHasChanges(true);
  };

  const handleResetRotation = () => {
    setRotation(0);
  };

  // Adjustment handlers
  const handleAdjustmentChange = (key: keyof ImageAdjustments, value: number) => {
    setAdjustments((prev) => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };

  // Undo all changes
  const handleUndo = () => {
    setAdjustments(defaultAdjustments);
    setRotation(0);
    setSelectedBackground('original');
    setShadowType('none');
    setIsBackgroundRemoved(false);
    setBackgroundRemovedImage(null);
    setProcessedImage(null);
    setShowComparison(false);
    setHasChanges(false);
    
    if (originalImage) {
      drawImage(originalImage);
    }
  };

  // Save edited image
  const handleSave = async () => {
    if (!canvasRef.current) return;

    setIsProcessing(true);
    setProcessingStep('Salvando imagem...');
    setProcessingProgress(50);

    try {
      const canvas = canvasRef.current;
      
      // If we have a background removed image, render it with all effects
      if (isBackgroundRemoved && backgroundRemovedImage) {
        applyBackground();
      } else if (originalImage) {
        drawImage(originalImage);
      }

      // Export as PNG to preserve transparency
      const dataUrl = canvas.toDataURL('image/png', 1.0);
      
      setProcessingProgress(100);
      
      onSave(dataUrl);
      onOpenChange(false);
      
      toast({
        title: "Sucesso",
        description: "Imagem salva com sucesso!",
      });
    } catch (error) {
      console.error('Error saving image:', error);
      toast({
        title: "Erro",
        description: "Não foi possível salvar a imagem",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
      setProcessingStep('');
    }
  };

  // Update canvas when rotation changes
  useEffect(() => {
    if (originalImage && !isBackgroundRemoved) {
      drawImage(originalImage);
    }
  }, [rotation, originalImage, isBackgroundRemoved, drawImage]);

  // Apply adjustments in real-time
  useEffect(() => {
    if (!canvasRef.current || !originalImage) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (isBackgroundRemoved && backgroundRemovedImage) {
      applyBackground();
    } else {
      drawImage(originalImage);
      applyAdjustments(ctx, canvas.width, canvas.height);
    }
  }, [adjustments, originalImage, isBackgroundRemoved, backgroundRemovedImage, applyBackground, drawImage]);

  const getHoverColor = (color: string) => {
    const hex = color.replace('#', '');
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);
    const factor = 0.85;
    return `rgb(${Math.floor(r * factor)}, ${Math.floor(g * factor)}, ${Math.floor(b * factor)})`;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[95vh] overflow-hidden p-0">
        <div className="flex flex-col h-full max-h-[95vh]">
          <DialogHeader className="px-4 py-3 border-b flex-shrink-0">
            <DialogTitle className="flex items-center gap-2">
              Editor de Imagem
              {hasChanges && <span className="text-xs text-muted-foreground">(alterações não salvas)</span>}
            </DialogTitle>
          </DialogHeader>

          {/* Processing Overlay */}
          {isProcessing && (
            <div className="absolute inset-0 bg-background/80 backdrop-blur-sm z-50 flex flex-col items-center justify-center gap-4">
              <Loader2 className="h-8 w-8 animate-spin" style={{ color: buttonBgColor }} />
              <p className="text-sm font-medium">{processingStep}</p>
              <div className="w-64">
                <Progress value={processingProgress} className="h-2" />
              </div>
            </div>
          )}

          <div className="flex flex-1 overflow-hidden">
            {/* Main Canvas Area */}
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Info Banner */}
              <div className="px-4 py-2 bg-muted/50 border-b flex items-center gap-2 text-xs text-muted-foreground flex-shrink-0">
                <Info className="h-4 w-4 flex-shrink-0" />
                <span>Para melhores resultados na remoção de fundo, utilize fotos com fundo contrastante e sem outros objetos além do produto.</span>
              </div>

              {/* Canvas Container */}
              <div className="flex-1 flex items-center justify-center p-4 bg-muted/30 overflow-auto">
                {showComparison && originalImage ? (
                  <div className="flex gap-4 items-center">
                    <div className="text-center">
                      <p className="text-xs text-muted-foreground mb-2">ANTES</p>
                      <img 
                        src={imageUrl} 
                        alt="Original" 
                        className="max-w-[200px] max-h-[300px] object-contain border rounded"
                      />
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-muted-foreground mb-2">DEPOIS</p>
                      <canvas
                        ref={canvasRef}
                        className="max-w-[200px] max-h-[300px] object-contain border rounded"
                        style={{ 
                          transform: `rotate(${rotation}deg)`,
                          maxWidth: '200px',
                          maxHeight: '300px'
                        }}
                      />
                    </div>
                  </div>
                ) : (
                  <canvas
                    ref={canvasRef}
                    className="max-w-full max-h-full object-contain border rounded shadow-sm"
                    style={{ 
                      transform: `rotate(${rotation}deg)`,
                      maxHeight: '400px'
                    }}
                  />
                )}
              </div>

              {/* Bottom Actions */}
              <div className="px-4 py-3 border-t flex flex-wrap gap-2 justify-center flex-shrink-0">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRotateLeft}
                  className={buttonRadius}
                  style={{ borderColor: buttonBgColor, color: buttonBgColor }}
                >
                  <RotateCcw className="h-4 w-4 mr-1" />
                  Esquerda
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRotateRight}
                  className={buttonRadius}
                  style={{ borderColor: buttonBgColor, color: buttonBgColor }}
                >
                  <RotateCw className="h-4 w-4 mr-1" />
                  Direita
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleResetRotation}
                  className={buttonRadius}
                  style={{ borderColor: buttonBgColor, color: buttonBgColor }}
                >
                  <RefreshCw className="h-4 w-4 mr-1" />
                  Resetar
                </Button>
              </div>
            </div>

            {/* Side Panel */}
            <div className="w-72 border-l flex flex-col overflow-hidden bg-background flex-shrink-0">
              <div className="flex-1 overflow-y-auto p-4">
                <Tabs defaultValue="background" className="w-full">
                  <TabsList className="w-full grid grid-cols-3 mb-4">
                    <TabsTrigger value="background" className="text-xs">Fundo</TabsTrigger>
                    <TabsTrigger value="adjustments" className="text-xs">Ajustes</TabsTrigger>
                    <TabsTrigger value="shadows" className="text-xs">Sombras</TabsTrigger>
                  </TabsList>

                  {/* Background Tab */}
                  <TabsContent value="background" className="space-y-4">
                    <Button
                      onClick={handleRemoveBackground}
                      disabled={isProcessing || isBackgroundRemoved}
                      className={`w-full ${buttonRadius}`}
                      style={{ 
                        backgroundColor: isBackgroundRemoved ? '#22c55e' : buttonBgColor, 
                        color: buttonTextColor 
                      }}
                    >
                      {isBackgroundRemoved ? (
                        <>
                          <Check className="h-4 w-4 mr-2" />
                          Fundo Removido
                        </>
                      ) : (
                        'Remover Fundo'
                      )}
                    </Button>

                    {isBackgroundRemoved && (
                      <>
                        <div className="space-y-2">
                          <p className="text-xs font-medium text-muted-foreground">Clássicos</p>
                          <div className="grid grid-cols-4 gap-2">
                            {(['original', 'white', 'black', 'transparent'] as BackgroundType[]).map((bg) => (
                              <button
                                key={bg}
                                onClick={() => { setSelectedBackground(bg); setHasChanges(true); }}
                                className={`w-full aspect-square rounded border-2 transition-all ${
                                  selectedBackground === bg ? 'ring-2 ring-offset-2' : ''
                                }`}
                                style={{
                                  borderColor: selectedBackground === bg ? buttonBgColor : 'transparent',
                                  backgroundColor: bg === 'white' ? '#FFFFFF' : 
                                                   bg === 'black' ? '#000000' :
                                                   bg === 'transparent' ? 'transparent' : '#F5F5F5',
                                  backgroundImage: bg === 'transparent' ? 
                                    'linear-gradient(45deg, #ccc 25%, transparent 25%), linear-gradient(-45deg, #ccc 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #ccc 75%), linear-gradient(-45deg, transparent 75%, #ccc 75%)' : 
                                    undefined,
                                  backgroundSize: bg === 'transparent' ? '8px 8px' : undefined,
                                  backgroundPosition: bg === 'transparent' ? '0 0, 0 4px, 4px -4px, -4px 0px' : undefined,
                                  ['--tw-ring-color' as any]: buttonBgColor
                                }}
                                title={backgroundPresets[bg].label}
                              />
                            ))}
                          </div>
                        </div>

                        <div className="space-y-2">
                          <p className="text-xs font-medium text-muted-foreground">Estúdio</p>
                          <div className="grid grid-cols-4 gap-2">
                            {(['neutral-light', 'pastel-pink', 'pastel-blue', 'pastel-green', 'auto-contrast'] as BackgroundType[]).map((bg) => (
                              <button
                                key={bg}
                                onClick={() => { setSelectedBackground(bg); setHasChanges(true); }}
                                className={`w-full aspect-square rounded border-2 transition-all ${
                                  selectedBackground === bg ? 'ring-2 ring-offset-2' : ''
                                }`}
                                style={{
                                  borderColor: selectedBackground === bg ? buttonBgColor : 'transparent',
                                  backgroundColor: backgroundPresets[bg].color || '#F5F5F5',
                                  ['--tw-ring-color' as any]: buttonBgColor
                                }}
                                title={backgroundPresets[bg].label}
                              />
                            ))}
                          </div>
                        </div>

                        <div className="space-y-2">
                          <p className="text-xs font-medium text-muted-foreground">Texturas</p>
                          <div className="grid grid-cols-4 gap-2">
                            {(['wood', 'marble', 'neutral-surface', 'light-texture'] as BackgroundType[]).map((bg) => (
                              <button
                                key={bg}
                                onClick={() => { setSelectedBackground(bg); setHasChanges(true); }}
                                className={`w-full aspect-square rounded border-2 transition-all ${
                                  selectedBackground === bg ? 'ring-2 ring-offset-2' : ''
                                }`}
                                style={{
                                  borderColor: selectedBackground === bg ? buttonBgColor : 'transparent',
                                  backgroundColor: bg === 'wood' ? '#D4A574' : 
                                                   bg === 'marble' ? '#F5F5F5' :
                                                   bg === 'neutral-surface' ? '#E5E5E5' : '#FAFAFA',
                                  ['--tw-ring-color' as any]: buttonBgColor
                                }}
                                title={backgroundPresets[bg].label}
                              />
                            ))}
                          </div>
                        </div>
                      </>
                    )}
                  </TabsContent>

                  {/* Adjustments Tab */}
                  <TabsContent value="adjustments" className="space-y-4">
                    {[
                      { key: 'exposure', label: 'Exposição', icon: Sun },
                      { key: 'contrast', label: 'Contraste', icon: Contrast },
                      { key: 'highlights', label: 'Realces', icon: Sparkles },
                      { key: 'shadows', label: 'Sombras', icon: Cloud },
                      { key: 'whites', label: 'Brancos', icon: CircleDot },
                      { key: 'blacks', label: 'Pretos', icon: Square },
                    ].map(({ key, label, icon: Icon }) => (
                      <div key={key} className="space-y-2">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-medium flex items-center gap-1">
                            <Icon className="h-3 w-3" />
                            {label}
                          </label>
                          <span className="text-xs text-muted-foreground">
                            {adjustments[key as keyof ImageAdjustments]}
                          </span>
                        </div>
                        <Slider
                          value={[adjustments[key as keyof ImageAdjustments]]}
                          onValueChange={([value]) => handleAdjustmentChange(key as keyof ImageAdjustments, value)}
                          min={-100}
                          max={100}
                          step={1}
                          className="w-full"
                        />
                      </div>
                    ))}
                  </TabsContent>

                  {/* Shadows Tab */}
                  <TabsContent value="shadows" className="space-y-4">
                    {!isBackgroundRemoved ? (
                      <p className="text-xs text-muted-foreground text-center py-4">
                        Remova o fundo primeiro para adicionar sombras
                      </p>
                    ) : (
                      <div className="space-y-3">
                        <p className="text-xs font-medium text-muted-foreground">Tipo de Sombra</p>
                        {[
                          { value: 'none', label: 'Sem sombra' },
                          { value: 'base', label: 'Sombra na base' },
                          { value: 'around', label: 'Sombra ao redor' },
                        ].map(({ value, label }) => (
                          <button
                            key={value}
                            onClick={() => { setShadowType(value as ShadowType); setHasChanges(true); }}
                            className={`w-full p-3 text-left rounded border-2 transition-all text-sm ${
                              shadowType === value ? 'bg-muted' : ''
                            }`}
                            style={{
                              borderColor: shadowType === value ? buttonBgColor : 'transparent',
                            }}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    )}
                  </TabsContent>
                </Tabs>
              </div>

              {/* Save Actions */}
              <div className="p-4 border-t space-y-2 flex-shrink-0">
                <Button
                  onClick={handleSave}
                  disabled={isProcessing || !hasChanges}
                  className={`w-full ${buttonRadius}`}
                  style={{ backgroundColor: buttonBgColor, color: buttonTextColor }}
                >
                  <Save className="h-4 w-4 mr-2" />
                  Salvar imagem processada
                </Button>
                <Button
                  variant="outline"
                  onClick={handleUndo}
                  disabled={isProcessing || !hasChanges}
                  className={`w-full ${buttonRadius}`}
                  style={{ borderColor: buttonBgColor, color: buttonBgColor }}
                >
                  <Undo2 className="h-4 w-4 mr-2" />
                  Desfazer alterações
                </Button>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
