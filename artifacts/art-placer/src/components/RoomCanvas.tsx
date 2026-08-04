import { useEffect, useRef } from 'react';
import { useStore } from '../state/Store';
import { rooms } from '../data/rooms';
import { ArtObject } from './ArtObject';
import { cn } from '@/lib/utils';
import { assetUrl } from '../types';
import { PlacementBand } from './PlacementBand';

export function RoomCanvas({ roomId, isActive }: { roomId: string, isActive: boolean }) {
  const { setRoomWidth, canvasElRef, placements } = useStore();

  const room = rooms.find(r => r.id === roomId)!;
  const containerRef = useRef<HTMLDivElement>(null);

  // Publish this canvas as the one drops are measured against while it is the
  // room on screen.
  useEffect(() => {
    if (!isActive) return;
    const el = containerRef.current;
    canvasElRef.current = el;
    return () => {
      if (canvasElRef.current === el) canvasElRef.current = null;
    };
  }, [isActive, canvasElRef]);

  useEffect(() => {
    if (!isActive || !containerRef.current) return;
    
    const observer = new ResizeObserver((entries) => {
      setRoomWidth(entries[0].contentRect.width);
    });
    observer.observe(containerRef.current);
    
    return () => observer.disconnect();
  }, [isActive, setRoomWidth]);

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