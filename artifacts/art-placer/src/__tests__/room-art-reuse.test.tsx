/**
 * Regression tests for per-room art reuse ("once per room" vs the default
 * "once per session").
 *
 * The invariant set:
 *   - A room holds at most one copy of a piece, always.
 *   - Placing into a room with `allowArtReuse: true` displaces only that
 *     room's own copy — copies in other rooms stay hung.
 *   - Placing into a room without the flag (absent or false) keeps the
 *     original session-wide rule: the piece exists once, anywhere.
 *   - Tray availability follows the ACTIVE room's policy.
 *   - livePlacements drops any duplicated (objectId, roomId) record, so a
 *     corrupt snapshot cannot come back through a catalog sweep or undo.
 */

import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, act, cleanup } from '@testing-library/react';

// ---------------------------------------------------------------------------
// Catalog mocks: reuse-room, legacy room (no flag), and one wall piece.
// ---------------------------------------------------------------------------

vi.mock('@workspace/api-client-react', () => ({
  useListRooms: () => ({
    data: [
      {
        id: 'reuse-room',
        name: 'Reuse Room',
        bandSplit: 70,
        wallWidthFeet: 10,
        backgroundFilename: 'a.jpg',
        allowArtReuse: true,
      },
      {
        // No allowArtReuse key at all — a room saved before the flag existed.
        id: 'legacy-room',
        name: 'Legacy Room',
        bandSplit: 70,
        wallWidthFeet: 10,
        backgroundFilename: 'b.jpg',
      },
    ],
    isError: false,
  }),
  useListArt: () => ({
    data: [
      {
        id: 'art-1',
        name: 'Painting',
        type: 'wall',
        realWidthInches: 48,
        realHeightInches: 32,
        fullImageFilename: 'p.jpg',
        thumbnailFilename: 'p-thumb.jpg',
      },
    ],
    isError: false,
  }),
  useListPlacements: () => ({ data: [], isError: false }),
  useReplacePlacements: () => ({ mutateAsync: vi.fn() }),
}));

import { StoreProvider, useStore } from '../state/Store';

/** Exposes store state and actions through the DOM for assertions. */
function Probe() {
  const store = useStore();
  return (
    <div
      data-testid="probe"
      data-placements={JSON.stringify(store.placements)}
      data-active-room={store.activeRoomId}
    >
      <button
        data-testid="place-reuse"
        onClick={() =>
          store.placeObject({ objectId: 'art-1', roomId: 'reuse-room', x: 30, y: 40 })
        }
      />
      <button
        data-testid="place-legacy"
        onClick={() =>
          store.placeObject({ objectId: 'art-1', roomId: 'legacy-room', x: 60, y: 40 })
        }
      />
      <button data-testid="undo" onClick={() => store.undo()} />
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
  return screen.getByTestId('probe');
}

function placementsOf(probe: HTMLElement): Array<{ objectId: string; roomId: string; x: number }> {
  return JSON.parse(probe.getAttribute('data-placements')!);
}

function click(testId: string) {
  return act(async () => {
    screen.getByTestId(testId).click();
  });
}

describe('per-room art reuse', () => {
  afterEach(() => cleanup());

  it('placing into a reuse room keeps the copy hanging in another room', async () => {
    const probe = await renderStore();

    await click('place-legacy'); // once-per-session room takes it first
    await click('place-reuse');  // the reuse room can hang it too

    const placements = placementsOf(probe);
    expect(placements).toHaveLength(2);
    expect(placements.map((p) => p.roomId).sort()).toEqual(['legacy-room', 'reuse-room']);
  });

  it('re-placing inside a reuse room displaces only that room’s own copy', async () => {
    const probe = await renderStore();

    await click('place-legacy');
    await click('place-reuse');
    await click('place-reuse'); // same room again — moves, never duplicates

    const placements = placementsOf(probe);
    expect(placements).toHaveLength(2);
    expect(
      placements.filter((p) => p.roomId === 'reuse-room'),
    ).toHaveLength(1);
  });

  it('placing into a legacy room (flag absent) removes the piece everywhere', async () => {
    const probe = await renderStore();

    await click('place-reuse');
    await click('place-legacy'); // session-wide rule: displaces the reuse copy

    const placements = placementsOf(probe);
    expect(placements).toHaveLength(1);
    expect(placements[0].roomId).toBe('legacy-room');
  });

  it('undo restores the multi-room arrangement it recorded', async () => {
    const probe = await renderStore();

    await click('place-legacy');
    await click('place-reuse');
    await click('undo'); // back to legacy-only

    const placements = placementsOf(probe);
    expect(placements).toHaveLength(1);
    expect(placements[0].roomId).toBe('legacy-room');
  });
});
