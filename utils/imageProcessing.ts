
import { ControlParams, Orb, GradientStop, SilhouetteLayerParams } from '../types';

// Helper for smooth Hermite interpolation (anti-aliasing)
const smoothStep = (value: number, min: number, max: number): number => {
    const x = Math.max(0, Math.min(1, (value - min) / (max - min)));
    return x * x * (3 - 2 * x);
};

// Robust canvas creation helper
const createBufferCanvas = (width: number, height: number): OffscreenCanvas | HTMLCanvasElement => {
    if (typeof OffscreenCanvas !== 'undefined') {
        return new OffscreenCanvas(width, height);
    } else {
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        return canvas;
    }
};

// Helper to draw image with "background-size: cover" behavior
const drawImageCover = (
    ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D, 
    img: CanvasImageSource
) => {
    const canvas = ctx.canvas;
    const cw = canvas.width;
    const ch = canvas.height;
    
    let iw = 0, ih = 0;
    if (img instanceof HTMLImageElement) {
        iw = img.naturalWidth;
        ih = img.naturalHeight;
    } else if (img instanceof HTMLVideoElement) {
        iw = img.videoWidth;
        ih = img.videoHeight;
    } else if (img instanceof HTMLCanvasElement) {
        iw = img.width;
        ih = img.height;
    } else if (typeof OffscreenCanvas !== 'undefined' && img instanceof OffscreenCanvas) {
        iw = img.width;
        ih = img.height;
    } else if (typeof ImageBitmap !== 'undefined' && img instanceof ImageBitmap) {
        iw = img.width;
        ih = img.height;
    }

    if (iw === 0 || ih === 0) return;

    const scale = Math.max(cw / iw, ch / ih);
    const scaledW = Math.floor(iw * scale);
    const scaledH = Math.floor(ih * scale);
    const x = Math.floor((cw - scaledW) / 2);
    const y = Math.floor((ch - scaledH) / 2);
    
    // Explicitly cast ctx to handle the union type overload issue
    (ctx as CanvasRenderingContext2D).drawImage(img, x, y, scaledW, scaledH);
};

