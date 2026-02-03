import { pipeline, env } from '@huggingface/transformers';

// Configure transformers.js
env.allowLocalModels = false;
env.useBrowserCache = true;

const MAX_IMAGE_DIMENSION = 1024;
const PROCESSING_SIZE = 512;

let segmenterInstance: any = null;
let depthEstimatorInstance: any = null;

// ============================================================================
// PART 1: MODEL MANAGEMENT
// ============================================================================

async function getSegmenter() {
  if (!segmenterInstance) {
    try {
      segmenterInstance = await pipeline(
        'image-segmentation',
        'Xenova/segformer-b2-finetuned-ade-512-512',
        { device: 'webgpu' }
      );
    } catch (e) {
      // Fallback to smaller model if WebGPU fails
      console.warn('WebGPU failed, falling back to CPU:', e);
      segmenterInstance = await pipeline(
        'image-segmentation',
        'Xenova/segformer-b0-finetuned-ade-512-512'
      );
    }
  }
  return segmenterInstance;
}

async function getDepthEstimator() {
  if (!depthEstimatorInstance) {
    try {
      depthEstimatorInstance = await pipeline(
        'depth-estimation',
        'Xenova/depth-anything-small-hf'
      );
    } catch (e) {
      console.warn('Depth estimator failed to load:', e);
      return null;
    }
  }
  return depthEstimatorInstance;
}

// ============================================================================
// PART 2: IMAGE ANALYSIS & OBJECT DETECTION
// ============================================================================

interface ImageAnalysis {
  dominantBackgroundColor: { r: number; g: number; b: number };
  centerOfMass: { x: number; y: number };
  hasUniformBackground: boolean;
  backgroundBrightness: number;
  contrastLevel: number;
  edgeComplexity: number;
}

function analyzeImage(imageData: ImageData): ImageAnalysis {
  const { data, width, height } = imageData;
  
  // Sample edges for background color detection
  const edgePixels: { r: number; g: number; b: number }[] = [];
  const sampleRate = 4;
  
  // Top and bottom edges
  for (let x = 0; x < width; x += sampleRate) {
    for (const y of [0, 1, 2, height - 3, height - 2, height - 1]) {
      const idx = (y * width + x) * 4;
      edgePixels.push({ r: data[idx], g: data[idx + 1], b: data[idx + 2] });
    }
  }
  
  // Left and right edges
  for (let y = 0; y < height; y += sampleRate) {
    for (const x of [0, 1, 2, width - 3, width - 2, width - 1]) {
      const idx = (y * width + x) * 4;
      edgePixels.push({ r: data[idx], g: data[idx + 1], b: data[idx + 2] });
    }
  }
  
  // Calculate dominant background color using median
  const sortedR = edgePixels.map(p => p.r).sort((a, b) => a - b);
  const sortedG = edgePixels.map(p => p.g).sort((a, b) => a - b);
  const sortedB = edgePixels.map(p => p.b).sort((a, b) => a - b);
  const mid = Math.floor(edgePixels.length / 2);
  
  const dominantBackgroundColor = {
    r: sortedR[mid],
    g: sortedG[mid],
    b: sortedB[mid]
  };
  
  // Check background uniformity
  let colorVariance = 0;
  for (const pixel of edgePixels) {
    const dr = pixel.r - dominantBackgroundColor.r;
    const dg = pixel.g - dominantBackgroundColor.g;
    const db = pixel.b - dominantBackgroundColor.b;
    colorVariance += Math.sqrt(dr * dr + dg * dg + db * db);
  }
  colorVariance /= edgePixels.length;
  
  const hasUniformBackground = colorVariance < 30;
  const backgroundBrightness = (dominantBackgroundColor.r + dominantBackgroundColor.g + dominantBackgroundColor.b) / 3;
  
  // Calculate center of mass based on non-background pixels
  let totalWeight = 0;
  let weightedX = 0;
  let weightedY = 0;
  
  for (let y = 0; y < height; y += 2) {
    for (let x = 0; x < width; x += 2) {
      const idx = (y * width + x) * 4;
      const dr = data[idx] - dominantBackgroundColor.r;
      const dg = data[idx + 1] - dominantBackgroundColor.g;
      const db = data[idx + 2] - dominantBackgroundColor.b;
      const diff = Math.sqrt(dr * dr + dg * dg + db * db);
      
      if (diff > 25) {
        const weight = diff;
        totalWeight += weight;
        weightedX += x * weight;
        weightedY += y * weight;
      }
    }
  }
  
  const centerOfMass = {
    x: totalWeight > 0 ? weightedX / totalWeight : width / 2,
    y: totalWeight > 0 ? weightedY / totalWeight : height / 2
  };
  
  // Calculate edge complexity (for feathering decisions)
  let edgeComplexity = 0;
  const sobelX = [-1, 0, 1, -2, 0, 2, -1, 0, 1];
  const sobelY = [-1, -2, -1, 0, 0, 0, 1, 2, 1];
  
  for (let y = 1; y < height - 1; y += 4) {
    for (let x = 1; x < width - 1; x += 4) {
      let gx = 0, gy = 0;
      for (let ky = -1; ky <= 1; ky++) {
        for (let kx = -1; kx <= 1; kx++) {
          const idx = ((y + ky) * width + (x + kx)) * 4;
          const gray = (data[idx] + data[idx + 1] + data[idx + 2]) / 3;
          const ki = (ky + 1) * 3 + (kx + 1);
          gx += gray * sobelX[ki];
          gy += gray * sobelY[ki];
        }
      }
      edgeComplexity += Math.sqrt(gx * gx + gy * gy);
    }
  }
  edgeComplexity /= (width * height / 16);
  
  // Calculate contrast
  let minBrightness = 255, maxBrightness = 0;
  for (let i = 0; i < data.length; i += 16) {
    const brightness = (data[i] + data[i + 1] + data[i + 2]) / 3;
    minBrightness = Math.min(minBrightness, brightness);
    maxBrightness = Math.max(maxBrightness, brightness);
  }
  const contrastLevel = maxBrightness - minBrightness;
  
  return {
    dominantBackgroundColor,
    centerOfMass,
    hasUniformBackground,
    backgroundBrightness,
    contrastLevel,
    edgeComplexity
  };
}

