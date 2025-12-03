
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

// SCALED PRESETS (x2.7) for 1080p Logical Coordinates
export const SILHOUETTE_PRESETS = [
    // 1. Solid
    { strokeScale: 1.00, strokeWidth: 27, blurStart: 108, strokeWidthMid: 14, blurMid: 108, strokeWidthEnd: 3, blurEnd: 27, opacity: 0.80 },
    // 2. Solid
    { strokeScale: 1.20, strokeWidth: 68, blurStart: 68, strokeWidthMid: 54, blurMid: 27, strokeWidthEnd: 3, blurEnd: 68, opacity: 0.80 },
    // 3. Solid
    { strokeScale: 1.50, strokeWidth: 108, blurStart: 54, strokeWidthMid: 3, blurMid: 81, strokeWidthEnd: 3, blurEnd: 14, opacity: 0.80 },
    // 4. Solid
    { strokeScale: 2.00, strokeWidth: 135, blurStart: 40, strokeWidthMid: 14, blurMid: 40, strokeWidthEnd: 5, blurEnd: 54, opacity: 0.80 },
    // 5. Solid
    { strokeScale: 2.20, strokeWidth: 135, blurStart: 81, strokeWidthMid: 11, blurMid: 135, strokeWidthEnd: 3, blurEnd: 135, opacity: 0.80 },
    
    // Derived Presets (Learned Styles)
    // 6. The Soft Taper
    { strokeScale: 1.80, strokeWidth: 108, blurStart: 108, strokeWidthMid: 40, blurMid: 81, strokeWidthEnd: 5, blurEnd: 27, opacity: 0.80 },
    // 7. The Bulge
    { strokeScale: 1.30, strokeWidth: 14, blurStart: 68, strokeWidthMid: 81, blurMid: 40, strokeWidthEnd: 14, blurEnd: 68, opacity: 0.80 },
    // 8. The Dissolve
    { strokeScale: 2.00, strokeWidth: 122, blurStart: 14, strokeWidthMid: 54, blurMid: 68, strokeWidthEnd: 3, blurEnd: 135, opacity: 0.80 },
    // 9. The Fade-Away
    { strokeScale: 1.00, strokeWidth: 40, blurStart: 0, strokeWidthMid: 40, blurMid: 68, strokeWidthEnd: 40, blurEnd: 135, opacity: 0.80 },
    // 10. The Hourglass
    { strokeScale: 1.50, strokeWidth: 81, blurStart: 54, strokeWidthMid: 5, blurMid: 108, strokeWidthEnd: 81, blurEnd: 54, opacity: 0.80 },
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
    roundness: 11, // Scaled 4 * 2.7
    backSilhouette: {
        enabled: true,
        strokeWidth: 11,     // Scaled 4 * 2.7
        strokeWidthMid: 32,  // Scaled 12 * 2.7
        strokeWidthEnd: 5,   // Scaled 2 * 2.7
        strokeScale: 1,
        mode: 'solid',
        color: '#FF73E5',    
        gradientStops: defaultBackSilStops,
        blurStart: 14,       // Scaled 5 * 2.7
        blurMid: 14,
        blurEnd: 14,            
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
      // Scaled Radii (165 -> 445) and Blur (128 -> 345)
      // L - Large (Scale 2.0) - Bottom Right - Pink
      { ...createOrb('bg-orb-2', 'L', 0.75, 0.75, '#FF73E5', 445, 345, 0.54), scale: 2.0 },
      // M - Medium (Scale 1.0) - Left - Orange
      { ...createOrb('bg-orb-1', 'M', 0.25, 0.5, '#FF9239', 445, 345, 0.54), scale: 1.0 },
      // S - Small (Scale 0.8) - Top Center - Pink
      { ...createOrb('bg-orb-3', 'S', 0.45, 0.3, '#FF73E5', 445, 345, 0.54), scale: 0.8 },
      // XS - Extra Small - Top Right - Orange
      { ...createOrb('bg-orb-4', 'XS', 0.8, 0.25, '#FF9239', 445, 345, 0.54), scale: 0.575 },
  ],
  foregroundOrbs: [
      // Scaled Radii (200 -> 540) and Blur (88 -> 238)
      // FG 1 - Top Right - Round - Orange
      { 
          ...createOrb('fg-orb-1', 'FG - Top Right', 0.70, 0.35, '#FF9239', 540, 238, 0.7), 
          radiusX: 540, 
          radiusY: 540, 
          rotation: 45 
      },
      // FG 2 - Bottom Left - Round - Pink
      { 
          ...createOrb('fg-orb-2', 'FG - Bottom Left', 0.30, 0.65, '#FF73E5', 540, 238, 0.7), 
          radiusX: 540, 
          radiusY: 540, 
          rotation: 135 
      },
  ],
  progressiveBlur: {
      enabled: false,
      startX: 0.0,
      startY: 0.5,
      endX: 0.5,
      endY: 0.5,
      startBlur: 0,
      endBlur: 40 // Scaled 15 * 2.7
  }
};
