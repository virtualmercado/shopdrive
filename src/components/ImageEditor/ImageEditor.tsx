import { useState, useEffect, useRef, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { useTheme } from "@/contexts/ThemeContext";
import { useIsMobile } from "@/hooks/use-mobile";
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
  Check,
  RotateCcwIcon,
  ZoomIn,
  Wand2
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

// Helper: apply tonal adjustments to ImageData
const applyAdjustmentsToImageData = (imageData: ImageData, adjustments: ImageAdjustments): ImageData => {
  const data = imageData.data;
  const result = new ImageData(new Uint8ClampedArray(data), imageData.width, imageData.height);
  const resultData = result.data;

  for (let i = 0; i < data.length; i += 4) {
    let r = data[i];
    let g = data[i + 1];
    let b = data[i + 2];
    const a = data[i + 3];

    // Skip fully transparent pixels
    if (a === 0) {
      resultData[i] = r;
      resultData[i + 1] = g;
      resultData[i + 2] = b;
      resultData[i + 3] = a;
      continue;
    }

    // Exposure (EV-style gamma adjustment)
    const exposureFactor = Math.pow(2, adjustments.exposure / 100);
    r *= exposureFactor;
    g *= exposureFactor;
    b *= exposureFactor;

    // Contrast (S-curve around midtones)
    const contrastFactor = (100 + adjustments.contrast) / 100;
    r = ((r / 255 - 0.5) * contrastFactor + 0.5) * 255;
    g = ((g / 255 - 0.5) * contrastFactor + 0.5) * 255;
    b = ((b / 255 - 0.5) * contrastFactor + 0.5) * 255;

    // Calculate luminance for masking
    const luminance = (r * 0.299 + g * 0.587 + b * 0.114);

    // Highlights (soft mask for bright areas - above 60% luminance)
    if (luminance > 153) {
      const highlightMask = Math.pow((luminance - 153) / 102, 0.5); // Soft feather
      const highlightEffect = highlightMask * (adjustments.highlights / 100) * 60;
      r += highlightEffect;
      g += highlightEffect;
      b += highlightEffect;
    }

    // Shadows (soft mask for dark areas - below 40% luminance)
    if (luminance < 102) {
      const shadowMask = Math.pow((102 - luminance) / 102, 0.5); // Soft feather
      const shadowEffect = shadowMask * (adjustments.shadows / 100) * 60;
      r += shadowEffect;
      g += shadowEffect;
      b += shadowEffect;
    }

    // Whites (affect very bright pixels - above 78% luminance)
    if (luminance > 200) {
      const whiteMask = (luminance - 200) / 55;
      const whiteEffect = whiteMask * (adjustments.whites / 100) * 40;
      r += whiteEffect;
      g += whiteEffect;
      b += whiteEffect;
    }

    // Blacks (affect very dark pixels - below 22% luminance)
    if (luminance < 55) {
      const blackMask = (55 - luminance) / 55;
      const blackEffect = blackMask * (adjustments.blacks / 100) * 40;
      r -= blackEffect;
      g -= blackEffect;
      b -= blackEffect;
    }

    // Clamp values
    resultData[i] = Math.max(0, Math.min(255, r));
    resultData[i + 1] = Math.max(0, Math.min(255, g));
    resultData[i + 2] = Math.max(0, Math.min(255, b));
    resultData[i + 3] = a;
  }

  return result;
};

// Helper: analyze image histogram for auto adjustments
interface HistogramAnalysis {
  median: number;
  mean: number;
  stdDev: number;
  p1: number;
  p99: number;
  p03: number;
  p997: number;
  clippingHighlights: number;
  clippingShadows: number;
}

const analyzeImageHistogram = (imageData: ImageData): HistogramAnalysis => {
  const data = imageData.data;
  const luminances: number[] = [];
  
  for (let i = 0; i < data.length; i += 4) {
    const a = data[i + 3];
    if (a > 128) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const luminance = (r * 0.299 + g * 0.587 + b * 0.114) / 255;
      luminances.push(luminance);
    }
  }

  if (luminances.length === 0) {
    return {
      median: 0.5, mean: 0.5, stdDev: 0.2,
      p1: 0.05, p99: 0.95, p03: 0.02, p997: 0.98,
      clippingHighlights: 0, clippingShadows: 0
    };
  }

  luminances.sort((a, b) => a - b);

  const mean = luminances.reduce((acc, v) => acc + v, 0) / luminances.length;
  const median = luminances[Math.floor(luminances.length / 2)];
  const variance = luminances.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0) / luminances.length;
  const stdDev = Math.sqrt(variance);

  const getPercentile = (p: number) => luminances[Math.floor(luminances.length * p)] || 0;
  
  const p1 = getPercentile(0.01);
  const p99 = getPercentile(0.99);
  const p03 = getPercentile(0.003);
  const p997 = getPercentile(0.997);

  const clippingHighlights = luminances.filter(l => l > 0.98).length / luminances.length;
  const clippingShadows = luminances.filter(l => l < 0.02).length / luminances.length;

  return { median, mean, stdDev, p1, p99, p03, p997, clippingHighlights, clippingShadows };
};

