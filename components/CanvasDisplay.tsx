
import React, { useRef, useEffect, useState, useCallback } from 'react';
import type { ControlParams } from '../types';
import { processImage } from '../utils/imageProcessing';

interface CanvasDisplayProps {
  image: HTMLImageElement | null;
  params: ControlParams;
  onProcessingChange: (isProcessing: boolean) => void;
  setCanvasRef: (ref: React.RefObject<HTMLCanvasElement>) => void;
  onFileChange: (file: File) => void;
  onParamUpdate: (updates: Partial<ControlParams>) => void;
  maskImage?: ImageBitmap | null;
  isProcessing?: boolean;
  showOverlay?: boolean; // New Prop
}

export const CanvasDisplay: React.FC<CanvasDisplayProps> = ({ 
    image, 
    params, 
    onProcessingChange, 
    setCanvasRef, 
    onFileChange,
    onParamUpdate,
    maskImage,
    isProcessing,
    showOverlay = false
}) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [dimensions, setDimensions] = useState({ width: 800, height: 1000 });
    const [isDraggingFile, setIsDraggingFile] = useState(false);
    
    // Drag state
    const [dragTarget, setDragTarget] = useState<'blurStart' | 'blurEnd' | null>(null);

    useEffect(() => {
        setCanvasRef(canvasRef);
    }, [setCanvasRef]);

    useEffect(() => {
        const resizeCanvas = () => {
            if (!containerRef.current) return;
            const containerW = containerRef.current.clientWidth;
            const containerH = containerRef.current.clientHeight;
            
            // Force 4:5 Aspect Ratio
            const targetAspect = 4 / 5; 

            let h = containerH;
            let w = h * targetAspect;

            if (w > containerW) {
                w = containerW;
                h = w / targetAspect;
            }
            setDimensions({ width: w, height: h });
        };
        
        resizeCanvas();
        window.addEventListener('resize', resizeCanvas);
        return () => window.removeEventListener('resize', resizeCanvas);

    }, [image]);

    useEffect(() => {
        if (!image || !canvasRef.current) return;
        
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) return;

        // Render once per prop update
        processImage(ctx, image, params, maskImage);
        
        // --- OVERLAYS ---
        // Only draw overlays if enabled AND showOverlay (Advanced Mode) is true
        if (params.progressiveBlur.enabled && showOverlay) {
            const { startX, startY, endX, endY } = params.progressiveBlur;
            const ax = startX * dimensions.width;
            const ay = startY * dimensions.height;
            const bx = endX * dimensions.width;
            const by = endY * dimensions.height;

            ctx.save();
            
            // Line
            ctx.beginPath();
            ctx.moveTo(ax, ay);
            ctx.lineTo(bx, by);
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
            ctx.lineWidth = 2;
            ctx.stroke();

            // Start Handle
            ctx.beginPath();
            ctx.arc(ax, ay, 8, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(0, 255, 200, 0.8)';
            ctx.fill();
            ctx.strokeStyle = 'white';
            ctx.stroke();
            ctx.fillStyle = 'black';
            ctx.font = '10px sans-serif';
            ctx.fillText('A', ax - 3, ay + 3);

            // End Handle
            ctx.beginPath();
            ctx.arc(bx, by, 8, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(255, 0, 100, 0.8)';
            ctx.fill();
            ctx.strokeStyle = 'white';
            ctx.stroke();
            ctx.fillStyle = 'white';
            ctx.fillText('B', bx - 3, by + 3);

            ctx.restore();
        }
    }, [image, params, dimensions, maskImage, showOverlay]);

    // -- Dragging Logic --

    const getMousePos = (e: React.MouseEvent | React.TouchEvent) => {
        if (!canvasRef.current) return { x: 0, y: 0 };
        const rect = canvasRef.current.getBoundingClientRect();
        const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
        const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
        return {
            x: (clientX - rect.left) / rect.width,
            y: (clientY - rect.top) / rect.height
        };
    };

    const handlePointerDown = (e: React.MouseEvent | React.TouchEvent) => {
        if (!image || !canvasRef.current) return;
        // Disable drag if overlays aren't visible
        if (!showOverlay) return;

        const pos = getMousePos(e);
        const pX = pos.x * dimensions.width;
        const pY = pos.y * dimensions.height;
        
        if (params.progressiveBlur.enabled) {
            const { startX, startY, endX, endY } = params.progressiveBlur;
            const ax = startX * dimensions.width;
            const ay = startY * dimensions.height;
            const bx = endX * dimensions.width;
            const by = endY * dimensions.height;
            
            const hitDist = 15;

            const distA = Math.sqrt(Math.pow(pX - ax, 2) + Math.pow(pY - ay, 2));
            if (distA < hitDist) {
                setDragTarget('blurStart');
                return;
            }

            const distB = Math.sqrt(Math.pow(pX - bx, 2) + Math.pow(pY - by, 2));
            if (distB < hitDist) {
                setDragTarget('blurEnd');
                return;
            }
        }
    };

    const handlePointerMove = (e: React.MouseEvent | React.TouchEvent) => {
        if (!dragTarget) return;
        
        const pos = getMousePos(e);
        const x = Math.max(0, Math.min(1, pos.x));
        const y = Math.max(0, Math.min(1, pos.y));

        if (dragTarget === 'blurStart') {
            onParamUpdate({
                progressiveBlur: { ...params.progressiveBlur, startX: x, startY: y }
            });
        } else if (dragTarget === 'blurEnd') {
             onParamUpdate({
                progressiveBlur: { ...params.progressiveBlur, endX: x, endY: y }
            });
        }
    };

    const handlePointerUp = () => {
        setDragTarget(null);
    };

    const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDraggingFile(true);
    }, []);

    const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDraggingFile(false);
    }, []);

    const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDraggingFile(false);
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            onFileChange(e.dataTransfer.files[0]);
        }
    }, [onFileChange]);

    return (
        <div 
            ref={containerRef}
            className="flex-grow flex items-center justify-center bg-[var(--bg-primary)] p-8 overflow-hidden relative transition-colors duration-300"
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
        >
            {image ? (
                <>
                    <canvas 
                        ref={canvasRef} 
                        width={dimensions.width} 
                        height={dimensions.height} 
                        className={`max-w-full max-h-full object-contain shadow-2xl shadow-black/30 cursor-crosshair touch-none transition-opacity duration-300 ${isProcessing ? 'opacity-50 blur-sm' : 'opacity-100'}`}
                        style={{
                            backgroundImage: "linear-gradient(45deg, var(--bg-secondary) 25%, transparent 25%), linear-gradient(-45deg, var(--bg-secondary) 25%, transparent 25%), linear-gradient(45deg, transparent 75%, var(--bg-secondary) 75%), linear-gradient(-45deg, transparent 75%, var(--bg-secondary) 75%)",
                            backgroundSize: "20px 20px",
                            backgroundPosition: "0 0, 0 10px, 10px -10px, -10px 0px"
                        }}
                        onMouseDown={handlePointerDown}
                        onMouseMove={handlePointerMove}
                        onMouseUp={handlePointerUp}
                        onMouseLeave={handlePointerUp}
                        onTouchStart={handlePointerDown}
                        onTouchMove={handlePointerMove}
                        onTouchEnd={handlePointerUp}
                    />
                </>
            ) : (
                <div className={`w-full h-full border-2 border-dashed border-[var(--border-color)] rounded-2xl flex flex-col items-center justify-center text-[var(--text-secondary)] transition-colors ${isDraggingFile ? 'bg-[var(--bg-secondary)] border-[var(--accent)]' : ''}`}>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                    <h3 className="text-xl font-semibold text-[var(--text-primary)]">Drag & Drop an Image</h3>
                    <p>or use the Upload button to begin.</p>
                </div>
            )}
             {params.progressiveBlur.enabled && showOverlay && (
                <div className="absolute bottom-6 left-8 pointer-events-none text-[var(--text-secondary)] text-xs opacity-70">
                    Tip: Drag A/B points for blur.
                </div>
             )}
        </div>
    );
};
