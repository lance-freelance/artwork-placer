/**
 * Characterization tests for the placement maths.
 *
 * `lib/placement.ts` decides where a released drag lands, and it had no test
 * coverage at all — including when the band rule changed from "judge a
 * sculpture on its centre" to "judge it on its base". These tests pin the rule
 * from both entry points (pointer drop and tap-to-place), and pin the one
 * invariant that protects saved work: anything the drop accepts must survive
 * the store's reconciliation pass, or a placement the visitor just made is
 * deleted the next time the catalog changes or they press undo.
 *
 * Numbers are chosen to come out round: a 16ft back wall photographed into a
 * 1600x1000 (16:10) canvas means 1ft of wall is 100px of canvas.
 */

import { describe, it, expect } from 'vitest';

import {
  EDGE_MARGIN,
  clampToCanvas,
  heightPercentOf,
  isValidBand,
  resolveDrop,
  resolveTapPlace,
} from '../lib/placement';
import { aspectRatioOf, scaleFor } from '../lib/sizing';
import type { ArtObject, Room } from '../types';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const ROOM: Room = {
  id: 'room-1',
  name: 'Living Room',
  imageFilename: 'living.jpg',
  bandSplit: 70,
  wallWidthFeet: 16,
};

const art = (over: Partial<ArtObject> & Pick<ArtObject, 'id' | 'type'>): ArtObject => ({
  name: 'Piece',
  thumbnailFilename: 'thumb.jpg',
  fullImageFilename: 'full.jpg',
  realWidthInches: 48,
  realHeightInches: 36,
  ...over,
});

/** 48x36in canvas — 30% of the canvas box tall. */
const WALL_ART = art({ id: 'wall-1', type: 'wall' });

/**
 * 24x72in floor sculpture — 60% of the canvas box tall. The piece the old
 * centre-only rule refused: stood on the floor, its centre sits at 40% and the
 * band split is at 70%.
 */
const TALL_SCULPTURE = art({
  id: 'sculpt-tall',
  type: 'sculpture',
  realWidthInches: 24,
  realHeightInches: 72,
});

/** 12x12in tabletop piece — 10% of the canvas box tall. */
const SHORT_SCULPTURE = art({
  id: 'sculpt-short',
  type: 'sculpture',
  realWidthInches: 12,
  realHeightInches: 12,
});

/** A stand-in for the room canvas, which the resolvers only ever measure. */
function canvas({ left = 0, top = 0, width = 1600, height = 1000 } = {}) {
  const rect = {
    left,
    top,
    width,
    height,
    right: left + width,
    bottom: top + height,
    x: left,
    y: top,
    toJSON: () => ({}),
  };
  return { getBoundingClientRect: () => rect } as unknown as HTMLElement;
}

const CANVAS = canvas();
const RECT = CANVAS.getBoundingClientRect();

/** The geometry a drag carries, for a piece grabbed dead centre. */
function grabCentre(object: ArtObject) {
  const width = scaleFor(object, ROOM) * RECT.width;
  const height = width / aspectRatioOf(object);
  return { width, height, offsetX: width / 2, offsetY: height / 2 };
}

// ---------------------------------------------------------------------------
// isValidBand
// ---------------------------------------------------------------------------

describe('isValidBand', () => {
  it('judges wall art on its top, letting its bottom run past the split', () => {
    expect(isValidBand('wall', 30, 70, 30)).toBe(true);
    // Centre below the split, but a 30%-tall piece still hangs from 65 — most
    // of its surface is on the wall, and the centre-only rule refused it.
    expect(isValidBand('wall', 80, 70, 30)).toBe(true);
    // Hung low enough that even its top edge has left the wall.
    expect(isValidBand('wall', 90, 70, 30)).toBe(false);
    // Top exactly on the split is already off the wall.
    expect(isValidBand('wall', 85, 70, 30)).toBe(false);
    expect(isValidBand('wall', 84.9, 70, 30)).toBe(true);
    // A taller piece hung at the same spot reaches further up the wall.
    expect(isValidBand('wall', 80, 70, 0)).toBe(false);
    expect(isValidBand('wall', 80, 70, 90)).toBe(true);
  });

  it('judges a sculpture on its base, letting its top run past the split', () => {
    // Centre at 45 is up in the wall band, but a 60%-tall piece reaches 75.
    expect(isValidBand('sculpture', 45, 70, 60)).toBe(true);
    // The same spot for a 10%-tall piece is floating on the wall.
    expect(isValidBand('sculpture', 45, 70, 10)).toBe(false);
    // Base exactly on the split counts as on the floor.
    expect(isValidBand('sculpture', 40, 70, 60)).toBe(true);
    expect(isValidBand('sculpture', 39.9, 70, 60)).toBe(false);
  });

  it('falls back to the centre-only rule when no height is supplied', () => {
    expect(isValidBand('sculpture', 70, 70)).toBe(true);
    expect(isValidBand('sculpture', 69.9, 70)).toBe(false);
    expect(isValidBand('wall', 69.9, 70)).toBe(true);
    expect(isValidBand('wall', 70, 70)).toBe(false);
  });

  // Both types now allow the far edge to overrun the split, so neither may be
  // judged more permissively than the caller that has no geometry to hand —
  // that caller is Store.livePlacements, which deletes what it refuses.
  it('is never more permissive without a height than with one', () => {
    for (const type of ['wall', 'sculpture'] as const) {
      for (let y = 0; y <= 100; y += 0.5) {
        if (isValidBand(type, y, 70)) {
          expect(isValidBand(type, y, 70, 40), `${type} at y=${y}`).toBe(true);
        }
      }
    }
  });
});

