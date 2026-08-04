import type { CSSProperties } from 'react';
import { motion } from 'framer-motion';
import { RoomCarousel } from './RoomCarousel';
import { RoomNavArrows } from './RoomNavArrows';
import { InventoryTray } from './InventoryTray';
import { Controls } from './Controls';
import { RoomTabs } from './RoomTabs';
import { InstructionOverlay } from './InstructionOverlay';
import { useStore } from '../state/Store';
import { assetUrl } from '../types';

/** The room photographs are all 1600x1000, so the canvas box is locked to 16:10. */
const CANVAS_ASPECT = 16 / 10;

/**
 * Matte insets. These are proportional to the viewport so the matte grows and
 * shrinks with the window instead of sitting at a fixed pixel value.
 *
 * The floors are not arbitrary padding — they reserve exactly enough room for
 * the viewport-anchored controls (undo/reset stack, chevrons, room pill, tray)
 * so those never overlap the room photograph on small screens. Shrinking a
 * floor will push a control onto the image.
 *
 * Scope note: the floors cover *persistent* chrome only. Two transient,
 * dismissible overlays — the reset confirmation popover and the first-use hint
 * — are allowed to float over the photograph, the same way any confirmation
 * dialog does. Reserving permanent matte for them would cost every user roughly
 * a fifth of the canvas to accommodate a card that shows once.
 */
const MATTE: CSSProperties = {
  ['--matte-x' as string]: 'clamp(88px, 7vw, 200px)',
  ['--matte-top' as string]: 'clamp(88px, 12dvh, 160px)',
  ['--matte-bottom' as string]: 'clamp(170px, 22dvh, 300px)',
};

// Space left for the canvas once the matte is subtracted.
const AVAIL_W = 'calc(100vw - 2 * var(--matte-x))';
const AVAIL_H = 'calc(100dvh - var(--matte-top) - var(--matte-bottom))';

/**
 * Fit a 16:10 box inside the available area, driven by whichever axis is more
 * constraining. One axis lands exactly on its matte inset and the other gets a
 * wider matte — a larger matte on an unusual window ratio is the correct
 * outcome, never a stretched or cropped room image.
 */
const CANVAS_BOX: CSSProperties = {
  width: `min(${AVAIL_W}, calc(${AVAIL_H} * ${CANVAS_ASPECT}))`,
  height: `min(${AVAIL_H}, calc(${AVAIL_W} / ${CANVAS_ASPECT}))`,
};

/**
 * The piece in flight. Rendered at the document level so it can travel from
 * the tray into the room canvas without being clipped by either.
 */
function GlobalDragLayer() {
  const { dragState, artObjects } = useStore();
  if (!dragState) return null;
  const obj = artObjects.find((o) => o.id === dragState.objectId);
  if (!obj) return null;

  const left = dragState.clientX - dragState.offsetX;
  const top = dragState.clientY - dragState.offsetY;

  return (
    <motion.div
      className="fixed pointer-events-none z-50"
      style={{ left, top, width: dragState.width, height: dragState.height }}
      initial={{ scale: 1 }}
      animate={{ scale: 1.06 }}
      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
    >
      <img
        src={assetUrl(`art/${obj.fullImageFilename}`)}
        alt=""
        draggable={false}
        className="w-full h-full object-contain drop-shadow-[0_22px_28px_rgba(50,40,30,0.32)]"
      />
    </motion.div>
  );
}

export function MainLayout() {
  return (
    <div
      className="h-[100dvh] w-full relative overflow-hidden bg-[#17140f]"
      style={MATTE}
    >
      <GlobalDragLayer />

      {/*
        Matted room canvas. The room is a mounted photograph inset from the
        viewport on all four sides — it must never run full-bleed, because
        filling the window means cover-scaling the photo and softening it.
      */}
      <div
        className="absolute z-0 flex items-center justify-center"
        style={{
          top: 'var(--matte-top)',
          bottom: 'var(--matte-bottom)',
          left: 'var(--matte-x)',
          right: 'var(--matte-x)',
        }}
      >
        <div
          className="relative overflow-hidden rounded-[3px] ring-1 ring-white/10 shadow-[0_30px_80px_-24px_rgba(0,0,0,0.75)]"
          style={CANVAS_BOX}
        >
          <RoomCarousel />
        </div>
      </div>

      {/* ── Top bar: compact room pill and logo in one centred group ── */}
      <div className="absolute top-0 left-0 right-0 z-20 flex justify-center px-4 pt-4 pointer-events-none">
        <div className="pointer-events-auto flex items-center gap-3 mt-[20px] mb-[20px]">
          <RoomTabs />
          <img
            src={assetUrl('l3-white-horizontal-logo.png')}
            alt="Living Luxury Lab"
            className="h-10 w-auto max-w-[120px] object-contain"
            draggable={false}
          />
        </div>
      </div>

      {/* ── Left floating controls: Undo + Reset ── */}
      <Controls />

      {/* ── Room prev/next — anchored to the viewport matte, not the canvas ── */}
      <RoomNavArrows />

      {/* ── Bottom: first-use hint + inventory tray — 2/3 window width, centred ── */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex flex-col gap-2 w-2/3">
        <InstructionOverlay />
        <InventoryTray />
      </div>
    </div>
  );
}