// Helper: calculate auto adjustments based on histogram
const calculateAutoAdjustments = (analysis: HistogramAnalysis): ImageAdjustments => {
  const { median, stdDev, p1, p99, clippingHighlights, clippingShadows } = analysis;

  // Exposure: adjust median to target ~0.55 for e-commerce
  const targetMedian = 0.55;
  let exposure = 0;
  if (median < targetMedian - 0.05) {
    exposure = Math.min(40, (targetMedian - median) * 100);
  } else if (median > targetMedian + 0.05) {
    exposure = Math.max(-30, (targetMedian - median) * 80);
  }

  // Contrast: based on standard deviation
  let contrast = 0;
  if (stdDev < 0.18) {
    // Image is "washed out", needs more contrast
    contrast = Math.min(25, (0.18 - stdDev) * 150);
  } else if (stdDev > 0.28) {
    // Image is too harsh, reduce contrast
    contrast = Math.max(-20, (0.28 - stdDev) * 100);
  }

  // Whites: pull back if there's highlight clipping
  let whites = 0;
  if (clippingHighlights > 0.02) {
    whites = Math.max(-50, -clippingHighlights * 800);
  } else if (p99 < 0.85) {
    // Brighten whites if no clipping and room to expand
    whites = Math.min(20, (0.90 - p99) * 100);
  }

  // Blacks: lift if shadows are crushed
  let blacks = 0;
  if (clippingShadows > 0.02) {
    blacks = Math.max(-40, -clippingShadows * 600);
  } else if (p1 > 0.15) {
    // Deepen blacks if no crushing
    blacks = Math.min(15, (p1 - 0.05) * 80);
  }

  // Highlights: recover if significant clipping
  let highlights = 0;
  if (clippingHighlights > 0.01) {
    highlights = Math.max(-40, -clippingHighlights * 600);
  }

  // Shadows: lift if too compressed
  let shadows = 0;
  if (clippingShadows > 0.005) {
    shadows = Math.min(30, clippingShadows * 400);
  } else if (p1 < 0.03 && stdDev < 0.22) {
    shadows = Math.min(20, 15);
  }

  return {
    exposure: Math.round(exposure),
    contrast: Math.round(contrast),
    highlights: Math.round(highlights),
    shadows: Math.round(shadows),
    whites: Math.round(whites),
    blacks: Math.round(blacks),
  };
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
  const [offsetX, setOffsetX] = useState(0);
  const [scale, setScale] = useState(100);
  const [rotationInput, setRotationInput] = useState("0");
  const [scaleInput, setScaleInput] = useState("100");
  const [selectedBackground, setSelectedBackground] = useState<BackgroundType>('original');
  const [shadowType, setShadowType] = useState<ShadowType>('none');
  const [isBackgroundRemoved, setIsBackgroundRemoved] = useState(false);
  const [showComparison, setShowComparison] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [isAnimatingReset, setIsAnimatingReset] = useState(false);
  const [isAnimatingAuto, setIsAnimatingAuto] = useState(false);
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number | null>(null);
  const resetAnimationRef = useRef<number | null>(null);
  const autoAnimationRef = useRef<number | null>(null);
  const { toast } = useToast();
  const { buttonBgColor, buttonTextColor, buttonBorderStyle } = useTheme();
  const isMobile = useIsMobile();
  
  const buttonRadius = buttonBorderStyle === 'rounded' ? 'rounded-full' : 'rounded-md';
  
  const rotationStep = isMobile ? 0.5 : 0.1;
  const offsetStep = isMobile ? 1 : 0.5;
  const scaleStep = isMobile ? 2 : 1;

  const calculateVisibilityFactor = useCallback((currentScale: number, currentOffsetX: number): number => {
    const scaleFactor = currentScale / 100;
    const canvasWidth = canvasRef.current?.width || 800;
    const productVisibleWidth = canvasWidth * scaleFactor;
    const offsetPixels = Math.abs(currentOffsetX / 100) * canvasWidth;
    const visiblePortion = Math.max(0, productVisibleWidth - offsetPixels) / productVisibleWidth;
    return Math.max(0, Math.min(1, visiblePortion));
  }, []);

  const getSoftClampMultiplier = useCallback((visibility: number): number => {
    const minVisibility = 0.60;
    if (visibility >= 0.80) return 1;
    if (visibility <= minVisibility) return 0.05;
    const range = 0.80 - minVisibility;
    const position = (visibility - minVisibility) / range;
    return 0.05 + (position * position) * 0.95;
  }, []);

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

  // Unified draw function that applies both transforms and adjustments
  const drawImage = useCallback((img: HTMLImageElement, imgData?: ImageData, currentAdjustments?: ImageAdjustments) => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    
    animationFrameRef.current = requestAnimationFrame(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      canvas.width = img.width;
      canvas.height = img.height;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const offsetPixels = (offsetX / 100) * canvas.width;
      const scaleFactor = scale / 100;
      const adj = currentAdjustments || adjustments;
      const hasAdjustments = Object.values(adj).some(v => v !== 0);

      // Create source image data (either from imgData or from original image)
      let sourceData: ImageData;
      
      if (imgData) {
        sourceData = imgData;
      } else {
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = img.width;
        tempCanvas.height = img.height;
        const tempCtx = tempCanvas.getContext('2d');
        if (!tempCtx) return;
        tempCtx.drawImage(img, 0, 0);
        sourceData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
      }

      // Apply adjustments if any
      const adjustedData = hasAdjustments ? applyAdjustmentsToImageData(sourceData, adj) : sourceData;

      // Create temp canvas with adjusted data
      const adjustedCanvas = document.createElement('canvas');
      adjustedCanvas.width = adjustedData.width;
      adjustedCanvas.height = adjustedData.height;
      const adjustedCtx = adjustedCanvas.getContext('2d');
      if (!adjustedCtx) return;
      adjustedCtx.putImageData(adjustedData, 0, 0);

      // Apply transforms and draw
      ctx.save();
      ctx.translate(canvas.width / 2 + offsetPixels, canvas.height / 2);
      ctx.rotate((rotation * Math.PI) / 180);
      ctx.scale(scaleFactor, scaleFactor);
      ctx.translate(-canvas.width / 2, -canvas.height / 2);
      ctx.drawImage(adjustedCanvas, 0, 0);
      ctx.restore();
    });
  }, [rotation, offsetX, scale, adjustments]);

  const handleRemoveBackground = async () => {
    if (!originalImage) return;

    setIsProcessing(true);
    setProcessingStep('Preparando imagem...');
    setProcessingProgress(10);

    try {
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = originalImage.width;
      tempCanvas.height = originalImage.height;
      const tempCtx = tempCanvas.getContext('2d');
      if (!tempCtx) throw new Error('Could not get canvas context');
      
      tempCtx.drawImage(originalImage, 0, 0);

      setProcessingStep('Removendo fundo...');
      setProcessingProgress(30);

      const resultBlob = await removeBackground(originalImage, (progress) => {
        setProcessingProgress(30 + progress * 60);
      });

      setProcessingStep('Processando resultado...');
      setProcessingProgress(90);

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

  // Apply background with all effects including adjustments
  const applyBackground = useCallback((currentAdjustments?: ImageAdjustments) => {
    if (!backgroundRemovedImage || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = backgroundRemovedImage.width;
    canvas.height = backgroundRemovedImage.height;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw background first
    if (selectedBackground !== 'transparent' && selectedBackground !== 'original') {
      const preset = backgroundPresets[selectedBackground];
      
      if (preset.pattern) {
        drawTextureBackground(ctx, canvas.width, canvas.height, preset.pattern);
      } else if (preset.color) {
        ctx.fillStyle = preset.color;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      } else if (selectedBackground === 'auto-contrast') {
        const avgColor = calculateAverageColor(backgroundRemovedImage);
        const contrastColor = getContrastingColor(avgColor);
        ctx.fillStyle = contrastColor;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
    } else if (selectedBackground === 'transparent') {
      drawCheckerboard(ctx, canvas.width, canvas.height);
    }

    const offsetPixels = (offsetX / 100) * canvas.width;
    const scaleFactor = scale / 100;
    const adj = currentAdjustments || adjustments;
    const hasAdj = Object.values(adj).some(v => v !== 0);

    // Apply adjustments to the background-removed image
    const adjustedData = hasAdj ? applyAdjustmentsToImageData(backgroundRemovedImage, adj) : backgroundRemovedImage;

    ctx.save();
    ctx.translate(canvas.width / 2 + offsetPixels, canvas.height / 2);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.scale(scaleFactor, scaleFactor);
    ctx.translate(-canvas.width / 2, -canvas.height / 2);

    // Apply shadow if needed
    if (shadowType !== 'none' && isBackgroundRemoved) {
      applyShadow(ctx, adjustedData, shadowType);
    }

    // Draw the adjusted image
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = adjustedData.width;
    tempCanvas.height = adjustedData.height;
    const tempCtx = tempCanvas.getContext('2d');
    if (tempCtx) {
      tempCtx.putImageData(adjustedData, 0, 0);
      ctx.drawImage(tempCanvas, 0, 0);
    }

    ctx.restore();
  }, [backgroundRemovedImage, selectedBackground, shadowType, adjustments, isBackgroundRemoved, rotation, offsetX, scale]);

  useEffect(() => {
    if (isBackgroundRemoved && backgroundRemovedImage) {
      applyBackground();
    }
  }, [applyBackground, isBackgroundRemoved, backgroundRemovedImage]);

  const drawTextureBackground = (ctx: CanvasRenderingContext2D, width: number, height: number, pattern: string) => {
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
      ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
      ctx.shadowBlur = 20;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 10;
    } else if (type === 'around') {
      ctx.shadowColor = 'rgba(0, 0, 0, 0.2)';
      ctx.shadowBlur = 30;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 0;
    }
    
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
      if (imageData.data[i + 3] > 128) {
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

  const handleRotationChange = useCallback((value: number) => {
    const clampedValue = Math.max(-180, Math.min(180, value));
    setRotation(clampedValue);
    setRotationInput(clampedValue.toFixed(1));
    setHasChanges(true);
  }, []);

  const handleRotationInputChange = (inputValue: string) => {
    setRotationInput(inputValue);
    const numValue = parseFloat(inputValue);
    if (!isNaN(numValue)) {
      const clampedValue = Math.max(-180, Math.min(180, numValue));
      setRotation(clampedValue);
      setHasChanges(true);
    }
  };

  const handleRotationInputBlur = () => {
    setRotationInput(rotation.toFixed(1));
  };

  const handleRotateLeft = (e: React.MouseEvent) => {
    const step = e.shiftKey ? 15 : 1;
    handleRotationChange(rotation - step);
  };

  const handleRotateRight = (e: React.MouseEvent) => {
    const step = e.shiftKey ? 15 : 1;
    handleRotationChange(rotation + step);
  };

  const handleQuickRotate = (degrees: number) => {
    handleRotationChange(rotation + degrees);
  };

  const handleOffsetChange = useCallback((value: number) => {
    if (isAnimatingReset) return;
    
    const visibility = calculateVisibilityFactor(scale, value);
    const clampMultiplier = getSoftClampMultiplier(visibility);
    
    const delta = value - offsetX;
    const softDelta = delta * clampMultiplier;
    const newValue = offsetX + softDelta;
    
    const clampedValue = Math.max(-30, Math.min(30, newValue));
    setOffsetX(clampedValue);
    setHasChanges(true);
  }, [offsetX, scale, isAnimatingReset, calculateVisibilityFactor, getSoftClampMultiplier]);

  const handleScaleChange = useCallback((value: number) => {
    if (isAnimatingReset) return;
    
    const visibility = calculateVisibilityFactor(value, offsetX);
    const clampMultiplier = getSoftClampMultiplier(visibility);
    
    const delta = value - scale;
    const softDelta = delta * clampMultiplier;
    const newValue = scale + softDelta;
    
    const clampedValue = Math.max(60, Math.min(160, newValue));
    setScale(clampedValue);
    setScaleInput(Math.round(clampedValue).toString());
    setHasChanges(true);
  }, [scale, offsetX, isAnimatingReset, calculateVisibilityFactor, getSoftClampMultiplier]);

  const handleScaleInputChange = (inputValue: string) => {
    setScaleInput(inputValue);
    const numValue = parseInt(inputValue, 10);
    if (!isNaN(numValue)) {
      const clampedValue = Math.max(60, Math.min(160, numValue));
      setScale(clampedValue);
      setHasChanges(true);
    }
  };

  const handleScaleInputBlur = () => {
    setScaleInput(Math.round(scale).toString());
  };

  // Animated reset with ease-out (includes adjustments)
  const handleResetTransform = useCallback(() => {
    if (isAnimatingReset) return;
    
    if (resetAnimationRef.current) {
      cancelAnimationFrame(resetAnimationRef.current);
    }
    
    setIsAnimatingReset(true);
    
    const startRotation = rotation;
    const startOffsetX = offsetX;
    const startScale = scale;
    const startAdjustments = { ...adjustments };
    const duration = 180;
    const startTime = performance.now();
    
    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(1, elapsed / duration);
      const easeOut = 1 - Math.pow(1 - progress, 3);
      
      const newRotation = startRotation * (1 - easeOut);
      const newOffsetX = startOffsetX * (1 - easeOut);
      const newScale = startScale + (100 - startScale) * easeOut;
      
      // Animate adjustments to 0
      const newAdjustments: ImageAdjustments = {
        exposure: Math.round(startAdjustments.exposure * (1 - easeOut)),
        contrast: Math.round(startAdjustments.contrast * (1 - easeOut)),
        highlights: Math.round(startAdjustments.highlights * (1 - easeOut)),
        shadows: Math.round(startAdjustments.shadows * (1 - easeOut)),
        whites: Math.round(startAdjustments.whites * (1 - easeOut)),
        blacks: Math.round(startAdjustments.blacks * (1 - easeOut)),
      };
      
      setRotation(newRotation);
      setRotationInput(newRotation.toFixed(1));
      setOffsetX(newOffsetX);
      setScale(newScale);
      setScaleInput(Math.round(newScale).toString());
      setAdjustments(newAdjustments);
      
      if (progress < 1) {
        resetAnimationRef.current = requestAnimationFrame(animate);
      } else {
        setRotation(0);
        setRotationInput("0");
        setOffsetX(0);
        setScale(100);
        setScaleInput("100");
        setAdjustments(defaultAdjustments);
        setIsAnimatingReset(false);
        resetAnimationRef.current = null;
      }
    };
    
    resetAnimationRef.current = requestAnimationFrame(animate);
  }, [rotation, offsetX, scale, adjustments, isAnimatingReset]);

  // Auto button: analyze image and set optimal adjustments
  const handleAutoAdjust = useCallback(() => {
    if (isAnimatingAuto || !originalImage) return;

    // Get source image data
    let sourceData: ImageData;
    
    if (isBackgroundRemoved && backgroundRemovedImage) {
      sourceData = backgroundRemovedImage;
    } else {
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = originalImage.width;
      tempCanvas.height = originalImage.height;
      const tempCtx = tempCanvas.getContext('2d');
      if (!tempCtx) return;
      tempCtx.drawImage(originalImage, 0, 0);
      sourceData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
    }

    // Analyze histogram
    const analysis = analyzeImageHistogram(sourceData);
    const targetAdjustments = calculateAutoAdjustments(analysis);

    // Cancel any existing animation
    if (autoAnimationRef.current) {
      cancelAnimationFrame(autoAnimationRef.current);
    }

    setIsAnimatingAuto(true);
    
    const startAdjustments = { ...adjustments };
    const duration = 180;
    const startTime = performance.now();

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(1, elapsed / duration);
      const easeOut = 1 - Math.pow(1 - progress, 3);

      const newAdjustments: ImageAdjustments = {
        exposure: Math.round(startAdjustments.exposure + (targetAdjustments.exposure - startAdjustments.exposure) * easeOut),
        contrast: Math.round(startAdjustments.contrast + (targetAdjustments.contrast - startAdjustments.contrast) * easeOut),
        highlights: Math.round(startAdjustments.highlights + (targetAdjustments.highlights - startAdjustments.highlights) * easeOut),
        shadows: Math.round(startAdjustments.shadows + (targetAdjustments.shadows - startAdjustments.shadows) * easeOut),
        whites: Math.round(startAdjustments.whites + (targetAdjustments.whites - startAdjustments.whites) * easeOut),
        blacks: Math.round(startAdjustments.blacks + (targetAdjustments.blacks - startAdjustments.blacks) * easeOut),
      };

      setAdjustments(newAdjustments);
      setHasChanges(true);

      if (progress < 1) {
        autoAnimationRef.current = requestAnimationFrame(animate);
      } else {
        setAdjustments(targetAdjustments);
        setIsAnimatingAuto(false);
        autoAnimationRef.current = null;
        
        toast({
          title: "Auto ajuste aplicado",
          description: "Ajustes otimizados para e-commerce foram aplicados",
        });
      }
    };

    autoAnimationRef.current = requestAnimationFrame(animate);
  }, [originalImage, isBackgroundRemoved, backgroundRemovedImage, adjustments, isAnimatingAuto, toast]);

  const handleAdjustmentChange = (key: keyof ImageAdjustments, value: number) => {
    setAdjustments((prev) => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };

  const handleUndo = () => {
    setAdjustments(defaultAdjustments);
    setRotation(0);
    setRotationInput("0");
    setOffsetX(0);
    setScale(100);
    setScaleInput("100");
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

  const handleSave = async () => {
    if (!canvasRef.current) return;

    setIsProcessing(true);
    setProcessingStep('Salvando imagem...');
    setProcessingProgress(50);

    try {
      // Re-render with final state
      if (isBackgroundRemoved && backgroundRemovedImage) {
        applyBackground(adjustments);
      } else if (originalImage) {
        // Synchronous final render
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          canvas.width = originalImage.width;
          canvas.height = originalImage.height;
          ctx.clearRect(0, 0, canvas.width, canvas.height);

          const offsetPixels = (offsetX / 100) * canvas.width;
          const scaleFactor = scale / 100;

          // Get source data
          const tempCanvas = document.createElement('canvas');
          tempCanvas.width = originalImage.width;
          tempCanvas.height = originalImage.height;
          const tempCtx = tempCanvas.getContext('2d');
          if (tempCtx) {
            tempCtx.drawImage(originalImage, 0, 0);
            const sourceData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
            
            // Apply adjustments
            const hasAdj = Object.values(adjustments).some(v => v !== 0);
            const adjustedData = hasAdj ? applyAdjustmentsToImageData(sourceData, adjustments) : sourceData;

            const adjustedCanvas = document.createElement('canvas');
            adjustedCanvas.width = adjustedData.width;
            adjustedCanvas.height = adjustedData.height;
            const adjustedCtx = adjustedCanvas.getContext('2d');
            if (adjustedCtx) {
              adjustedCtx.putImageData(adjustedData, 0, 0);

              ctx.save();
              ctx.translate(canvas.width / 2 + offsetPixels, canvas.height / 2);
              ctx.rotate((rotation * Math.PI) / 180);
              ctx.scale(scaleFactor, scaleFactor);
              ctx.translate(-canvas.width / 2, -canvas.height / 2);
              ctx.drawImage(adjustedCanvas, 0, 0);
              ctx.restore();
            }
          }
        }
      }

      const dataUrl = canvasRef.current.toDataURL('image/png', 1.0);
      
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

  // Update canvas when transforms or adjustments change
  useEffect(() => {
    if (originalImage && !isBackgroundRemoved) {
      drawImage(originalImage, undefined, adjustments);
    }
  }, [rotation, offsetX, scale, adjustments, originalImage, isBackgroundRemoved, drawImage]);

  // Update background-removed canvas when adjustments change
  useEffect(() => {
    if (isBackgroundRemoved && backgroundRemovedImage) {
      applyBackground(adjustments);
    }
  }, [adjustments, isBackgroundRemoved, backgroundRemovedImage, rotation, offsetX, scale, selectedBackground, shadowType]);

  useEffect(() => {
    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      if (resetAnimationRef.current) cancelAnimationFrame(resetAnimationRef.current);
      if (autoAnimationRef.current) cancelAnimationFrame(autoAnimationRef.current);
    };
  }, []);

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
            <div className="flex-1 flex flex-col overflow-hidden">
              <div className="px-4 py-2 bg-muted/50 border-b flex items-center gap-2 text-xs text-muted-foreground flex-shrink-0">
                <Info className="h-4 w-4 flex-shrink-0" />
                <span>Para melhores resultados na remoção de fundo, utilize fotos com fundo contrastante e sem outros objetos além do produto.</span>
              </div>

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
                        style={{ maxWidth: '200px', maxHeight: '300px' }}
                      />
                    </div>
                  </div>
                ) : (
                  <canvas
                    ref={canvasRef}
                    className="max-w-full max-h-full object-contain border rounded shadow-sm"
                    style={{ maxHeight: '400px' }}
                  />
                )}
              </div>

              <div className="px-4 py-3 border-t space-y-4 flex-shrink-0">
                {/* Rotation Control */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-medium flex items-center gap-1">
                      <RotateCcwIcon className="h-3 w-3" />
                      Rotação (°)
                    </label>
                    <div className="flex items-center gap-2">
                      <Input
                        type="text"
                        value={rotationInput}
                        onChange={(e) => handleRotationInputChange(e.target.value)}
                        onBlur={handleRotationInputBlur}
                        className="w-16 h-7 text-xs text-center"
                      />
                    </div>
                  </div>
                  <Slider
                    value={[rotation]}
                    onValueChange={([value]) => handleRotationChange(value)}
                    min={-180}
                    max={180}
                    step={rotationStep}
                    className="w-full"
                  />
                  <div className="flex gap-1 justify-center">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleQuickRotate(-90)}
                      className={`text-xs px-2 ${buttonRadius}`}
                      style={{ borderColor: buttonBgColor, color: buttonBgColor }}
                    >
                      -90°
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleRotateLeft}
                      className={buttonRadius}
                      style={{ borderColor: buttonBgColor, color: buttonBgColor }}
                      title="Clique: -1° | Shift+Clique: -15°"
                    >
                      <RotateCcw className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleRotateRight}
                      className={buttonRadius}
                      style={{ borderColor: buttonBgColor, color: buttonBgColor }}
                      title="Clique: +1° | Shift+Clique: +15°"
                    >
                      <RotateCw className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleQuickRotate(90)}
                      className={`text-xs px-2 ${buttonRadius}`}
                      style={{ borderColor: buttonBgColor, color: buttonBgColor }}
                    >
                      +90°
                    </Button>
                  </div>
                </div>

                {/* Zoom/Scale Control */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-medium flex items-center gap-1">
                      <ZoomIn className="h-3 w-3" />
                      Zoom / Escala (%)
                    </label>
                    <div className="flex items-center gap-1">
                      <Input
                        type="text"
                        value={scaleInput}
                        onChange={(e) => handleScaleInputChange(e.target.value)}
                        onBlur={handleScaleInputBlur}
                        className="w-14 h-7 text-xs text-center"
                      />
                      <span className="text-xs text-muted-foreground">%</span>
                    </div>
                  </div>
                  <Slider
                    value={[scale]}
                    onValueChange={([value]) => handleScaleChange(value)}
                    min={60}
                    max={160}
                    step={scaleStep}
                    className="w-full"
                  />
                </div>

                {/* Horizontal Position Control */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-medium flex items-center gap-1">
                      <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M18 8L22 12L18 16" />
                        <path d="M6 8L2 12L6 16" />
                        <line x1="2" y1="12" x2="22" y2="12" />
                      </svg>
                      Posição horizontal (X)
                    </label>
                    <span className="text-xs text-muted-foreground">
                      {offsetX > 0 ? '+' : ''}{offsetX.toFixed(1)}%
                    </span>
                  </div>
                  <Slider
                    value={[offsetX]}
                    onValueChange={([value]) => handleOffsetChange(value)}
                    min={-30}
                    max={30}
                    step={offsetStep}
                    className="w-full"
                  />
                </div>

                {/* Reset Button */}
                <div className="flex justify-center">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleResetTransform}
                    className={buttonRadius}
                    style={{ borderColor: buttonBgColor, color: buttonBgColor }}
                  >
                    <RefreshCw className="h-4 w-4 mr-1" />
                    Resetar
                  </Button>
                </div>
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
                    {/* Auto Button */}
                    <div className="space-y-2">
                      <Button
                        onClick={handleAutoAdjust}
                        disabled={isProcessing || isAnimatingAuto || !originalImage}
                        variant="outline"
                        className={`w-full ${buttonRadius}`}
                        style={{ borderColor: buttonBgColor, color: buttonBgColor }}
                      >
                        <Wand2 className="h-4 w-4 mr-2" />
                        Auto
                      </Button>
                      <p className="text-[10px] text-muted-foreground text-center leading-tight">
                        Auto usa IA para analisar a imagem e sugerir ajustes profissionais para e-commerce.
                      </p>
                    </div>

                    <div className="border-t pt-4">
                      {[
                        { key: 'exposure', label: 'Exposição', icon: Sun },
                        { key: 'contrast', label: 'Contraste', icon: Contrast },
                        { key: 'highlights', label: 'Realces', icon: Sparkles },
                        { key: 'shadows', label: 'Sombras', icon: Cloud },
                        { key: 'whites', label: 'Brancos', icon: CircleDot },
                        { key: 'blacks', label: 'Pretos', icon: Square },
                      ].map(({ key, label, icon: Icon }) => (
                        <div key={key} className="space-y-2 mb-3">
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
                    </div>
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
