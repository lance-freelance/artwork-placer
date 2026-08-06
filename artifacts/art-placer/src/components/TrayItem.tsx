import { useRef } from 'react';
import { useStore } from '../state/Store';
import { usePointerDrag } from '../hooks/usePointerDrag';
import { cn } from '@/lib/utils';
import { resolveDrop, type DragGeometry } from '@/lib/placement';
import { aspectRatioOf, scaleFor } from '@/lib/sizing';
import { artImageUrl } from '../types';

/**
 * A single draggable thumbnail in the inventory tray. Pull it out to place it,
 * or tap it to select it and then tap a valid band in the room.
 */
export function TrayItem({ objectId }: { objectId: string }) {
  const {
    setDragState,
    dragState,
    selectedObjectId,
    setSelectedObjectId,
    placements,
    placeObject,
    canvasElRef,
    activeRoomId,
    rooms,
    artObjects,
  } = useStore();
  const obj = artObjects.find((o) => o.id === objectId)!;
  const activeRoom = rooms.find((r) => r.id === activeRoomId);
  const grab = useRef<DragGeometry | null>(null);
  const isDragging = dragState?.objectId === objectId;
  const isPlaced = placements.some((p) => p.objectId === objectId);
  const isSelected = selectedObjectId === objectId;

  const { dragging, handlers } = usePointerDrag({
    // touch-action defaults to 'none' here, so the browser never contests the
    // contact as a tray scroll — every touch is unambiguously a potential drag
    // from the moment it starts. Horizontal tray browsing is handled exclusively
    // by the chevron buttons in InventoryTray.
    onDragStart: (p) => {
      setSelectedObjectId(null);
      // No room, no geometry to size the ghost against. Leaving `grab` null
      // also makes the matching onDragEnd a no-op, so the gesture is inert
      // rather than half-live.
      if (!activeRoom) return;
      // Measure the canvas live rather than trusting the store's roomWidth:
      // a first drag fired before RoomCanvas has reported its width would
      // otherwise size the ghost off the 1000px default, and with no canvas
      // registered at all the gesture must stay inert.
      const canvasWidth = canvasElRef.current?.getBoundingClientRect().width;
      if (!canvasWidth) return;
      const width = canvasWidth * scaleFor(obj, activeRoom);
      const height = width / aspectRatioOf(obj);
      // Held in a ref rather than read back from dragState: a quick flick can
      // reach pointerup before React has committed the drag-start render.
      const geometry: DragGeometry = {
        width,
        height,
        offsetX: width / 2,
        offsetY: height / 2,
      };
      grab.current = geometry;
      setDragState({
        objectId,
        source: 'tray',
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
      if (geometry && activeRoom) {
        const result = resolveDrop({
          canvasEl: canvasElRef.current,
          room: activeRoom,
          object: obj,
          source: 'tray',
          clientX: p.clientX,
          clientY: p.clientY,
          ...geometry,
        });
        if (result.action === 'place') placeObject(result.placement);
        // Temporary: drop-resolution instrumentation for the silent-drop bug.
        // Only ever active alongside src/dev/dragDiagnostics.ts (?debugDrag=1);
        // remove with it once the cause is pinned down.
        (window as unknown as { __dragLog?: unknown }).__dragLog &&
          console.log('[drag] resolveDrop', {
            action: result.action,
            room: activeRoom.id,
            bandSplit: activeRoom.bandSplit,
            clientX: p.clientX,
            clientY: p.clientY,
            geometry,
            rect: canvasElRef.current?.getBoundingClientRect().toJSON(),
            placement: result.action === 'place' ? result.placement : null,
          });
      } else {
        (window as unknown as { __dragLog?: unknown }).__dragLog &&
          console.log('[drag] drop skipped', {
            hasGeometry: !!geometry,
            activeRoomId,
          });
      }
      setDragState(null);
    },
    // Interrupted, not released: drop the geometry and clear the ghost without
    // resolving a placement, so the piece simply stays in the tray.
    onDragCancel: () => {
      grab.current = null;
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
      className="relative shrink-0 cursor-grab active:cursor-grabbing rounded-sm transition-transform duration-200 outline-none hover:-translate-y-1 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background ml-[14px] mr-[14px]"
      style={{
        height: 'clamp(56px, 9vh, 84px)',
        aspectRatio: aspectRatioOf(obj),
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
        src={artImageUrl(obj.thumbnailFilename)}
        alt=""
        draggable={false}
        className="w-full h-full object-contain pointer-events-none drop-shadow-[0_4px_6px_rgba(60,50,40,0.18)]"
      />
    </button>
  );
}
