import { useEffect, useRef } from 'react';
import { useStore } from '../state/Store';
import { rooms } from '../data/rooms';
import { artObjects } from '../data/objects';
import { ArtObject } from './ArtObject';
import { cn } from '@/lib/utils';
import { assetUrl } from '../types';
import { PlacementBand } from './PlacementBand';
import { clampToCanvas, isValidBand } from '@/lib/placement';

export function RoomCanvas({ roomId, isActive }: { roomId: string, isActive: boolean }) {
  const { 
    setRoomWidth, 
    placeObject, 
    removePlacement, 
    activeRoomId,
    dragState
  } = useStore();
  
  const room = rooms.find(r => r.id === roomId)!;
  const containerRef = useRef<HTMLDivElement>(null);
  const dragStateRef = useRef(dragState);

  useEffect(() => {
    dragStateRef.current = dragState;
  }, [dragState]);

  useEffect(() => {
    if (!isActive || !containerRef.current) return;
    
    const observer = new ResizeObserver((entries) => {
      setRoomWidth(entries[0].contentRect.width);
    });
    observer.observe(containerRef.current);
    
    return () => observer.disconnect();
  }, [isActive, setRoomWidth]);

  useEffect(() => {
    if (!isActive) return;

    const handleDrop = (e: CustomEvent) => {
      const { clientX, clientY, objectId } = e.detail;
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;

      const obj = artObjects.find(o => o.id === objectId)!;
      
      if (clientY > rect.bottom + 20) {
        removePlacement(objectId);
        return;
      }

      const isInside = clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom;
      const currentDrag = dragStateRef.current;
      
      if (isInside && currentDrag) {
        const objectCenterX = clientX - currentDrag.offsetX + currentDrag.width / 2;
        const objectCenterY = clientY - currentDrag.offsetY + currentDrag.height / 2;
        
        const pctCenterX = ((objectCenterX - rect.left) / rect.width) * 100;
        const pctCenterY = ((objectCenterY - rect.top) / rect.height) * 100;
        
        if (isValidBand(obj.type, pctCenterY, room.bandSplit)) {
          const { x, y } = clampToCanvas(pctCenterX, pctCenterY);
          placeObject({
            objectId,
            roomId,
            x,
            y,
            scale: obj.defaultScale,
            band: obj.type
          });
        }
      }
    };

    const handleRemove = (e: CustomEvent) => {
      removePlacement(e.detail.objectId);
    };

    window.addEventListener('art-drop', handleDrop as EventListener);
    window.addEventListener('art-remove', handleRemove as EventListener);
    return () => {
      window.removeEventListener('art-drop', handleDrop as EventListener);
      window.removeEventListener('art-remove', handleRemove as EventListener);
    };
  }, [isActive, room, placeObject, removePlacement]);

  const { placements } = useStore();
  const roomPlacements = placements.filter(p => p.roomId === roomId);

  return (
    <div 
      ref={containerRef}
      id={isActive ? 'active-room-canvas' : undefined}
      className={cn(
        "relative w-full aspect-[16/10] overflow-hidden bg-muted transition-opacity duration-500",
        isActive ? "opacity-100" : "opacity-0 pointer-events-none"
      )}
    >
      <img src={assetUrl(`rooms/${room.imageFilename}`)} alt={room.name} className="absolute inset-0 w-full h-full object-cover pointer-events-none" />
      
      {/* Placements */}
      {roomPlacements.map(p => (
        <ArtObject key={p.objectId} placement={p} />
      ))}

      {/* Placement Band Highlights and Crosshair */}
      {isActive && <PlacementBand room={room} canvasRef={containerRef} />}
    </div>
  );
}