/**
 * Persistence tests for the Store's localStorage path.
 *
 * Visitor placements hydrate from and save to localStorage
 * (key `haumiq.placements.v1`). These tests pin the whole path:
 * valid hydration, filtering of entries referencing deleted rooms/art,
 * corrupt JSON / non-array / malformed entries, the debounced save,
 * and the failure path when the write throws.
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, cleanup, fireEvent } from '@testing-library/react';

// ---------------------------------------------------------------------------
// Catalog mock. Mutable so individual tests can shrink the catalog and prove
// the hydration sweep drops placements pointing at rooms/art that no longer
// exist. (vi.mock is hoisted; the factory closes over these lets.)
// ---------------------------------------------------------------------------

/**
 * Fixture geometry, chosen so the sample placements below are band-valid and
 * survive the store's reconciliation sweep:
 * - wall piece: scaleFor = 24 / 12 / 12 = 0.1667, aspect = 24/16 = 1.5,
 *   heightPercent ≈ 17.8 → centerY 30 has its top well above bandSplit 70.
 * - sculpture: centerY 85 with base below 70.
 */
const ROOM = { id: 'room-1', name: 'Living Room', bandSplit: 70, wallWidthFeet: 12 };
const ROOM_2 = { id: 'room-2', name: 'Study', bandSplit: 70, wallWidthFeet: 12 };
const WALL_ART = {
  id: 'art-1',
  name: 'Painting',
  type: 'wall',
  realWidthInches: 24,
  realHeightInches: 16,
  fullImageFilename: 'test.jpg',
  thumbnailFilename: 'test-thumb.jpg',
};
const SCULPTURE = {
  id: 'art-2',
  name: 'Bust',
  type: 'sculpture',
  realWidthInches: 12,
  realHeightInches: 18,
  fullImageFilename: 'bust.jpg',
  thumbnailFilename: 'bust-thumb.jpg',
};

let mockRooms: unknown[] = [ROOM, ROOM_2];
let mockArt: unknown[] = [WALL_ART, SCULPTURE];

vi.mock('@workspace/api-client-react', () => ({
  useListRooms: () => ({ data: mockRooms, isError: false }),
  useListArt: () => ({ data: mockArt, isError: false }),
}));

import { StoreProvider, useStore } from '../state/Store';

const STORAGE_KEY = 'haumiq.placements.v1';
const SAVE_DEBOUNCE_MS = 400;

/** A band-valid wall placement in room-1. */
const VALID_WALL = { roomId: 'room-1', objectId: 'art-1', x: 40, y: 30, scale: 0.1667 };
/** A band-valid sculpture placement in room-1. */
const VALID_SCULPTURE = { roomId: 'room-1', objectId: 'art-2', x: 60, y: 85, scale: 0.0833 };

// ---------------------------------------------------------------------------
// Probe component: exposes the hydrated placements through the DOM and a
// button that mutates them, so tests can drive the save path.
// ---------------------------------------------------------------------------

function Probe() {
  const { placements, placeObject, removePlacement } = useStore();
  return (
    <div>
      <div data-testid="placements">{JSON.stringify(placements)}</div>
      <button
        data-testid="place"
        onClick={() => placeObject({ roomId: 'room-1', objectId: 'art-1', x: 50, y: 25, scale: 0.1667 })}
      />
      <button
        data-testid="place-alt"
        onClick={() => placeObject({ roomId: 'room-1', objectId: 'art-1', x: 20, y: 35, scale: 0.1667 })}
      />
      <button data-testid="remove" onClick={() => removePlacement('art-1')} />
    </div>
  );
}

async function renderStore() {
  await act(async () => {
    render(
      <StoreProvider>
        <Probe />
      </StoreProvider>,
    );
  });
}

/** The placements the Probe currently sees. */
function visiblePlacements(): Array<Record<string, unknown>> {
  return JSON.parse(screen.getByTestId('placements').textContent ?? '[]');
}

beforeEach(() => {
  localStorage.clear();
  mockRooms = [ROOM, ROOM_2];
  mockArt = [WALL_ART, SCULPTURE];
});

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Hydration
// ---------------------------------------------------------------------------