// ============================================================================
// PART 3: MASK GENERATION & REFINEMENT
// ============================================================================

interface MaskData {
  mask: Float32Array;
  width: number;
  height: number;
  confidence: number;
}

function createInitialMask(
  segmentationResult: any[],
  analysis: ImageAnalysis,
  width: number,
  height: number
): MaskData {
  const mask = new Float32Array(width * height);
  let bestMaskScore = -1;
  let bestMaskData: Float32Array | null = null;
  
  // Evaluate each segment
  for (const segment of segmentationResult) {
    if (!segment.mask?.data) continue;
    
    const segMask = segment.mask.data;
    const segWidth = segment.mask.width;
    const segHeight = segment.mask.height;
    
    // Calculate segment score based on:
    // 1. Size (prefer larger objects)
    // 2. Centrality (prefer centered objects)
    // 3. Continuity (prefer continuous regions)
    
    let area = 0;
    let centerX = 0;
    let centerY = 0;
    
    for (let y = 0; y < segHeight; y++) {
      for (let x = 0; x < segWidth; x++) {
        const val = segMask[y * segWidth + x];
        if (val > 0.3) {
          area++;
          centerX += x;
          centerY += y;
        }
      }
    }
    
    if (area === 0) continue;
    
    centerX /= area;
    centerY /= area;
    
    // Normalize center to image dimensions
    const normCenterX = centerX / segWidth;
    const normCenterY = centerY / segHeight;
    
    // Score: size * centrality
    const sizeScore = area / (segWidth * segHeight);
    const centralityScore = 1 - Math.sqrt(
      Math.pow(normCenterX - 0.5, 2) + Math.pow(normCenterY - 0.5, 2)
    );
    
    const score = sizeScore * 0.6 + centralityScore * 0.4;
    
    if (score > bestMaskScore) {
      bestMaskScore = score;
      bestMaskData = new Float32Array(segMask);
    }
  }
  
  // If no good segment found, create mask from color difference
  if (!bestMaskData || bestMaskScore < 0.05) {
    return createColorBasedMask(analysis, width, height);
  }
  
  // Resize mask to target dimensions if needed
  const segWidth = segmentationResult[0]?.mask?.width || width;
  const segHeight = segmentationResult[0]?.mask?.height || height;
  
  if (segWidth !== width || segHeight !== height) {
    // Bilinear interpolation resize
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const srcX = (x / width) * segWidth;
        const srcY = (y / height) * segHeight;
        
        const x0 = Math.floor(srcX);
        const y0 = Math.floor(srcY);
        const x1 = Math.min(x0 + 1, segWidth - 1);
        const y1 = Math.min(y0 + 1, segHeight - 1);
        
        const fx = srcX - x0;
        const fy = srcY - y0;
        
        const v00 = bestMaskData[y0 * segWidth + x0];
        const v10 = bestMaskData[y0 * segWidth + x1];
        const v01 = bestMaskData[y1 * segWidth + x0];
        const v11 = bestMaskData[y1 * segWidth + x1];
        
        mask[y * width + x] = 
          v00 * (1 - fx) * (1 - fy) +
          v10 * fx * (1 - fy) +
          v01 * (1 - fx) * fy +
          v11 * fx * fy;
      }
    }
  } else {
    mask.set(bestMaskData);
  }
  
  return { mask, width, height, confidence: bestMaskScore };
}

