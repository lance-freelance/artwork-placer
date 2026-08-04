import { useStore } from '../state/Store';
import { artObjects } from '../data/objects';
import { usePointerDrag } from '../hooks/usePointerDrag';
import { cn } from '@/lib/utils';
import { assetUrl } from '../types';

/**
 * A single draggable thumbnail in the inventory tray. Pull it out to place it,
 * or tap it to select it and then tap a valid band in the room.
 */
export function TrayItem({ objectId }: { objectId: string }) {
  const {
    setDragState,
    dragState,
    roomWidth,
    selectedObjectId,
    setSelectedObjectId,
    placements,
  } = useStore();
  const obj = artObjects.find((o) => o.id === objectId)!;
  const isDragging = dragState?.objectId === objectId;
  const isPlaced = placements.some((p) => p.objectId === objectId);
  const isSelected = selectedObjectId === objectId;

  const { dragging, handlers } = usePointerDrag({
    // Horizontal swipes still scroll the tray; pulling upward lifts the piece.
    touchAction: 'pan-x',
    onDragStart: (p) => {
      setSelectedObjectId(null);
      const width = roomWidth * obj.defaultScale;
      const height = width / obj.aspectRatio;
      setDragState({
        objectId,
        source: 'tray',
        clientX: p.clientX,
        clientY: p.clientY,
        width,
        height,
        offsetX: width / 2,
        offsetY: height / 2,
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
            objectId,
            source: 'tray',
          },
        }),
      );
      setDragState(null);
    },
  });

  if (isPlaced && !isDragging) return null;

  return (
    <button
      {...handlers}
      onClick={() => {
        // A drag that ended on this element must not also toggle selection.
        if (dragging()) return;
        setSelectedObjectId(isSelected ? null : objectId);
      }}
      className={cn(
        'relative shrink-0 cursor-grab active:cursor-grabbing rounded-sm transition-transform duration-200 outline-none',
        'hover:-translate-y-1 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        isDragging && 'opacity-0',
        isSelected &&
          'ring-2 ring-foreground ring-offset-4 ring-offset-background -translate-y-1',
      )}
      style={{
        height: 'clamp(56px, 9vh, 84px)',
        aspectRatio: obj.aspectRatio,
        ...handlers.style,
      }}
      aria-pressed={isSelected}
      aria-label={
        isSelected
          ? `${obj.name} selected. Tap a valid area in the room to place it.`
          : `Select ${obj.name}`
      }
    >
      <img
        src={assetUrl(`art/${obj.thumbnailFilename}`)}
        alt=""
        draggable={false}
        className="w-full h-full object-contain pointer-events-none drop-shadow-[0_4px_6px_rgba(60,50,40,0.18)]"
      />
    </button>
  );
}
