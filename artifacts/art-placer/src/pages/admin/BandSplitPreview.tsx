import { useRef } from 'react';
import { roomImageUrl } from '@/types';

interface BandSplitPreviewProps {
  imageFilename: string | undefined;
  bandSplit: number;
  onChange: (val: number) => void;
}

export function BandSplitPreview({ imageFilename, bandSplit, onChange }: BandSplitPreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  const handlePointerDown = (e: React.PointerEvent) => {
    const el = containerRef.current;
    if (!el) return;
    el.setPointerCapture(e.pointerId);
    updateSplit(e.clientY, el);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    const el = containerRef.current;
    if (!el || !el.hasPointerCapture(e.pointerId)) return;
    updateSplit(e.clientY, el);
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    const el = containerRef.current;
    if (!el) return;
    el.releasePointerCapture(e.pointerId);
  };

  const updateSplit = (clientY: number, el: HTMLDivElement) => {
    const rect = el.getBoundingClientRect();
    const y = clientY - rect.top;
    let pct = (y / rect.height) * 100;
    pct = Math.max(1, Math.min(99, pct));
    onChange(Math.round(pct));
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">Adjust the horizontal line to set the band split.</span>
        <span className="font-mono bg-muted px-2 py-0.5 rounded text-foreground font-medium">
          Split: {bandSplit}%
        </span>
      </div>
      
      <div 
        ref={containerRef}
        className="relative w-full aspect-[16/10] bg-card border border-border rounded-lg overflow-hidden cursor-ns-resize shadow-sm select-none touch-none"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        {imageFilename ? (
          <img 
            src={roomImageUrl(imageFilename)} 
            className="w-full h-full object-cover pointer-events-none" 
            alt="Room preview" 
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground font-serif bg-muted/30">
            <span className="mb-2">No image selected</span>
            <span className="text-xs font-sans">Required: 1600x1000px, 16:10</span>
          </div>
        )}
        
        {/* The draggable line */}
        <div 
          className="absolute left-0 right-0 h-[2px] bg-primary pointer-events-none flex items-center shadow-[0_0_8px_rgba(255,255,255,0.5)] z-10 transition-transform duration-75 ease-out"
          style={{ top: `${bandSplit}%` }}
        >
          {/* Handles to indicate it's draggable */}
          <div className="absolute left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-3 bg-primary rounded-full flex items-center justify-center shadow-md">
            <div className="w-4 h-0.5 bg-primary-foreground opacity-70" />
          </div>

          <div className="absolute left-4 -translate-y-1/2 bg-primary text-primary-foreground text-xs px-2 py-0.5 rounded font-mono shadow-sm">
            {bandSplit}%
          </div>
          <div className="absolute right-4 -translate-y-1/2 text-xs font-mono text-white drop-shadow-md bg-black/40 px-2 py-0.5 rounded backdrop-blur-sm">
            Wall above / Sculpture below
          </div>
        </div>
      </div>
    </div>
  );
}