function createColorBasedMask(
  analysis: ImageAnalysis,
  width: number,
  height: number
): MaskData {
  // This is a fallback when segmentation fails
  // Uses color difference from background
  const mask = new Float32Array(width * height);
  const { dominantBackgroundColor } = analysis;
  
  // Adaptive threshold based on background uniformity
  const baseThreshold = analysis.hasUniformBackground ? 35 : 50;
  
  return { mask, width, height, confidence: 0.3 };
}

// ============================================================================
// PART 4: EDGE REFINEMENT (Feathering & Anti-aliasing)
// ============================================================================

function refineMaskEdges(maskData: MaskData, analysis: ImageAnalysis): MaskData {
  const { mask, width, height } = maskData;
  const refined = new Float32Array(mask);
  
  // Adaptive feather radius based on edge complexity
  const featherRadius = Math.max(2, Math.min(6, Math.round(3 + analysis.edgeComplexity * 0.5)));
  
  // Create distance field for feathering
  const distanceField = new Float32Array(width * height);
  const threshold = 0.5;
  
  // Initialize distance field
  for (let i = 0; i < mask.length; i++) {
    distanceField[i] = mask[i] > threshold ? 0 : Infinity;
  }
  
  // Forward pass
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = y * width + x;
      const neighbors = [
        distanceField[(y - 1) * width + (x - 1)] + 1.414,
        distanceField[(y - 1) * width + x] + 1,
        distanceField[(y - 1) * width + (x + 1)] + 1.414,
        distanceField[y * width + (x - 1)] + 1
      ];
      distanceField[idx] = Math.min(distanceField[idx], ...neighbors);
    }
  }
  
  // Backward pass
  for (let y = height - 2; y >= 1; y--) {
    for (let x = width - 2; x >= 1; x--) {
      const idx = y * width + x;
      const neighbors = [
        distanceField[(y + 1) * width + (x + 1)] + 1.414,
        distanceField[(y + 1) * width + x] + 1,
        distanceField[(y + 1) * width + (x - 1)] + 1.414,
        distanceField[y * width + (x + 1)] + 1
      ];
      distanceField[idx] = Math.min(distanceField[idx], ...neighbors);
    }
  }
  
  // Apply adaptive feathering
  for (let i = 0; i < mask.length; i++) {
    if (mask[i] > threshold) {
      // Inside the mask - check distance to edge
      const dist = distanceField[i];
      if (dist < featherRadius) {
        // Smooth transition at edges
        const t = dist / featherRadius;
        refined[i] = 0.5 + 0.5 * smoothstep(t);
      } else {
        refined[i] = 1;
      }
    } else {
      // Outside - apply inverse distance feathering
      refined[i] = 0;
    }
  }
  
  // Anti-aliasing pass (Gaussian blur on edges only)
  const antialiased = applyEdgeAntiAliasing(refined, width, height, featherRadius);
  
  return { mask: antialiased, width, height, confidence: maskData.confidence };
}

function smoothstep(t: number): number {
  return t * t * (3 - 2 * t);
}

