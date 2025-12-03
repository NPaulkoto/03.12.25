

export interface GradientStop {
  id: string;
  color: string;
  position: number; // 0 to 1
}

export type OrbType = 'solid' | 'radial';

export interface Orb {
  id: string;
  name: string; // Added for user labeling
  x: number; // Normalized 0-1
  y: number; // Normalized 0-1
  radiusX: number; // Pixel size X
  radiusY: number; // Pixel size Y
  scale?: number;
  rotation: number; // Degrees 0-360
  color: string; // Used for solid type
  stops: GradientStop[]; // Used for radial type
  opacity: number;
  blur: number; // CSS filter blur amount
  type: OrbType;
}

export interface SilhouetteLayerParams {
    enabled: boolean;
    strokeWidth: number;     // Start Width
    strokeWidthMid: number;  // Middle Width (at 50% X)
    strokeWidthEnd: number;  // End Width
    strokeScale: number;     // Master multiplier for width
    mode: 'solid' | 'gradient';
    color: string;
    gradientStops: GradientStop[];
    blurStart: number;       // Start Fade
    blurMid: number;         // Middle Fade
    blurEnd: number;         // End Fade
    opacity: number;
    xOffset: number;
    yOffset: number;
}

export interface ProgressiveBlurParams {
    enabled: boolean;
    startX: number;
    startY: number;
    endX: number;
    endY: number;
    startBlur: number;
    endBlur: number;
}

export interface ControlParams {
  stabilityApiKey?: string; // New: API Key for SD3 Background Removal
  showBackgroundOrbs: boolean; 
  showForegroundOrbs: boolean; 
  silhouette: {
    mode: 'solid' | 'gradient';
    color: string; 
    gradientStops: GradientStop[]; 
    gradientType: 'linear' | 'radial';
    roundness: number; 
    
    backSilhouette: SilhouetteLayerParams;
    
    innerSilhouette?: SilhouetteLayerParams;
  };
  background: {
    color: string; 
  };
  backgroundOrbs: Orb[];
  foregroundOrbs: Orb[]; 
  progressiveBlur: ProgressiveBlurParams;
}