import type { EditorSettings, ImageAdjustments } from "@/components/ImageEditor";

type ExportResult = { blob: Blob; width: number; height: number };

const cropPresetRatio = (preset: EditorSettings["cropPreset"]): number | null => {
  switch (preset) {
    case "1:1":
      return 1;
    case "4:5":
      return 4 / 5;
    case "16:9":
      return 16 / 9;
    case "original":
    default:
      return null;
  }
};

const getCropDimensions = (imgWidth: number, imgHeight: number, preset: EditorSettings["cropPreset"]) => {
  const ratio = cropPresetRatio(preset);
  if (!ratio) return { width: imgWidth, height: imgHeight };

  const imgRatio = imgWidth / imgHeight;
  if (imgRatio > ratio) {
    return { width: Math.round(imgHeight * ratio), height: imgHeight };
  }
  return { width: imgWidth, height: Math.round(imgWidth / ratio) };
};

// Helper: apply sharpness using unsharp mask technique (same mapping as editor)
const applySharpness = (imageData: ImageData, amount: number): ImageData => {
  if (amount === 0) return imageData;

  const data = imageData.data;
  const width = imageData.width;
  const height = imageData.height;
  const result = new ImageData(new Uint8ClampedArray(data), width, height);
  const resultData = result.data;

  const strength = (amount / 30) * 0.6;

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = (y * width + x) * 4;

      const idxUp = ((y - 1) * width + x) * 4;
      const idxDown = ((y + 1) * width + x) * 4;
      const idxLeft = (y * width + (x - 1)) * 4;
      const idxRight = (y * width + (x + 1)) * 4;

      for (let c = 0; c < 3; c++) {
        const center = data[idx + c];
        const blur = (data[idxUp + c] + data[idxDown + c] + data[idxLeft + c] + data[idxRight + c]) / 4;
        const detail = center - blur;
        resultData[idx + c] = Math.max(0, Math.min(255, center + detail * strength));
      }
      resultData[idx + 3] = data[idx + 3];
    }
  }

  return result;
};

// Helper: apply tonal adjustments to ImageData (same as editor)
const applyAdjustmentsToImageData = (imageData: ImageData, adjustments: ImageAdjustments): ImageData => {
  const data = imageData.data;
  const result = new ImageData(new Uint8ClampedArray(data), imageData.width, imageData.height);
  const resultData = result.data;

  for (let i = 0; i < data.length; i += 4) {
    let r = data[i];
    let g = data[i + 1];
    let b = data[i + 2];
    const a = data[i + 3];

    if (a === 0) {
      resultData[i] = r;
      resultData[i + 1] = g;
      resultData[i + 2] = b;
      resultData[i + 3] = a;
      continue;
    }

    const exposureFactor = Math.pow(2, adjustments.exposure / 100);
    r *= exposureFactor;
    g *= exposureFactor;
    b *= exposureFactor;

    const contrastFactor = (100 + adjustments.contrast) / 100;
    r = ((r / 255 - 0.5) * contrastFactor + 0.5) * 255;
    g = ((g / 255 - 0.5) * contrastFactor + 0.5) * 255;
    b = ((b / 255 - 0.5) * contrastFactor + 0.5) * 255;

    const luminance = r * 0.299 + g * 0.587 + b * 0.114;

    if (luminance > 153) {
      const highlightMask = Math.pow((luminance - 153) / 102, 0.5);
      const highlightEffect = highlightMask * (adjustments.highlights / 100) * 60;
      r += highlightEffect;
      g += highlightEffect;
      b += highlightEffect;
    }

    if (luminance < 102) {
      const shadowMask = Math.pow((102 - luminance) / 102, 0.5);
      const shadowEffect = shadowMask * (adjustments.shadows / 100) * 60;
      r += shadowEffect;
      g += shadowEffect;
      b += shadowEffect;
    }

    if (luminance > 200) {
      const whiteMask = (luminance - 200) / 55;
      const whiteEffect = whiteMask * (adjustments.whites / 100) * 40;
      r += whiteEffect;
      g += whiteEffect;
      b += whiteEffect;
    }

    if (luminance < 55) {
      const blackMask = (55 - luminance) / 55;
      const blackEffect = blackMask * (adjustments.blacks / 100) * 40;
      r -= blackEffect;
      g -= blackEffect;
      b -= blackEffect;
    }

    resultData[i] = Math.max(0, Math.min(255, r));
    resultData[i + 1] = Math.max(0, Math.min(255, g));
    resultData[i + 2] = Math.max(0, Math.min(255, b));
    resultData[i + 3] = a;
  }

  if (adjustments.sharpness > 0) {
    return applySharpness(result, adjustments.sharpness);
  }

  return result;
};

