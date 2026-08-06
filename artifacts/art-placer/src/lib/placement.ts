import type { ArtObject as ArtObjectData, Placement, Room } from '../types';
import { aspectRatioOf, scaleFor } from './sizing';

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
 * The whole validity rule: one comparison against the room's band split. Wall
 * art above it, sculptures below it.
 *
 * Each is judged on the edge that meets the room, and the opposite edge is free
 * to run past the split — which is what both do in a real room.
 *
 * A sculpture *stands* on something, so its base must reach the lower band. A
 * tall piece resting properly on the floor routinely has its centre up in the
 * wall band, and judging it on the centre rejected that drop silently.
 *
 * Wall art *hangs*, so it is anchored at its top: the top edge is what has to
 * be on the wall. Judging it on the centre was the same mistake mirrored — a
 * large piece hung low, with most of its surface still plainly on the wall, was
 * refused the moment its midpoint crossed the line. The consequence is
 * deliberate: a big canvas may now overlap the floor band at its bottom, the
 * way one leaning against a wall does.
 *
 * `heightPercent` is the piece's rendered height as a percentage of the canvas
 * box, and defaults to 0 — the old centre-only rule for both types — so a
 * caller with no geometry to hand is never more permissive than one that has it.
 */
export function isValidBand(
  type: 'wall' | 'sculpture',
  centerYPercent: number,
  bandSplit: number,
  heightPercent = 0,
) {
  const half = heightPercent / 2;
  return type === 'wall'
    ? centerYPercent - half < bandSplit
    : centerYPercent + half >= bandSplit;
}

/**
 * What to tell the visitor about a refused drop.
 *
 * Lives beside the rule that produces the reason so the two cannot drift — a
 * new rejection has to answer here before it can reach anyone. Returns null for
 * the refusals that are not mistakes: a piece dragged back to the tray did what
 * the visitor meant, and a missing canvas is a fault to fix rather than
 * something to narrate at them.
 */
export function refusalMessage(
  reason: DropRejection,
  type: 'wall' | 'sculpture',
): string | null {
  switch (reason) {
    case 'wrong-band':
      return type === 'wall'
        ? 'Wall art hangs above the floor line'
        : 'Sculptures stand below the floor line';
    case 'outside-canvas':
      return 'Release inside the room';
    case 'returned-unplaced':
    case 'no-canvas':
      return null;
  }
}

/** The canvas box is locked to 16:10 by the layout. */
const CANVAS_ASPECT = 16 / 10;

/**
 * A piece's rendered height as a percentage of the canvas box.
 *
 * Derived from the catalog rather than measured, so the store's reconciliation
 * pass — which re-checks saved placements with no canvas in reach — judges a
 * sculpture by the same base the drop did. Callers holding a real canvas rect
 * pass its aspect ratio and get the exact figure.
 */
