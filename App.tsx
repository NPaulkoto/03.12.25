
import React, { useState, useReducer, useCallback, useRef, useEffect } from 'react';
import { ControlPanel } from './components/ControlPanel';
import { CanvasDisplay } from './components/CanvasDisplay';
import { DEFAULT_PARAMS, SILHOUETTE_PRESETS } from './constants';
import type { ControlParams, Orb, GradientStop, SilhouetteLayerParams, ProgressiveBlurParams } from './types';
import { renderAuraScene, generateSoftMask, removeBackgroundSD3 } from './utils/imageProcessing';

const PARAMS_STORAGE_KEY = 'auraToolParams_v45';

function mergeParams(target: ControlParams, source: Partial<ControlParams>): ControlParams {
  const output: any = { ...target };
  for (const key in source) {
    const typedKey = key as keyof ControlParams;
    const sourceValue = source[typedKey];
    
    if (Array.isArray(sourceValue)) {
        output[typedKey] = sourceValue;
    } else if (sourceValue && typeof sourceValue === 'object') {
      const targetValue = target[typedKey];
      if (targetValue && typeof targetValue === 'object' && !Array.isArray(targetValue)) {
          output[typedKey] = {
            ...(targetValue as object),
            ...(sourceValue as object),
          };
      } else {
        output[typedKey] = sourceValue;
      }
    } else if(sourceValue !== undefined) {
      output[typedKey] = sourceValue;
    }
  }
  return output;
}

function loadInitialParams(): ControlParams {
    try {
        const saved = localStorage.getItem(PARAMS_STORAGE_KEY);
        if (saved) {
            const savedParams = JSON.parse(saved);
            return mergeParams(DEFAULT_PARAMS, savedParams);
        }
    } catch (error) {
        console.error("Failed to load saved params:", error);
    }
    return DEFAULT_PARAMS;
}

function paramsReducer(state: ControlParams, action: Partial<ControlParams>): ControlParams {
    return mergeParams(state, action);
}