// ---------------------------------------------------------------------------
// heightPercentOf
// ---------------------------------------------------------------------------

describe('heightPercentOf', () => {
  it('derives a piece height as a share of the canvas box', () => {
    expect(heightPercentOf(TALL_SCULPTURE, ROOM)).toBeCloseTo(60);
    expect(heightPercentOf(WALL_ART, ROOM)).toBeCloseTo(30);
    expect(heightPercentOf(SHORT_SCULPTURE, ROOM)).toBeCloseTo(10);
  });

  it('agrees with a measured canvas when that canvas is the nominal 16:10', () => {
    const measured = heightPercentOf(
      TALL_SCULPTURE,
      ROOM,
      RECT.width / RECT.height,
    );
    expect(measured).toBeCloseTo(heightPercentOf(TALL_SCULPTURE, ROOM));
  });

  it('honours an explicitly supplied canvas aspect', () => {
    expect(heightPercentOf(TALL_SCULPTURE, ROOM, 1)).toBeCloseTo(37.5);
  });
});

// ---------------------------------------------------------------------------
// clampToCanvas
// ---------------------------------------------------------------------------

describe('clampToCanvas', () => {
  it('leaves an interior anchor alone', () => {
    expect(clampToCanvas(50, 40)).toEqual({ x: 50, y: 40 });
  });

  it('pulls an anchor back inside on both axes', () => {
    expect(clampToCanvas(-10, 130)).toEqual({
      x: EDGE_MARGIN,
      y: 100 - EDGE_MARGIN,
    });
  });
});

// ---------------------------------------------------------------------------
// resolveDrop
// ---------------------------------------------------------------------------

describe('resolveDrop', () => {
  const drop = (
    object: ArtObject,
    clientX: number,
    clientY: number,
    over: { canvasEl?: HTMLElement | null; source?: 'tray' | 'room' } = {},
  ) =>
    resolveDrop({
      canvasEl: CANVAS,
      room: ROOM,
      object,
      source: 'tray',
      clientX,
      clientY,
      ...grabCentre(object),
      ...over,
    });

  it('does nothing without a canvas to measure', () => {
    expect(drop(WALL_ART, 800, 300, { canvasEl: null })).toEqual({
      action: 'none',
      reason: 'no-canvas',
    });
  });

  it('places wall art dropped above the split', () => {
    expect(drop(WALL_ART, 800, 300)).toEqual({
      action: 'place',
      placement: {
        objectId: 'wall-1',
        roomId: 'room-1',
        x: 50,
        y: 30,
        scale: 0.25,
      },
    });
  });

  it('refuses wall art hung low enough that its top leaves the wall', () => {
    // Centre at 90% on a 30%-tall piece: it hangs from 75%, below the split.
    expect(drop(WALL_ART, 800, 900)).toMatchObject({
      action: 'none',
      reason: 'wrong-band',
      // The trace has to say how far off it was, not just that it was off.
      measured: { centerYPercent: 90, bandSplit: 70, heightPercent: 30 },
    });
  });

  it('still places wall art whose centre dips just below the split', () => {
    // Centre at 80% — the drop the centre-only rule refused, though the piece
    // hangs from 65% and most of it is plainly on the wall.
    expect(drop(WALL_ART, 800, 800)).toMatchObject({
      action: 'place',
      placement: { x: 50, y: 80 },
    });
  });

  it('places a tall sculpture whose base reaches the floor band', () => {
    // Centre lands at 45% — above the split — but the piece is 60% tall, so it
    // stands on 75%. This is the drop the centre-only rule silently discarded.
    expect(drop(TALL_SCULPTURE, 800, 450)).toEqual({
      action: 'place',
      placement: {
        objectId: 'sculpt-tall',
        roomId: 'room-1',
        x: 50,
        y: 45,
        scale: 0.125,
      },
    });
  });

  it('refuses a short sculpture at that same spot', () => {
    expect(drop(SHORT_SCULPTURE, 800, 450)).toMatchObject({
      action: 'none',
      reason: 'wrong-band',
      // Base at 50% against a 70% split — the number that explains the refusal.
      measured: { basePercent: 50, bandSplit: 70 },
    });
  });

  it('still places a sculpture sitting wholly in the floor band', () => {
    expect(drop(SHORT_SCULPTURE, 800, 800)).toMatchObject({ action: 'place' });
  });

  it('returns a placed piece to the tray when released below the canvas', () => {
    expect(drop(WALL_ART, 800, 1025, { source: 'room' })).toEqual({
      action: 'remove',
    });
  });

  it('does not remove a tray piece dragged back to the tray', () => {
    expect(drop(WALL_ART, 800, 1025, { source: 'tray' })).toEqual({
      action: 'none',
      reason: 'returned-unplaced',
    });
  });

  it('ignores a release outside the canvas', () => {
    expect(drop(WALL_ART, 1700, 300)).toEqual({
      action: 'none',
      reason: 'outside-canvas',
    });
  });

  // The pointer is not the piece. A tall sculpture grabbed near its base and
  // released just under the canvas edge is still standing wholly in frame —
  // judging the pointer refused that drop, and refused it silently, which is
  // exactly what "the app dropped my object" looks like from the other side.
  it('places a piece held below the canvas edge whose artwork is inside it', () => {
    const { width, height } = grabCentre(TALL_SCULPTURE);
    const result = resolveDrop({
      canvasEl: CANVAS,
      room: ROOM,
      object: TALL_SCULPTURE,
      source: 'tray',
      clientX: 800,
      clientY: RECT.bottom + 10,
      width,
      height,
      offsetX: width / 2,
      // Held at its base, so the 600px-tall piece hangs above the pointer and
      // its centre lands at 71% — in frame, and standing below the split.
      offsetY: height,
    });
    expect(result).toMatchObject({
      action: 'place',
      placement: { x: 50, y: 71 },
    });
  });

  it('keeps an edge drop inside the frame', () => {
    const result = drop(TALL_SCULPTURE, 10, 450);
    expect(result).toMatchObject({ action: 'place' });
    if (result.action === 'place') expect(result.placement.x).toBe(EDGE_MARGIN);
  });
});