export function heightPercentOf(
  object: Pick<ArtObjectData, 'realWidthInches' | 'realHeightInches'>,
  room: Pick<Room, 'wallWidthFeet'>,
  canvasAspect: number = CANVAS_ASPECT,
): number {
  return scaleFor(object, room) * 100 * (canvasAspect / aspectRatioOf(object));
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

/**
 * Why a release resolved to nothing.
 *
 * A refused drop looks identical to the visitor however it was refused — the
 * piece simply snaps back — so the reason has to be carried out of here or it
 * is unrecoverable. Every `none` names one, which is what lets the drag trace
 * say *which* rule rejected a drop instead of only that one did.
 */
export type DropRejection =
  /** No room canvas was registered, so there was nothing to measure against. */
  | 'no-canvas'
  /** Released below the canvas, but a tray piece was never placed to remove. */
  | 'returned-unplaced'
  /** Released away from the room entirely. */
  | 'outside-canvas'
  /** Over the room, but on the wrong side of the band split. */
  | 'wrong-band';

/** The numbers the band rule actually judged, for the trace to report. */
export interface BandMeasurement {
  /** The piece's centre, as a percentage of the canvas box. */
  centerYPercent: number;
  /** Where its base lands — what the sculpture rule is judged on. */
  basePercent: number;
  /** The piece's rendered height, as a percentage of the canvas box. */
  heightPercent: number;
  bandSplit: number;
}

export type DropResolution =
  | { action: 'place'; placement: Placement }
  | { action: 'remove' }
  /** Released somewhere invalid: the caller leaves the piece where it was. */
  | { action: 'none'; reason: DropRejection; measured?: BandMeasurement };

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
  if (!canvasEl) return { action: 'none', reason: 'no-canvas' };
  const rect = canvasEl.getBoundingClientRect();

  if (clientY > rect.bottom + RETURN_TO_TRAY_GUTTER) {
    // A tray piece dragged back to the tray never became a placement, so
    // removing it would be a no-op that still pushes an undo entry.
    return source === 'room'
      ? { action: 'remove' }
      : { action: 'none', reason: 'returned-unplaced' };
  }

  const centerX = clientX - offsetX + width / 2;
  const centerY = clientY - offsetY + height / 2;
  const pctCenterX = ((centerX - rect.left) / rect.width) * 100;
  const pctCenterY = ((centerY - rect.top) / rect.height) * 100;

  // Judged on the piece, not the pointer. The two differ by wherever inside the
  // piece it was grabbed, so testing the pointer refused drops whose artwork was
  // plainly inside the frame — and did it silently, which is indistinguishable
  // from the app losing the object.
  const isInside =
    pctCenterX >= 0 && pctCenterX <= 100 && pctCenterY >= 0 && pctCenterY <= 100;
  if (!isInside) return { action: 'none', reason: 'outside-canvas' };

  const heightPercent = (height / rect.height) * 100;
  if (!isValidBand(object.type, pctCenterY, room.bandSplit, heightPercent)) {
    return {
      action: 'none',
      reason: 'wrong-band',
      measured: {
        centerYPercent: pctCenterY,
        basePercent: pctCenterY + heightPercent / 2,
        heightPercent,
        bandSplit: room.bandSplit,
      },
    };
  }

  const { x, y } = clampToCanvas(pctCenterX, pctCenterY);
  return {
    action: 'place',
    placement: {
      objectId: object.id,
      roomId: room.id,
      x,
      y,
      scale: scaleFor(object, room),
    },
  };
}

/**
 * Where a *tap* from the select-then-place flow lands.
 *
 * Separate from `resolveDrop` because a tap carries no grab geometry — the
 * anchor is the tap point itself, not the centre of a piece already under the
 * pointer — but it shares `isValidBand` and `clampToCanvas` with it so the two
 * entry points into placement cannot drift apart.
 *
 * Called from both the placement band and from a tap that lands on a piece
 * already in the room, so an occupied spot is not a dead zone.
 */
export function resolveTapPlace({
  canvasEl,
  room,
  object,
  clientX,
  clientY,
}: {
  canvasEl: HTMLElement | null;
  room: Room;
  object: ArtObjectData;
  /** Tap position. */
  clientX: number;
  clientY: number;
}): DropResolution {
  if (!canvasEl) return { action: 'none', reason: 'no-canvas' };
  const rect = canvasEl.getBoundingClientRect();

  const pctX = ((clientX - rect.left) / rect.width) * 100;
  const pctY = ((clientY - rect.top) / rect.height) * 100;

  const heightPercent = heightPercentOf(object, room, rect.width / rect.height);
  if (!isValidBand(object.type, pctY, room.bandSplit, heightPercent)) {
    return {
      action: 'none',
      reason: 'wrong-band',
      measured: {
        centerYPercent: pctY,
        basePercent: pctY + heightPercent / 2,
        heightPercent,
        bandSplit: room.bandSplit,
      },
    };
  }

  const { x, y } = clampToCanvas(pctX, pctY);
  return {
    action: 'place',
    placement: {
      objectId: object.id,
      roomId: room.id,
      x,
      y,
      scale: scaleFor(object, room),
    },
  };
}
