import { useEffect, useState } from 'react';
import { useStore } from '../state/Store';
import { artObjects } from '../data/objects';
import { Room } from '../types';
import { cn } from '@/lib/utils';

export function PlacementBand({ room, canvasRef }: { room: Room, canvasRef: React.RefObject<HTMLDivElement | null> }) {
  const { dragState, selectedObjectId, placeObject, setSelectedObjectId } = useStore();
  
  const activeObject = dragState 
    ? artObjects.find(o => o.id === dragState.objectId) 
    : selectedObjectId 
      ? artObjects.find(o => o.id === selectedObjectId) 
      : null;

  const showHighlight = !!activeObject;
  const isValidTop = activeObject?.type === 'wall';
  const isValidBottom = activeObject?.type === 'sculpture';
  const isInteractive = !!selectedObjectId && !dragState;

  // Crosshair tracking
  const [crosshairPos, setCrosshairPos] = useState<{ x: number, y: number } | null>(null);

  useEffect(() => {
    if (!dragState || !canvasRef.current || !activeObject) {
      setCrosshairPos(null);
      return;
    }
    const rect = canvasRef.current.getBoundingClientRect();
    const objectCenterX = dragState.clientX - dragState.offsetX + dragState.width / 2;
    const objectCenterY = dragState.clientY - dragState.offsetY + dragState.height / 2;
    
    const pctY = ((objectCenterY - rect.top) / rect.height) * 100;
    const isOverValid = activeObject.type === 'wall' ? pctY < room.bandSplit : pctY >= room.bandSplit;
    
    if (isOverValid) {
      setCrosshairPos({ x: objectCenterX - rect.left, y: objectCenterY - rect.top });
    } else {
      setCrosshairPos(null);
    }
  }, [dragState, canvasRef, activeObject, room.bandSplit]);

  const handleTapPlace = (e: React.MouseEvent, type: 'wall' | 'sculpture') => {
    if (!selectedObjectId || !canvasRef.current) return;
    const obj = artObjects.find(o => o.id === selectedObjectId)!;
    if (obj.type !== type) return;

    const rect = canvasRef.current.getBoundingClientRect();
    // Center it on the click
    const pctX = ((e.clientX - rect.left) / rect.width) * 100;
    const pctY = ((e.clientY - rect.top) / rect.height) * 100;

    placeObject({
      objectId: obj.id,
      roomId: room.id,
      x: pctX,
      y: pctY,
      scale: obj.defaultScale,
      band: obj.type
    });
    setSelectedObjectId(null);
  };

  if (!showHighlight) return null;

  return (
    <div className="absolute inset-0 z-10 flex flex-col pointer-events-none">
      <button
        className={cn(
          "w-full transition-colors duration-500 outline-none focus-visible:ring-inset focus-visible:ring-4 focus-visible:ring-primary/30",
          isInteractive ? "pointer-events-auto" : "pointer-events-none",
          isValidTop ? (isInteractive ? "cursor-crosshair bg-white/5 hover:bg-white/10" : "bg-white/5") : "bg-black/30 backdrop-blur-[2px]"
        )}
        style={{ height: `${room.bandSplit}%` }}
        disabled={!isValidTop || !isInteractive}
        onClick={(e) => handleTapPlace(e, 'wall')}
        aria-label={isValidTop ? "Place wall art" : "Invalid area"}
      />
      <button
        className={cn(
          "w-full transition-colors duration-500 outline-none focus-visible:ring-inset focus-visible:ring-4 focus-visible:ring-primary/30",
          isInteractive ? "pointer-events-auto" : "pointer-events-none",
          isValidBottom ? (isInteractive ? "cursor-crosshair bg-white/5 hover:bg-white/10" : "bg-white/5") : "bg-black/30 backdrop-blur-[2px]"
        )}
        style={{ height: `${100 - room.bandSplit}%` }}
        disabled={!isValidBottom || !isInteractive}
        onClick={(e) => handleTapPlace(e, 'sculpture')}
        aria-label={isValidBottom ? "Place sculpture" : "Invalid area"}
      />

      {/* Crosshair */}
      {crosshairPos && (
        <div className="absolute inset-0 pointer-events-none overflow-hidden mix-blend-difference text-white opacity-40">
          <div className="absolute top-0 bottom-0 border-l border-dashed border-current shadow-sm" style={{ left: crosshairPos.x }} />
          <div className="absolute left-0 right-0 border-t border-dashed border-current shadow-sm" style={{ top: crosshairPos.y }} />
        </div>
      )}
    </div>
  );
}