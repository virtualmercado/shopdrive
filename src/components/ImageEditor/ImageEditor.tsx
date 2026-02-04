import { useState, useEffect, useRef, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
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
  RefreshCw,
  ZoomIn,
  Wand2,
  Share2,
  Crop,
  Copy,
  Focus
} from "lucide-react";
import { loadImageFromUrl, loadImageFromDataUrl } from "./backgroundRemoval";

interface ImageEditorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  imageUrl: string;
  onSave: (editedImageUrl: string) => void;
  otherProductImages?: string[];
  onApplyToOthers?: (settings: EditorSettings) => void;
}

interface ImageAdjustments {
  exposure: number;
  contrast: number;
  highlights: number;
  shadows: number;
  whites: number;
  blacks: number;
  sharpness: number;
}

// Crop preset definition
type CropPreset = '1:1' | '4:5' | '16:9' | 'original';

interface CropPresetConfig {
  label: string;
  ratio: number | null; // null = original
  description: string;
}

const cropPresets: Record<CropPreset, CropPresetConfig> = {
  'original': { label: 'Original', ratio: null, description: 'Proporção original' },
  '1:1': { label: '1:1', ratio: 1, description: 'Quadrado (loja)' },
  '4:5': { label: '4:5', ratio: 4/5, description: 'Vertical (Instagram)' },
  '16:9': { label: '16:9', ratio: 16/9, description: 'Banner horizontal' },
};

// Editor settings that can be applied to other images
export interface EditorSettings {
  adjustments: ImageAdjustments;
  rotation: number;
  offsetX: number;
  scale: number;
  cropPreset: CropPreset;
}

// History state snapshot for undo functionality
interface EditorHistoryState {
  adjustments: ImageAdjustments;
  rotation: number;
  offsetX: number;
  scale: number;
  cropPreset: CropPreset;
}

const MAX_HISTORY_SIZE = 20;

const defaultAdjustments: ImageAdjustments = {
  exposure: 0,
  contrast: 0,
  highlights: 0,
  shadows: 0,
  whites: 0,
  blacks: 0,
  sharpness: 0,
};

// Helper: apply sharpness using unsharp mask technique
const applySharpness = (imageData: ImageData, amount: number): ImageData => {
  if (amount === 0) return imageData;
  
  const data = imageData.data;
  const width = imageData.width;
  const height = imageData.height;
  const result = new ImageData(new Uint8ClampedArray(data), width, height);
  const resultData = result.data;
  
  // Sharpness strength (0-30 maps to 0-0.6 multiplier)
  const strength = (amount / 30) * 0.6;
  
  // Simple unsharp mask: enhance edges by subtracting blurred version
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = (y * width + x) * 4;
      
      // Get surrounding pixels for blur approximation
      const idxUp = ((y - 1) * width + x) * 4;
      const idxDown = ((y + 1) * width + x) * 4;
      const idxLeft = (y * width + (x - 1)) * 4;
      const idxRight = (y * width + (x + 1)) * 4;
      
      for (let c = 0; c < 3; c++) {
        const center = data[idx + c];
        const blur = (data[idxUp + c] + data[idxDown + c] + data[idxLeft + c] + data[idxRight + c]) / 4;
        const detail = center - blur;
        
        // Apply sharpening with controlled strength
        resultData[idx + c] = Math.max(0, Math.min(255, center + detail * strength));
      }
      resultData[idx + 3] = data[idx + 3]; // Preserve alpha
    }
  }
  
  return result;
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

  // Apply sharpness as a second pass
  if (adjustments.sharpness > 0) {
    return applySharpness(result, adjustments.sharpness);
  }

  return result;
};

// Helper: analyze image histogram for auto adjustments (advanced e-commerce analysis)
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
  // E-commerce specific metrics
  hasWhiteBackground: boolean;
  backgroundBrightness: number;
  isWellExposed: boolean;
  isBalanced: boolean;
  // Advanced diagnostic metrics
  productReadability: number; // 0-1 score for label/product clarity
  dynamicRange: number; // Tonal spread
  hasGoodContrast: boolean;
  isEcommerceReady: boolean; // Master flag: image already suitable
}