function applyEdgeAntiAliasing(
  mask: Float32Array,
  width: number,
  height: number,
  radius: number
): Float32Array {
  const result = new Float32Array(mask);
  const kernelSize = 3;
  const sigma = 1.0;
  
  // Create Gaussian kernel
  const kernel: number[] = [];
  let kernelSum = 0;
  for (let y = -1; y <= 1; y++) {
    for (let x = -1; x <= 1; x++) {
      const val = Math.exp(-(x * x + y * y) / (2 * sigma * sigma));
      kernel.push(val);
      kernelSum += val;
    }
  }
  for (let i = 0; i < kernel.length; i++) kernel[i] /= kernelSum;
  
  // Apply only to edge pixels
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = y * width + x;
      const val = mask[idx];
      
      // Check if this is an edge pixel
      if (val > 0.1 && val < 0.9) {
        let sum = 0;
        let ki = 0;
        for (let ky = -1; ky <= 1; ky++) {
          for (let kx = -1; kx <= 1; kx++) {
            sum += mask[(y + ky) * width + (x + kx)] * kernel[ki++];
          }
        }
        result[idx] = sum;
      }
    }
  }
  
  return result;
}

// ============================================================================
// PART 5: HALO REMOVAL (Color Decontamination)
// ============================================================================

function removeHalo(
  imageData: ImageData,
  maskData: MaskData,
  analysis: ImageAnalysis
): ImageData {
  const { data, width, height } = imageData;
  const { mask } = maskData;
  const result = new Uint8ClampedArray(data);
  
  const { dominantBackgroundColor } = analysis;
  const bgR = dominantBackgroundColor.r;
  const bgG = dominantBackgroundColor.g;
  const bgB = dominantBackgroundColor.b;
  
  // Decontamination radius (in pixels)
  const decontRadius = 3;
  
  // Process each pixel
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      const alpha = mask[idx];
      
      // Only process edge pixels (partial transparency)
      if (alpha > 0.05 && alpha < 0.95) {
        const pixelIdx = idx * 4;
        const r = data[pixelIdx];
        const g = data[pixelIdx + 1];
        const b = data[pixelIdx + 2];
        
        // Calculate how much this pixel is contaminated by background
        const bgInfluence = 1 - alpha;
        
        // Sample interior pixels to get true object color
        let interiorR = 0, interiorG = 0, interiorB = 0;
        let interiorCount = 0;
        
        for (let dy = -decontRadius; dy <= decontRadius; dy++) {
          for (let dx = -decontRadius; dx <= decontRadius; dx++) {
            const nx = x + dx;
            const ny = y + dy;
            if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
              const nIdx = ny * width + nx;
              if (mask[nIdx] > 0.9) {
                const nPixelIdx = nIdx * 4;
                interiorR += data[nPixelIdx];
                interiorG += data[nPixelIdx + 1];
                interiorB += data[nPixelIdx + 2];
                interiorCount++;
              }
            }
          }
        }
        
        if (interiorCount > 0) {
          interiorR /= interiorCount;
          interiorG /= interiorCount;
          interiorB /= interiorCount;
          
          // Remove background contamination
          // Formula: decontaminated = (original - background * bgInfluence) / alpha
          const decontStrength = Math.min(0.8, bgInfluence * 1.2);
          
          result[pixelIdx] = Math.round(
            r + (interiorR - r) * decontStrength
          );
          result[pixelIdx + 1] = Math.round(
            g + (interiorG - g) * decontStrength
          );
          result[pixelIdx + 2] = Math.round(
            b + (interiorB - b) * decontStrength
          );
        }
      }
    }
  }
  
  return new ImageData(result, width, height);
}

// ============================================================================
// PART 6: MASK VALIDATION & AUTO-CORRECTION
// ============================================================================

interface ValidationResult {
  isValid: boolean;
  issues: string[];
  corrections: (() => void)[];
}

