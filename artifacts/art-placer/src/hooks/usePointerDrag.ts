import { useCallback, useEffect, useRef, useState } from 'react';
import { traceDrag } from '../dev/dragTrace';

/** The minimal pointer information the drag callbacks need. */
export interface DragPoint {
  clientX: number;
  clientY: number;
  currentTarget: HTMLElement;
}

type DragCallbacks = {
  /**
   * Return `false` to refuse the gesture — the owner has nothing to drag with,
   * such as a tray piece with no room canvas registered to size its ghost
   * against. The hook then unwinds instead of holding a drag no owner backs,
   * which would otherwise track the pointer with no ghost and resolve to
   * nothing on release.
   */
  onDragStart: (p: DragPoint) => boolean | void;
  onDragMove: (p: DragPoint) => void;
  onDragEnd: (p: DragPoint) => void;
  /**
   * The gesture was taken away from us — palm rejection, a system edge swipe,
   * the window losing focus.
   *
   * Deliberately separate from `onDragEnd`: a cancelled gesture must never
   * commit. Its last known point is wherever the OS happened to interrupt,
   * which is not where the user meant to let go, so routing cancel into
   * `onDragEnd` drops artwork at an arbitrary spot.
   */
  onDragCancel?: () => void;
  /**
   * How the browser is allowed to handle the gesture natively *before* the
   * drag threshold is crossed.
   * - `'none'` (default): we own the contact from the very first pixel of
   *   movement. Use this for all draggable elements, including tray thumbnails,
   *   where unambiguous ownership matters more than native scroll behaviour.
   *
   * Once the threshold is crossed this is forced to `'none'` — see
   * `gestureLocked` below.
   */
  touchAction?: 'none' | 'pan-x';
  /** Pixels the pointer must travel before this counts as a drag, not a tap. */
  threshold?: number;
};

/**
 * Teardown functions for every mounted drag hook.
 *
 * The window-level safety net in Store has to clear the refs inside whichever
 * component owned an interrupted gesture, but it cannot reach them and must
 * not be coupled to individual component refs. Each hook instance publishes
 * its own teardown here instead, so the safety net calls one function and lets
 * every hook clean itself up.
 */
const liveDrags = new Set<() => void>();

/**
 * Abort whichever drag is in flight, if any. A no-op for idle hooks, so the
 * window safety net can call it on every pointerup without side effects.
 */
