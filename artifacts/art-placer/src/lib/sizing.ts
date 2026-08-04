import type { ArtObject, Room } from '../types';

const INCHES_PER_FOOT = 12;

/**
 * How far the board zooms into a room photograph.
 *
 * RoomCanvas renders the image `object-contain` and then scales it up, so the
 * visible canvas is the middle `1 / ROOM_IMAGE_ZOOM` of the photo rather than
 * all of it. Anything that measures a room has to render it the same way or
 * it measures wall that the visitor never sees — a calibration taken against
 * the full photo comes out too wide by exactly this factor, and every piece
 * in that room then hangs too small.
 *
 * Keep this in step with the scale applied in RoomCanvas.
 */
export const ROOM_IMAGE_ZOOM = 1.2;

/**
 * How large a piece should appear, as a fraction of the room canvas width.
 *
 * The canvas always spans `room.wallWidthFeet` of real wall, so a piece's
 * share of it is simply its real width over that span. A 48" canvas on a
 * 13'6" wall covers 4/13.5 of the frame; the same piece in a tighter room
 * covers proportionally more.
 *
 * Deliberately computed at render time and never stored on the placement:
 * recalibrating a room has to resize everything already hanging in it, and a
 * stored copy would silently keep the old size.
 */
export function scaleFor(
  object: Pick<ArtObject, 'realWidthInches'>,
  room: Pick<Room, 'wallWidthFeet'>,
): number {
  return object.realWidthInches / INCHES_PER_FOOT / room.wallWidthFeet;
}

/**
 * The range a visitor may size a piece within, centred on its true-to-life
 * size. A `resizeRangePercent` of 20 yields 80%–120% of that size.
 */
export function scaleBoundsFor(
  object: Pick<ArtObject, 'realWidthInches' | 'resizeRangePercent'>,
  room: Pick<Room, 'wallWidthFeet'>,
): { min: number; base: number; max: number } {
  const base = scaleFor(object, room);
  const range = object.resizeRangePercent / 100;
  return { min: base * (1 - range), base, max: base * (1 + range) };
}

/** Width over height, derived from the real dimensions rather than stored. */
export function aspectRatioOf(
  object: Pick<ArtObject, 'realWidthInches' | 'realHeightInches'>,
): number {
  return object.realWidthInches / object.realHeightInches;
}

/**
 * Renders decimal feet the way someone would say it out loud: `13.5` becomes
 * `13 ft 6 in`. Rounds to the nearest inch, and carries 12" up into the next
 * foot so nothing ever reads as `13 ft 12 in`.
 */
export function formatFeetInches(feet: number): string {
  if (!Number.isFinite(feet) || feet <= 0) return '—';

  let wholeFeet = Math.floor(feet);
  let inches = Math.round((feet - wholeFeet) * INCHES_PER_FOOT);

  if (inches === INCHES_PER_FOOT) {
    wholeFeet += 1;
    inches = 0;
  }

  return inches === 0 ? `${wholeFeet} ft` : `${wholeFeet} ft ${inches} in`;
}

/** Feet and inches as a single decimal-feet value. */
export function toDecimalFeet(feet: number, inches: number): number {
  return feet + inches / INCHES_PER_FOOT;
}

/**
 * Derives a room's back-wall width from a drawn reference line.
 *
 * The line is measured against something of known real length in the photo —
 * a door frame, a countertop — and stated in feet and inches. If that
 * reference spans a fraction `lineLengthPx / canvasWidthPx` of the frame, the
 * full frame must span its real length divided by that fraction.
 *
 * Returns null when the line is too short to measure reliably, which keeps a
 * stray tap from calibrating a room to an absurd width.
 */
export function wallWidthFromReference(input: {
  lineLengthPx: number;
  canvasWidthPx: number;
  referenceFeet: number;
}): number | null {
  const { lineLengthPx, canvasWidthPx, referenceFeet } = input;
  if (canvasWidthPx <= 0 || referenceFeet <= 0) return null;

  const fraction = lineLengthPx / canvasWidthPx;
  // Below ~2% of the frame the pixel error swamps the measurement.
  if (!Number.isFinite(fraction) || fraction < 0.02) return null;

  return referenceFeet / fraction;
}