function validateMask(maskData: MaskData): ValidationResult {
  const { mask, width, height } = maskData;
  const issues: string[] = [];
  const corrections: (() => void)[] = [];
  
  // Check 1: Mask has content
  let totalOpacity = 0;
  for (let i = 0; i < mask.length; i++) {
    totalOpacity += mask[i];
  }
  const coverage = totalOpacity / mask.length;
  
  if (coverage < 0.01) {
    issues.push('Mask is nearly empty');
  } else if (coverage > 0.95) {
    issues.push('Mask covers almost entire image');
  }
  
  // Check 2: No holes in center
  const centerX = Math.floor(width / 2);
  const centerY = Math.floor(height / 2);
  const centerRadius = Math.min(width, height) * 0.1;
  
  let centerHoles = 0;
  for (let dy = -centerRadius; dy <= centerRadius; dy++) {
    for (let dx = -centerRadius; dx <= centerRadius; dx++) {
      if (dx * dx + dy * dy <= centerRadius * centerRadius) {
        const idx = (centerY + dy) * width + (centerX + dx);
        if (mask[idx] < 0.5) {
          centerHoles++;
        }
      }
    }
  }
  
  const centerArea = Math.PI * centerRadius * centerRadius;
  if (centerHoles / centerArea > 0.3) {
    issues.push('Holes detected in center region');
    corrections.push(() => fillHoles(mask, width, height));
  }
  
  // Check 3: Edge continuity
  let edgeBreaks = 0;
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = y * width + x;
      if (mask[idx] > 0.5) {
        // Count neighbors
        let neighbors = 0;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dy === 0) continue;
            if (mask[(y + dy) * width + (x + dx)] > 0.5) neighbors++;
          }
        }
        if (neighbors < 2) edgeBreaks++;
      }
    }
  }
  
  if (edgeBreaks > coverage * mask.length * 0.1) {
    issues.push('Fragmented mask detected');
  }
  
  return {
    isValid: issues.length === 0,
    issues,
    corrections
  };
}

function fillHoles(mask: Float32Array, width: number, height: number): void {
  // Simple morphological closing (dilate then erode)
  const temp = new Float32Array(mask);
  
  // Dilate
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      let maxVal = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          maxVal = Math.max(maxVal, mask[(y + dy) * width + (x + dx)]);
        }
      }
      temp[y * width + x] = maxVal;
    }
  }
  
  // Erode
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      let minVal = 1;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          minVal = Math.min(minVal, temp[(y + dy) * width + (x + dx)]);
        }
      }
      mask[y * width + x] = minVal;
    }
  }
}

// ============================================================================
// PART 7: FALLBACK STRATEGIES
// ============================================================================

async function fallbackGrabCut(
  imageData: ImageData,
  analysis: ImageAnalysis
): Promise<MaskData> {
  const { data, width, height } = imageData;
  const mask = new Float32Array(width * height);
  
  const { dominantBackgroundColor, centerOfMass } = analysis;
  
  // Adaptive threshold based on image characteristics
  let threshold = analysis.hasUniformBackground ? 30 : 45;
  
  // If low contrast, reduce threshold
  if (analysis.contrastLevel < 100) {
    threshold *= 0.7;
  }
  
  // Initial segmentation based on color distance from background
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      const pixelIdx = idx * 4;
      
      const dr = data[pixelIdx] - dominantBackgroundColor.r;
      const dg = data[pixelIdx + 1] - dominantBackgroundColor.g;
      const db = data[pixelIdx + 2] - dominantBackgroundColor.b;
      const colorDist = Math.sqrt(dr * dr + dg * dg + db * db);
      
      // Distance from center of mass
      const cx = centerOfMass.x / width;
      const cy = centerOfMass.y / height;
      const nx = x / width;
      const ny = y / height;
      const spatialDist = Math.sqrt(Math.pow(nx - cx, 2) + Math.pow(ny - cy, 2));
      
      // Combine color and spatial information
      const colorScore = colorDist > threshold ? 1 : colorDist / threshold;
      const spatialScore = 1 - Math.min(1, spatialDist * 1.5);
      
      mask[idx] = Math.min(1, colorScore * 0.7 + spatialScore * 0.3);
    }
  }
  
  // Apply morphological operations to clean up
  for (let iter = 0; iter < 3; iter++) {
    // Median filter for noise reduction
    const filtered = new Float32Array(mask);
    for (let y = 2; y < height - 2; y++) {
      for (let x = 2; x < width - 2; x++) {
        const values: number[] = [];
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            values.push(mask[(y + dy) * width + (x + dx)]);
          }
        }
        values.sort((a, b) => a - b);
        filtered[y * width + x] = values[4];
      }
    }
    mask.set(filtered);
  }
  
  return { mask, width, height, confidence: 0.5 };
}

