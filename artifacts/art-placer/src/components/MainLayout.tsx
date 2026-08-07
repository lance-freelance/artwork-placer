import type { CSSProperties } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { RoomCarousel } from './RoomCarousel';
import { RoomNavArrows, RoomNavButton } from './RoomNavArrows';
import { InventoryTray } from './InventoryTray';
import { Controls } from './Controls';
import { RoomTabs } from './RoomTabs';
import { InstructionOverlay } from './InstructionOverlay';
import { useStore } from '../state/Store';
import { artImageUrl, assetUrl } from '../types';
import { useMediaQuery } from '../hooks/useMediaQuery';
import { useMeasuredHeight } from '../hooks/useMeasuredHeight';

/** The room photographs are all 1600x1000, so the canvas box is locked to 16:10. */
const CANVAS_ASPECT = 16 / 10;

/**
 * Where the floating controls live.
 *
 * Side gutters only exist when the viewport is wide *and* landscape-ish. On a
 * portrait phone or a tall narrow window, width is the constraining axis, so
 * the leftover matte lands top/bottom and the controls move there with it —
 * the room keeps the full width instead of being squeezed to make room for
 * chrome.
 *
 * Decided from the viewport alone, never from measured chrome, so the choice
 * cannot feed back into the layout it drives.
 */
const SIDE_CONTROLS = '(min-width: 820px) and (min-aspect-ratio: 5/4)';

/**
 * Matte geometry.
 *
 * The matte is the leftover from fitting a 16:10 box to whichever axis is more
 * constraining — it is *not* padding added on top of that fit. The only
 * deliberate inset is `--edge`, a small proportional breathing margin (capped
 * well under the shorter viewport dimension) so nothing touches the screen
 * edge. Everything else falls out of the fit, which is why a portrait phone
 * ends up with the room near full-width and the matte almost entirely
 * top/bottom.
 *
 * `--chrome-top` / `--chrome-bottom` are measured from the real elements, so
 * the canvas gets every pixel the chrome is not using and no constant needs
 * re-tuning when the chrome changes.
 */
function layoutVars(chromeTop: number, chromeBottom: number): CSSProperties {
  return {
    ['--edge' as string]: 'clamp(12px, 4vmin, 40px)',
    ['--gap' as string]: 'clamp(10px, 1.8vmin, 20px)',
    ['--chrome-top' as string]: `${chromeTop}px`,
    ['--chrome-bottom' as string]: `${chromeBottom}px`,

    ['--avail-w' as string]: 'calc(100vw - 2 * var(--edge))',
    ['--avail-h' as string]:
      'calc(100dvh - 2 * var(--edge) - 2 * var(--gap) - var(--chrome-top) - var(--chrome-bottom))',

    // Paired min() expressions: both resolve against the same limiting axis, so
    // the box stays exactly 16:10 and the photo is never cropped or stretched.
    ['--box-w' as string]:
      `min(var(--avail-w), calc(var(--avail-h) * ${CANVAS_ASPECT}))`,
    ['--box-h' as string]:
      `min(var(--avail-h), calc(var(--avail-w) / ${CANVAS_ASPECT}))`,

    // Where the centred column actually lands, so absolutely-positioned side
    // controls can align to the photograph rather than to the viewport.
    ['--group-h' as string]:
      'calc(var(--chrome-top) + var(--gap) + var(--box-h) + var(--gap) + var(--chrome-bottom))',
    ['--box-top' as string]:
      'calc(var(--edge) + (100dvh - 2 * var(--edge) - var(--group-h)) / 2 + var(--chrome-top) + var(--gap))',
    ['--gutter' as string]: 'calc((100vw - var(--box-w)) / 2)',
  };
}

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
      {/*
        The thumbnail sits underneath as an instant stand-in: it is guaranteed
        already-loaded (the tray rendered it), so the ghost is visible from the
        very first frame of the very first drag even if the full-size fetch is
        still in flight. The full image paints over it the moment it arrives.
      */}
      <div className="relative w-full h-full drop-shadow-[0_22px_28px_rgba(50,40,30,0.32)]">
        <img
          src={artImageUrl(obj.thumbnailFilename, obj.imageVersion)}
          alt=""
          draggable={false}
          className="absolute inset-0 w-full h-full object-contain"
        />
        <img
          src={artImageUrl(obj.fullImageFilename, obj.imageVersion)}
          alt=""
          draggable={false}
          className="relative w-full h-full object-contain"
        />
      </div>
    </motion.div>
  );
}

/**
 * Why the last drop did nothing.
 *
 * A refused drop is otherwise silent: the piece snaps back and nothing
 * distinguishes a rule from a fault. Rendered at the document level alongside
 * the ghost, at the point of release, so the explanation appears where the
 * visitor was already looking rather than in a corner they are not.
 */
