/**
 * Shared placement maths. Kept separate from the components so the two entry
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