function App() {
    const [image, setImage] = useState<HTMLImageElement | null>(null);
    const [maskImage, setMaskImage] = useState<ImageBitmap | null>(null);
    const [params, setParams] = useReducer(paramsReducer, loadInitialParams());
    const [isProcessing, setIsProcessing] = useState(false);
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    
    // UI State
    const [showAdvanced, setShowAdvanced] = useState(false);
    
    // Theme State
    const [theme, setTheme] = useState<'dark' | 'light'>('dark');

    // Toggle Theme
    const toggleTheme = useCallback(() => {
        setTheme(prev => prev === 'dark' ? 'light' : 'dark');
    }, []);

    // Apply Theme to Body
    useEffect(() => {
        if (theme === 'light') {
            document.body.classList.add('light-mode');
        } else {
            document.body.classList.remove('light-mode');
        }
    }, [theme]);

    useEffect(() => {
        try {
            localStorage.setItem(PARAMS_STORAGE_KEY, JSON.stringify(params));
        } catch (error) {
            console.error("Failed to save params:", error);
        }
    }, [params]);

    const handleFileChange = async (file: File) => {
        if (file) {
            setIsProcessing(true);
            setMaskImage(null); // Reset old mask

            // 1. Try SD3 API first if Key is present
            let mask: ImageBitmap | null = null;
            if (params.stabilityApiKey) {
                console.log("Calling Stability AI...");
                mask = await removeBackgroundSD3(file, params.stabilityApiKey);
                if (mask) {
                    console.log("Stability AI background removal successful.");
                } else {
                    console.log("Stability AI failed, falling back to local processing.");
                }
            }

            // 2. Fallback to Local Soft Mask if SD3 failed or no key
            if (!mask) {
                try {
                    console.log("Generating local soft mask...");
                    mask = await generateSoftMask(file);
                } catch (error) {
                    console.error("Failed to generate soft mask:", error);
                }
            }

            setMaskImage(mask);

            // 3. Load image for basic display
            const reader = new FileReader();
            reader.onload = async (e) => {
                const src = e.target?.result as string;
                const img = new Image();
                img.onload = () => {
                    setImage(img);
                    setIsProcessing(false);
                };
                img.src = src;
            };
            reader.readAsDataURL(file);
        }
    };

    const handleDownload = async () => {
        if (!image) return;
        setIsProcessing(true);

        // Fixed 4:5 Output Resolution (HD)
        const LOGICAL_WIDTH = 1080;
        const LOGICAL_HEIGHT = 1350; 
        
        const canvas = document.createElement('canvas');
        canvas.width = LOGICAL_WIDTH;
        canvas.height = LOGICAL_HEIGHT;
        const ctx = canvas.getContext('2d');
        
        if (!ctx) {
             setIsProcessing(false);
             return;
        }

        // NO SCALING HACKS.
        // We render exactly as defined in logical coordinates (1080p).
        // The preview matches this because it uses a scaled transform of these exact same coords.
        ctx.setTransform(1, 0, 0, 1, 0, 0);

        renderAuraScene(ctx, LOGICAL_WIDTH, LOGICAL_HEIGHT, image, params, maskImage);

        // 4. Download
        const link = document.createElement('a');
        link.download = 'aura-export.png';
        link.href = canvas.toDataURL('image/png');
        link.click();
        
        setIsProcessing(false);
    };

    const setCanvasRefCallback = useCallback((ref: React.RefObject<HTMLCanvasElement>) => {
        if (ref.current) canvasRef.current = ref.current;
    }, []);

    const handleApplyColorPairing = (colors: string[]) => {
        // Evenly distribute colors: Alternating logic (A, B, A, B...)
        
        // Update Background Orbs
        const newBgOrbs = params.backgroundOrbs.map((orb, index) => {
            const c = colors[index % colors.length];
            return {
                ...orb,
                color: c,
                stops: orb.stops.length > 0 ? [{...orb.stops[0], color: c}, orb.stops[1]] : orb.stops
            };
        });

        // Update Foreground Orbs
        const newFgOrbs = params.foregroundOrbs.map((orb, index) => {
            const c = colors[index % colors.length];
            return {
                ...orb,
                color: c,
                stops: orb.stops.length > 0 ? [{...orb.stops[0], color: c}, orb.stops[1]] : orb.stops
            };
        });

        // Update Subject Silhouette (Main) - Gradient Stops Only
        const newMainSil = {
             ...params.silhouette,
             gradientStops: [
                 { id: `ss-stop-${Date.now()}-1`, color: colors[0], position: 0 },
                 { id: `ss-stop-${Date.now()}-2`, color: colors[1], position: 1 }
             ]
        };

        // Update Back Silhouette
        const newBackSil = {
             ...params.silhouette.backSilhouette,
             color: colors[0],
             gradientStops: [
                 { id: `bs-stop-${Date.now()}-1`, color: colors[0], position: 0 },
                 { id: `bs-stop-${Date.now()}-2`, color: colors[1], position: 1 }
             ]
        };

        setParams({
            backgroundOrbs: newBgOrbs,
            foregroundOrbs: newFgOrbs,
            silhouette: {
                ...newMainSil,
                backSilhouette: newBackSil
            }
        });
    };

    // --- Helper Logic for Randomization ---

    const calculateRandomPositions = (bgOrbs: Orb[], fgOrbs: Orb[]): { bgOrbs: Orb[], fgOrbs: Orb[] } => {
        // 1. BACKGROUND LIGHTS - Quadrant distribution
        const quadrants = [
            { xMin: 0.1, xMax: 0.45, yMin: 0.1, yMax: 0.45 }, // Top-Left
            { xMin: 0.55, xMax: 0.9, yMin: 0.1, yMax: 0.45 }, // Top-Right
            { xMin: 0.1, xMax: 0.45, yMin: 0.55, yMax: 0.9 }, // Bottom-Left
            { xMin: 0.55, xMax: 0.9, yMin: 0.55, yMax: 0.9 }  // Bottom-Right
        ];
        
        // Shuffle quadrants
        for (let i = quadrants.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [quadrants[i], quadrants[j]] = [quadrants[j], quadrants[i]];
        }

        const newBgOrbs = bgOrbs.map((orb, index) => {
            const quad = quadrants[index % quadrants.length];
            return {
                ...orb,
                x: quad.xMin + Math.random() * (quad.xMax - quad.xMin),
                y: quad.yMin + Math.random() * (quad.yMax - quad.yMin)
            };
        });

        // 2. FOREGROUND LIGHTS
        const angle1 = (Math.PI / 4) + (Math.random() * (Math.PI / 2)); // 45 to 135 deg
        const dist1 = 0.2 + Math.random() * 0.15;
        const x1 = 0.5 + Math.cos(angle1) * dist1 * 0.8;
        const y1 = 0.5 + Math.sin(angle1) * dist1;
        
        const finalY1 = Math.max(0.66, Math.min(0.9, y1));
        const finalX1 = Math.max(0.1, Math.min(0.9, x1));
        const rot1 = (angle1 * 180 / Math.PI) + 45;

        const isRight1 = finalX1 > 0.5;
        let minAngle2, maxAngle2;

        if (isRight1) {
             minAngle2 = 3 * Math.PI / 4;
             maxAngle2 = 3 * Math.PI / 2;
        } else {
             minAngle2 = -Math.PI / 2;
             maxAngle2 = Math.PI / 4;
        }
        
        const angle2 = minAngle2 + Math.random() * (maxAngle2 - minAngle2);
        const dist2 = 0.2 + Math.random() * 0.15;
        const x2 = 0.5 + Math.cos(angle2) * dist2 * 0.8;
        const y2 = 0.5 + Math.sin(angle2) * dist2;
        
        const finalY2 = Math.max(0.1, Math.min(0.65, y2));
        const finalX2 = Math.max(0.1, Math.min(0.9, x2));
        const rot2 = (angle2 * 180 / Math.PI) + 45;

        const newFgOrbs = fgOrbs.map((orb, index) => {
            if (index === 0) {
                return { ...orb, x: finalX1, y: finalY1, rotation: rot1 };
            } else if (index === 1) {
                return { ...orb, x: finalX2, y: finalY2, rotation: rot2 };
            } else {
                const angle = Math.random() * Math.PI * 2;
                const dist = 0.2 + Math.random() * 0.15;
                const x = 0.5 + Math.cos(angle) * dist * 0.8;
                const y = 0.5 + Math.sin(angle) * dist;
                return { 
                    ...orb, 
                    x: Math.max(0.1, Math.min(0.9, x)), 
                    y: Math.max(0.1, Math.min(0.9, y)),
                    rotation: (angle * 180 / Math.PI) + 45
                };
            }
        });

        return { bgOrbs: newBgOrbs, fgOrbs: newFgOrbs };
    };

    const calculateRandomSilhouette = (): Partial<SilhouetteLayerParams> => {
        const presets = SILHOUETTE_PRESETS;
        const preset = presets[Math.floor(Math.random() * presets.length)];

        // Flip Coin 1: Direction Flip
        const isFlipped = Math.random() > 0.5;
        // Flip Coin 2: Solid vs Gradient
        const isGradient = Math.random() > 0.5;

        return {
            strokeScale: preset.strokeScale,
            opacity: preset.opacity,
            strokeWidth: isFlipped ? preset.strokeWidthEnd : preset.strokeWidth,
            strokeWidthMid: preset.strokeWidthMid,
            strokeWidthEnd: isFlipped ? preset.strokeWidth : preset.strokeWidthEnd,
            blurStart: isFlipped ? preset.blurEnd : preset.blurStart,
            blurMid: preset.blurMid,
            blurEnd: isFlipped ? preset.blurStart : preset.blurEnd,
            mode: isGradient ? 'gradient' : 'solid'
        };
    };

    const calculateMatchingBlur = (silParams: Partial<SilhouetteLayerParams>): Partial<ProgressiveBlurParams> => {
        const startW = silParams.strokeWidth || 0;
        const endW = silParams.strokeWidthEnd || 0;
        
        const isLeftHeavy = startW >= endW;
        
        if (isLeftHeavy) {
            return {
                startX: 1.0, endX: 0.5,
                startY: 0.5, endY: 0.5,
                startBlur: 0, endBlur: 40, // Scaled default 15 * 2.7
                enabled: true
            };
        } else {
            return {
                startX: 0.0, endX: 0.5,
                startY: 0.5, endY: 0.5,
                startBlur: 0, endBlur: 40, // Scaled default 15 * 2.7
                enabled: true
            };
        }
    };

    // --- Action Handlers ---

    const handleRandomizePositions = () => {
        const { bgOrbs, fgOrbs } = calculateRandomPositions(params.backgroundOrbs, params.foregroundOrbs);
        setParams({
            backgroundOrbs: bgOrbs,
            foregroundOrbs: fgOrbs
        });
    };

    const handleRandomizeSilhouette = () => {
        const newSettings = calculateRandomSilhouette();
        const newBlur = calculateMatchingBlur(newSettings);
        
        setParams({
            silhouette: {
                ...params.silhouette,
                backSilhouette: {
                    ...params.silhouette.backSilhouette,
                    ...newSettings
                }
            },
            progressiveBlur: {
                ...params.progressiveBlur,
                ...newBlur
            }
        });
    };

    const handleShuffleAll = () => {
        const { bgOrbs, fgOrbs } = calculateRandomPositions(params.backgroundOrbs, params.foregroundOrbs);
        const newSilSettings = calculateRandomSilhouette();
        const newBlur = calculateMatchingBlur(newSilSettings);

        setParams({
            backgroundOrbs: bgOrbs,
            foregroundOrbs: fgOrbs,
            silhouette: {
                ...params.silhouette,
                backSilhouette: {
                    ...params.silhouette.backSilhouette,
                    ...newSilSettings
                }
            },
            progressiveBlur: {
                ...params.progressiveBlur,
                ...newBlur
            }
        });
    };

    return (
        <div className="flex flex-col md:flex-row h-screen w-screen bg-[var(--bg-primary)] transition-colors duration-300">
            <ControlPanel
                params={params}
                setParams={setParams}
                onFileChange={handleFileChange}
                onDownload={handleDownload}
                isProcessing={isProcessing}
                hasImage={!!image}
                onApplyColorPairing={handleApplyColorPairing}
                onRandomizePositions={handleRandomizePositions}
                onRandomizeSilhouette={handleRandomizeSilhouette}
                onShuffleAll={handleShuffleAll}
                theme={theme}
                toggleTheme={toggleTheme}
                showAdvanced={showAdvanced}
                setShowAdvanced={setShowAdvanced}
            />
            <CanvasDisplay
                image={image}
                params={params}
                onProcessingChange={setIsProcessing}
                setCanvasRef={setCanvasRefCallback}
                onFileChange={handleFileChange}
                onParamUpdate={setParams}
                maskImage={maskImage}
                isProcessing={isProcessing}
                showOverlay={showAdvanced}
            />
        </div>
    );
}

export default App;