function DropRefusalNotice() {
  const { dropRefusal } = useStore();

  return (
    <AnimatePresence>
      {dropRefusal && (
        // Only opacity is animated. Anything transform-based here would be
        // written inline by framer and clobber the offset the inner pill uses
        // to sit above the release point.
        <motion.div
          key={dropRefusal.key}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          className="fixed z-50 pointer-events-none"
          style={{
            // Kept clear of the viewport edges so a drop refused near one does
            // not push the notice half off screen.
            left: Math.min(
              Math.max(dropRefusal.clientX, 120),
              window.innerWidth - 120,
            ),
            top: Math.max(dropRefusal.clientY - 16, 44),
          }}
        >
          <p
            role="status"
            className="-translate-x-1/2 -translate-y-full bg-foreground/90 text-background backdrop-blur-sm rounded-full px-3.5 py-1.5 text-[11px] tracking-[0.1em] uppercase whitespace-nowrap shadow-lg"
          >
            {dropRefusal.message}
          </p>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function MainLayout() {
  const sideControls = useMediaQuery(SIDE_CONTROLS);
  const [topChromeRef, topChromeH] = useMeasuredHeight(44);
  const [bottomChromeRef, bottomChromeH] = useMeasuredHeight(140);

  return (
    <div
      // Warm taupe matte, drawn from the wall tone in the room photographs, so
      // the board reads as a mounted print rather than a screenshot on black.
      //
      // Tabs, photo and tray are one centred column rather than three things
      // pinned to three viewport edges: the gaps between them stay tight at any
      // size and the leftover matte collects outside the group.
      // select-none is desktop insurance: a mouse selection anchored outside a
      // draggable (on the matte) could otherwise sweep the blue ::selection
      // highlight across the artwork images while dragging.
      className="h-[100dvh] w-full relative overflow-hidden bg-[#C9BFAE] flex flex-col items-center justify-center select-none"
      style={{
        ...layoutVars(topChromeH, bottomChromeH),
        paddingTop: 'var(--edge)',
        paddingBottom: 'var(--edge)',
        rowGap: 'var(--gap)',
      }}
    >
      <GlobalDragLayer />
      <DropRefusalNotice />

      {/* ── Top chrome: room pill + logo. Height is measured, not assumed. ── */}
      <div ref={topChromeRef} className="w-full flex justify-center shrink-0">
        {/*
          Definite width, so the room capsule's own max-width has something real
          to resolve against — inside a shrink-to-fit parent that percentage is
          circular and the capsule silently runs off screen.

          Deliberately --avail-w (viewport-derived) rather than --box-w: this
          row's height is measured to size the canvas, so tying its width to the
          canvas would let wrapping feed back into the box it just resized.
        */}
        {/*
          flex-nowrap, not wrap: this row's height is measured to size the
          canvas, so a row that reflows makes its own height width-dependent
          and the box size and chrome height can oscillate. The capsule already
          carries min-w-0 + overflow-x-auto, so it absorbs narrow widths by
          scrolling instead of pushing the wordmark onto a second line.
        */}
        <div
          className="flex flex-nowrap items-center justify-center gap-x-3"
          style={{ width: 'var(--avail-w)' }}
        >
          <RoomTabs />
          <img
            src={assetUrl('l3-white-horizontal-logo.png')}
            alt="Living Luxury Lab"
            // The asset is a white wordmark; brightness(0) recolours it to ink
            // so it reads against the light matte without shipping a second file.
            className="h-9 w-auto max-w-[118px] object-contain shrink-0 [filter:brightness(0)] opacity-75"
            draggable={false}
          />
        </div>
      </div>

      {/*
        Matted room canvas. The room is a mounted photograph inset from the
        viewport on all four sides — it must never run full-bleed, because
        filling the window means cover-scaling the photo and softening it.
      */}
      <div
        className="relative overflow-hidden rounded-[30px] shrink-0 ring-1 ring-[#5b503f]/20 shadow-[0_22px_55px_-20px_rgba(74,63,48,0.5)]"
        style={{ width: 'var(--box-w)', height: 'var(--box-h)' }}
      >
        <RoomCarousel />
      </div>

      {/*
        Bottom chrome. Height is measured, so adding or removing the control row
        re-sizes the matte automatically. Everything in here must keep a
        width-independent height (no wrapping), otherwise measuring it would
        feed back into the box width it is aligned to.
      */}
      <div
        ref={bottomChromeRef}
        className="relative flex flex-col items-center gap-2.5 shrink-0"
        style={{ width: 'var(--box-w)' }}
      >
        {/* Positioned against this container, but absolute — see the note in
            InstructionOverlay for why it must stay out of the flow. */}
        <InstructionOverlay />

        {!sideControls && (
          <div className="flex items-center justify-center gap-4 flex-nowrap">
            <RoomNavButton dir="prev" />
            <Controls layout="horizontal" />
            <RoomNavButton dir="next" />
          </div>
        )}

        <InventoryTray />
      </div>

      {/* ── Side controls, only where a real gutter exists to hold them ── */}
      {sideControls && (
        <>
          <Controls layout="vertical" />
          <RoomNavArrows />
        </>
      )}
    </div>
  );
}