export function abortActivePointerDrags() {
  for (const teardown of Array.from(liveDrags)) teardown();
}

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
  onDragCancel,
  touchAction = 'none',
  threshold = 6,
}: DragCallbacks) {
  const origin = useRef<{ x: number; y: number } | null>(null);
  const isDragging = useRef(false);
  // Stays true from the end of a drag until the next press, so the synthetic
  // click the browser fires after pointerup can be ignored.
  const justDragged = useRef(false);
  /** Who holds pointer capture, so a teardown with no event can hand it back. */
  const capture = useRef<{ el: HTMLElement; pointerId: number } | null>(null);

  /**
   * Once the threshold is crossed the gesture is unambiguously ours, so the
   * browser has to stop trying to scroll the tray with the same contact — on a
   * large tablet a fast upward lift otherwise crosses the threshold only after
   * the browser has begun routing the gesture as a pan, and it answers by
   * firing pointercancel.
   *
   * State rather than a ref: the element has to re-render to pick up the new
   * touch-action.
   */
  const [gestureLocked, setGestureLocked] = useState(false);

  // Read through a ref so the teardown below can stay stable across renders
  // while still calling the latest callback.
  const onDragCancelRef = useRef(onDragCancel);
  onDragCancelRef.current = onDragCancel;

  const releaseCapture = useCallback(() => {
    const held = capture.current;
    capture.current = null;
    if (held && held.el.hasPointerCapture(held.pointerId)) {
      held.el.releasePointerCapture(held.pointerId);
    }
  }, []);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    // Desktop/mouse-specific: without this, mousedown anchors a native text
    // selection, and rapid consecutive drags read as double/triple-clicks that
    // sweep the ::selection highlight (a blue tint) across the artwork images.
    // Touch is unaffected — touch-action and pointer capture already own that
    // path. Side effect: click-focus is suppressed, which is fine here since
    // draggables style focus via focus-visible (keyboard Tab still focuses).
    e.preventDefault();
    const el = e.currentTarget as HTMLElement;
    el.setPointerCapture(e.pointerId);
    capture.current = { el, pointerId: e.pointerId };
    origin.current = { x: e.clientX, y: e.clientY };
    isDragging.current = false;
    justDragged.current = false;
    traceDrag('press', {
      pointerType: e.pointerType,
      id: e.pointerId,
      at: `${Math.round(e.clientX)},${Math.round(e.clientY)}`,
    });
  }, []);

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      const start = origin.current;
      if (!start) return;
      if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;

      const target = e.currentTarget as HTMLElement;

      if (!isDragging.current) {
        const travel = Math.hypot(e.clientX - start.x, e.clientY - start.y);
        if (travel < threshold) return;
        traceDrag('threshold', { travel: Math.round(travel) });

        const started = onDragStart({
          clientX: start.x,
          clientY: start.y,
          currentTarget: target,
        });
        if (started === false) {
          // Unwind rather than carry a drag the owner has no geometry for.
          // Leaving it armed used to strand the contact: no ghost, no drop, and
          // nothing to distinguish it from a gesture the app had simply lost.
          origin.current = null;
          releaseCapture();
          traceDrag('start-refused');
          return;
        }
        isDragging.current = true;
        setGestureLocked(true);
      }

      e.preventDefault();
      onDragMove({ clientX: e.clientX, clientY: e.clientY, currentTarget: target });
    },
    [onDragStart, onDragMove, releaseCapture, threshold],
  );

  /** A deliberate release: commit whatever the gesture resolved to. */
  const finish = useCallback(
    (e: React.PointerEvent) => {
      const target = e.currentTarget as HTMLElement;
      releaseCapture();
      origin.current = null;
      setGestureLocked(false);
      traceDrag('release', {
        wasDragging: isDragging.current,
        at: `${Math.round(e.clientX)},${Math.round(e.clientY)}`,
      });
      if (isDragging.current) {
        isDragging.current = false;
        justDragged.current = true;
        onDragEnd({ clientX: e.clientX, clientY: e.clientY, currentTarget: target });
      }
    },
    [onDragEnd, releaseCapture],
  );

  /**
   * The gesture was taken away. Tear everything down without ever reaching
   * `onDragEnd`, and clear every ref so a stray pointerup arriving afterwards
   * cannot re-run the drop with the geometry of a gesture that no longer
   * exists.
   */
  const cancel = useCallback(() => {
    const wasDragging = isDragging.current;
    releaseCapture();
    origin.current = null;
    isDragging.current = false;
    justDragged.current = false;
    setGestureLocked(false);
    traceDrag('cancel', { wasDragging });
    if (wasDragging) onDragCancelRef.current?.();
  }, [releaseCapture]);

  // Publish the teardown so the window-level safety net can reach it.
  useEffect(() => {
    const teardown = () => {
      // Nothing in flight — leave `justDragged` alone. `finish` sets it a
      // moment before that same pointerup bubbles on to window, and clearing
      // it here would let the trailing synthetic click toggle selection on a
      // piece the user had just dragged.
      if (!origin.current && !isDragging.current && !capture.current) return;
      // Only reported when the net actually catches something. A normal release
      // leaves nothing in flight, so this line appearing at all means the
      // gesture was torn down before its owner could resolve the drop.
      traceDrag('safety-net', { wasDragging: isDragging.current });
      cancel();
    };
    liveDrags.add(teardown);
    return () => {
      liveDrags.delete(teardown);
    };
  }, [cancel]);

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
      onPointerCancel: cancel,
      style: { touchAction: gestureLocked ? ('none' as const) : touchAction },
    },
  };
}
