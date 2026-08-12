/**
 * Regression tests for interrupted-drag misplacement bugs.
 *
 * Three drag bugs were fixed that were invisible on a desktop browser and only
 * appeared on a real tablet. These tests pin the invariants so any future
 * change to usePointerDrag or the Store safety net catches a breakage
 * immediately rather than requiring a physical device to notice.
 */

import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, act, cleanup } from '@testing-library/react';
import { fireEvent } from '@testing-library/react';

import { usePointerDrag, abortActivePointerDrags } from '../hooks/usePointerDrag';

// ---------------------------------------------------------------------------
// Top-level mocks (vi.mock is always hoisted — factory values must be literals)
// ---------------------------------------------------------------------------

vi.mock('@workspace/api-client-react', () => ({
  useListRooms: () => ({
    data: [{ id: 'room-1', name: 'Living Room', bandSplit: 70 }],
    isError: false,
  }),
  useListArt: () => ({
    data: [
      {
        id: 'art-1',
        name: 'Painting',
        type: 'wall',
        defaultScale: 0.3,
        aspectRatio: 1.5,
        fullImageFilename: 'test.jpg',
        thumbnailFilename: 'test-thumb.jpg',
      },
    ],
    isError: false,
  }),
}));

// ---------------------------------------------------------------------------
// Minimal test harness
// ---------------------------------------------------------------------------

interface DragHarnessProps {
  onDragStart?: () => boolean | void;
  onDragMove?: () => void;
  onDragEnd?: () => void;
  onDragCancel?: () => void;
  /** Must match the test's pointermove distance to control when drag starts. */
  threshold?: number;
}

/**
 * A tiny draggable element that exposes the hook's return value through the
 * DOM so tests can call `dragging()` via a data attribute.
 */
function DragHarness({
  onDragStart,
  onDragMove,
  onDragEnd,
  onDragCancel,
  threshold = 5,
}: DragHarnessProps) {
  const { dragging, handlers } = usePointerDrag({
    onDragStart: onDragStart ?? (() => {}),
    onDragMove: onDragMove ?? (() => {}),
    onDragEnd: onDragEnd ?? (() => {}),
    onDragCancel,
    threshold,
  });

  return (
    <div
      data-testid="target"
      {...handlers}
      style={handlers.style}
      // Expose `dragging()` result so tests can read it after click events.
      data-dragging={String(dragging())}
    />
  );
}

// ---------------------------------------------------------------------------
// Pointer event helpers
// ---------------------------------------------------------------------------

const POINTER_ID = 1;

function pointerDown(el: HTMLElement, x = 100, y = 100) {
  fireEvent.pointerDown(el, {
    button: 0,
    pointerId: POINTER_ID,
    clientX: x,
    clientY: y,
  });
}

/** Move far enough past the default threshold of 5px to start the drag. */
function pointerMove(el: HTMLElement, x = 120, y = 120) {
  fireEvent.pointerMove(el, {
    pointerId: POINTER_ID,
    clientX: x,
    clientY: y,
  });
}

function pointerUp(el: HTMLElement, x = 120, y = 120) {
  fireEvent.pointerUp(el, {
    pointerId: POINTER_ID,
    clientX: x,
    clientY: y,
  });
}