const analyzeImageHistogram = (imageData: ImageData): HistogramAnalysis => {
  const data = imageData.data;
  const luminances: number[] = [];
  let whitePixels = 0;
  let nearWhitePixels = 0;
  let totalPixels = 0;
  let midtonePixels = 0; // Pixels in readable range (product/label area)
  
  for (let i = 0; i < data.length; i += 4) {
    const a = data[i + 3];
    if (a > 128) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const luminance = (r * 0.299 + g * 0.587 + b * 0.114) / 255;
      luminances.push(luminance);
      totalPixels++;
      
      // Detect white/near-white pixels (background detection)
      if (r > 245 && g > 245 && b > 245) {
        whitePixels++;
      } else if (r > 230 && g > 230 && b > 230) {
        nearWhitePixels++;
      }
      
      // Count midtone pixels (where product/label typically resides)
      if (luminance >= 0.15 && luminance <= 0.85) {
        midtonePixels++;
      }
    }
  }

  if (luminances.length === 0) {
    return {
      median: 0.5, mean: 0.5, stdDev: 0.2,
      p1: 0.05, p99: 0.95, p03: 0.02, p997: 0.98,
      clippingHighlights: 0, clippingShadows: 0,
      hasWhiteBackground: false, backgroundBrightness: 0.5,
      isWellExposed: true, isBalanced: true,
      productReadability: 1, dynamicRange: 0.9,
      hasGoodContrast: true, isEcommerceReady: true
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

  // E-commerce specific: detect white background (more strict)
  const whiteRatio = (whitePixels + nearWhitePixels) / totalPixels;
  const hasWhiteBackground = whiteRatio > 0.12; // 12%+ white/near-white = likely white bg
  const backgroundBrightness = p99;

  // Dynamic range: spread between dark and bright areas
  const dynamicRange = p99 - p1;
  
  // Check if image is already well-exposed for e-commerce
  // Ideal: median between 0.42-0.68 (centered, not too dark or bright)
  const isWellExposed = median >= 0.38 && median <= 0.72;
  
  // Check if contrast is balanced (not washed out, not too harsh)
  const isBalanced = stdDev >= 0.14 && stdDev <= 0.34;
  
  // Product readability: high ratio of midtone pixels where labels are readable
  const productReadability = midtonePixels / totalPixels;
  
  // Good contrast: sufficient tonal separation without crushing
  const hasGoodContrast = dynamicRange >= 0.5 && clippingHighlights < 0.06 && clippingShadows < 0.04;
  
  // MASTER FLAG: Image is e-commerce ready if ALL conditions met
  const isEcommerceReady = 
    isWellExposed && 
    isBalanced && 
    hasGoodContrast && 
    productReadability >= 0.3 &&
    clippingHighlights < 0.08 && 
    clippingShadows < 0.05;

  return { 
    median, mean, stdDev, p1, p99, p03, p997, 
    clippingHighlights, clippingShadows,
    hasWhiteBackground, backgroundBrightness,
    isWellExposed, isBalanced,
    productReadability, dynamicRange,
    hasGoodContrast, isEcommerceReady
  };
};

// Helper: simulate adjustment result and compare quality
const simulateAdjustmentQuality = (
  originalAnalysis: HistogramAnalysis,
  adjustments: ImageAdjustments
): { wouldImprove: boolean; qualityDelta: number } => {
  // Estimate resulting metrics based on adjustments
  const estimatedMedian = Math.max(0.1, Math.min(0.9, 
    originalAnalysis.median * Math.pow(2, adjustments.exposure / 100)
  ));
  
  const estimatedStdDev = originalAnalysis.stdDev * (1 + adjustments.contrast / 200);
  
  // Quality score: closer to ideal = better
  const idealMedian = 0.52;
  const idealStdDev = 0.22;
  
  const originalScore = 
    (1 - Math.abs(originalAnalysis.median - idealMedian) * 2) +
    (1 - Math.abs(originalAnalysis.stdDev - idealStdDev) * 3) +
    (originalAnalysis.hasGoodContrast ? 0.5 : 0) +
    (originalAnalysis.productReadability * 0.5);
    
  const estimatedScore = 
    (1 - Math.abs(estimatedMedian - idealMedian) * 2) +
    (1 - Math.abs(estimatedStdDev - idealStdDev) * 3) +
    (originalAnalysis.hasGoodContrast ? 0.5 : 0) + // Preserved
    (originalAnalysis.productReadability * 0.5); // Preserved
  
  const qualityDelta = estimatedScore - originalScore;
  
  // Only consider improvement if delta is meaningfully positive
  return {
    wouldImprove: qualityDelta > 0.05,
    qualityDelta
  };
};

// Helper: calculate auto adjustments based on histogram (ULTRA-CONSERVATIVE for e-commerce)
const calculateAutoAdjustments = (analysis: HistogramAnalysis): ImageAdjustments => {
  const { 
    median, stdDev, 
    clippingHighlights, clippingShadows,
    hasWhiteBackground, isWellExposed, isBalanced,
    hasGoodContrast, isEcommerceReady,
    productReadability
  } = analysis;

  // ========== RULE 1: E-COMMERCE READY = NO ADJUSTMENTS ==========
  // If image already meets all e-commerce criteria, return zeros
  if (isEcommerceReady) {
    return {
      exposure: 0,
      contrast: 0,
      highlights: 0,
      shadows: 0,
      whites: 0,
      blacks: 0,
      sharpness: 0,
    };
  }

  // ========== RULE 2: MOSTLY GOOD = MINIMAL ADJUSTMENTS ==========
  // If image is 3 out of 4 quality checks, only tiny corrections
  const qualityChecks = [isWellExposed, isBalanced, hasGoodContrast, productReadability >= 0.35];
  const passedChecks = qualityChecks.filter(Boolean).length;
  
  if (passedChecks >= 3) {
    // Very subtle corrections only
    let tinyExposure = 0;
    if (!isWellExposed && median < 0.40) {
      tinyExposure = Math.min(8, (0.48 - median) * 25); // Max +8
    }
    
    return {
      exposure: Math.round(tinyExposure),
      contrast: 0,
      highlights: 0,
      shadows: 0,
      whites: 0,
      blacks: 0,
      sharpness: 0,
    };
  }

  // ========== RULE 3: WHITE BACKGROUND ABSOLUTE PROTECTION ==========
  const isWhiteBgProtected = hasWhiteBackground;
  // White bg = studio photo = correct as-is

  // === EXPOSURE ===
  // Target median ~0.52 for e-commerce, but use VERY SUBTLE corrections
  let exposure = 0;
  const targetMedian = 0.52;
  const exposureDeviation = Math.abs(median - targetMedian);
  
  // Only adjust if SIGNIFICANTLY off (>0.12 deviation)
  if (exposureDeviation > 0.12) {
    if (median < targetMedian - 0.12) {
      // Underexposed - gentle lift, max +18
      exposure = Math.min(18, (targetMedian - median) * 45);
    } else if (median > targetMedian + 0.15 && !isWhiteBgProtected) {
      // Overexposed - only reduce if NOT white background
      exposure = Math.max(-12, (targetMedian - median) * 35);
    }
  }
  
  // WHITE BG: NEVER reduce exposure (absolute rule)
  if (isWhiteBgProtected && exposure < 0) {
    exposure = 0;
  }

  // === CONTRAST ===
  // Ultra-subtle contrast adjustments
  let contrast = 0;
  if (stdDev < 0.10) {
    // Severely washed out - mild contrast boost, max +10
    contrast = Math.min(10, (0.16 - stdDev) * 55);
  }
  // NEVER increase contrast for white bg images
  if (isWhiteBgProtected) {
    contrast = 0;
  }
  // If already balanced, no contrast change
  if (isBalanced) {
    contrast = 0;
  }

  // === WHITES ===
  // Only pull back whites if SEVERE clipping (>10%)
  let whites = 0;
  if (clippingHighlights > 0.10) {
    whites = Math.max(-20, -clippingHighlights * 150);
  }
  // WHITE BG: NEVER touch whites (absolute rule)
  if (isWhiteBgProtected) {
    whites = 0;
  }

  // === BLACKS ===
  // Ultra-conservative - only adjust if shadows are SEVERELY crushed
  let blacks = 0;
  if (clippingShadows > 0.06) {
    // Lift crushed shadows slightly
    blacks = Math.max(-15, -clippingShadows * 180);
  }
  // WHITE BG: NEVER darken blacks (would gray out background)
  if (isWhiteBgProtected) {
    blacks = 0;
  }

  // === HIGHLIGHTS ===
  // Only recover if significant clipping (>7%)
  let highlights = 0;
  if (clippingHighlights > 0.07 && !isWhiteBgProtected) {
    highlights = Math.max(-15, -clippingHighlights * 180);
  }
  // White bg: NO highlight adjustments
  if (isWhiteBgProtected) {
    highlights = 0;
  }

  // === SHADOWS ===
  // Gentle shadow lift only if truly crushed (>5%)
  let shadows = 0;
  if (clippingShadows > 0.05) {
    shadows = Math.min(12, clippingShadows * 150);
  }

  // ========== RULE 4: SIMULATE & VALIDATE ==========
  const proposedAdjustments: ImageAdjustments = {
    exposure: Math.round(exposure),
    contrast: Math.round(contrast),
    highlights: Math.round(highlights),
    shadows: Math.round(shadows),
    whites: Math.round(whites),
    blacks: Math.round(blacks),
    sharpness: 0,
  };
  
  const simulation = simulateAdjustmentQuality(analysis, proposedAdjustments);
  
  // If simulation suggests no improvement or degradation, return zeros
  if (!simulation.wouldImprove || simulation.qualityDelta < 0.03) {
    return {
      exposure: 0,
      contrast: 0,
      highlights: 0,
      shadows: 0,
      whites: 0,
      blacks: 0,
      sharpness: 0,
    };
  }

  // ========== RULE 5: FINAL SAFETY CAPS ==========
  const capAdjustment = (val: number, max: number) => 
    Math.max(-max, Math.min(max, val));

  return {
    exposure: Math.round(capAdjustment(exposure, 18)),
    contrast: Math.round(capAdjustment(contrast, 10)),
    highlights: Math.round(capAdjustment(highlights, 15)),
    shadows: Math.round(capAdjustment(shadows, 12)),
    whites: Math.round(capAdjustment(whites, 20)),
    blacks: Math.round(capAdjustment(blacks, 15)),
    sharpness: 0,
  };
};

export const ImageEditor = ({ 
  open, 
  onOpenChange, 
  imageUrl, 
  onSave,
  otherProductImages = [],
  onApplyToOthers
}: ImageEditorProps) => {
  const [originalImage, setOriginalImage] = useState<HTMLImageElement | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingProgress, setProcessingProgress] = useState(0);
  const [processingStep, setProcessingStep] = useState('');
  const [adjustments, setAdjustments] = useState<ImageAdjustments>(defaultAdjustments);
  const [rotation, setRotation] = useState(0);
  const [offsetX, setOffsetX] = useState(0);
  const [scale, setScale] = useState(100);
  const [scaleSliderPos, setScaleSliderPos] = useState(0); // Bipolar slider position: -100 to +100, 0 = 100%
  const [rotationInput, setRotationInput] = useState("0");
  const [scaleInput, setScaleInput] = useState("100");
  const [hasChanges, setHasChanges] = useState(false);
  const [isAnimatingReset, setIsAnimatingReset] = useState(false);
  const [isAnimatingAuto, setIsAnimatingAuto] = useState(false);
  const [cropPreset, setCropPreset] = useState<CropPreset>('original');
  const [showGuides, setShowGuides] = useState(true);
  
  // History stack for undo functionality
  const [historyStack, setHistoryStack] = useState<EditorHistoryState[]>([]);
  
  // Track if we're currently in an interaction (slider drag, etc.)
  const isInteractingRef = useRef(false);
  const interactionTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pendingHistoryStateRef = useRef<EditorHistoryState | null>(null);
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const guidesCanvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number | null>(null);
  const resetAnimationRef = useRef<number | null>(null);
  const autoAnimationRef = useRef<number | null>(null);
  const { toast } = useToast();
  const { buttonBgColor, buttonTextColor, buttonBorderStyle } = useTheme();
  const isMobile = useIsMobile();
  
  const buttonRadius = buttonBorderStyle === 'rounded' ? 'rounded-full' : 'rounded-md';
  
  const rotationStep = isMobile ? 0.5 : 0.1;
  const offsetStep = isMobile ? 1 : 0.5;

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

  // Bipolar mapping: slider position (-100 to +100) to scale (60% to 160%)
  const sliderPosToScale = useCallback((pos: number): number => {
    if (pos <= 0) {
      // -100 → 60%, 0 → 100%
      return 100 + (pos / 100) * 40;
    } else {
      // 0 → 100%, +100 → 160%
      return 100 + (pos / 100) * 60;
    }
  }, []);

  // Bipolar mapping: scale (60% to 160%) to slider position (-100 to +100)
  const scaleToSliderPos = useCallback((s: number): number => {
    if (s <= 100) {
      // 60% → -100, 100% → 0
      return ((s - 100) / 40) * 100;
    } else {
      // 100% → 0, 160% → +100
      return ((s - 100) / 60) * 100;
    }
  }, []);

  // Calculate crop dimensions based on preset
  const getCropDimensions = useCallback((imgWidth: number, imgHeight: number, preset: CropPreset) => {
    const config = cropPresets[preset];
    if (!config.ratio) {
      return { width: imgWidth, height: imgHeight, offsetX: 0, offsetY: 0 };
    }
    
    const imgRatio = imgWidth / imgHeight;
    const targetRatio = config.ratio;
    
    let cropWidth: number;
    let cropHeight: number;
    
    if (imgRatio > targetRatio) {
      // Image is wider than target - fit by height
      cropHeight = imgHeight;
      cropWidth = cropHeight * targetRatio;
    } else {
      // Image is taller than target - fit by width
      cropWidth = imgWidth;
      cropHeight = cropWidth / targetRatio;
    }
    
    return {
      width: cropWidth,
      height: cropHeight,
      offsetX: (imgWidth - cropWidth) / 2,
      offsetY: (imgHeight - cropHeight) / 2
    };
  }, []);

  // Draw safe area guides - Rule of Thirds (3x3 grid) + Frame (Lightroom style)
  const drawGuides = useCallback((canvasWidth: number, canvasHeight: number) => {
    const guidesCanvas = guidesCanvasRef.current;
    if (!guidesCanvas || !showGuides) return;
    
    guidesCanvas.width = canvasWidth;
    guidesCanvas.height = canvasHeight;
    
    const ctx = guidesCanvas.getContext('2d');
    if (!ctx) return;
    
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);
    
    // Helper function to draw line with shadow for contrast on any background
    const drawLineWithShadow = (x1: number, y1: number, x2: number, y2: number) => {
      // Shadow (dark) for contrast on light backgrounds
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.35)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x1 + 0.5, y1 + 0.5);
      ctx.lineTo(x2 + 0.5, y2 + 0.5);
      ctx.stroke();
      
      // Main line (white) for contrast on dark backgrounds
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.75)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    };
    
    // Frame (outer border) - with shadow for visibility
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.4)';
    ctx.lineWidth = 2;
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.rect(1, 1, canvasWidth - 2, canvasHeight - 2);
    ctx.stroke();
    
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.rect(0.5, 0.5, canvasWidth - 1, canvasHeight - 1);
    ctx.stroke();
    
    // Calculate 1/3 and 2/3 positions
    const oneThirdX = Math.round(canvasWidth / 3);
    const twoThirdsX = Math.round((canvasWidth * 2) / 3);
    const oneThirdY = Math.round(canvasHeight / 3);
    const twoThirdsY = Math.round((canvasHeight * 2) / 3);
    
    // Rule of Thirds grid lines - 2 vertical + 2 horizontal (with shadow)
    drawLineWithShadow(oneThirdX, 0, oneThirdX, canvasHeight);
    drawLineWithShadow(twoThirdsX, 0, twoThirdsX, canvasHeight);
    drawLineWithShadow(0, oneThirdY, canvasWidth, oneThirdY);
    drawLineWithShadow(0, twoThirdsY, canvasWidth, twoThirdsY);
  }, [showGuides]);

  // Capture state BEFORE an interaction begins (called once at start of interaction)
  const captureStateBeforeInteraction = useCallback(() => {
    // Only capture if we're not already in an interaction
    if (!isInteractingRef.current) {
      isInteractingRef.current = true;
      pendingHistoryStateRef.current = {
        adjustments: { ...adjustments },
        rotation,
        offsetX,
        scale,
        cropPreset,
      };
    }
    
    // Clear any existing timeout
    if (interactionTimeoutRef.current) {
      clearTimeout(interactionTimeoutRef.current);
    }
    
    // Set a timeout to commit the state after interaction ends
    interactionTimeoutRef.current = setTimeout(() => {
      if (pendingHistoryStateRef.current) {
        setHistoryStack(prev => {
          const newStack = [...prev, pendingHistoryStateRef.current!];
          // Limit stack size
          if (newStack.length > MAX_HISTORY_SIZE) {
            return newStack.slice(-MAX_HISTORY_SIZE);
          }
          return newStack;
        });
        pendingHistoryStateRef.current = null;
      }
      isInteractingRef.current = false;
      interactionTimeoutRef.current = null;
    }, 300); // 300ms debounce - commits after user stops interacting
  }, [adjustments, rotation, offsetX, scale, cropPreset]);

  // Immediate push for discrete actions (button clicks, etc.)
  const pushToHistoryImmediate = useCallback(() => {
    const currentState: EditorHistoryState = {
      adjustments: { ...adjustments },
      rotation,
      offsetX,
      scale,
      cropPreset,
    };
    
    setHistoryStack(prev => {
      const newStack = [...prev, currentState];
      // Limit stack size
      if (newStack.length > MAX_HISTORY_SIZE) {
        return newStack.slice(-MAX_HISTORY_SIZE);
      }
      return newStack;
    });
  }, [adjustments, rotation, offsetX, scale, cropPreset]);

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
  const drawImage = useCallback((img: HTMLImageElement, currentAdjustments?: ImageAdjustments) => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    
    animationFrameRef.current = requestAnimationFrame(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Calculate crop dimensions
      const crop = getCropDimensions(img.width, img.height, cropPreset);
      
      canvas.width = crop.width;
      canvas.height = crop.height;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const offsetPixels = (offsetX / 100) * canvas.width;
      const scaleFactor = scale / 100;
      const adj = currentAdjustments || adjustments;
      const hasAdjustments = Object.values(adj).some(v => v !== 0);

      // Create source image data from original image
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = img.width;
      tempCanvas.height = img.height;
      const tempCtx = tempCanvas.getContext('2d');
      if (!tempCtx) return;
      tempCtx.drawImage(img, 0, 0);
      const sourceData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);

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
      ctx.translate(-img.width / 2, -img.height / 2);
      ctx.drawImage(adjustedCanvas, 0, 0);
      ctx.restore();
      
      // Draw guides
      drawGuides(canvas.width, canvas.height);
    });
  }, [rotation, offsetX, scale, adjustments, cropPreset, getCropDimensions, drawGuides]);

  const handleRotationChange = useCallback((value: number) => {
    if (isAnimatingReset) return;
    
    captureStateBeforeInteraction();
    
    const clampedValue = Math.max(-180, Math.min(180, value));
    setRotation(clampedValue);
    setRotationInput(clampedValue.toFixed(1));
    setHasChanges(true);
  }, [isAnimatingReset, captureStateBeforeInteraction]);

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
    
    captureStateBeforeInteraction();
    
    const visibility = calculateVisibilityFactor(scale, value);
    const clampMultiplier = getSoftClampMultiplier(visibility);
    
    const delta = value - offsetX;
    const softDelta = delta * clampMultiplier;
    const newValue = offsetX + softDelta;
    
    const clampedValue = Math.max(-30, Math.min(30, newValue));
    setOffsetX(clampedValue);
    setHasChanges(true);
  }, [offsetX, scale, isAnimatingReset, calculateVisibilityFactor, getSoftClampMultiplier, captureStateBeforeInteraction]);

  // Handler for bipolar scale slider
  const handleScaleSliderChange = useCallback((pos: number) => {
    if (isAnimatingReset) return;
    
    captureStateBeforeInteraction();
    
    const targetScale = sliderPosToScale(pos);
    const visibility = calculateVisibilityFactor(targetScale, offsetX);
    const clampMultiplier = getSoftClampMultiplier(visibility);
    
    const delta = targetScale - scale;
    const softDelta = delta * clampMultiplier;
    const newScale = Math.max(60, Math.min(160, scale + softDelta));
    
    setScale(newScale);
    setScaleSliderPos(scaleToSliderPos(newScale));
    setScaleInput(Math.round(newScale).toString());
    setHasChanges(true);
  }, [scale, offsetX, isAnimatingReset, calculateVisibilityFactor, getSoftClampMultiplier, sliderPosToScale, scaleToSliderPos, captureStateBeforeInteraction]);

  const handleScaleInputChange = (inputValue: string) => {
    setScaleInput(inputValue);
    const numValue = parseInt(inputValue, 10);
    if (!isNaN(numValue)) {
      const clampedValue = Math.max(60, Math.min(160, numValue));
      setScale(clampedValue);
      setScaleSliderPos(scaleToSliderPos(clampedValue));
      setHasChanges(true);
    }
  };

  const handleScaleInputBlur = () => {
    setScaleInput(Math.round(scale).toString());
  };

  // Handle crop preset change with auto-adjustment
  const handleCropPresetChange = useCallback((preset: CropPreset) => {
    if (cropPreset === preset) return;
    
    pushToHistoryImmediate();
    setCropPreset(preset);
    setHasChanges(true);
    
    toast({
      title: `Corte ${cropPresets[preset].label}`,
      description: cropPresets[preset].description,
    });
  }, [cropPreset, pushToHistoryImmediate, toast]);

  // Animated reset with ease-out (includes adjustments) - clears history
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
        sharpness: Math.round(startAdjustments.sharpness * (1 - easeOut)),
      };
      
      setRotation(newRotation);
      setRotationInput(newRotation.toFixed(1));
      setOffsetX(newOffsetX);
      setScale(newScale);
      setScaleSliderPos(scaleToSliderPos(newScale));
      setScaleInput(Math.round(newScale).toString());
      setAdjustments(newAdjustments);
      
      if (progress < 1) {
        resetAnimationRef.current = requestAnimationFrame(animate);
      } else {
        setRotation(0);
        setRotationInput("0");
        setOffsetX(0);
        setScale(100);
        setScaleSliderPos(0);
        setScaleInput("100");
        setAdjustments(defaultAdjustments);
        setCropPreset('original');
        setHasChanges(false);
        setHistoryStack([]); // Clear history on reset
        setIsAnimatingReset(false);
        resetAnimationRef.current = null;
        
        if (originalImage) {
          drawImage(originalImage);
        }
      }
    };
    
    resetAnimationRef.current = requestAnimationFrame(animate);
  }, [rotation, offsetX, scale, adjustments, isAnimatingReset, originalImage, drawImage, scaleToSliderPos]);

  // Auto button: analyze image and set optimal adjustments
  const handleAutoAdjust = useCallback(() => {
    if (isAnimatingAuto || !originalImage) return;

    // Push current state to history before auto adjustment
    pushToHistoryImmediate();

    // Get source image data
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = originalImage.width;
    tempCanvas.height = originalImage.height;
    const tempCtx = tempCanvas.getContext('2d');
    if (!tempCtx) return;
    tempCtx.drawImage(originalImage, 0, 0);
    const sourceData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);

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
        sharpness: Math.round(startAdjustments.sharpness + (targetAdjustments.sharpness - startAdjustments.sharpness) * easeOut),
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
  }, [originalImage, adjustments, isAnimatingAuto, toast, pushToHistoryImmediate]);

  const handleAdjustmentChange = (key: keyof ImageAdjustments, value: number) => {
    captureStateBeforeInteraction();
    setAdjustments((prev) => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };

  // Undo last action from history stack
  const handleUndo = useCallback(() => {
    if (historyStack.length === 0) return;
    
    const newStack = [...historyStack];
    const previousState = newStack.pop();
    
    if (previousState) {
      setAdjustments(previousState.adjustments);
      setRotation(previousState.rotation);
      setRotationInput(previousState.rotation.toFixed(1));
      setOffsetX(previousState.offsetX);
      setScale(previousState.scale);
      setScaleSliderPos(scaleToSliderPos(previousState.scale));
      setScaleInput(Math.round(previousState.scale).toString());
      setCropPreset(previousState.cropPreset);
      
      setHistoryStack(newStack);
      
      // Update hasChanges based on whether there are still items in history
      setHasChanges(newStack.length > 0);
      
      // Redraw the image with restored state
      if (originalImage) {
        drawImage(originalImage, previousState.adjustments);
      }
    }
  }, [historyStack, originalImage, drawImage, scaleToSliderPos]);

  // Apply settings to other product images
  const handleApplyToOthers = useCallback(() => {
    if (!onApplyToOthers) {
      toast({
        title: "Indisponível",
        description: "Não há outras imagens do produto para aplicar os ajustes",
        variant: "destructive",
      });
      return;
    }
    
    const settings: EditorSettings = {
      adjustments: { ...adjustments },
      rotation,
      offsetX,
      scale,
      cropPreset,
    };
    
    onApplyToOthers(settings);
    
    toast({
      title: "Ajustes aplicados",
      description: `Configurações aplicadas às outras ${otherProductImages.length} imagens do produto`,
    });
  }, [adjustments, rotation, offsetX, scale, cropPreset, onApplyToOthers, otherProductImages.length, toast]);

  // Share image using native Web Share API
  const handleShare = useCallback(async () => {
    if (!canvasRef.current || !originalImage) return;
    
    setIsProcessing(true);
    setProcessingStep('Preparando imagem para compartilhar...');
    setProcessingProgress(30);
    
    try {
      // Render final image
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas context not available');
      
      // Get crop dimensions
      const crop = getCropDimensions(originalImage.width, originalImage.height, cropPreset);
      canvas.width = crop.width;
      canvas.height = crop.height;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      const offsetPixels = (offsetX / 100) * canvas.width;
      const scaleFactor = scale / 100;
      
      // Get source data and apply adjustments
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = originalImage.width;
      tempCanvas.height = originalImage.height;
      const tempCtx = tempCanvas.getContext('2d');
      if (tempCtx) {
        tempCtx.drawImage(originalImage, 0, 0);
        const sourceData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
        
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
          ctx.translate(-originalImage.width / 2, -originalImage.height / 2);
          ctx.drawImage(adjustedCanvas, 0, 0);
          ctx.restore();
        }
      }
      
      setProcessingProgress(60);
      
      // Convert to blob
      const blob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob(resolve, 'image/png', 1.0);
      });
      
      if (!blob) throw new Error('Failed to create image blob');
      
      setProcessingProgress(80);
      
      // Check if Web Share API is available and supports files
      if (navigator.share && navigator.canShare) {
        const file = new File([blob], 'produto-editado.png', { type: 'image/png' });
        const shareData = {
          files: [file],
          title: 'Imagem do Produto',
        };
        
        if (navigator.canShare(shareData)) {
          await navigator.share(shareData);
          toast({
            title: "Compartilhado!",
            description: "Imagem compartilhada com sucesso",
          });
        } else {
          // Fallback: download
          downloadImage(blob);
        }
      } else {
        // Fallback: download
        downloadImage(blob);
      }
      
      setProcessingProgress(100);
    } catch (error: any) {
      if (error.name !== 'AbortError') {
        console.error('Error sharing image:', error);
        toast({
          title: "Erro ao compartilhar",
          description: "Use o botão Salvar para baixar a imagem",
          variant: "destructive",
        });
      }
    } finally {
      setIsProcessing(false);
      setProcessingStep('');
    }
  }, [canvasRef, originalImage, adjustments, rotation, offsetX, scale, cropPreset, getCropDimensions, toast]);
  
  const downloadImage = (blob: Blob) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'produto-editado.png';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    toast({
      title: "Download iniciado",
      description: "A imagem foi baixada para seu dispositivo",
    });
  };

  const handleSave = async () => {
    if (!canvasRef.current || !originalImage) return;

    setIsProcessing(true);
    setProcessingStep('Salvando imagem...');
    setProcessingProgress(50);

    try {
      // Synchronous final render
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        // Get crop dimensions
        const crop = getCropDimensions(originalImage.width, originalImage.height, cropPreset);
        canvas.width = crop.width;
        canvas.height = crop.height;
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
            ctx.translate(-originalImage.width / 2, -originalImage.height / 2);
            ctx.drawImage(adjustedCanvas, 0, 0);
            ctx.restore();
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
    if (originalImage) {
      drawImage(originalImage, adjustments);
    }
  }, [rotation, offsetX, scale, adjustments, originalImage, drawImage, cropPreset]);

  useEffect(() => {
    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      if (resetAnimationRef.current) cancelAnimationFrame(resetAnimationRef.current);
      if (autoAnimationRef.current) cancelAnimationFrame(autoAnimationRef.current);
      if (interactionTimeoutRef.current) clearTimeout(interactionTimeoutRef.current);
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
              {/* Crop Presets */}
              <div className="px-4 py-2 border-b flex items-center gap-2 flex-wrap">
                <span className="text-xs font-medium flex items-center gap-1 text-muted-foreground">
                  <Crop className="h-3 w-3" />
                  Corte:
                </span>
                {(Object.keys(cropPresets) as CropPreset[]).map((preset) => (
                  <Button
                    key={preset}
                    variant={cropPreset === preset ? "default" : "outline"}
                    size="sm"
                    onClick={() => handleCropPresetChange(preset)}
                    className={`text-xs px-3 h-7 ${buttonRadius}`}
                    style={cropPreset === preset ? { backgroundColor: buttonBgColor, color: buttonTextColor } : { borderColor: buttonBgColor, color: buttonBgColor }}
                  >
                    {cropPresets[preset].label}
                  </Button>
                ))}
              </div>
              
              {/* Preview Area */}
              <div className="flex-1 flex items-center justify-center p-4 bg-muted/30 overflow-auto relative">
                {/* Grid Toggle Button - overlaid on preview area */}
                <button
                  onClick={() => setShowGuides(!showGuides)}
                  className="absolute top-6 right-6 z-10 px-2 py-1 text-[10px] font-medium rounded shadow-md transition-all hover:scale-105"
                  style={{
                    backgroundColor: showGuides ? buttonBgColor : 'rgba(0, 0, 0, 0.6)',
                    color: showGuides ? buttonTextColor : 'white',
                    border: `1px solid ${showGuides ? buttonBgColor : 'rgba(255, 255, 255, 0.3)'}`,
                  }}
                >
                  Grade: {showGuides ? 'ON' : 'OFF'}
                </button>
                
                <div className="relative">
                  <canvas
                    ref={canvasRef}
                    className="max-w-full max-h-full object-contain border rounded shadow-sm"
                    style={{ maxHeight: '400px' }}
                  />
                  {/* Guides overlay canvas */}
                  {showGuides && (
                    <canvas
                      ref={guidesCanvasRef}
                      className="absolute inset-0 pointer-events-none"
                      style={{ maxHeight: '400px' }}
                    />
                  )}
                </div>
              </div>

              {/* Transform Controls */}
              <div className="px-4 py-3 border-t space-y-3 flex-shrink-0">
                {/* Rotation Control */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-medium flex items-center gap-1">
                      <RotateCw className="h-3 w-3" />
                      Rotação (°)
                    </label>
                    <div className="flex items-center gap-1">
                      <Input
                        type="text"
                        value={rotationInput}
                        onChange={(e) => handleRotationInputChange(e.target.value)}
                        onBlur={handleRotationInputBlur}
                        className="w-16 h-7 text-xs text-center"
                      />
                      <span className="text-xs text-muted-foreground">°</span>
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
                  <div className="flex justify-between gap-2">
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
                      size="icon"
                      onClick={handleRotateLeft}
                      className={`h-8 w-8 ${buttonRadius}`}
                      style={{ borderColor: buttonBgColor, color: buttonBgColor }}
                    >
                      <RotateCcw className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={handleRotateRight}
                      className={`h-8 w-8 ${buttonRadius}`}
                      style={{ borderColor: buttonBgColor, color: buttonBgColor }}
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

                {/* Zoom/Scale Control - centered at 100% */}
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
                    value={[scaleSliderPos]}
                    onValueChange={([pos]) => handleScaleSliderChange(pos)}
                    min={-100}
                    max={100}
                    step={1}
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

                {/* Reset Button - Red visual style for destructive action */}
                <div className="flex justify-center">
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={handleResetTransform}
                    className={buttonRadius}
                  >
                    <RefreshCw className="h-4 w-4 mr-1" />
                    Resetar
                  </Button>
                </div>
              </div>
            </div>

            {/* Side Panel - Adjustments Only */}
            <div className="w-72 border-l flex flex-col overflow-hidden bg-background flex-shrink-0">
              <div className="flex-1 overflow-y-auto p-4">
                <div className="space-y-4">
                  <h3 className="text-sm font-medium">Ajustes</h3>
                  
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
                      { key: 'exposure', label: 'Exposição', icon: Sun, min: -100, max: 100 },
                      { key: 'contrast', label: 'Contraste', icon: Contrast, min: -100, max: 100 },
                      { key: 'highlights', label: 'Realces', icon: Sparkles, min: -100, max: 100 },
                      { key: 'shadows', label: 'Sombras', icon: Cloud, min: -100, max: 100 },
                      { key: 'whites', label: 'Brancos', icon: CircleDot, min: -100, max: 100 },
                      { key: 'blacks', label: 'Pretos', icon: Square, min: -100, max: 100 },
                      { key: 'sharpness', label: 'Nitidez', icon: Focus, min: 0, max: 30 },
                    ].map(({ key, label, icon: Icon, min, max }) => (
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
                          min={min}
                          max={max}
                          step={1}
                          className="w-full"
                        />
                      </div>
                    ))}
                  </div>
                  
                  {/* Apply to other images */}
                  {otherProductImages.length > 0 && onApplyToOthers && (
                    <div className="border-t pt-4">
                      <Button
                        onClick={handleApplyToOthers}
                        variant="outline"
                        className={`w-full ${buttonRadius}`}
                        style={{ borderColor: buttonBgColor, color: buttonBgColor }}
                      >
                        <Copy className="h-4 w-4 mr-2" />
                        Aplicar às outras imagens
                      </Button>
                      <p className="text-[10px] text-muted-foreground text-center leading-tight mt-2">
                        Aplica estes ajustes às outras {otherProductImages.length} imagens do produto.
                      </p>
                    </div>
                  )}
                </div>
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
                  onClick={handleShare}
                  disabled={isProcessing || !originalImage}
                  className={`w-full ${buttonRadius}`}
                  style={{ borderColor: buttonBgColor, color: buttonBgColor }}
                >
                  <Share2 className="h-4 w-4 mr-2" />
                  Compartilhar imagem
                </Button>
                <Button
                  variant="outline"
                  onClick={handleUndo}
                  disabled={isProcessing || historyStack.length === 0}
                  className={`w-full ${buttonRadius}`}
                  style={{ borderColor: buttonBgColor, color: buttonBgColor }}
                >
                  <Undo2 className="h-4 w-4 mr-2" />
                  Desfazer última alteração
                </Button>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