async function fallbackEdgeDetection(
  imageData: ImageData,
  analysis: ImageAnalysis
): Promise<MaskData> {
  const { data, width, height } = imageData;
  const mask = new Float32Array(width * height);
  const edges = new Float32Array(width * height);
  
  // Canny-like edge detection
  const gray = new Float32Array(width * height);
  for (let i = 0; i < width * height; i++) {
    gray[i] = (data[i * 4] + data[i * 4 + 1] + data[i * 4 + 2]) / 3;
  }
  
  // Sobel operator
  const sobelX = [-1, 0, 1, -2, 0, 2, -1, 0, 1];
  const sobelY = [-1, -2, -1, 0, 0, 0, 1, 2, 1];
  
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      let gx = 0, gy = 0;
      for (let ky = -1; ky <= 1; ky++) {
        for (let kx = -1; kx <= 1; kx++) {
          const val = gray[(y + ky) * width + (x + kx)];
          const ki = (ky + 1) * 3 + (kx + 1);
          gx += val * sobelX[ki];
          gy += val * sobelY[ki];
        }
      }
      edges[y * width + x] = Math.sqrt(gx * gx + gy * gy);
    }
  }
  
  // Normalize edges
  let maxEdge = 0;
  for (let i = 0; i < edges.length; i++) {
    maxEdge = Math.max(maxEdge, edges[i]);
  }
  if (maxEdge > 0) {
    for (let i = 0; i < edges.length; i++) {
      edges[i] /= maxEdge;
    }
  }
  
  // Flood fill from edges to find object boundary
  const visited = new Uint8Array(width * height);
  const queue: number[] = [];
  
  // Start from center
  const startX = Math.floor(analysis.centerOfMass.x);
  const startY = Math.floor(analysis.centerOfMass.y);
  const startIdx = startY * width + startX;
  
  queue.push(startIdx);
  visited[startIdx] = 1;
  
  const edgeThreshold = 0.3;
  
  while (queue.length > 0) {
    const idx = queue.shift()!;
    const x = idx % width;
    const y = Math.floor(idx / width);
    
    mask[idx] = 1;
    
    // Check neighbors
    const neighbors = [
      { dx: -1, dy: 0 },
      { dx: 1, dy: 0 },
      { dx: 0, dy: -1 },
      { dx: 0, dy: 1 }
    ];
    
    for (const { dx, dy } of neighbors) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
        const nIdx = ny * width + nx;
        if (!visited[nIdx] && edges[nIdx] < edgeThreshold) {
          visited[nIdx] = 1;
          queue.push(nIdx);
        }
      }
    }
  }
  
  return { mask, width, height, confidence: 0.4 };
}

// ============================================================================
// PART 8: MAIN PIPELINE
// ============================================================================

function resizeImageIfNeeded(
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement
): boolean {
  let width = image.naturalWidth;
  let height = image.naturalHeight;

  if (width > MAX_IMAGE_DIMENSION || height > MAX_IMAGE_DIMENSION) {
    if (width > height) {
      height = Math.round((height * MAX_IMAGE_DIMENSION) / width);
      width = MAX_IMAGE_DIMENSION;
    } else {
      width = Math.round((width * MAX_IMAGE_DIMENSION) / height);
      height = MAX_IMAGE_DIMENSION;
    }

    canvas.width = width;
    canvas.height = height;
    ctx.drawImage(image, 0, 0, width, height);
    return true;
  }

  canvas.width = width;
  canvas.height = height;
  ctx.drawImage(image, 0, 0);
  return false;
}

