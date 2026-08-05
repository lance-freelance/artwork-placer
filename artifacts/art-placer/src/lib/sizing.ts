import type { ArtObject, Room } from '../types';

const INCHES_PER_FOOT = 12;

/**
 * How large a piece should appear, as a fraction of the room canvas width.
 *
 * The canvas always spans `room.wallWidthFeet` of real wall, so a piece's
 * share of it is simply its real width over that span. A 48" canvas on a
 * 13'6" wall covers 4/13.5 of the frame; the same piece in a tighter room
 * covers proportionally more.
 *
 * `wallWidthFeet` measures the full canvas box, and the board shows room
 * photographs untouched — no zoom, no crop — so that box is the whole photo.
 * Anything that measures a room has to frame it the same way, or it measures
 * wall the visitor never sees and every piece in that room hangs at the wrong
 * size by exactly the framing difference.
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
 * Decimal feet split into whole feet and inches, as the calibration tool's
 * pair of number fields holds it. Rounds to the nearest inch and carries 12"
 * up into the next foot, so nothing ever reads as `13 ft 12 in`.
 */
export function toFeetInches(value: number): { feet: number; inches: number } {
  if (!Number.isFinite(value) || value <= 0) return { feet: 0, inches: 0 };

  let feet = Math.floor(value);
  let inches = Math.round((value - feet) * INCHES_PER_FOOT);

  if (inches === INCHES_PER_FOOT) {
    feet += 1;
    inches = 0;
  }

  return { feet, inches };
}

/**
 * Renders decimal feet the way someone would say it out loud: `13.5` becomes
 * `13 ft 6 in`.
 */
export function formatFeetInches(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return '—';

  const { feet, inches } = toFeetInches(value);
  return inches === 0 ? `${feet} ft` : `${feet} ft ${inches} in`;
}

/** Feet and inches as a single decimal-feet value. */
export function toDecimalFeet(feet: number, inches: number): number {
  return feet + inches / INCHES_PER_FOOT;
}

/**
 * A standard door frame: the reference most room photographs have to hand, and
 * what the calibration tool opens on for a room with nothing else recorded.
 *
 * Shared rather than re-declared beside each use. The admin form needs it to
 * fill in a room that predates `referenceLengthFeet`, and the tool needs it as
 * the value those fields start on — two copies would drift, and the drift
 * would show up as a room's measured width shifting the moment it was opened.
 */
export const DEFAULT_REFERENCE_LENGTH_FEET = toDecimalFeet(6, 8);

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
