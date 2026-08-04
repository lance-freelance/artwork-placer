import { useEffect, useRef } from 'react';
import { useStore } from '../state/Store';
import { ArtObject } from './ArtObject';
import { cn } from '@/lib/utils';
import { assetUrl } from '../types';
import { PlacementBand } from './PlacementBand';

export function RoomCanvas({ roomId, isActive }: { roomId: string, isActive: boolean }) {
  const { rooms, artObjects, setRoomWidth, canvasElRef, placements } = useStore();

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

  // The store reconciles the catalog after it changes, but that happens one
  // commit later — a piece deleted in the admin panel must not be rendered in
  // the render in between, because the lookup below it would come back empty.
  const roomPlacements = placements.filter(
    p => p.roomId === roomId && artObjects.some(o => o.id === p.objectId),
  );

  return (
    <div 
      ref={containerRef}
      id={isActive ? 'active-room-canvas' : undefined}
      className={cn(
        "relative w-full h-full overflow-hidden bg-muted transition-opacity duration-500",
        isActive ? "opacity-100" : "opacity-0 pointer-events-none"
      )}
    >
      {/*
        `object-contain` is required, not cosmetic: the canvas box is a fixed
        16:10 matte and the room photographs are 16:10, so contain fills it
        exactly with no crop and no stretch-scaling. Switching this back to
        `cover` would distort the photo on off-ratio boxes and silently move
        every placement, because placements are stored as percentages of this
        box.
      */}
      <img
        src={assetUrl(`rooms/${room.imageFilename}`)}
        alt={room.name}
        draggable={false}
        className="absolute inset-0 w-full h-full object-contain pointer-events-none select-none"
      />
      
      {/* Placements */}
      {roomPlacements.map(p => (
        <ArtObject key={p.objectId} placement={p} />
      ))}

      {/* Placement Band Highlights and Crosshair */}
      {isActive && <PlacementBand room={room} canvasRef={containerRef} />}
    </div>
  );
}