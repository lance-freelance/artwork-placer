import { useRef, useCallback } from 'react';

/** The minimal pointer information the drag callbacks need. */
export interface DragPoint {
  clientX: number;
  clientY: number;
  currentTarget: HTMLElement;
}

type DragCallbacks = {
  onDragStart: (p: DragPoint) => void;
  onDragMove: (p: DragPoint) => void;
  onDragEnd: (p: DragPoint) => void;
  /**
   * How the browser is allowed to handle the gesture natively.
   * - `'none'` for objects already placed in a room: we own the gesture.
   * - `'pan-x'` for tray thumbnails: horizontal swipes still scroll the tray,
   *   while pulling a piece out of the tray comes through as pointer moves.
   */
  touchAction?: 'none' | 'pan-x';
  /** Pixels the pointer must travel before this counts as a drag, not a tap. */
  threshold?: number;
};

/**
 * Pointer Events based dragging with pointer capture. Deliberately not HTML5
 * drag-and-drop, which is unreliable on touch devices.
 *
 * A drag only begins once the pointer has moved past `threshold`, so a plain
 * tap stays a tap and can drive the select-then-place accessibility flow.
 */
export function usePointerDrag({
  onDragStart,
  onDragMove,
  onDragEnd,
  touchAction = 'none',
  threshold = 6,
}: DragCallbacks) {
  const origin = useRef<{ x: number; y: number } | null>(null);
  const isDragging = useRef(false);
  // Stays true from the end of a drag until the next press, so the synthetic
  // click the browser fires after pointerup can be ignored.
  const justDragged = useRef(false);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    origin.current = { x: e.clientX, y: e.clientY };
    isDragging.current = false;
    justDragged.current = false;
  }, []);

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      const start = origin.current;
      if (!start) return;
      if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;

      const target = e.currentTarget as HTMLElement;

      if (!isDragging.current) {
        if (Math.hypot(e.clientX - start.x, e.clientY - start.y) < threshold) {
          return;
        }
        isDragging.current = true;
        // Start from the original press point so the piece doesn't jump.
        onDragStart({ clientX: start.x, clientY: start.y, currentTarget: target });
      }

      e.preventDefault();
      onDragMove({ clientX: e.clientX, clientY: e.clientY, currentTarget: target });
    },
    [onDragStart, onDragMove, threshold],
  );

  const finish = useCallback(
    (e: React.PointerEvent) => {
      const target = e.currentTarget as HTMLElement;
      if (target.hasPointerCapture(e.pointerId)) {
        target.releasePointerCapture(e.pointerId);
      }
      origin.current = null;
      if (isDragging.current) {
        isDragging.current = false;
        justDragged.current = true;
        onDragEnd({ clientX: e.clientX, clientY: e.clientY, currentTarget: target });
      }
    },
    [onDragEnd],
  );

  /**
   * True while a real drag is in flight, and for the click that immediately
   * follows one. Lets a click handler tell a tap apart from a drag that
   * happened to end back on its source element.
   */
  const dragging = () => isDragging.current || justDragged.current;

  return {
    dragging,
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp: finish,
      onPointerCancel: finish,
      style: { touchAction },
    },
  };
}
