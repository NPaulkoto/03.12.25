
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

// Helper to draw image with "background-size: cover" behavior into logical dimensions
const drawImageCover = (
    ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D, 
    img: CanvasImageSource,
    logicalW: number,
    logicalH: number
) => {
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

    const scale = Math.max(logicalW / iw, logicalH / ih);
    const scaledW = Math.floor(iw * scale);
    const scaledH = Math.floor(ih * scale);
    const x = Math.floor((logicalW - scaledW) / 2);
    const y = Math.floor((logicalH - scaledH) / 2);
    
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
            // @ts-ignore
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
            
            // Dynamic Blur based on resolution - REDUCED slightly to preserve detail/solidity
            const liquidBlur = Math.max(1, width * 0.0015); 
            bCtx.filter = `blur(${liquidBlur}px)`; 
            bCtx.drawImage(rawMaskCanvas as CanvasImageSource, 0, 0);
            bCtx.filter = 'none';

            // Threshold the blur - WIDENED range to boost solidity
            const blurredData = bCtx.getImageData(0, 0, width, height);
            const bData = blurredData.data;
            for (let i = 0; i < bData.length; i += 4) {
                const alpha = bData[i + 3];
                // Lower threshold (50) to keep more pixels opaque
                bData[i+3] = smoothStep(alpha, 50, 200) * 255;
            }
            bCtx.putImageData(blurredData, 0, 0);

            // Final Anti-Aliasing
            const finalCanvas = createBufferCanvas(width, height);
            const fCtx = finalCanvas.getContext('2d', { willReadFrequently: true }) as CanvasRenderingContext2D;
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
    logicalWidth: number, 
    logicalHeight: number
) => {
    const x = orb.x * logicalWidth;
    const y = orb.y * logicalHeight;
    
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

// Returns mask and rawMask scaled for current context
const createSimplifiedMask = (
    logicalW: number, 
    logicalH: number, 
    scale: number,
    image: CanvasImageSource, 
    roundness: number,
    aiMask?: ImageBitmap | null
): { mask: OffscreenCanvas | HTMLCanvasElement, rawMask: OffscreenCanvas | HTMLCanvasElement, center: { x: number, y: number } } => {
    
    const physicalW = Math.ceil(logicalW * scale);
    const physicalH = Math.ceil(logicalH * scale);

    const rawCanvas = createBufferCanvas(physicalW, physicalH);
    const ctx = rawCanvas.getContext('2d', { willReadFrequently: true }) as CanvasRenderingContext2D;
    ctx.scale(scale, scale);
    
    if (aiMask) {
        drawImageCover(ctx, aiMask, logicalW, logicalH);
    } else {
        drawImageCover(ctx, image, logicalW, logicalH);
    }

    // Center calc needs access to pixels.
    // For performance, we can do this on a small buffer, or just the physical one.
    // Let's use physical data.
    const imageData = ctx.getImageData(0, 0, physicalW, physicalH);
    const fData = imageData.data;
    let minX = physicalW;
    let maxX = 0;
    let minY = physicalH;
    let maxY = 0;
    let hasPixels = false;

    for (let i = 0; i < fData.length; i += 4) {
        if (fData[i + 3] > 20) {
            const pixelIdx = i / 4;
            const x = pixelIdx % physicalW;
            const y = Math.floor(pixelIdx / physicalW);

            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
            hasPixels = true;
        }
    }
    // Scale center back to logical coordinates
    const center = hasPixels 
        ? { x: ((minX + maxX) / 2) / scale, y: ((minY + maxY) / 2) / scale } 
        : { x: logicalW / 2, y: logicalH / 2 };

    const roundedCanvas = createBufferCanvas(physicalW, physicalH);
    const rCtx = roundedCanvas.getContext('2d', { willReadFrequently: true }) as CanvasRenderingContext2D;
    rCtx.scale(scale, scale);
    
    // Logical blur 1.5px
    rCtx.filter = `blur(1.5px)`; 
    rCtx.drawImage(rawCanvas as CanvasImageSource, 0, 0, logicalW, logicalH);
    rCtx.filter = 'none';

    return { mask: roundedCanvas, rawMask: rawCanvas, center };
};

// Compute Chamfer Distance Transform
const computeDistanceField = (
    mask: OffscreenCanvas | HTMLCanvasElement, 
    physicalW: number, 
    physicalH: number
): Float32Array => {
    const ctx = mask.getContext('2d', { willReadFrequently: true }) as CanvasRenderingContext2D;
    const imageData = ctx.getImageData(0, 0, physicalW, physicalH);
    const data = imageData.data;
    const dist = new Float32Array(physicalW * physicalH);
    
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
    for (let y = 0; y < physicalH; y++) {
        for (let x = 0; x < physicalW; x++) {
            const idx = y * physicalW + x;
            if (dist[idx] === 0) continue; 
            let minD = dist[idx];
            if (x > 0) { const d = dist[idx - 1] + w1; if (d < minD) minD = d; }
            if (x > 0 && y > 0) { const d = dist[idx - physicalW - 1] + w2; if (d < minD) minD = d; }
            if (y > 0) { const d = dist[idx - physicalW] + w1; if (d < minD) minD = d; }
            if (x < physicalW - 1 && y > 0) { const d = dist[idx - physicalW + 1] + w2; if (d < minD) minD = d; }
            dist[idx] = minD;
        }
    }
    // Pass 2
    for (let y = physicalH - 1; y >= 0; y--) {
        for (let x = physicalW - 1; x >= 0; x--) {
            const idx = y * physicalW + x;
            if (dist[idx] === 0) continue; 
            let minD = dist[idx];
            if (x < physicalW - 1) { const d = dist[idx + 1] + w1; if (d < minD) minD = d; }
            if (x < physicalW - 1 && y < physicalH - 1) { const d = dist[idx + physicalW + 1] + w2; if (d < minD) minD = d; }
            if (y < physicalH - 1) { const d = dist[idx + physicalW] + w1; if (d < minD) minD = d; }
            if (x > 0 && y < physicalH - 1) { const d = dist[idx + physicalW - 1] + w2; if (d < minD) minD = d; }
            dist[idx] = minD;
        }
    }
    return dist;
};

const createOutlineFromMask = (
    mask: OffscreenCanvas | HTMLCanvasElement,
    logicalW: number,
    logicalH: number,
    scale: number,
    strokeWidthStart: number,
    strokeWidthMid: number,
    strokeWidthEnd: number,
    strokeScale: number = 1, 
    blurStart: number = 0,
    blurMid: number = 0,
    blurEnd: number = 0
): OffscreenCanvas | HTMLCanvasElement => {
    
    // Everything is logical input, but we work on a physically scaled grid
    const physicalW = Math.ceil(logicalW * scale);
    const physicalH = Math.ceil(logicalH * scale);

    const outlineCanvas = createBufferCanvas(physicalW, physicalH);
    const ctx = outlineCanvas.getContext('2d', { willReadFrequently: true }) as CanvasRenderingContext2D;
    // We do NOT scale context here, because we are putting pixel data directly.

    const effectiveStart = strokeWidthStart * strokeScale;
    const effectiveMid = strokeWidthMid * strokeScale;
    const effectiveEnd = strokeWidthEnd * strokeScale;

    if (effectiveStart <= 0 && effectiveMid <= 0 && effectiveEnd <= 0) return outlineCanvas;

    const maxStroke = Math.max(effectiveStart, effectiveMid, effectiveEnd);
    const maxBlurRaw = Math.max(blurStart, blurMid, blurEnd);
    
    // Adaptive feather calculation (Logical)
    const maxAdaptiveFeather = maxBlurRaw > 0 ? maxBlurRaw * (0.5 + maxStroke / 54) : 0; // 54 is scaled 20*2.7
    
    const paddingLogical = Math.ceil(maxStroke + maxAdaptiveFeather + 20); 
    const paddingPhysical = Math.ceil(paddingLogical * scale);

    const paddedWPhysical = physicalW + paddingPhysical * 2;
    const paddedHPhysical = physicalH + paddingPhysical * 2;
    
    const paddedMaskSharp = createBufferCanvas(paddedWPhysical, paddedHPhysical);
    const psCtx = paddedMaskSharp.getContext('2d', { willReadFrequently: true }) as CanvasRenderingContext2D;
    
    // Draw scaled mask into center
    psCtx.drawImage(mask as CanvasImageSource, paddingPhysical, paddingPhysical);
    // Clamp to edge (Physical copies)
    psCtx.drawImage(mask as CanvasImageSource, 0, 0, physicalW, 1, paddingPhysical, 0, physicalW, paddingPhysical);
    psCtx.drawImage(mask as CanvasImageSource, 0, physicalH - 1, physicalW, 1, paddingPhysical, physicalH + paddingPhysical, physicalW, paddingPhysical);
    psCtx.drawImage(mask as CanvasImageSource, 0, 0, 1, physicalH, 0, paddingPhysical, paddingPhysical, physicalH);
    psCtx.drawImage(mask as CanvasImageSource, physicalW - 1, 0, 1, physicalH, physicalW + paddingPhysical, paddingPhysical, paddingPhysical, physicalH);

    const paddedMaskBlurred = createBufferCanvas(paddedWPhysical, paddedHPhysical);
    const pmCtx = paddedMaskBlurred.getContext('2d', { willReadFrequently: true }) as CanvasRenderingContext2D;
    
    // Logical smoothing blur (e.g. 2px) needs to be applied in transform or manually scaled
    // Since we are working on physical pixels here without scale transform, we multiply by scale.
    // However, ctx.filter with px units behaves differently on unscaled vs scaled context.
    // Here psCtx is unscaled 1:1 with pixels.
    // So 2px logical -> 2 * scale physical pixels.
    
    // Dynamic smooth blur - REDUCED to 0.5 to fix "super rounded" issue and gaps
    // We want the stroke to follow the EXACT shape of the silhouette, not a rounded blob.
    // The previous large blur was causing the "zero distance" line to recede, creating the gap.
    const smoothBlurPhysical = 0.5 * scale;
    pmCtx.filter = `blur(${smoothBlurPhysical}px)`;
    pmCtx.drawImage(paddedMaskSharp as CanvasImageSource, 0, 0);
    pmCtx.filter = 'none';

    const maxDistLogical = maxStroke + maxAdaptiveFeather + 5;
    const distanceField = computeDistanceField(paddedMaskBlurred, paddedWPhysical, paddedHPhysical);
    
    const outputImage = new ImageData(paddedWPhysical, paddedHPhysical);
    const outData = outputImage.data;
    const minFeatherRange = 1;

    for (let i = 0; i < distanceField.length; i++) {
        const distPhysical = distanceField[i]; // Distance in physical pixels
        if (distPhysical === Infinity || distPhysical === 0) continue; 
        
        // Convert dist to logical for comparison against logical widths
        const distLogical = distPhysical / scale;

        const xPhysical = i % paddedWPhysical;
        const originalXPhysical = xPhysical - paddingPhysical;
        const t = Math.max(0, Math.min(1, originalXPhysical / physicalW));
        
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
        
        const adaptiveFeather = currentBlur > 0 ? currentBlur * (0.5 + currentTargetWidth / 54) : 0;
        const featherRange = Math.max(minFeatherRange, adaptiveFeather);

        if (distLogical > currentTargetWidth + featherRange) continue;

        let alpha = 1.0;
        if (distLogical > currentTargetWidth) {
             alpha = 1.0 - smoothStep(distLogical, currentTargetWidth, currentTargetWidth + featherRange);
        } else {
             alpha = 1.0;
        }

        const idx = i * 4;
        outData[idx] = 0; outData[idx+1] = 0; outData[idx+2] = 0;
        outData[idx+3] = alpha * 255; 
    }

    const processedOuter = createBufferCanvas(paddedWPhysical, paddedHPhysical);
    const poCtx = processedOuter.getContext('2d', { willReadFrequently: true }) as CanvasRenderingContext2D;
    poCtx.putImageData(outputImage, 0, 0);

    // Create CHOKED Inner Cutout
    const chokedMask = createBufferCanvas(paddedWPhysical, paddedHPhysical);
    const cCtx = chokedMask.getContext('2d', { willReadFrequently: true }) as CanvasRenderingContext2D;
    cCtx.drawImage(paddedMaskSharp as CanvasImageSource, 0, 0);
    
    const blurredChoke = createBufferCanvas(paddedWPhysical, paddedHPhysical);
    const bcCtx = blurredChoke.getContext('2d', { willReadFrequently: true }) as CanvasRenderingContext2D;
    
    // Logical 6px -> Physical 6 * scale
    const chokeBlurPhysical = 6 * scale;
    bcCtx.filter = `blur(${chokeBlurPhysical}px)`;
    bcCtx.drawImage(chokedMask as CanvasImageSource, 0, 0);
    
    const chokeData = bcCtx.getImageData(0, 0, paddedWPhysical, paddedHPhysical);
    const cData = chokeData.data;
    for(let i=0; i<cData.length; i+=4) {
        cData[i+3] = cData[i+3] > 220 ? 255 : 0;
    }
    bcCtx.putImageData(chokeData, 0, 0);

    poCtx.globalCompositeOperation = 'destination-out';
    poCtx.drawImage(blurredChoke as CanvasImageSource, 0, 0);
    poCtx.globalCompositeOperation = 'source-over';

    // Draw result back into outlineCanvas (which is scaled by context elsewhere? No, ctx is unscaled here)
    // We need to return an unscaled canvas with physical pixels, that will be drawn into a scaled context later?
    // No, renderAccessoryLayer draws this result using ctx.drawImage.
    // If ctx (in renderAccessoryLayer) is scaled, drawing a physical-sized canvas at 0,0 needs to be sized correctly.
    // If outlineCanvas is physical size, and we draw it at (0,0) in a scaled context...
    // We need to draw it with logical dimensions.
    
    // But wait, outlineCanvas is `physicalW x physicalH`.
    // It contains padding.
    // We need to draw it offset by padding.
    
    // Let's just return the processedOuter and handle offset/scaling in caller or here.
    // We can draw it into `outlineCanvas` (which matches physical screen size) with offset.
    ctx.drawImage(processedOuter as CanvasImageSource, -paddingPhysical, -paddingPhysical);
    
    return outlineCanvas;
}

const renderAccessoryLayer = (
    logicalW: number, 
    logicalH: number, 
    scale: number,
    masterMask: OffscreenCanvas | HTMLCanvasElement, 
    center: { x: number, y: number },
    config: SilhouetteLayerParams
): OffscreenCanvas | HTMLCanvasElement => {
    // Return canvas should match physical resolution but be compatible with scaled context?
    // Standard pattern: Create physical canvas, scale context, draw.
    const physicalW = Math.ceil(logicalW * scale);
    const physicalH = Math.ceil(logicalH * scale);
    
    const layerCanvas = createBufferCanvas(physicalW, physicalH);
    const ctx = layerCanvas.getContext('2d', { willReadFrequently: true }) as CanvasRenderingContext2D;
    ctx.scale(scale, scale); // Work in logical coords for composition
    
    if (!config.enabled) return layerCanvas;

    const outlineMask = createOutlineFromMask(
        masterMask, 
        logicalW, 
        logicalH, 
        scale,
        config.strokeWidth, 
        config.strokeWidthMid || config.strokeWidth, 
        config.strokeWidthEnd ?? config.strokeWidth,
        config.strokeScale || 1, 
        config.blurStart,
        config.blurMid,
        config.blurEnd
    );
    
    // outlineMask is physical sized.
    // We are in a scaled context.
    // If we draw image (physical), we need to draw it at logical size?
    // ctx.drawImage(img, x, y, w, h).
    // outlineMask.width is physicalW.
    // We want to draw it covering 0,0 to logicalW, logicalH.
    // So drawImage(outlineMask, 0, 0, logicalW, logicalH).
    
    ctx.save();
    // Offset is logical
    ctx.translate(config.xOffset || 0, config.yOffset || 0);
    ctx.drawImage(outlineMask as CanvasImageSource, 0, 0, logicalW, logicalH);
    ctx.restore();
    
    ctx.globalCompositeOperation = 'source-in';
    if (config.mode === 'gradient') {
        ctx.fillStyle = createGradient(ctx, logicalW, logicalH, config.gradientStops, 'linear');
    } else {
        ctx.fillStyle = config.color;
    }
    ctx.fillRect(0, 0, logicalW, logicalH);
    return layerCanvas;
};

export const renderAuraScene = (
    ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
    logicalWidth: number,
    logicalHeight: number,
    image: CanvasImageSource,
    params: ControlParams,
    maskImage?: ImageBitmap | null
) => {
    // Detect Scale from Transform
    // Assuming uniform scale
    const scale = ctx.getTransform().a;
    
    ctx.clearRect(0, 0, logicalWidth, logicalHeight);

    ctx.fillStyle = params.background.color;
    ctx.fillRect(0, 0, logicalWidth, logicalHeight);

    if (params.showBackgroundOrbs) {
        params.backgroundOrbs.forEach(orb => renderOrb(ctx, orb, logicalWidth, logicalHeight));
    }

    const { mask, rawMask, center } = createSimplifiedMask(logicalWidth, logicalHeight, scale, image, params.silhouette.roundness, maskImage);

    // Draw Back Silhouette
    const backSilLayer = renderAccessoryLayer(logicalWidth, logicalHeight, scale, rawMask, center, params.silhouette.backSilhouette);
    // Draw layer (physical) into scaled context
    ctx.drawImage(backSilLayer as CanvasImageSource, 0, 0, logicalWidth, logicalHeight);

    // Draw Main Silhouette
    const silCanvas = createBufferCanvas(Math.ceil(logicalWidth * scale), Math.ceil(logicalHeight * scale));
    const silCtx = silCanvas.getContext('2d', { willReadFrequently: true }) as CanvasRenderingContext2D;
    silCtx.scale(scale, scale);
    
    // Logical 0.5px blur
    silCtx.filter = 'blur(0.5px)'; 
    // rawMask is physical, draw logical
    silCtx.drawImage(rawMask as CanvasImageSource, 0, 0, logicalWidth, logicalHeight);
    silCtx.filter = 'none';
    
    silCtx.globalCompositeOperation = 'source-in';
    if (params.silhouette.mode === 'gradient') {
         silCtx.fillStyle = createGradient(silCtx, logicalWidth, logicalHeight, params.silhouette.gradientStops, params.silhouette.gradientType);
    } else {
         silCtx.fillStyle = params.silhouette.color;
    }
    silCtx.fillRect(0, 0, logicalWidth, logicalHeight);
    
    ctx.drawImage(silCanvas as CanvasImageSource, 0, 0, logicalWidth, logicalHeight);

    if (params.showForegroundOrbs && params.foregroundOrbs.length > 0) {
        const fgCanvas = createBufferCanvas(Math.ceil(logicalWidth * scale), Math.ceil(logicalHeight * scale));
        const fgCtx = fgCanvas.getContext('2d', { willReadFrequently: true }) as CanvasRenderingContext2D;
        fgCtx.scale(scale, scale);
        
        params.foregroundOrbs.forEach(orb => renderOrb(fgCtx, orb, logicalWidth, logicalHeight));
        fgCtx.globalCompositeOperation = 'destination-in';
        fgCtx.drawImage(rawMask as CanvasImageSource, 0, 0, logicalWidth, logicalHeight);
        ctx.drawImage(fgCanvas as CanvasImageSource, 0, 0, logicalWidth, logicalHeight);
    }

    if (params.progressiveBlur.enabled) {
        const { startX, startY, endX, endY, startBlur, endBlur } = params.progressiveBlur;
        const maxBlur = Math.max(startBlur, endBlur);
        if (maxBlur > 0) {
            const currentCanvas = createBufferCanvas(Math.ceil(logicalWidth * scale), Math.ceil(logicalHeight * scale));
            const curCtx = currentCanvas.getContext('2d', { willReadFrequently: true }) as CanvasRenderingContext2D;
            curCtx.scale(scale, scale);
            curCtx.drawImage(ctx.canvas, 0, 0, logicalWidth, logicalHeight);

            const blurredCanvas = createBufferCanvas(Math.ceil(logicalWidth * scale), Math.ceil(logicalHeight * scale));
            const bCtx = blurredCanvas.getContext('2d', { willReadFrequently: true }) as CanvasRenderingContext2D;
            bCtx.scale(scale, scale);
            bCtx.filter = `blur(${maxBlur}px)`;
            bCtx.drawImage(currentCanvas as CanvasImageSource, 0, 0, logicalWidth, logicalHeight);
            bCtx.filter = 'none';

            const maskCanvas = createBufferCanvas(Math.ceil(logicalWidth * scale), Math.ceil(logicalHeight * scale));
            const mCtx = maskCanvas.getContext('2d', { willReadFrequently: true }) as CanvasRenderingContext2D;
            mCtx.scale(scale, scale);
            const grad = mCtx.createLinearGradient(startX * logicalWidth, startY * logicalHeight, endX * logicalWidth, endY * logicalHeight);
            const startOp = startBlur / maxBlur;
            const endOp = endBlur / maxBlur;
            grad.addColorStop(0, `rgba(0,0,0,${startOp})`);
            grad.addColorStop(1, `rgba(0,0,0,${endOp})`);
            mCtx.fillStyle = grad;
            mCtx.fillRect(0, 0, logicalWidth, logicalHeight);

            bCtx.globalCompositeOperation = 'destination-in';
            bCtx.drawImage(maskCanvas as CanvasImageSource, 0, 0, logicalWidth, logicalHeight);
            ctx.drawImage(blurredCanvas as CanvasImageSource, 0, 0, logicalWidth, logicalHeight);
        }
    }
};

// Kept for backward compat / type check if needed, but App uses renderAuraScene
export const processImage = renderAuraScene;
