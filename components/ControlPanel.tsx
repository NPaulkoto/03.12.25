
import React from 'react';
import type { ControlParams } from '../types';

interface ControlPanelProps {
  params: ControlParams;
  setParams: React.Dispatch<Partial<ControlParams>>;
  onFileChange: (file: File) => void;
  onDownload: () => void;
  isProcessing: boolean;
  hasImage: boolean;
  onApplyColorPairing: (colors: string[]) => void;
  onRandomizePositions: () => void;
  onRandomizeSilhouette: () => void;
  onShuffleAll: () => void; 
  theme: 'dark' | 'light';
  toggleTheme: () => void;
  showAdvanced: boolean;
  setShowAdvanced: (v: boolean) => void;
}

const THEME_COLORS = [
    { value: '#F3EFEA', label: 'Off-White' },
    { value: '#E6E1DB', label: 'Warm Grey' },
    { value: '#000000', label: 'Black' },
    { value: 'transparent', label: 'Transparent' }
];

const COLOR_PAIRINGS = [
    ['#FF73E5', '#FF9239'], 
    ['#FF9239', '#FFE23C'], 
    ['#57CFFF', '#FF73E5'], 
    ['#48FF73', '#FFE23C'],
    ['#FF3939', '#FF9239'],
];

const ThemeColorPicker: React.FC<{ label: string, value: string, onChange: (c: string) => void }> = ({ label, value, onChange }) => (
    <div className="mb-4">
        <label className="flex justify-between items-center text-xs font-medium text-[var(--text-secondary)] mb-2">
            <span>{label}</span>
            <span className="font-mono text-[10px] text-[var(--text-primary)] opacity-50">{value === 'transparent' ? 'NONE' : value.toUpperCase()}</span>
        </label>
        <div className="flex gap-2">
            {THEME_COLORS.map((opt) => (
                <button
                    key={opt.value}
                    onClick={() => onChange(opt.value)}
                    title={opt.label}
                    className={`w-8 h-8 rounded-lg border border-[var(--border-color)] shadow-sm transition-all relative overflow-hidden ${
                        value === opt.value
                        ? 'ring-2 ring-[var(--accent)] scale-110 z-10' 
                        : 'hover:scale-105'
                    }`}
                    style={{ 
                        backgroundColor: opt.value === 'transparent' ? 'transparent' : opt.value,
                    }}
                >
                     {opt.value === 'transparent' && (
                         <div className="absolute inset-0 bg-[linear-gradient(45deg,#ccc_25%,transparent_25%),linear-gradient(-45deg,#ccc_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#ccc_75%),linear-gradient(-45deg,transparent_75%,#ccc_75%)] bg-[length:6px_6px] opacity-20"></div>
                     )}
                     {(opt.value === '#F3EFEA' || opt.value === '#E6E1DB') && (
                         <div className="absolute inset-0 border border-black/10 rounded-lg"></div>
                     )}
                     {opt.value === '#000000' && (
                         <div className="absolute inset-0 border border-white/20 rounded-lg"></div>
                     )}
                </button>
            ))}
        </div>
    </div>
);

const ColorPairings: React.FC<{ onApply: (colors: string[]) => void }> = ({ onApply }) => (
    <div className="mb-4">
         <label className="text-xs font-medium text-[var(--text-secondary)] mb-2 block">Color Pairings</label>
         <div className="grid grid-cols-5 gap-2">
            {COLOR_PAIRINGS.map((pair, index) => (
                <button
                    key={index}
                    onClick={() => onApply(pair)}
                    className="h-8 rounded-lg border border-[var(--border-color)] shadow-sm overflow-hidden flex hover:scale-105 transition-transform"
                    title={`Apply ${pair[0]} & ${pair[1]}`}
                >
                    <div className="flex-1 h-full" style={{ backgroundColor: pair[0] }} />
                    <div className="flex-1 h-full" style={{ backgroundColor: pair[1] }} />
                </button>
            ))}
         </div>
    </div>
);

