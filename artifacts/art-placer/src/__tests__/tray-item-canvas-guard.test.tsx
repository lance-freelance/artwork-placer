/**
 * Regression tests for the "first drag misplaces art" bug.
 *
 * TrayItem's onDragStart measures the room canvas live via canvasElRef. When
 * the canvas hasn't registered itself yet (ref is null) or reports zero width,
 * the guard must leave the gesture inert: no drag ghost, no placement on
 * release. These tests pin that guard, plus the healthy path, so a refactor
 * that drops the canvasWidth check fails here instead of on a device.
 */

import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, act, cleanup, fireEvent } from '@testing-library/react';

// ---------------------------------------------------------------------------
// Catalog mocks — realistic fields so the sizing maths produces real numbers.
// scaleFor(art, room) = 48in / 12 / 10ft = 0.4 → ghost width is 40% of canvas.
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
        fullImageFilename: 'test.jpg',
        thumbnailFilename: 'test-thumb.jpg',
      },
    ],
    isError: false,
  }),
  // Start with nothing placed so the tray item is visible and any placement
  // observed later must have come from the drag under test.
  useListPlacements: () => ({ data: [], isError: false }),
  useReplacePlacements: () => ({ mutateAsync: vi.fn() }),
}));

import { StoreProvider, useStore } from '../state/Store';
import { TrayItem } from '../components/TrayItem';

// ---------------------------------------------------------------------------
// Harness pieces
// ---------------------------------------------------------------------------

/** A canvas rect matching the layout's 16:10 box. */
const CANVAS_RECT = {
  left: 0,
  top: 0,
  width: 1000,
  height: 625,
  right: 1000,
  bottom: 625,
  x: 0,
  y: 0,
  toJSON: () => ({}),
} as DOMRect;

const ZERO_RECT = { ...CANVAS_RECT, width: 0, right: 0 } as DOMRect;

/**
 * Registers a fake room canvas in the store, the way RoomCanvas does, with a
 * stubbed bounding rect. `rect === null` means "never register" — the state
 * a first drag races against.
 */
function CanvasStub({ rect }: { rect: DOMRect | null }) {
  const { canvasElRef } = useStore();
  return (
    <div
      data-testid="canvas"
      ref={(el) => {
        if (el && rect) {
          el.getBoundingClientRect = () => rect;
          canvasElRef.current = el;
        }
      }}
    />
  );
}

/** Exposes placements and dragState through the DOM for assertions. */
function StoreProbe() {
  const { placements, dragState } = useStore();
  return (
    <div
      data-testid="probe"
      data-placements={JSON.stringify(placements)}
      data-drag-active={String(dragState !== null)}
    />
  );
}

async function renderTray(rect: DOMRect | null) {
  await act(async () => {
    render(
      <StoreProvider>
        <CanvasStub rect={rect} />
        <TrayItem objectId="art-1" />
        <StoreProbe />
      </StoreProvider>,
    );
  });
  return {
    item: screen.getByRole('button', { name: /Select Painting/ }),
    probe: screen.getByTestId('probe'),
  };
}

function readPlacements(probe: HTMLElement): Array<{ objectId: string; x: number; y: number }> {
  return JSON.parse(probe.getAttribute('data-placements')!);
}

const POINTER_ID = 1;

/** Full gesture: press → move past the 6px threshold → release over the canvas. */
function dragOntoCanvas(el: HTMLElement) {
  fireEvent.pointerDown(el, { button: 0, pointerId: POINTER_ID, clientX: 100, clientY: 700 });
  fireEvent.pointerMove(el, { pointerId: POINTER_ID, clientX: 300, clientY: 500 });
  // Release well inside the wall band: y = 300 of 625 → 48% < bandSplit 70.
  fireEvent.pointerMove(el, { pointerId: POINTER_ID, clientX: 400, clientY: 300 });
  fireEvent.pointerUp(el, { pointerId: POINTER_ID, clientX: 400, clientY: 300 });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('TrayItem — drag before the room canvas is ready', () => {
  afterEach(() => {
    cleanup();
  });

  it('with no canvas registered, a full drag commits nothing and leaves no ghost', async () => {
    const { item, probe } = await renderTray(null);

    dragOntoCanvas(item);

    // No placement was committed…
    expect(readPlacements(probe)).toHaveLength(0);
    // …and no drag ghost state survived the gesture.
    expect(probe.getAttribute('data-drag-active')).toBe('false');
    // The piece is still in the tray, ready for a later, valid drag.
    expect(screen.getByRole('button', { name: /Select Painting/ })).toBeInTheDocument();
  });

  it('with a zero-width canvas rect, a full drag commits nothing and leaves no ghost', async () => {
    const { item, probe } = await renderTray(ZERO_RECT);

    dragOntoCanvas(item);

    expect(readPlacements(probe)).toHaveLength(0);
    expect(probe.getAttribute('data-drag-active')).toBe('false');
    expect(screen.getByRole('button', { name: /Select Painting/ })).toBeInTheDocument();
  });

  it('the drag ghost never appears when the guard bails out', async () => {
    const { item, probe } = await renderTray(null);

    fireEvent.pointerDown(item, { button: 0, pointerId: POINTER_ID, clientX: 100, clientY: 700 });
    fireEvent.pointerMove(item, { pointerId: POINTER_ID, clientX: 300, clientY: 500 });

    // Mid-gesture, past the threshold: the guard returned before setDragState,
    // so no ghost is on screen at all.
    expect(probe.getAttribute('data-drag-active')).toBe('false');

    fireEvent.pointerUp(item, { pointerId: POINTER_ID, clientX: 400, clientY: 300 });
    expect(readPlacements(probe)).toHaveLength(0);
  });
});

describe('TrayItem — healthy registered canvas', () => {
  afterEach(() => {
    cleanup();
  });

  it('the same drag places the piece when the canvas is registered with real width', async () => {
    const { item, probe } = await renderTray(CANVAS_RECT);

    await act(async () => {
      dragOntoCanvas(item);
    });

    const placements = readPlacements(probe);
    expect(placements).toHaveLength(1);
    expect(placements[0].objectId).toBe('art-1');
    // Released at (400, 300) with the grab centred on the piece, so the
    // anchor is the release point: 40% across, 48% down — inside the wall band.
    expect(placements[0].x).toBeCloseTo(40, 1);
    expect(placements[0].y).toBeCloseTo(48, 1);
    // The gesture finished cleanly: ghost cleared after the drop.
    expect(probe.getAttribute('data-drag-active')).toBe('false');
    // The catalog slot stays visible after placement, so neighboring pieces
    // do not collapse into the removed thumbnail's footprint.
    const placeholder = screen.getByTestId('tray-placeholder-art-1');
    expect(placeholder).toBeInTheDocument();

    // The placeholder must carry the same intrinsic box as the button so the
    // carousel slot width is unchanged by the state switch.  Both states share
    // the clamp height and the artwork aspect-ratio; neither carries its own
    // horizontal margin (that belongs to the InventoryTray wrapper).
    expect(placeholder).toHaveStyle({ aspectRatio: '1.5' }); // 48in / 32in
    expect(placeholder).not.toHaveClass('ml-[14px]', 'mr-[14px]');
  });
});
