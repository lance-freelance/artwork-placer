import { X } from 'lucide-react';
import { useStore } from '../state/Store';
import { artObjects } from '../data/objects';
import { usePointerDrag } from '../hooks/usePointerDrag';
import { cn } from '@/lib/utils';
import { assetUrl, type Placement } from '../types';

/**
 * A single object placed inside a room. Dragging it repositions it freeform
 * within its valid band; dragging it below the canvas, or using the remove
 * affordance, returns it to the inventory tray.
 */
export function ArtObject({ placement }: { placement: Placement }) {
  const { setDragState, dragState, activeRoomId } = useStore();
  const obj = artObjects.find((o) => o.id === placement.objectId)!;
  const isDragging = dragState?.objectId === placement.objectId;

  const { handlers } = usePointerDrag({
    onDragStart: (p) => {
      const rect = p.currentTarget.getBoundingClientRect();
      setDragState({
        objectId: placement.objectId,
        source: 'room',
        clientX: p.clientX,
        clientY: p.clientY,
        width: rect.width,
        height: rect.height,
        offsetX: p.clientX - rect.left,
        offsetY: p.clientY - rect.top,
      });
    },
    onDragMove: (p) => {
      setDragState((prev) =>
        prev ? { ...prev, clientX: p.clientX, clientY: p.clientY } : null,
      );
    },
    onDragEnd: (p) => {
      window.dispatchEvent(
        new CustomEvent('art-drop', {
          detail: {
            clientX: p.clientX,
            clientY: p.clientY,
            objectId: placement.objectId,
            source: 'room',
          },
        }),
      );
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
        src={assetUrl(`art/${obj.fullImageFilename}`)}
        alt={obj.name}
        draggable={false}
        className="w-full h-full object-contain pointer-events-none drop-shadow-[0_6px_10px_rgba(60,50,40,0.22)] group-hover:drop-shadow-[0_12px_18px_rgba(60,50,40,0.28)] transition-[filter] duration-300"
      />

      <button
        className="absolute -top-3 -right-3 bg-background text-foreground rounded-full w-6 h-6 flex items-center justify-center opacity-0 group-hover:opacity-100 focus-visible:opacity-100 shadow-md border border-border transition-opacity outline-none focus-visible:ring-2 focus-visible:ring-primary"
        onClick={(e) => {
          e.stopPropagation();
          window.dispatchEvent(
            new CustomEvent('art-remove', {
              detail: { objectId: placement.objectId },
            }),
          );
        }}
        aria-label={`Return ${obj.name} to the tray`}
      >
        <X size={12} strokeWidth={2} />
      </button>
    </div>
  );
}
