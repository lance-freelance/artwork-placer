import type { ArtObject as ArtObjectData, Placement, Room } from '../types';

/**
 * Shared placement maths. Kept separate from the components so the entry
 * points into placement — pointer drop and tap-to-place — cannot drift apart.
 */

/**
 * How close to the canvas edge an object's anchor point may sit, as a
 * percentage. The pointer can be over the canvas while the object's centre is
 * not, and an object centred outside the frame is clipped by the canvas and
 * impossible to grab again. This bounds a drop; it never snaps one.
 */
export const EDGE_MARGIN = 3;

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

/** Keeps an anchor point inside the visible frame. */
export function clampToCanvas(x: number, y: number) {
  return {
    x: clamp(x, EDGE_MARGIN, 100 - EDGE_MARGIN),
    y: clamp(y, EDGE_MARGIN, 100 - EDGE_MARGIN),
  };
}

/**
 * The whole validity rule: one comparison of the object's vertical centre
 * against the room's band split. Wall art above it, sculptures below it.
 */
export function isValidBand(
  type: 'wall' | 'sculpture',
  centerYPercent: number,
  bandSplit: number,
) {
  return type === 'wall'
    ? centerYPercent < bandSplit
    : centerYPercent >= bandSplit;
}

/** How far below the canvas a piece must be released to return to the tray. */
const RETURN_TO_TRAY_GUTTER = 20;

/**
 * Where inside a piece the pointer grabbed it, and the piece's rendered size.
 * Captured once at drag start and carried through to the drop.
 */
export interface DragGeometry {
  offsetX: number;
  offsetY: number;
  width: number;
  height: number;
}

export type DropResolution =
  | { action: 'place'; placement: Placement }
  | { action: 'remove' }
  /** Released somewhere invalid: the caller leaves the piece where it was. */
  | { action: 'none' };

/**
 * Decides what a released drag means. Pure, and the single place the drop
 * rules live, so a piece dropped from the tray and a piece being repositioned
 * are resolved identically.
 */
export function resolveDrop({
  canvasEl,
  room,
  object,
  source,
  clientX,
  clientY,
  offsetX,
  offsetY,
  width,
  height,
}: DragGeometry & {
  canvasEl: HTMLElement | null;
  room: Room;
  object: ArtObjectData;
  source: 'tray' | 'room';
  /** Pointer position at release. */
  clientX: number;
  clientY: number;
}): DropResolution {
  if (!canvasEl) return { action: 'none' };
  const rect = canvasEl.getBoundingClientRect();

  if (clientY > rect.bottom + RETURN_TO_TRAY_GUTTER) {
    // A tray piece dragged back to the tray never became a placement, so
    // removing it would be a no-op that still pushes an undo entry.
    return source === 'room' ? { action: 'remove' } : { action: 'none' };
  }

  const isInside =
    clientX >= rect.left &&
    clientX <= rect.right &&
    clientY >= rect.top &&
    clientY <= rect.bottom;
  if (!isInside) return { action: 'none' };

  const centerX = clientX - offsetX + width / 2;
  const centerY = clientY - offsetY + height / 2;
  const pctCenterX = ((centerX - rect.left) / rect.width) * 100;
  const pctCenterY = ((centerY - rect.top) / rect.height) * 100;

  if (!isValidBand(object.type, pctCenterY, room.bandSplit)) {
    return { action: 'none' };
  }

  const { x, y } = clampToCanvas(pctCenterX, pctCenterY);
  return {
    action: 'place',
    placement: {
      objectId: object.id,
      roomId: room.id,
      x,
      y,
      scale: object.defaultScale,
    },
  };
}