describe('Store persistence — hydration', () => {
  it('hydrates valid stored placements', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([VALID_WALL, VALID_SCULPTURE]));

    await renderStore();

    expect(visiblePlacements()).toEqual([VALID_WALL, VALID_SCULPTURE]);
  });

  it('starts empty when nothing is stored', async () => {
    await renderStore();
    expect(visiblePlacements()).toEqual([]);
  });

  it('drops placements referencing a deleted room', async () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify([VALID_WALL, { ...VALID_WALL, objectId: 'art-2', roomId: 'room-gone', y: 85 }]),
    );

    await renderStore();

    expect(visiblePlacements()).toEqual([VALID_WALL]);
  });

  it('drops placements referencing deleted art', async () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify([{ ...VALID_WALL, objectId: 'art-gone' }, VALID_SCULPTURE]),
    );

    await renderStore();

    expect(visiblePlacements()).toEqual([VALID_SCULPTURE]);
  });

  it('treats corrupt JSON as an empty board', async () => {
    localStorage.setItem(STORAGE_KEY, '{not json');

    await renderStore();

    expect(visiblePlacements()).toEqual([]);
  });

  it('treats a non-array value as an empty board', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ roomId: 'room-1' }));

    await renderStore();

    expect(visiblePlacements()).toEqual([]);
  });

  it('discards malformed entries while keeping valid ones', async () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify([
        VALID_WALL,
        null,
        'a string',
        42,
        { roomId: 'room-1' }, // missing fields
        { ...VALID_SCULPTURE, scale: 0 }, // scale must be > 0
        { ...VALID_SCULPTURE, scale: 1.5 }, // scale must be <= 1
        { ...VALID_SCULPTURE, x: 'left' }, // non-numeric coordinate
        { ...VALID_SCULPTURE, y: Infinity }, // non-finite coordinate (Infinity serializes to null)
        { ...VALID_WALL, roomId: 7 }, // non-string id
      ]),
    );

    await renderStore();

    expect(visiblePlacements()).toEqual([VALID_WALL]);
  });
});

// ---------------------------------------------------------------------------
// Debounced save
// ---------------------------------------------------------------------------

describe('Store persistence — debounced save', () => {
  it('writes to storage only after the debounce settles', async () => {
    vi.useFakeTimers();
    await renderStore();

    fireEvent.click(screen.getByTestId('place'));

    // Nothing written before the debounce elapses.
    act(() => {
      vi.advanceTimersByTime(SAVE_DEBOUNCE_MS - 1);
    });
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!)).toEqual([
      { roomId: 'room-1', objectId: 'art-1', x: 50, y: 25, scale: 0.1667 },
    ]);
  });

  it('collapses rapid changes into a single write of the final state', async () => {
    vi.useFakeTimers();
    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    await renderStore();

    fireEvent.click(screen.getByTestId('place'));
    act(() => {
      vi.advanceTimersByTime(SAVE_DEBOUNCE_MS - 50);
    });
    fireEvent.click(screen.getByTestId('place-alt')); // resets the timer

    act(() => {
      vi.advanceTimersByTime(SAVE_DEBOUNCE_MS);
    });

    // One write, holding only the final state — never the intermediate one.
    expect(setItem).toHaveBeenCalledTimes(1);
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!)).toEqual([
      { roomId: 'room-1', objectId: 'art-1', x: 20, y: 35, scale: 0.1667 },
    ]);
  });

  it('does not rewrite storage when hydrated content is unchanged', async () => {
    vi.useFakeTimers();
    localStorage.setItem(STORAGE_KEY, JSON.stringify([VALID_WALL]));
    const setItem = vi.spyOn(Storage.prototype, 'setItem');

    await renderStore();
    act(() => {
      vi.advanceTimersByTime(SAVE_DEBOUNCE_MS * 2);
    });

    expect(setItem).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Write failure
// ---------------------------------------------------------------------------

describe('Store persistence — write failure', () => {
  it('shows a notice when the write throws, and retries on the next change', async () => {
    vi.useFakeTimers();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const setItem = vi
      .spyOn(Storage.prototype, 'setItem')
      .mockImplementation(() => {
        throw new Error('quota exceeded');
      });

    await renderStore();

    fireEvent.click(screen.getByTestId('place'));
    act(() => {
      vi.advanceTimersByTime(SAVE_DEBOUNCE_MS);
    });

    // The failed write surfaces rather than being silently swallowed.
    expect(screen.getByRole('status').textContent).toMatch(/not saved/i);
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();

    // Storage recovers; the next change (a different arrangement, so the
    // serialized form differs from the last successful save) writes and
    // clears the notice.
    setItem.mockRestore();
    fireEvent.click(screen.getByTestId('place-alt'));
    act(() => {
      vi.advanceTimersByTime(SAVE_DEBOUNCE_MS);
    });

    expect(screen.queryByRole('status')).toBeNull();
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!)).toEqual([
      { roomId: 'room-1', objectId: 'art-1', x: 20, y: 35, scale: 0.1667 },
    ]);
  });
});