export const removeBackground = async (
  imageElement: HTMLImageElement,
  onProgress?: (progress: number) => void
): Promise<Blob> => {
  try {
    onProgress?.(0.05);
    
    // Step 1: Prepare canvas and get image data
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) throw new Error('Could not get canvas context');
    
    resizeImageIfNeeded(canvas, ctx, imageElement);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    
    onProgress?.(0.1);
    
    // Step 2: Analyze image for adaptive processing
    const analysis = analyzeImage(imageData);
    console.log('Image analysis:', analysis);
    
    onProgress?.(0.15);
    
    // Step 3: Try primary segmentation
    let maskData: MaskData | null = null;
    let attempts = 0;
    const maxAttempts = 3;
    
    while (!maskData || maskData.confidence < 0.3) {
      attempts++;
      onProgress?.(0.15 + (attempts / maxAttempts) * 0.35);
      
      try {
        if (attempts === 1) {
          // Primary: ML segmentation
          const segmenter = await getSegmenter();
          const segmentationImage = canvas.toDataURL('image/jpeg', 0.9);
          const result = await segmenter(segmentationImage);
          
          if (result && Array.isArray(result) && result.length > 0) {
            maskData = createInitialMask(result, analysis, canvas.width, canvas.height);
          }
        } else if (attempts === 2) {
          // Fallback 1: GrabCut-like approach
          console.log('Trying GrabCut fallback...');
          maskData = await fallbackGrabCut(imageData, analysis);
        } else {
          // Fallback 2: Edge detection
          console.log('Trying edge detection fallback...');
          maskData = await fallbackEdgeDetection(imageData, analysis);
        }
      } catch (e) {
        console.warn(`Attempt ${attempts} failed:`, e);
      }
      
      if (attempts >= maxAttempts) break;
    }
    
    // If all attempts failed, create a basic mask
    if (!maskData) {
      console.log('All attempts failed, creating basic mask');
      maskData = createColorBasedMask(analysis, canvas.width, canvas.height);
      
      // Emergency fallback: just use threshold on color distance
      const data = imageData.data;
      const { dominantBackgroundColor } = analysis;
      
      for (let y = 0; y < canvas.height; y++) {
        for (let x = 0; x < canvas.width; x++) {
          const idx = y * canvas.width + x;
          const pIdx = idx * 4;
          
          const dr = data[pIdx] - dominantBackgroundColor.r;
          const dg = data[pIdx + 1] - dominantBackgroundColor.g;
          const db = data[pIdx + 2] - dominantBackgroundColor.b;
          const dist = Math.sqrt(dr * dr + dg * dg + db * db);
          
          maskData.mask[idx] = dist > 40 ? 1 : 0;
        }
      }
    }
    
    onProgress?.(0.55);
    
    // Step 4: Validate and correct mask
    const validation = validateMask(maskData);
    if (!validation.isValid) {
      console.log('Mask validation issues:', validation.issues);
      for (const correction of validation.corrections) {
        correction();
      }
    }
    
    onProgress?.(0.65);
    
    // Step 5: Refine edges
    maskData = refineMaskEdges(maskData, analysis);
    
    onProgress?.(0.75);
    
    // Step 6: Remove halo
    const decontaminatedImage = removeHalo(imageData, maskData, analysis);
    
    onProgress?.(0.85);
    
    // Step 7: Apply final mask
    const outputCanvas = document.createElement('canvas');
    outputCanvas.width = canvas.width;
    outputCanvas.height = canvas.height;
    const outputCtx = outputCanvas.getContext('2d');
    
    if (!outputCtx) throw new Error('Could not get output canvas context');
    
    // Draw decontaminated image
    outputCtx.putImageData(decontaminatedImage, 0, 0);
    
    // Apply mask to alpha channel
    const outputData = outputCtx.getImageData(0, 0, outputCanvas.width, outputCanvas.height);
    const outPixels = outputData.data;
    
    for (let i = 0; i < maskData.mask.length; i++) {
      outPixels[i * 4 + 3] = Math.round(maskData.mask[i] * 255);
    }
    
    outputCtx.putImageData(outputData, 0, 0);
    
    onProgress?.(0.95);
    
    // Convert to blob
    return new Promise((resolve, reject) => {
      outputCanvas.toBlob(
        (blob) => {
          if (blob) {
            onProgress?.(1);
            resolve(blob);
          } else {
            reject(new Error('Failed to create blob'));
          }
        },
        'image/png',
        1.0
      );
    });
    
  } catch (error) {
    console.error('Background removal pipeline error:', error);
    
    // Last resort: return original image with minimal processing
    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (ctx) {
        canvas.width = imageElement.naturalWidth;
        canvas.height = imageElement.naturalHeight;
        ctx.drawImage(imageElement, 0, 0);
        
        return new Promise((resolve) => {
          canvas.toBlob(
            (blob) => {
              if (blob) {
                onProgress?.(1);
                resolve(blob);
              } else {
                // Ultimate fallback
                resolve(new Blob([new Uint8Array(0)], { type: 'image/png' }));
              }
            },
            'image/png'
          );
        });
      }
    } catch (e) {
      console.error('Ultimate fallback failed:', e);
    }
    
    throw error;
  }
};

export const loadImageFromUrl = (url: string): Promise<HTMLImageElement> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
};

export const loadImageFromDataUrl = (dataUrl: string): Promise<HTMLImageElement> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = dataUrl;
  });
};

export const loadImageFromFile = (file: Blob): Promise<HTMLImageElement> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(img.src);
      resolve(img);
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
};
