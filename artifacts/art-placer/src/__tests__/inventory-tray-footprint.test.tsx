/**
 * Regression tests for the tray-footprint invariant: placing a piece must not
 * change the horizontal space its carousel slot occupies.
 *
 * The first version of the placeholder kept the image box but dropped the
 * thumbnail's side margins, so every later item slid 28px left the moment a
 * piece was placed. jsdom performs no layout, so these tests pin the
 * structural facts that geometry depends on instead of measuring pixels:
 *
 *   1. every catalog slot wrapper stays mounted, in order, with unchanged
 *      classes, whether its piece is in the tray or on the wall;
 *   2. the placeholder carries the same intrinsic box (height clamp +
 *      artwork aspect-ratio) as the button it replaces;
 *   3. neither state carries its own horizontal margin — the wrapper owns
 *      all slot spacing, so the two states cannot drift apart.
 */

import React from 'react';
import { describe, it, expect, vi, afterEach, beforeAll } from 'vitest';
import { render, screen, act, cleanup } from '@testing-library/react';

// ---------------------------------------------------------------------------
// Catalog mocks — two pieces so "the neighbor's slot" is a real element.
// ---------------------------------------------------------------------------

vi.mock('@workspace/api-client-react', () => ({
  useListRooms: () => ({
    data: [
      {
        id: 'room-1',
        name: 'Living Room',
        bandSplit: 70,
        wallWidthFeet: 10,
        backgroundFilename: 'room.jpg',
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
        fullImageFilename: 'a.jpg',
        thumbnailFilename: 'a-thumb.jpg',
      },
      {
        id: 'art-2',
        name: 'Sculpture',
        type: 'sculpture',
        realWidthInches: 20,
        realHeightInches: 40,
        fullImageFilename: 'b.jpg',
        thumbnailFilename: 'b-thumb.jpg',
      },
    ],
    isError: false,
  }),
  useListPlacements: () => ({ data: [], isError: false }),
  useReplacePlacements: () => ({ mutateAsync: vi.fn() }),
}));

import { StoreProvider, useStore } from '../state/Store';
import { InventoryTray } from '../components/InventoryTray';

// jsdom has no ResizeObserver; the tray only uses it to refresh arrow state.
beforeAll(() => {
  (globalThis as Record<string, unknown>).ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

/** Places art-1 through the store, the way a resolved drop does. */
function PlaceControl() {
  const { placeObject } = useStore();
  return (
    <button
      data-testid="place-art-1"
      onClick={() =>
        placeObject({ objectId: 'art-1', roomId: 'room-1', x: 40, y: 48 })
      }
    />
  );
}

async function renderTray() {
  await act(async () => {
    render(
      <StoreProvider>
        <InventoryTray />
        <PlaceControl />
      </StoreProvider>,
    );
  });
}

/** The direct children of the scroll strip, i.e. the slot wrappers, in order. */
function slotWrappers(): HTMLElement[] {
  // The strip is the element that owns the horizontal scroll; every slot
  // wrapper is one of its direct children.
  const strip = document.querySelector('.overflow-x-auto')!;
  return Array.from(strip.children) as HTMLElement[];
}

describe('InventoryTray — slot footprint survives placement', () => {
  afterEach(() => {
    cleanup();
  });

  it('keeps every slot wrapper mounted, in order, with unchanged classes', async () => {
    await renderTray();

    const before = slotWrappers();
    expect(before).toHaveLength(2);
    const beforeClasses = before.map((el) => el.className);

    await act(async () => {
      screen.getByTestId('place-art-1').click();
    });

    const after = slotWrappers();
    // Same number of slots — placing removed the thumbnail, not the slot.
    expect(after).toHaveLength(2);
    // Same wrappers, same order, same classes — margin/gap geometry is
    // untouched, so the neighbor cannot have moved.
    after.forEach((el, i) => {
      expect(el.className).toBe(beforeClasses[i]);
    });
    // The first slot now holds the placeholder, the second still its button.
    expect(after[0].querySelector('[data-testid="tray-placeholder-art-1"]')).not.toBeNull();
    expect(after[1].querySelector('button')).not.toBeNull();
  });

  it('the placeholder occupies the same intrinsic box as the thumbnail it replaces', async () => {
    await renderTray();

    const button = screen.getByRole('button', { name: /Select Painting/ });
    const buttonBox = {
      height: button.style.height,
      aspectRatio: button.style.aspectRatio,
    };
    // The button never carries its own horizontal margin; the wrapper owns
    // slot spacing so both states share it.
    expect(button.className).not.toMatch(/\bm[lr]-/);

    await act(async () => {
      screen.getByTestId('place-art-1').click();
    });

    const placeholder = screen.getByTestId('tray-placeholder-art-1');
    expect(placeholder.style.height).toBe(buttonBox.height);
    expect(placeholder.style.aspectRatio).toBe(buttonBox.aspectRatio);
    expect(placeholder.className).not.toMatch(/\bm[lr]-/);
  });
});
