
import { ControlParams, Orb, GradientStop } from './types';

// Palette: #FF73E5, #FF9239, #FFE23C, #57CFFF, #48FF73, #FF3939, #F3EFEA, #E6E1DB, #000000

const defaultSilhouetteStops = [
    { id: 'ss-stop-1', color: '#FF73E5', position: 0.0 },
    { id: 'ss-stop-2', color: '#FF9239', position: 1.0 },
];

const defaultBackSilStops = [
    { id: 'bs-stop-1', color: '#FF73E5', position: 0.0 },
    { id: 'bs-stop-2', color: '#FF9239', position: 1.0 },
];

const defaultOrbStops = (color1: string, color2: string): GradientStop[] => [
    { id: `os-${Date.now()}-1`, color: color1, position: 0 },
    { id: `os-${Date.now()}-2`, color: color2, position: 1 }
];

const createOrb = (id: string, name: string, x: number, y: number, color: string, radius: number, blur: number, opacity: number): Orb => ({
    id,
    name,
    x,
    y,
    radiusX: radius,
    radiusY: radius,
    scale: 1,
    rotation: 0,
    color,
    stops: defaultOrbStops(color, 'rgba(255,255,255,0)'),
    blur,
    opacity,
    type: 'solid'
});

export const SILHOUETTE_PRESETS = [
    // 1. Solid, MS: 1.00, Start(w:10, f:100->40), Mid(w:5, f:100->40), End(w:1, f:25->10), Op: 0.80
    { strokeScale: 1.00, strokeWidth: 10, blurStart: 40, strokeWidthMid: 5, blurMid: 40, strokeWidthEnd: 1, blurEnd: 10, opacity: 0.80 },
    // 2. Solid, MS: 1.20, Start(w:25, f:50->25), Mid(w:20, f:20->10), End(w:1, f:50->25), Op: 0.80
    { strokeScale: 1.20, strokeWidth: 25, blurStart: 25, strokeWidthMid: 20, blurMid: 10, strokeWidthEnd: 1, blurEnd: 25, opacity: 0.80 },
    // 3. Solid, MS: 1.50, Start(w:40, f:45->20), Mid(w:1, f:60->30), End(w:1, f:10->5), Op: 0.80
    { strokeScale: 1.50, strokeWidth: 40, blurStart: 20, strokeWidthMid: 1, blurMid: 30, strokeWidthEnd: 1, blurEnd: 5, opacity: 0.80 },
    // 4. Solid, MS: 2.00, Start(w:50, f:30->15), Mid(w:5, f:30->15), End(w:2, f:40->20), Op: 0.80
    { strokeScale: 2.00, strokeWidth: 50, blurStart: 15, strokeWidthMid: 5, blurMid: 15, strokeWidthEnd: 2, blurEnd: 20, opacity: 0.80 },
    // 5. Solid, MS: 2.20, Start(w:50, f:80->30), Mid(w:4, f:100->50), End(w:1, f:100->50), Op: 0.80
    { strokeScale: 2.20, strokeWidth: 50, blurStart: 30, strokeWidthMid: 4, blurMid: 50, strokeWidthEnd: 1, blurEnd: 50, opacity: 0.80 },
    
    // Derived Presets (Learned Styles) - Scaled down blur and set opacity 0.80
    // 6. The Soft Taper (High scale, smooth reduction)
    { strokeScale: 1.80, strokeWidth: 40, blurStart: 40, strokeWidthMid: 15, blurMid: 30, strokeWidthEnd: 2, blurEnd: 10, opacity: 0.80 },
    // 7. The Bulge (Thin ends, thick middle)
    { strokeScale: 1.30, strokeWidth: 5, blurStart: 25, strokeWidthMid: 30, blurMid: 15, strokeWidthEnd: 5, blurEnd: 25, opacity: 0.80 },
    // 8. The Dissolve (Sharp start -> Blurred/Thin end)
    { strokeScale: 2.00, strokeWidth: 45, blurStart: 5, strokeWidthMid: 20, blurMid: 25, strokeWidthEnd: 1, blurEnd: 50, opacity: 0.80 },
    // 9. The Fade-Away (Uniform width, progressive blur)
    { strokeScale: 1.00, strokeWidth: 15, blurStart: 0, strokeWidthMid: 15, blurMid: 25, strokeWidthEnd: 15, blurEnd: 50, opacity: 0.80 },
    // 10. The Hourglass (Thick ends, thin middle)
    { strokeScale: 1.50, strokeWidth: 30, blurStart: 20, strokeWidthMid: 2, blurMid: 40, strokeWidthEnd: 30, blurEnd: 20, opacity: 0.80 },
];

