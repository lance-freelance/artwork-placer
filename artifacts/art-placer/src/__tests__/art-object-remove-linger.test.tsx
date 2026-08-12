/**
 * Regression tests for the vanishing remove button on touch screens.
 *
 * Touch devices that report `hover: hover` (touchscreen laptops, Surface-class
 * tablets) answer a tap with a hover state that ends the instant the finger
 * lifts, so the X flashed and was gone before it could be aimed at. The button
 * has to linger for a beat after a touch gesture ends, while a mouse keeps the
 * immediate hover-in/hover-out behaviour.
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, cleanup, fireEvent } from '@testing-library/react';

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
}));

import { StoreProvider } from '../state/Store';
import { ArtObject } from '../components/ArtObject';

const PLACEMENT = { roomId: 'room-1', objectId: 'art-1', x: 50, y: 40, scale: 0.4 };
const POINTER_ID = 1;

/** The linger window in ArtObject, mirrored here so the waits are explicit. */
const LINGER_MS = 1000;

async function renderPlaced() {
  await act(async () => {
    render(
      <StoreProvider>
        <ArtObject placement={PLACEMENT} />
      </StoreProvider>,
    );
  });
  return screen.getByRole('button', { name: /Return Painting to the tray/ });
}

/**
 * True when the button is painted rather than held at zero opacity. Reads the
 * unprefixed opacity utility only: the `group-hover:` and `[@media(hover:none)]`
 * variants are CSS-only and never resolve under JSDOM.
 */
function isVisible(el: HTMLElement) {
  const classes = el.className.split(/\s+/);
  const shown = classes.includes('opacity-100');
  const hidden = classes.includes('opacity-0');
  // Exactly one of the pair has to be there. Neither would mean the base
  // utility was dropped, and this helper would report "hidden" forever.
  expect(shown !== hidden).toBe(true);
  return shown;
}

/** A tap that never crosses the drag threshold. */
function tap(el: HTMLElement, pointerType: string) {
  fireEvent.pointerDown(el, { button: 0, pointerId: POINTER_ID, pointerType, clientX: 100, clientY: 100 });
  fireEvent.pointerUp(el, { pointerId: POINTER_ID, pointerType, clientX: 100, clientY: 100 });
}

describe('ArtObject — remove button linger after touch', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
    cleanup();
    localStorage.clear();
  });

  it('starts hidden until something touches the piece', async () => {
    const button = await renderPlaced();
    expect(isVisible(button)).toBe(false);
  });

  it('stays visible for the full linger after a touch, then fades', async () => {
    const button = await renderPlaced();

    await act(async () => {
      tap(button.parentElement!, 'touch');
    });
    expect(isVisible(button)).toBe(true);

    // Just short of the window: still up, so the finger has time to travel.
    await act(async () => {
      vi.advanceTimersByTime(LINGER_MS - 50);
    });
    expect(isVisible(button)).toBe(true);

    await act(async () => {
      vi.advanceTimersByTime(100);
    });
    expect(isVisible(button)).toBe(false);
  });

  it('holds the button up for as long as the contact lasts, timing the linger from lift-off', async () => {
    const button = await renderPlaced();
    const piece = button.parentElement!;

    await act(async () => {
      fireEvent.pointerDown(piece, {
        button: 0,
        pointerId: POINTER_ID,
        pointerType: 'touch',
        clientX: 100,
        clientY: 100,
      });
    });

    // A press held well past the window must not hide the button underneath
    // the finger — the countdown has not started yet.
    await act(async () => {
      vi.advanceTimersByTime(LINGER_MS * 3);
    });
    expect(isVisible(button)).toBe(true);

    await act(async () => {
      fireEvent.pointerUp(piece, {
        pointerId: POINTER_ID,
        pointerType: 'touch',
        clientX: 100,
        clientY: 100,
      });
      vi.advanceTimersByTime(LINGER_MS - 50);
    });
    expect(isVisible(button)).toBe(true);
  });

  it('a second tap refreshes the linger instead of inheriting the first one', async () => {
    const button = await renderPlaced();
    const piece = button.parentElement!;

    await act(async () => {
      tap(piece, 'touch');
      vi.advanceTimersByTime(LINGER_MS - 100);
    });
    await act(async () => {
      tap(piece, 'touch');
      vi.advanceTimersByTime(LINGER_MS - 100);
    });

    // Past the first tap's deadline, inside the second's.
    expect(isVisible(button)).toBe(true);
  });

  it('an interrupted touch still fades the button rather than stranding it', async () => {
    const button = await renderPlaced();
    const piece = button.parentElement!;

    await act(async () => {
      fireEvent.pointerDown(piece, {
        button: 0,
        pointerId: POINTER_ID,
        pointerType: 'touch',
        clientX: 100,
        clientY: 100,
      });
      fireEvent.pointerCancel(piece, { pointerId: POINTER_ID, pointerType: 'touch' });
      vi.advanceTimersByTime(LINGER_MS + 50);
    });

    expect(isVisible(button)).toBe(false);
  });

  it('a mouse press does not arm the linger — hover alone drives it', async () => {
    const button = await renderPlaced();

    await act(async () => {
      tap(button.parentElement!, 'mouse');
    });

    // No lingering opacity class: on a mouse the button follows :hover, which
    // is CSS-only and so reads as hidden in JSDOM.
    expect(isVisible(button)).toBe(false);
  });
});