const loadImageFromUrlViaBlob = async (url: string): Promise<HTMLImageElement> => {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Falha ao carregar imagem (${res.status})`);
  const blob = await res.blob();
  const objectUrl = URL.createObjectURL(blob);

  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error("Falha ao decodificar a imagem"));
      i.src = objectUrl;
    });
    return img;
  } finally {
    try {
      URL.revokeObjectURL(objectUrl);
    } catch {
      // ignore
    }
  }
};

/**
 * Renderiza uma imagem URL aplicando cropPreset + transforms + ajustes,
 * e exporta JPEG padronizado (qualidade 0.85, max width 1800, fundo branco).
 */
export async function exportEditedProductImageJpeg(
  sourceUrl: string,
  settings: EditorSettings,
  opts?: { maxWidth?: number; quality?: number }
): Promise<ExportResult> {
  const MAX_WIDTH = opts?.maxWidth ?? 1800;
  const JPEG_QUALITY = opts?.quality ?? 0.85;

  const img = await loadImageFromUrlViaBlob(sourceUrl);
  const crop = getCropDimensions(img.width, img.height, settings.cropPreset);

  const tempCanvas = document.createElement("canvas");
  tempCanvas.width = img.width;
  tempCanvas.height = img.height;
  const tempCtx = tempCanvas.getContext("2d");
  if (!tempCtx) throw new Error("Falha ao preparar processamento da imagem");
  tempCtx.drawImage(img, 0, 0);
  const sourceData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);

  const hasAdj = Object.values(settings.adjustments).some((v) => v !== 0);
  const adjustedData = hasAdj ? applyAdjustmentsToImageData(sourceData, settings.adjustments) : sourceData;

  const adjustedCanvas = document.createElement("canvas");
  adjustedCanvas.width = adjustedData.width;
  adjustedCanvas.height = adjustedData.height;
  const adjustedCtx = adjustedCanvas.getContext("2d");
  if (!adjustedCtx) throw new Error("Falha ao aplicar ajustes na imagem");
  adjustedCtx.putImageData(adjustedData, 0, 0);

  const baseCanvas = document.createElement("canvas");
  baseCanvas.width = crop.width;
  baseCanvas.height = crop.height;
  const baseCtx = baseCanvas.getContext("2d");
  if (!baseCtx) throw new Error("Falha ao renderizar a imagem");

  baseCtx.fillStyle = "#ffffff";
  baseCtx.fillRect(0, 0, baseCanvas.width, baseCanvas.height);

  const offsetPixels = (settings.offsetX / 100) * baseCanvas.width;
  const scaleFactor = settings.scale / 100;

  baseCtx.save();
  baseCtx.translate(baseCanvas.width / 2 + offsetPixels, baseCanvas.height / 2);
  baseCtx.rotate((settings.rotation * Math.PI) / 180);
  baseCtx.scale(scaleFactor, scaleFactor);
  baseCtx.translate(-img.width / 2, -img.height / 2);
  baseCtx.drawImage(adjustedCanvas, 0, 0);
  baseCtx.restore();

  const scaleDown = baseCanvas.width > MAX_WIDTH ? MAX_WIDTH / baseCanvas.width : 1;
  const outCanvas = document.createElement("canvas");
  outCanvas.width = Math.max(1, Math.round(baseCanvas.width * scaleDown));
  outCanvas.height = Math.max(1, Math.round(baseCanvas.height * scaleDown));
  const outCtx = outCanvas.getContext("2d");
  if (!outCtx) throw new Error("Falha ao preparar exportação da imagem");

  outCtx.fillStyle = "#ffffff";
  outCtx.fillRect(0, 0, outCanvas.width, outCanvas.height);
  outCtx.drawImage(baseCanvas, 0, 0, outCanvas.width, outCanvas.height);

  const blob = await new Promise<Blob>((resolve, reject) => {
    outCanvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Falha ao gerar o arquivo da imagem"))),
      "image/jpeg",
      JPEG_QUALITY
    );
  });

  return { blob, width: outCanvas.width, height: outCanvas.height };
}