// Stability AI SD3 Background Removal
export const removeBackgroundSD3 = async (imageFile: File, apiKey: string): Promise<ImageBitmap | null> => {
    try {
        const formData = new FormData();
        formData.append('image', imageFile);
        formData.append('output_format', 'png');

        const response = await fetch('https://api.stability.ai/v2beta/stable-image/edit/remove-background', {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${apiKey}`,
                Accept: 'image/*'
            },
            body: formData
        });

        if (!response.ok) {
            console.warn(`SD3 API Error: ${response.status} ${response.statusText}`);
            return null;
        }

        const blob = await response.blob();
        return await createImageBitmap(blob);
    } catch (error) {
        console.error("Failed to call SD3 API:", error);
        return null;
    }
};

// Enhanced Heuristic Background Removal with LIQUID SMOOTHING
export const generateSoftMask = async (imageSrc: string | Blob | File): Promise<ImageBitmap | null> => {
    return new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = async () => {
            const width = img.naturalWidth;
            const height = img.naturalHeight;
            
            const canvas = createBufferCanvas(width, height);
            // @ts-ignore - OffscreenCanvas context settings type mismatch
            const ctx = canvas.getContext('2d', { willReadFrequently: true }) as CanvasRenderingContext2D;
            ctx.drawImage(img, 0, 0);
            
            const imageData = ctx.getImageData(0, 0, width, height);
            const data = imageData.data;

            // 1. Detect if image has transparent background
            const corners = [
                0, 
                (width - 1) * 4, 
                (width * (height - 1)) * 4, 
                (width * height - 1) * 4
            ];
            
            let cornerAlphaSum = 0;
            for (const idx of corners) {
                cornerAlphaSum += data[idx + 3];
            }
            const isTransparentBackground = (cornerAlphaSum / 4) < 250;

            const maskImage = new ImageData(width, height);
            const mData = maskImage.data;

            if (isTransparentBackground) {
                // PATH A: Use existing Alpha Channel
                for (let i = 0; i < data.length; i += 4) {
                    const alpha = data[i + 3];
                    mData[i] = 255;   
                    mData[i+1] = 255; 
                    mData[i+2] = 255; 
                    mData[i+3] = alpha > 50 ? 255 : 0;
                }
            } else {
                // PATH B: Color Keying
                let br = 0, bg = 0, bb = 0;
                for (const idx of corners) {
                    br += data[idx];
                    bg += data[idx + 1];
                    bb += data[idx + 2];
                }
                br /= 4; bg /= 4; bb /= 4;

                const threshold = 35; 

                for (let i = 0; i < data.length; i += 4) {
                    const r = data[i];
                    const g = data[i + 1];
                    const b = data[i + 2];
                    const dist = Math.max(Math.abs(r - br), Math.abs(g - bg), Math.abs(b - bb));
                    const alpha = dist < threshold ? 0 : 255;
                    mData[i] = 255;   
                    mData[i+1] = 255; 
                    mData[i+2] = 255; 
                    mData[i+3] = alpha;
                }
            }

            // 3. LIQUID SMOOTHING PIPELINE
            const rawMaskCanvas = createBufferCanvas(width, height);
            const rCtx = rawMaskCanvas.getContext('2d', { willReadFrequently: true }) as CanvasRenderingContext2D;
            rCtx.putImageData(maskImage, 0, 0);

            const blurredCanvas = createBufferCanvas(width, height);
            const bCtx = blurredCanvas.getContext('2d', { willReadFrequently: true }) as CanvasRenderingContext2D;
            
            // Dynamic Blur based on resolution - REDUCED for more detail
            const liquidBlur = Math.max(1, width * 0.002); 
            bCtx.filter = `blur(${liquidBlur}px)`; 
            bCtx.drawImage(rawMaskCanvas as CanvasImageSource, 0, 0);
            bCtx.filter = 'none';

            // Threshold the blur
            const blurredData = bCtx.getImageData(0, 0, width, height);
            const bData = blurredData.data;
            for (let i = 0; i < bData.length; i += 4) {
                const alpha = bData[i + 3];
                // Smooth ramp instead of hard threshold to avoid pixelation
                // Map alpha 100..200 to 0..255
                bData[i+3] = smoothStep(alpha, 100, 200) * 255;
            }
            bCtx.putImageData(blurredData, 0, 0);

            // Final Anti-Aliasing
            const finalCanvas = createBufferCanvas(width, height);
            const fCtx = finalCanvas.getContext('2d', { willReadFrequently: true }) as CanvasRenderingContext2D;
            // Slightly stronger AA for smoother exports
            const aaBlur = Math.max(0.5, width * 0.002); 
            fCtx.filter = `blur(${aaBlur}px)`;
            fCtx.drawImage(blurredCanvas as CanvasImageSource, 0, 0);

            const bitmap = await createImageBitmap(finalCanvas as HTMLCanvasElement | OffscreenCanvas);
            resolve(bitmap);
        };
        img.onerror = () => resolve(null);
        
        if (typeof imageSrc === 'string') {
            img.src = imageSrc;
        } else {
            img.src = URL.createObjectURL(imageSrc);
        }
    });
};

const renderOrb = (
    ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D, 
    orb: Orb, 
    width: number, 
    height: number
) => {
    const x = orb.x * width;
    const y = orb.y * height;
    
    const baseRx = orb.radiusX * (orb.scale || 1);
    const baseRy = orb.radiusY * (orb.scale || 1);

    const rx = baseRx;
    const ry = baseRy;
    const finalBlur = orb.blur;
    
    ctx.save();
    ctx.globalAlpha = Math.max(0, Math.min(1, orb.opacity));
    ctx.filter = `blur(${finalBlur}px)`;
    
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, (orb.rotation * Math.PI) / 180, 0, 2 * Math.PI);

    if (orb.type === 'radial') {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate((orb.rotation * Math.PI) / 180);
        ctx.scale(rx / ry, 1); 
        
        const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, ry); 
        const sortedStops = [...orb.stops].sort((a, b) => a.position - b.position);
        sortedStops.forEach(stop => {
            gradient.addColorStop(stop.position, stop.color);
        });
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(0, 0, ry, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

    } else {
        ctx.fillStyle = orb.color;
        ctx.fill();
    }
    ctx.restore();
};

const createGradient = (
    ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D, 
    width: number, 
    height: number, 
    stops: GradientStop[], 
    type: 'linear' | 'radial'
) => {
    let gradient;
    if (type === 'radial') {
        gradient = ctx.createRadialGradient(width / 2, height / 2, 0, width / 2, height / 2, Math.max(width, height) / 2);
    } else {
        gradient = ctx.createLinearGradient(0, 0, width, height);
    }
    const sortedStops = [...stops].sort((a, b) => a.position - b.position);
    sortedStops.forEach(stop => {
        gradient.addColorStop(stop.position, stop.color);
    });
    return gradient;
};

// Returns the processed mask (rounded), the raw mask (detailed), and the center
const createSimplifiedMask = (
    width: number, 
    height: number, 
    image: CanvasImageSource, 
    roundness: number,
    aiMask?: ImageBitmap | null
): { mask: OffscreenCanvas | HTMLCanvasElement, rawMask: OffscreenCanvas | HTMLCanvasElement, center: { x: number, y: number } } => {
    
    const rawCanvas = createBufferCanvas(width, height);
    const ctx = rawCanvas.getContext('2d', { willReadFrequently: true }) as CanvasRenderingContext2D;
    ctx.clearRect(0, 0, width, height);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    if (aiMask) {
        drawImageCover(ctx, aiMask);
    } else {
        drawImageCover(ctx, image);
    }

    // Calculate Bounding Box Center
    const imageData = ctx.getImageData(0, 0, width, height);
    const fData = imageData.data;
    let minX = width;
    let maxX = 0;
    let minY = height;
    let maxY = 0;
    let hasPixels = false;

    for (let i = 0; i < fData.length; i += 4) {
        if (fData[i + 3] > 20) {
            const pixelIdx = i / 4;
            const x = pixelIdx % width;
            const y = Math.floor(pixelIdx / width);

            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
            hasPixels = true;
        }
    }
    const center = hasPixels ? { x: (minX + maxX) / 2, y: (minY + maxY) / 2 } : { x: width / 2, y: height / 2 };

    const roundedCanvas = createBufferCanvas(width, height);
    const rCtx = roundedCanvas.getContext('2d', { willReadFrequently: true }) as CanvasRenderingContext2D;
    rCtx.imageSmoothingEnabled = true;
    rCtx.imageSmoothingQuality = 'high';
    rCtx.filter = 'blur(0.5px)'; 
    rCtx.drawImage(rawCanvas as CanvasImageSource, 0, 0);
    rCtx.filter = 'none';

    return { mask: roundedCanvas, rawMask: rawCanvas, center };
};

// Compute Chamfer Distance Transform
const computeDistanceField = (
    mask: OffscreenCanvas | HTMLCanvasElement, 
    width: number, 
    height: number, 
    maxDist: number
): Float32Array => {
    const ctx = mask.getContext('2d', { willReadFrequently: true }) as CanvasRenderingContext2D;
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;
    const dist = new Float32Array(width * height);
    
    for (let i = 0; i < dist.length; i++) {
        if (data[i * 4 + 3] > 128) {
            dist[i] = 0;
        } else {
            dist[i] = Infinity;
        }
    }

    const w1 = 1.0;
    const w2 = 1.41421356; 

    // Pass 1
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const idx = y * width + x;
            if (dist[idx] === 0) continue; 
            let minD = dist[idx];
            if (x > 0) { const d = dist[idx - 1] + w1; if (d < minD) minD = d; }
            if (x > 0 && y > 0) { const d = dist[idx - width - 1] + w2; if (d < minD) minD = d; }
            if (y > 0) { const d = dist[idx - width] + w1; if (d < minD) minD = d; }
            if (x < width - 1 && y > 0) { const d = dist[idx - width + 1] + w2; if (d < minD) minD = d; }
            dist[idx] = minD;
        }
    }
    // Pass 2
    for (let y = height - 1; y >= 0; y--) {
        for (let x = width - 1; x >= 0; x--) {
            const idx = y * width + x;
            if (dist[idx] === 0) continue; 
            let minD = dist[idx];
            if (x < width - 1) { const d = dist[idx + 1] + w1; if (d < minD) minD = d; }
            if (x < width - 1 && y < height - 1) { const d = dist[idx + width + 1] + w2; if (d < minD) minD = d; }
            if (y < height - 1) { const d = dist[idx + width] + w1; if (d < minD) minD = d; }
            if (x > 0 && y < height - 1) { const d = dist[idx + width - 1] + w2; if (d < minD) minD = d; }
            dist[idx] = minD;
        }
    }
    return dist;
};

const createOutlineFromMask = (
    mask: OffscreenCanvas | HTMLCanvasElement,
    width: number,
    height: number,
    strokeWidthStart: number,
    strokeWidthMid: number,
    strokeWidthEnd: number,
    strokeScale: number = 1, 
    blurStart: number = 0,
    blurMid: number = 0,
    blurEnd: number = 0
): OffscreenCanvas | HTMLCanvasElement => {
    const outlineCanvas = createBufferCanvas(width, height);
    const ctx = outlineCanvas.getContext('2d', { willReadFrequently: true }) as CanvasRenderingContext2D;

    const effectiveStart = strokeWidthStart * strokeScale;
    const effectiveMid = strokeWidthMid * strokeScale;
    const effectiveEnd = strokeWidthEnd * strokeScale;

    if (effectiveStart <= 0 && effectiveMid <= 0 && effectiveEnd <= 0) return outlineCanvas;

    const baseRes = 400; // Reference resolution for tuning
    const resScale = width / baseRes; // Scaling factor for high-res exports

    const maxStroke = Math.max(effectiveStart, effectiveMid, effectiveEnd);
    const maxBlurRaw = Math.max(blurStart, blurMid, blurEnd);
    
    // SCALE FIX: Remove resScale from the divisor to boost blur relative to stroke width at high resolutions
    const maxAdaptiveFeather = maxBlurRaw > 0 ? maxBlurRaw * (0.5 + maxStroke / 20) : 0;
    
    const padding = Math.ceil(maxStroke + maxAdaptiveFeather + 20); 
    const paddedW = Math.ceil(width + padding * 2);
    const paddedH = Math.ceil(height + padding * 2);
    
    const paddedMaskSharp = createBufferCanvas(paddedW, paddedH);
    const psCtx = paddedMaskSharp.getContext('2d', { willReadFrequently: true }) as CanvasRenderingContext2D;
    
    // Explicit clamp-to-edge drawing
    psCtx.drawImage(mask as CanvasImageSource, padding, padding);
    psCtx.drawImage(mask as CanvasImageSource, 0, 0, width, 1, padding, 0, width, padding);
    psCtx.drawImage(mask as CanvasImageSource, 0, height - 1, width, 1, padding, height + padding, width, padding);
    psCtx.drawImage(mask as CanvasImageSource, 0, 0, 1, height, 0, padding, padding, height);
    psCtx.drawImage(mask as CanvasImageSource, width - 1, 0, 1, height, width + padding, padding, padding, height);

    const paddedMaskBlurred = createBufferCanvas(paddedW, paddedH);
    const pmCtx = paddedMaskBlurred.getContext('2d', { willReadFrequently: true }) as CanvasRenderingContext2D;
    
    // FIXED: Use conservative scaled blur
    // Scaling smoothBlur slightly (conservative) to avoid aliasing artifacts on high-res export
    // while preserving shape. '2 * resScale' was too much (blobby).
    const smoothBlur = Math.max(2, resScale);
    pmCtx.filter = `blur(${smoothBlur}px)`;
    pmCtx.drawImage(paddedMaskSharp as CanvasImageSource, 0, 0);
    pmCtx.filter = 'none';

    const maxDist = maxStroke + maxAdaptiveFeather + 5;
    const distanceField = computeDistanceField(paddedMaskBlurred, paddedW, paddedH, maxDist);
    
    const outputImage = new ImageData(paddedW, paddedH);
    const outData = outputImage.data;
    const minFeatherRange = 1;

    for (let i = 0; i < distanceField.length; i++) {
        const dist = distanceField[i];
        if (dist === Infinity || dist === 0) continue; 
        
        const x = i % paddedW;
        const originalX = x - padding;
        const t = Math.max(0, Math.min(1, originalX / width));
        
        let currentTargetWidth;
        let currentBlur;

        if (t < 0.5) {
            const localT = t / 0.5;
            currentTargetWidth = effectiveStart + (effectiveMid - effectiveStart) * localT;
            currentBlur = blurStart + (blurMid - blurStart) * localT;
        } else {
            const localT = (t - 0.5) / 0.5;
            currentTargetWidth = effectiveMid + (effectiveEnd - effectiveMid) * localT;
            currentBlur = blurMid + (blurEnd - blurMid) * localT;
        }
        
        const adaptiveFeather = currentBlur > 0 ? currentBlur * (0.5 + currentTargetWidth / 20) : 0;
        const featherRange = Math.max(minFeatherRange, adaptiveFeather);

        if (dist > currentTargetWidth + featherRange) continue;

        let alpha = 1.0;
        if (dist > currentTargetWidth) {
             alpha = 1.0 - smoothStep(dist, currentTargetWidth, currentTargetWidth + featherRange);
        } else {
             alpha = 1.0;
        }

        const idx = i * 4;
        outData[idx] = 0; outData[idx+1] = 0; outData[idx+2] = 0;
        outData[idx+3] = alpha * 255; 
    }

    const processedOuter = createBufferCanvas(paddedW, paddedH);
    const poCtx = processedOuter.getContext('2d', { willReadFrequently: true }) as CanvasRenderingContext2D;
    poCtx.putImageData(outputImage, 0, 0);

    // Create CHOKED Inner Cutout
    // We create a "hole" that is larger than the original sharp mask, ensuring the outline extends
    // UNDER the main silhouette.
    const chokedMask = createBufferCanvas(paddedW, paddedH);
    const cCtx = chokedMask.getContext('2d', { willReadFrequently: true }) as CanvasRenderingContext2D;
    cCtx.drawImage(paddedMaskSharp as CanvasImageSource, 0, 0);
    
    const blurredChoke = createBufferCanvas(paddedW, paddedH);
    const bcCtx = blurredChoke.getContext('2d', { willReadFrequently: true }) as CanvasRenderingContext2D;
    
    // Increase choke blur to ensure a soft inner seal
    const chokeBlur = Math.max(2, 4 * resScale);
    bcCtx.filter = `blur(${chokeBlur}px)`;
    bcCtx.drawImage(chokedMask as CanvasImageSource, 0, 0);
    
    const chokeData = bcCtx.getImageData(0, 0, paddedW, paddedH);
    const cData = chokeData.data;
    // High threshold makes the cutout "hole" smaller, so the stroke overlaps more
    for(let i=0; i<cData.length; i+=4) {
        cData[i+3] = cData[i+3] > 220 ? 255 : 0;
    }
    bcCtx.putImageData(chokeData, 0, 0);

    poCtx.globalCompositeOperation = 'destination-out';
    poCtx.drawImage(blurredChoke as CanvasImageSource, 0, 0);
    poCtx.globalCompositeOperation = 'source-over';

    ctx.drawImage(processedOuter as CanvasImageSource, -padding, -padding);
    return outlineCanvas;
}

const renderAccessoryLayer = (
    width: number, 
    height: number, 
    masterMask: OffscreenCanvas | HTMLCanvasElement, 
    center: { x: number, y: number },
    config: SilhouetteLayerParams
): OffscreenCanvas | HTMLCanvasElement => {
    const layerCanvas = createBufferCanvas(width, height);
    const ctx = layerCanvas.getContext('2d', { willReadFrequently: true }) as CanvasRenderingContext2D;
    
    if (!config.enabled) return layerCanvas;

    const outlineMask = createOutlineFromMask(
        masterMask, 
        width, 
        height, 
        config.strokeWidth, 
        config.strokeWidthMid || config.strokeWidth, 
        config.strokeWidthEnd ?? config.strokeWidth,
        config.strokeScale || 1, 
        config.blurStart,
        config.blurMid,
        config.blurEnd
    );
    
    ctx.drawImage(outlineMask as CanvasImageSource, config.xOffset || 0, config.yOffset || 0);
    
    ctx.globalCompositeOperation = 'source-in';
    if (config.mode === 'gradient') {
        ctx.fillStyle = createGradient(ctx, width, height, config.gradientStops, 'linear');
    } else {
        ctx.fillStyle = config.color;
    }
    ctx.fillRect(0, 0, width, height);
    return layerCanvas;
};

export const processImage = (
    ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
    image: CanvasImageSource,
    params: ControlParams,
    maskImage?: ImageBitmap | null
) => {
    const { width, height } = ctx.canvas;
    ctx.clearRect(0, 0, width, height);

    ctx.fillStyle = params.background.color;
    ctx.fillRect(0, 0, width, height);

    if (params.showBackgroundOrbs) {
        params.backgroundOrbs.forEach(orb => renderOrb(ctx, orb, width, height));
    }

    const { mask, rawMask, center } = createSimplifiedMask(width, height, image, params.silhouette.roundness, maskImage);

    const backSilLayer = renderAccessoryLayer(width, height, rawMask, center, params.silhouette.backSilhouette);
    ctx.drawImage(backSilLayer as CanvasImageSource, 0, 0);

    const silCanvas = createBufferCanvas(width, height);
    const silCtx = silCanvas.getContext('2d', { willReadFrequently: true }) as CanvasRenderingContext2D;
    silCtx.filter = 'blur(0.5px)'; 
    silCtx.drawImage(rawMask as CanvasImageSource, 0, 0);
    silCtx.filter = 'none';
    
    silCtx.globalCompositeOperation = 'source-in';
    if (params.silhouette.mode === 'gradient') {
         silCtx.fillStyle = createGradient(silCtx, width, height, params.silhouette.gradientStops, params.silhouette.gradientType);
    } else {
         silCtx.fillStyle = params.silhouette.color;
    }
    silCtx.fillRect(0, 0, width, height);
    ctx.drawImage(silCanvas as CanvasImageSource, 0, 0);

    if (params.showForegroundOrbs && params.foregroundOrbs.length > 0) {
        const fgCanvas = createBufferCanvas(width, height);
        const fgCtx = fgCanvas.getContext('2d', { willReadFrequently: true }) as CanvasRenderingContext2D;
        params.foregroundOrbs.forEach(orb => renderOrb(fgCtx, orb, width, height));
        fgCtx.globalCompositeOperation = 'destination-in';
        fgCtx.drawImage(rawMask as CanvasImageSource, 0, 0);
        ctx.drawImage(fgCanvas as CanvasImageSource, 0, 0);
    }

    if (params.progressiveBlur.enabled) {
        const { startX, startY, endX, endY, startBlur, endBlur } = params.progressiveBlur;
        const maxBlur = Math.max(startBlur, endBlur);
        if (maxBlur > 0) {
            const currentCanvas = createBufferCanvas(width, height);
            const curCtx = currentCanvas.getContext('2d', { willReadFrequently: true }) as CanvasRenderingContext2D;
            curCtx.drawImage(ctx.canvas, 0, 0);

            const blurredCanvas = createBufferCanvas(width, height);
            const bCtx = blurredCanvas.getContext('2d', { willReadFrequently: true }) as CanvasRenderingContext2D;
            bCtx.filter = `blur(${maxBlur}px)`;
            bCtx.drawImage(currentCanvas as CanvasImageSource, 0, 0);
            bCtx.filter = 'none';

            const maskCanvas = createBufferCanvas(width, height);
            const mCtx = maskCanvas.getContext('2d', { willReadFrequently: true }) as CanvasRenderingContext2D;
            const grad = mCtx.createLinearGradient(startX * width, startY * height, endX * width, endY * height);
            const startOp = startBlur / maxBlur;
            const endOp = endBlur / maxBlur;
            grad.addColorStop(0, `rgba(0,0,0,${startOp})`);
            grad.addColorStop(1, `rgba(0,0,0,${endOp})`);
            mCtx.fillStyle = grad;
            mCtx.fillRect(0, 0, width, height);

            bCtx.globalCompositeOperation = 'destination-in';
            bCtx.drawImage(maskCanvas as CanvasImageSource, 0, 0);
            ctx.drawImage(blurredCanvas as CanvasImageSource, 0, 0);
        }
    }
};
