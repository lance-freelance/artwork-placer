import { useRef } from 'react';
import { X } from 'lucide-react';
import { useStore } from '../state/Store';
import { usePointerDrag } from '../hooks/usePointerDrag';
import { cn } from '@/lib/utils';
import { resolveDrop, type DragGeometry } from '@/lib/placement';
import { artImageUrl, assetUrl, type Placement } from '../types';

/**
 * A single object placed inside a room. Dragging it repositions it freeform
 * within its valid band; dragging it below the canvas, or using the remove
 * affordance, returns it to the inventory tray.
 */
export function ArtObject({ placement }: { placement: Placement }) {
  const {
    setDragState,
    dragState,
    activeRoomId,
    canvasElRef,
    placeObject,
    removePlacement,
    rooms,
    artObjects,
  } = useStore();
  const obj = artObjects.find((o) => o.id === placement.objectId)!;
  const room = rooms.find((r) => r.id === placement.roomId)!;
  const isDragging = dragState?.objectId === placement.objectId;

  // The geometry of the gesture in flight. Held in a ref, not read back from
  // dragState: a quick flick can reach pointerup before React has committed
  // the drag-start render, and the drop must not silently do nothing.
  const grab = useRef<DragGeometry | null>(null);

  const { handlers } = usePointerDrag({
    onDragStart: (p) => {
      const rect = p.currentTarget.getBoundingClientRect();
      const geometry: DragGeometry = {
        width: rect.width,
        height: rect.height,
        offsetX: p.clientX - rect.left,
        offsetY: p.clientY - rect.top,
      };
      grab.current = geometry;
      setDragState({
        objectId: placement.objectId,
        source: 'room',
        clientX: p.clientX,
        clientY: p.clientY,
        ...geometry,
      });
    },
    onDragMove: (p) => {
      setDragState((prev) =>
        prev ? { ...prev, clientX: p.clientX, clientY: p.clientY } : null,
      );
    },
    onDragEnd: (p) => {
      const geometry = grab.current;
      grab.current = null;
      if (geometry) {
        const result = resolveDrop({
          canvasEl: canvasElRef.current,
          room,
          object: obj,
          source: 'room',
          clientX: p.clientX,
          clientY: p.clientY,
          ...geometry,
        });
        if (result.action === 'place') placeObject(result.placement);
        if (result.action === 'remove') removePlacement(placement.objectId);
      }
      setDragState(null);
    },
  });

  if (placement.roomId !== activeRoomId) return null;

  return (
    <div
      {...handlers}
      className={cn(
        'absolute cursor-grab touch-none active:cursor-grabbing group',
        isDragging && 'opacity-0',
      )}
      style={{
        left: `${placement.x}%`,
        top: `${placement.y}%`,
        width: `${placement.scale * 100}%`,
        aspectRatio: obj.aspectRatio,
        transform: 'translate(-50%, -50%)',
        ...handlers.style,
      }}
    >
      <img
        src={artImageUrl(obj.fullImageFilename)}
        alt={obj.name}
        draggable={false}
        className="w-full h-full object-contain pointer-events-none drop-shadow-[0_6px_10px_rgba(60,50,40,0.22)] group-hover:drop-shadow-[0_12px_18px_rgba(60,50,40,0.28)] transition-[filter] duration-300"
      />

      <button
        className="absolute -top-3 -right-3 bg-background text-foreground rounded-full w-6 h-6 flex items-center justify-center opacity-0 group-hover:opacity-100 focus-visible:opacity-100 [@media(hover:none)]:opacity-100 shadow-md border border-border transition-opacity outline-none focus-visible:ring-2 focus-visible:ring-primary"
        // The parent takes pointer capture on pointerdown to drive dragging.
        // Capture retargets the follow-up click to the parent, so without
        // stopping the gesture here the button's onClick never fires.
        onPointerDown={(e) => e.stopPropagation()}
        onPointerUp={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation();
          removePlacement(placement.objectId);
        }}
        aria-label={`Return ${obj.name} to the tray`}
      >
        <X size={12} strokeWidth={2} />
      </button>
    </div>
  );
}