// ---------------------------------------------------------------------------
// resolveTapPlace
// ---------------------------------------------------------------------------

describe('resolveTapPlace', () => {
  const tap = (object: ArtObject, clientX: number, clientY: number, canvasEl = CANVAS) =>
    resolveTapPlace({ canvasEl, room: ROOM, object, clientX, clientY });

  it('does nothing without a canvas to measure', () => {
    expect(tap(WALL_ART, 800, 300, null as unknown as HTMLElement)).toEqual({
      action: 'none',
      reason: 'no-canvas',
    });
  });

  it('places wall art tapped above the split', () => {
    expect(tap(WALL_ART, 800, 300)).toMatchObject({
      action: 'place',
      placement: { x: 50, y: 30 },
    });
  });

  it('resolves a tall sculpture the same way the drop does', () => {
    // The two entry points must not drift: same piece, same spot, same answer.
    expect(tap(TALL_SCULPTURE, 800, 450)).toMatchObject({ action: 'place' });
    expect(tap(SHORT_SCULPTURE, 800, 450)).toMatchObject({
      action: 'none',
      reason: 'wrong-band',
    });
  });

  it('keeps an edge tap inside the frame', () => {
    expect(tap(TALL_SCULPTURE, 0, 450)).toMatchObject({
      action: 'place',
      placement: { x: EDGE_MARGIN },
    });
  });
});

// ---------------------------------------------------------------------------
// The invariant that protects saved work
// ---------------------------------------------------------------------------

describe('an accepted placement survives the store reconciliation pass', () => {
  /**
   * `Store.livePlacements` re-checks every saved placement whenever the catalog
   * changes and on every undo, and drops the ones that fail — it is the only
   * code that can delete a visitor's work without being asked. It has no canvas
   * to measure, so it derives the piece height from the catalog instead. If
   * that derivation is ever stricter than the one the drop used, a placement
   * disappears one commit after it was made.
   */
  const storeWouldKeep = (object: ArtObject, y: number) =>
    isValidBand(object.type, y, ROOM.bandSplit, heightPercentOf(object, ROOM));

  const OBJECTS = [WALL_ART, TALL_SCULPTURE, SHORT_SCULPTURE];

  it('holds across the whole canvas for every piece, via drop', () => {
    for (const object of OBJECTS) {
      for (let clientX = 0; clientX <= 1600; clientX += 100) {
        for (let clientY = 0; clientY <= 1000; clientY += 25) {
          const result = resolveDrop({
            canvasEl: CANVAS,
            room: ROOM,
            object,
            source: 'tray',
            clientX,
            clientY,
            ...grabCentre(object),
          });
          if (result.action !== 'place') continue;
          expect(
            storeWouldKeep(object, result.placement.y),
            `${object.id} dropped at (${clientX}, ${clientY}) placed at y=${result.placement.y} but the store would delete it`,
          ).toBe(true);
        }
      }
    }
  });

  it('holds across the whole canvas for every piece, via tap', () => {
    for (const object of OBJECTS) {
      for (let clientX = 0; clientX <= 1600; clientX += 100) {
        for (let clientY = 0; clientY <= 1000; clientY += 25) {
          const result = resolveTapPlace({
            canvasEl: CANVAS,
            room: ROOM,
            object,
            clientX,
            clientY,
          });
          if (result.action !== 'place') continue;
          expect(
            storeWouldKeep(object, result.placement.y),
            `${object.id} tapped at (${clientX}, ${clientY}) placed at y=${result.placement.y} but the store would delete it`,
          ).toBe(true);
        }
      }
    }
  });
});