export const DEFAULT_PARAMS: ControlParams = {
  stabilityApiKey: 'sk-smgCQfmeVhFkQIAq8z0BXD3mMIItFuRCGiBKtJRblN6KM3bE',
  showBackgroundOrbs: true,
  showForegroundOrbs: true,
  silhouette: {
    mode: 'solid',
    gradientType: 'linear',
    color: '#F3EFEA', 
    gradientStops: defaultSilhouetteStops,
    roundness: 4, 
    backSilhouette: {
        enabled: true,
        strokeWidth: 4,      
        strokeWidthMid: 12,  
        strokeWidthEnd: 2,   
        strokeScale: 1,
        mode: 'solid',
        color: '#FF73E5',    
        gradientStops: defaultBackSilStops,
        blurStart: 5,
        blurMid: 5,
        blurEnd: 5,            
        opacity: 0.8,        
        xOffset: 0,
        yOffset: 0
    },
    innerSilhouette: {
        enabled: false,
        strokeWidth: 0,
        strokeWidthMid: 0,
        strokeWidthEnd: 0,
        strokeScale: 1,
        mode: 'solid',
        color: '#FFFFFF',
        gradientStops: [],
        blurStart: 0,
        blurMid: 0,
        blurEnd: 0,
        opacity: 1.0,
        xOffset: 0,
        yOffset: 0
    }
  },
  background: {
    color: '#F3EFEA',
  },
  backgroundOrbs: [
      // L - Large (Scale 2.0) - Bottom Right - Pink
      { ...createOrb('bg-orb-2', 'L', 0.75, 0.75, '#FF73E5', 165, 128, 0.54), scale: 2.0 },
      // M - Medium (Scale 1.0) - Left - Orange
      { ...createOrb('bg-orb-1', 'M', 0.25, 0.5, '#FF9239', 165, 128, 0.54), scale: 1.0 },
      // S - Small (Scale 0.8) - Top Center - Pink
      { ...createOrb('bg-orb-3', 'S', 0.45, 0.3, '#FF73E5', 165, 128, 0.54), scale: 0.8 },
      // XS - Extra Small - Top Right - Orange
      { ...createOrb('bg-orb-4', 'XS', 0.8, 0.25, '#FF9239', 165, 128, 0.54), scale: 0.575 },
  ],
  foregroundOrbs: [
      // FG 1 - Top Right - Round - Orange
      { 
          ...createOrb('fg-orb-1', 'FG - Top Right', 0.70, 0.35, '#FF9239', 200, 88, 0.7), 
          radiusX: 200, 
          radiusY: 200, 
          rotation: 45 
      },
      // FG 2 - Bottom Left - Round - Pink
      { 
          ...createOrb('fg-orb-2', 'FG - Bottom Left', 0.30, 0.65, '#FF73E5', 200, 88, 0.7), 
          radiusX: 200, 
          radiusY: 200, 
          rotation: 135 
      },
  ],
  progressiveBlur: {
      enabled: false,
      // Default: Sharp Edge on Left (0.0) -> Blurry Center (0.5)
      // High blur (15) always in center, Low blur (0) on edge
      startX: 0.0,
      startY: 0.5,
      endX: 0.5,
      endY: 0.5,
      startBlur: 0,
      endBlur: 15
  }
};