const Slider: React.FC<{label: string, value: number, min: number, max: number, step: number, onChange: (v: number) => void}> = 
({ label, value, min, max, step, onChange }) => (
    <div className="mb-4">
        <label className="flex justify-between items-center text-xs font-medium text-[var(--text-secondary)] mb-1.5">
            <span>{label}</span>
            <span className="font-mono text-[10px] text-[var(--text-primary)] bg-[var(--bg-tertiary)] px-1.5 py-0.5 rounded">{value.toFixed(step < 1 ? 2 : 0)}</span>
        </label>
        <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(parseFloat(e.target.value))} />
    </div>
);

const SectionHeader: React.FC<{title: string, onAdd?: () => void, isEnabled?: boolean, onToggle?: (v: boolean) => void}> = ({ title, onAdd, isEnabled, onToggle }) => (
    <div className="flex justify-between items-center mb-3 mt-6 px-1">
        <div className="flex items-center gap-2">
            <h3 className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-widest">{title}</h3>
            {onToggle && (
                 <input 
                    type="checkbox" 
                    checked={isEnabled} 
                    onChange={(e) => onToggle(e.target.checked)}
                    className="w-3 h-3 rounded bg-[var(--bg-primary)] border-[var(--border-color)]"
                    title="Toggle Visibility"
                />
            )}
        </div>
        {onAdd && (
            <button onClick={onAdd} className="w-6 h-6 flex items-center justify-center rounded hover:bg-[var(--bg-tertiary)] text-[var(--text-primary)] transition-colors text-sm" title="Add Light">
                +
            </button>
        )}
    </div>
);