function pointerCancel(el: HTMLElement) {
  fireEvent.pointerCancel(el, { pointerId: POINTER_ID });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('usePointerDrag — drag lifecycle', () => {
  afterEach(() => {
    cleanup();
  });

  it('a completed drag calls onDragEnd exactly once, not twice', () => {
    const onDragEnd = vi.fn();

    render(<DragHarness onDragEnd={onDragEnd} />);
    const el = screen.getByTestId('target');

    // Full gesture: press → move past threshold → release.
    pointerDown(el);
    pointerMove(el);
    pointerUp(el);

    // The window-level safety-net in Store would also fire on the same
    // pointerup. Simulate that by calling abortActivePointerDrags, as the
    // Store does, to prove the hook's teardown guard prevents a double-commit.
    act(() => {
      abortActivePointerDrags();
    });

    expect(onDragEnd).toHaveBeenCalledTimes(1);
  });

  // An owner with nothing to drag with — a tray piece whose room canvas has not
  // registered yet — refuses the gesture. The hook used to have already
  // committed to the drag by then, so it went on tracking a piece that had no
  // ghost and could never resolve: the contact stayed armed until release and
  // then did nothing, which is indistinguishable from a dropped object.
  it('a refused drag start leaves the hook idle and never ends a drag', () => {
    const onDragStart = vi.fn(() => false);
    const onDragMove = vi.fn();
    const onDragEnd = vi.fn();
    const onDragCancel = vi.fn();

    render(
      <DragHarness
        onDragStart={onDragStart}
        onDragMove={onDragMove}
        onDragEnd={onDragEnd}
        onDragCancel={onDragCancel}
      />,
    );
    const el = screen.getByTestId('target');

    pointerDown(el);
    pointerMove(el);

    expect(onDragStart).toHaveBeenCalledTimes(1);
    // Refused, so nothing downstream of the start may run.
    expect(onDragMove).not.toHaveBeenCalled();

    // Further movement must not retry the start on every event.
    pointerMove(el, 200, 200);
    expect(onDragStart).toHaveBeenCalledTimes(1);

    // And the release resolves nothing rather than dropping with no geometry.
    pointerUp(el);
    expect(onDragEnd).not.toHaveBeenCalled();
    expect(onDragCancel).not.toHaveBeenCalled();
    expect(el.dataset.dragging).toBe('false');
  });

  it('pointercancel mid-drag calls onDragCancel, never onDragEnd', () => {
    const onDragEnd = vi.fn();
    const onDragCancel = vi.fn();

    render(<DragHarness onDragEnd={onDragEnd} onDragCancel={onDragCancel} />);
    const el = screen.getByTestId('target');

    pointerDown(el);
    pointerMove(el);
    pointerCancel(el);

    expect(onDragCancel).toHaveBeenCalledTimes(1);
    expect(onDragEnd).not.toHaveBeenCalled();
  });

  it('pointercancel mid-drag leaves the hook idle (no stale refs)', () => {
    const onDragEnd = vi.fn();
    const onDragCancel = vi.fn();

    render(<DragHarness onDragEnd={onDragEnd} onDragCancel={onDragCancel} />);
    const el = screen.getByTestId('target');

    pointerDown(el);
    pointerMove(el);
    pointerCancel(el);

    // A pointerup arriving after the cancel (e.g. a stray event from the OS)
    // must not trigger a drop.
    pointerUp(el);

    expect(onDragEnd).not.toHaveBeenCalled();
    // onDragCancel should still only have been called once.
    expect(onDragCancel).toHaveBeenCalledTimes(1);
  });

  it('window blur mid-drag then pointerup commits nothing', () => {
    // The Store's window blur handler calls abortActivePointerDrags(), which
    // is how the hook learns the gesture was interrupted. This test verifies
    // that a pointerup arriving after that abort is silently ignored.
    const onDragEnd = vi.fn();
    const onDragCancel = vi.fn();

    render(<DragHarness onDragEnd={onDragEnd} onDragCancel={onDragCancel} />);
    const el = screen.getByTestId('target');

    pointerDown(el);
    pointerMove(el);

    // Simulate the Store's window-blur handler running abortActivePointerDrags.
    act(() => {
      abortActivePointerDrags();
    });

    expect(onDragCancel).toHaveBeenCalledTimes(1);

    // The OS may still deliver a pointerup after focus returns; it must do
    // nothing because the hook already cancelled the gesture.
    pointerUp(el);

    expect(onDragEnd).not.toHaveBeenCalled();
    expect(onDragCancel).toHaveBeenCalledTimes(1);
  });

  it('the click that trails a completed drag is flagged by dragging()', () => {
    // dragging() returns true from the moment the drag ends until the next
    // press, so a click handler can skip its action when dragging() is true
    // and avoid toggling selection after the user just placed something.
    const onClick = vi.fn();

    function HarnessWithClick(props: DragHarnessProps) {
      const { dragging, handlers } = usePointerDrag({
        onDragStart: () => {},
        onDragMove: () => {},
        onDragEnd: () => {},
        threshold: props.threshold ?? 5,
      });
      return (
        <button
          data-testid="target"
          {...handlers}
          style={handlers.style}
          onClick={() => {
            if (dragging()) return; // mirrors TrayItem
            onClick();
          }}
        />
      );
    }

    render(<HarnessWithClick />);
    const el = screen.getByTestId('target');

    // Complete a drag.
    pointerDown(el);
    pointerMove(el);
    pointerUp(el);

    // The browser fires a synthetic click on the element right after pointerup.
    fireEvent.click(el);

    expect(onClick).not.toHaveBeenCalled();
  });

  it('a normal tap (no drag) is not suppressed by dragging()', () => {
    const onClick = vi.fn();

    function HarnessWithClick() {
      const { dragging, handlers } = usePointerDrag({
        onDragStart: () => {},
        onDragMove: () => {},
        onDragEnd: () => {},
        threshold: 20, // very high threshold so a small move stays a tap
      });
      return (
        <button
          data-testid="target"
          {...handlers}
          style={handlers.style}
          onClick={() => {
            if (dragging()) return;
            onClick();
          }}
        />
      );
    }

    render(<HarnessWithClick />);
    const el = screen.getByTestId('target');

    // Press and release without crossing the threshold — this is a tap.
    pointerDown(el, 100, 100);
    pointerMove(el, 101, 101); // only 1px — stays below threshold of 20
    pointerUp(el, 101, 101);
    fireEvent.click(el);

    expect(onClick).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// Store safety-net: end-to-end event-path tests
//
// These tests mount StoreProvider alongside a DragHarness and dispatch real
// window events, exercising the full path:
//   window event → Store listener → abortActivePointerDrags() → hook cancel
//
// A pure hook unit test (calling abortActivePointerDrags directly) cannot
// catch a future change that removes/bypasses that call inside the Store
// listener while keeping the listener itself registered. These tests can.
// ---------------------------------------------------------------------------

describe('Store safety-net — end-to-end event path', () => {
  /**
   * Renders StoreProvider wrapping a DragHarness. The Store mock returns
   * data synchronously, so after `await act(async () => render(...))` the
   * hydration effect has run and the DragHarness is mounted.
   */
  async function renderWithStore(props: DragHarnessProps) {
    const { StoreProvider } = await import('../state/Store');
    await act(async () => {
      render(
        <StoreProvider>
          <DragHarness {...props} />
        </StoreProvider>,
      );
    });
    return screen.getByTestId('target');
  }

  it('window blur mid-drag cancels the gesture via the Store safety-net', async () => {
    const onDragEnd = vi.fn();
    const onDragCancel = vi.fn();

    const el = await renderWithStore({ onDragEnd, onDragCancel });

    pointerDown(el);
    pointerMove(el);

    // Fire the real window blur that the Store is listening for.
    // This exercises: window blur → Store listener → abortActivePointerDrags()
    // → hook teardown → onDragCancel.
    act(() => {
      window.dispatchEvent(new Event('blur'));
    });

    expect(onDragCancel).toHaveBeenCalledTimes(1);

    // The OS may still deliver a pointerup after focus returns; the hook's
    // refs are now cleared so it must commit nothing.
    pointerUp(el);
    expect(onDragEnd).not.toHaveBeenCalled();
  });

  it('window pointercancel mid-drag cancels the gesture via the Store safety-net', async () => {
    const onDragEnd = vi.fn();
    const onDragCancel = vi.fn();

    const el = await renderWithStore({ onDragEnd, onDragCancel });

    pointerDown(el);
    pointerMove(el);

    // A system-level pointercancel that reaches window (e.g. OS edge swipe).
    // The element's own onPointerCancel would fire for a cancel targeted at
    // the element; this one is dispatched directly on window to verify the
    // Store's window-level listener triggers the abort.
    act(() => {
      window.dispatchEvent(new PointerEvent('pointercancel', { pointerId: POINTER_ID, bubbles: false }));
    });

    expect(onDragCancel).toHaveBeenCalledTimes(1);

    pointerUp(el);
    expect(onDragEnd).not.toHaveBeenCalled();
  });

  it('a completed drag followed by window pointerup does not commit twice', async () => {
    const onDragEnd = vi.fn();

    const el = await renderWithStore({ onDragEnd });

    pointerDown(el);
    pointerMove(el);
    // The element-level finish() fires here, committing once and clearing refs.
    pointerUp(el);

    // The same pointerup event bubbles to window and fires the Store's safety
    // net, which calls abortActivePointerDrags(). Because finish() cleared the
    // refs first, the teardown guard sees nothing in flight and returns early.
    act(() => {
      window.dispatchEvent(new PointerEvent('pointerup', { pointerId: POINTER_ID, bubbles: false }));
    });

    expect(onDragEnd).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// Store safety-net: window listener phase
// ---------------------------------------------------------------------------

describe('Store safety-net — window listeners must be bubble-phase', () => {
  /**
   * The comment in Store.tsx explains the invariant precisely:
   *
   *   "These must stay bubble-phase. React's delegated handler sits on the
   *    root container, so on a normal release finish() runs first and leaves
   *    nothing in flight, which makes the teardown above a no-op. Switching
   *    any of these to capture would invert that order and silently abort
   *    every valid drop."
   *
   * This test enforces that invariant. If someone passes `{ capture: true }`
   * or `true` as the third argument to any of the three window listeners
   * (pointerup, pointercancel, blur), this test will fail and surface the
   * problem before it reaches a device.
   */
  it('pointerup, pointercancel, and blur listeners are registered in bubble phase', async () => {
    // Spy before anything mounts.
    const addSpy = vi.spyOn(window, 'addEventListener');

    // The mock for @workspace/api-client-react is registered at the top of
    // this file (vi.mock is hoisted, so it is always in effect here).
    const { StoreProvider } = await import('../state/Store');

    await act(async () => {
      render(<StoreProvider><div data-testid="child" /></StoreProvider>);
    });

    // For each sentinel event: assert it was registered at least once AND
    // that every registration is bubble-phase (no capture: true / true).
    // Asserting presence means a deleted listener also fails this test.
    const sentinelEvents = ['pointerup', 'pointercancel', 'blur'] as const;

    for (const event of sentinelEvents) {
      const registrations = addSpy.mock.calls.filter(([e]) => e === event);

      expect(
        registrations.length,
        `The Store safety-net is missing a "${event}" listener on window. ` +
        'All three listeners (pointerup, pointercancel, blur) are required — ' +
        'see the comment in Store.tsx.',
      ).toBeGreaterThanOrEqual(1);

      const captureRegistrations = registrations.filter(([, , opts]) =>
        // addEventListener(type, listener, true) or ({ capture: true })
        opts === true || (typeof opts === 'object' && opts !== null && (opts as AddEventListenerOptions).capture === true),
      );

      expect(
        captureRegistrations,
        `The "${event}" listener on window is registered in capture phase. ` +
        'Switch it back to bubble phase — see the comment in Store.tsx for the reason this matters.',
      ).toHaveLength(0);
    }

    addSpy.mockRestore();
  });
});