export const ControlPanel: React.FC<ControlPanelProps> = ({ 
    params, setParams, onFileChange, onDownload, isProcessing, hasImage, 
    onApplyColorPairing, onRandomizePositions, onRandomizeSilhouette, onShuffleAll,
    theme, toggleTheme, showAdvanced, setShowAdvanced
}) => {
    
    const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
        if (event.target.files && event.target.files[0]) {
            onFileChange(event.target.files[0]);
        }
    };

    const handleThemeChange = (color: string) => {
        setParams({
            background: { ...params.background, color: color },
            silhouette: { ...params.silhouette, color: color } 
        });
    };

    const updateSilLayer = (layer: 'backSilhouette' | 'innerSilhouette', updates: any) => {
        setParams({
            silhouette: {
                ...params.silhouette,
                [layer]: {
                    ...params.silhouette[layer],
                    ...updates
                }
            }
        });
    }

    return (
        <div className="w-full md:w-[340px] bg-[var(--bg-secondary)] flex-shrink-0 h-full flex flex-col border-r border-[var(--border-color)] transition-colors duration-300">
            
            <div className="p-5 border-b border-[var(--border-color)] bg-[var(--bg-secondary)] z-10 flex justify-between items-center">
                 <h1 className="text-sm font-bold text-[var(--text-primary)]">Hush Tool</h1>
                 <div className="flex items-center gap-3">
                    <button 
                        onClick={() => setShowAdvanced(!showAdvanced)}
                        className="text-[10px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] flex items-center gap-1"
                    >
                        {showAdvanced ? (
                            <>
                                <span>Advanced</span>
                                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 21v-7"/><path d="M4 10V3"/><path d="M12 21v-9"/><path d="M12 8V3"/><path d="M20 21v-5"/><path d="M20 12V3"/><path d="M1 14h6"/><path d="M9 8h6"/><path d="M17 16h6"/></svg>
                            </>
                        ) : (
                            <>
                                <span>Simple</span>
                                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 21v-7"/><path d="M4 10V3"/><path d="M12 21v-9"/><path d="M12 8V3"/><path d="M20 21v-5"/><path d="M20 12V3"/><path d="M1 14h6"/><path d="M9 8h6"/><path d="M17 16h6"/></svg>
                            </>
                        )}
                    </button>
                    <button 
                        onClick={toggleTheme}
                        className="w-8 h-8 rounded-full bg-[var(--bg-primary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border-color)] flex items-center justify-center transition-all"
                        title={theme === 'dark' ? "Switch to Light Mode" : "Switch to Dark Mode"}
                     >
                        {theme === 'dark' ? (
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>
                        ) : (
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
                        )}
                     </button>
                 </div>
            </div>

            <div className="flex-1 overflow-y-auto p-5 custom-scrollbar">
                
                <div className="mb-4">
                    <SectionHeader 
                        title="1. Background Lights" 
                        isEnabled={params.showBackgroundOrbs}
                        onToggle={(v) => setParams({ showBackgroundOrbs: v })}
                    />
                    <div className="pl-2 border-l-2 border-[var(--border-color)] mb-4">
                         <ThemeColorPicker label="Base Theme" value={params.background.color} onChange={handleThemeChange} />
                         <ColorPairings onApply={onApplyColorPairing} />
                         
                         <div className="grid grid-cols-3 gap-2 mt-4">
                            <label 
                                htmlFor="file-upload" 
                                className={`flex items-center justify-center bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white text-xs font-semibold py-2.5 px-2 rounded-lg cursor-pointer transition-colors shadow-lg shadow-blue-900/20 text-center truncate`}
                                title="Upload Photo"
                            >
                                {isProcessing ? '...' : 'Upload'}
                            </label>
                            <input id="file-upload" type="file" accept="image/png, image/jpeg" onChange={handleFileSelect} className="hidden" />
                            
                            <button 
                                onClick={onShuffleAll} 
                                className="flex items-center justify-center bg-[var(--bg-tertiary)] hover:bg-[var(--border-color)] text-[var(--text-primary)] text-xs font-semibold py-2.5 px-2 rounded-lg transition-colors border border-[var(--border-color)] truncate"
                                title="Randomize All Settings"
                            >
                                Randomize
                            </button>

                            <button 
                                onClick={onDownload} 
                                disabled={isProcessing || !hasImage} 
                                className="flex items-center justify-center bg-[var(--bg-tertiary)] hover:bg-[var(--border-color)] disabled:opacity-50 text-[var(--text-primary)] text-xs font-semibold py-2.5 px-2 rounded-lg transition-colors border border-[var(--border-color)] truncate"
                                title="Download Result"
                            >
                                Download
                            </button>
                        </div>
                    </div>
                </div>

                {showAdvanced && (
                    <>
                        <hr className="border-[var(--border-color)] my-6 opacity-50" />

                        <div className="mb-8">
                            <SectionHeader title="2. Subject Silhouette" />
                            <div className="bg-[var(--bg-tertiary)]/30 rounded-xl p-4 border border-[var(--border-color)]">
                                
                                <div className="mb-0">
                                    <div className="flex justify-between items-center mb-3">
                                        <span className="text-xs font-bold text-[var(--text-secondary)] BACK SILHOUETTE">BACK SILHOUETTE</span>
                                        <div className="flex items-center gap-2">
                                             <button 
                                                onClick={onRandomizeSilhouette}
                                                className="text-[10px] font-semibold uppercase bg-[var(--bg-primary)] hover:bg-[var(--bg-tertiary)] text-[var(--text-primary)] border border-[var(--border-color)] px-2 py-1 rounded transition-all"
                                                title="Shuffle Silhouette Style Only"
                                            >
                                                Shuffle Style
                                            </button>
                                            <input 
                                                type="checkbox" 
                                                checked={params.silhouette.backSilhouette.enabled}
                                                onChange={(e) => updateSilLayer('backSilhouette', { enabled: e.target.checked })}
                                                className="w-4 h-4 rounded bg-[var(--bg-primary)] border-[var(--border-color)]"
                                            />
                                        </div>
                                    </div>
                                    
                                    {params.silhouette.backSilhouette.enabled && (
                                        <div className="pl-2 border-l-2 border-[var(--border-color)]">
                                            
                                             <div className="flex bg-[var(--bg-primary)] p-1 rounded-lg mb-4 border border-[var(--border-color)]">
                                                <button onClick={() => updateSilLayer('backSilhouette', { mode: 'solid' })} className={`flex-1 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all ${params.silhouette.backSilhouette.mode === 'solid' ? 'bg-[var(--bg-tertiary)] text-[var(--text-primary)] shadow-sm' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}>Solid</button>
                                                <button onClick={() => updateSilLayer('backSilhouette', { mode: 'gradient' })} className={`flex-1 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all ${params.silhouette.backSilhouette.mode === 'gradient' ? 'bg-[var(--bg-tertiary)] text-[var(--text-primary)] shadow-sm' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}>Gradient</button>
                                            </div>
                                            
                                            <Slider label="Master Scale" value={params.silhouette.backSilhouette.strokeScale || 1} min={0.1} max={3} step={0.1} onChange={(v) => updateSilLayer('backSilhouette', { strokeScale: v })} />

                                            <div className="mb-2 space-y-4">
                                                <div className="bg-[var(--bg-primary)]/50 p-2 rounded-lg border border-[var(--border-color)]/30">
                                                    <h4 className="text-[10px] font-bold text-[var(--text-secondary)] uppercase mb-2">Start (Left)</h4>
                                                    <Slider label="Width" value={params.silhouette.backSilhouette.strokeWidth} min={1} max={50} step={1} onChange={(v) => updateSilLayer('backSilhouette', { strokeWidth: v })} />
                                                    <Slider label="Fade" value={params.silhouette.backSilhouette.blurStart} min={0} max={100} step={1} onChange={(v) => updateSilLayer('backSilhouette', { blurStart: v })} />
                                                </div>

                                                <div className="bg-[var(--bg-primary)]/50 p-2 rounded-lg border border-[var(--border-color)]/30">
                                                    <h4 className="text-[10px] font-bold text-[var(--text-secondary)] uppercase mb-2">Middle</h4>
                                                    <Slider label="Width" value={params.silhouette.backSilhouette.strokeWidthMid || params.silhouette.backSilhouette.strokeWidth} min={1} max={50} step={1} onChange={(v) => updateSilLayer('backSilhouette', { strokeWidthMid: v })} />
                                                    <Slider label="Fade" value={params.silhouette.backSilhouette.blurMid} min={0} max={100} step={1} onChange={(v) => updateSilLayer('backSilhouette', { blurMid: v })} />
                                                </div>

                                                <div className="bg-[var(--bg-primary)]/50 p-2 rounded-lg border border-[var(--border-color)]/30">
                                                    <h4 className="text-[10px] font-bold text-[var(--text-secondary)] uppercase mb-2">End (Right)</h4>
                                                    <Slider label="Width" value={params.silhouette.backSilhouette.strokeWidthEnd || params.silhouette.backSilhouette.strokeWidth} min={1} max={50} step={1} onChange={(v) => updateSilLayer('backSilhouette', { strokeWidthEnd: v })} />
                                                    <Slider label="Fade" value={params.silhouette.backSilhouette.blurEnd} min={0} max={100} step={1} onChange={(v) => updateSilLayer('backSilhouette', { blurEnd: v })} />
                                                </div>
                                            </div>
                                            
                                            <div className="mt-4 pt-4 border-t border-[var(--border-color)]/30">
                                                <Slider label="Opacity" value={params.silhouette.backSilhouette.opacity} min={0} max={1} step={0.05} onChange={(v) => updateSilLayer('backSilhouette', { opacity: v })} />
                                            </div>
                                        </div>
                                    )}
                                </div>

                            </div>
                        </div>

                        <hr className="border-[var(--border-color)] my-6 opacity-50" />

                        <div className="mb-8">
                            <SectionHeader 
                                title="3. Foreground Lights" 
                                isEnabled={params.showForegroundOrbs}
                                onToggle={(v) => setParams({ showForegroundOrbs: v })}
                            />
                            <p className="text-[10px] text-[var(--text-secondary)] mb-3 px-1">Lights masked inside the silhouette.</p>
                        </div>

                        <div className="mb-8">
                            <div className="bg-[var(--bg-tertiary)]/20 p-3 rounded-lg border border-[var(--border-color)]">
                                <div className="flex justify-between items-center mb-3">
                                    <span className="text-xs font-bold text-[var(--text-secondary)] uppercase">Directional Blur</span>
                                    <input 
                                        type="checkbox" 
                                        checked={params.progressiveBlur.enabled}
                                        onChange={(e) => setParams({ progressiveBlur: { ...params.progressiveBlur, enabled: e.target.checked } })}
                                        className="w-4 h-4 rounded bg-[var(--bg-primary)] border-[var(--border-color)]"
                                    />
                                </div>
                                
                                {params.progressiveBlur.enabled && (
                                    <>
                                        <div className="flex flex-wrap items-center gap-2 mb-3">
                                            <span className="text-[10px] text-[var(--text-secondary)] font-medium">Presets:</span>
                                            <button 
                                                onClick={() => setParams({ progressiveBlur: { ...params.progressiveBlur, startX: 1.0, startY: 0.5, endX: 0.5, endY: 0.5 } })} 
                                                className="px-2 py-1 text-[10px] bg-[var(--bg-primary)] border border-[var(--border-color)] rounded hover:bg-[var(--bg-tertiary)] transition-colors"
                                            >
                                                Left
                                            </button>
                                            <button 
                                                onClick={() => setParams({ progressiveBlur: { ...params.progressiveBlur, startX: 0.0, startY: 0.5, endX: 0.5, endY: 0.5 } })} 
                                                className="px-2 py-1 text-[10px] bg-[var(--bg-primary)] border border-[var(--border-color)] rounded hover:bg-[var(--bg-tertiary)] transition-colors"
                                            >
                                                Right
                                            </button>
                                            <button 
                                                onClick={() => setParams({ progressiveBlur: { ...params.progressiveBlur, startX: 0.5, startY: 1.0, endX: 0.5, endY: 0.5 } })} 
                                                className="px-2 py-1 text-[10px] bg-[var(--bg-primary)] border border-[var(--border-color)] rounded hover:bg-[var(--bg-tertiary)] transition-colors"
                                            >
                                                Top
                                            </button>
                                            <button 
                                                onClick={() => setParams({ progressiveBlur: { ...params.progressiveBlur, startX: 0.5, startY: 0.0, endX: 0.5, endY: 0.5 } })} 
                                                className="px-2 py-1 text-[10px] bg-[var(--bg-primary)] border border-[var(--border-color)] rounded hover:bg-[var(--bg-tertiary)] transition-colors"
                                            >
                                                Bottom
                                            </button>
                                        </div>
                                        
                                        <Slider label="Start Blur (A)" value={params.progressiveBlur.startBlur} min={0} max={300} step={1} onChange={v => setParams({ progressiveBlur: { ...params.progressiveBlur, startBlur: v } })} />
                                        <Slider label="End Blur (B)" value={params.progressiveBlur.endBlur} min={0} max={300} step={1} onChange={v => setParams({ progressiveBlur: { ...params.progressiveBlur, endBlur: v } })} />
                                        <p className="text-[10px] text-[var(--text-secondary)] italic mt-2">Drag points A and B on the canvas to change direction.</p>
                                    </>
                                )}
                            </div>
                        </div>
                    </>
                )}

            </div>
        </div>
    );
};
