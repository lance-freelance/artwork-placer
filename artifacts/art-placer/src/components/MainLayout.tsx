import { motion } from 'framer-motion';
import { RoomCarousel } from './RoomCarousel';
import { InventoryTray } from './InventoryTray';
import { Controls } from './Controls';
import { RoomTabs } from './RoomTabs';
import { InstructionOverlay } from './InstructionOverlay';
import { useStore } from '../state/Store';
import { assetUrl } from '../types';

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
    <div className="h-[100dvh] w-full relative overflow-hidden bg-black">
      <GlobalDragLayer />

      {/* Room canvas fills the entire viewport */}
      <div className="absolute inset-0">
        <RoomCarousel />
      </div>

      {/* ── Top bar: room tabs centred, logo top-right ── */}
      <div className="absolute top-0 left-0 right-0 z-20 flex items-start justify-between px-4 pt-4 pointer-events-none">
        {/* Spacer matches logo width so tabs stay truly centred */}
        <div className="w-32 shrink-0" />

        <div className="pointer-events-auto">
          <RoomTabs />
        </div>

        {/* Living Luxury Lab logo — white version */}
        <div className="pointer-events-auto w-32 shrink-0 flex justify-end">
          <img
            src={assetUrl('l3-white-horizontal-logo.png')}
            alt="Living Luxury Lab"
            className="h-10 object-contain"
            draggable={false}
          />
        </div>
      </div>

      {/* Subtle left-edge gradient so controls read against any room photo */}
      <div
        className="absolute left-0 top-0 bottom-0 w-24 z-10 pointer-events-none"
        style={{ background: 'linear-gradient(to right, rgba(0,0,0,0.18) 0%, transparent 100%)' }}
      />
      {/* Subtle top gradient for the tab bar */}
      <div
        className="absolute top-0 left-0 right-0 h-24 z-10 pointer-events-none"
        style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0.22) 0%, transparent 100%)' }}
      />

      {/* ── Left floating controls: Undo + Clear room ── */}
      <Controls />

      {/* ── Bottom: first-use hint + inventory tray ── */}
      <div className="absolute bottom-4 left-4 right-4 z-20 flex flex-col gap-2">
        <InstructionOverlay />
        <InventoryTray />
      </div>
    </div>
  );
}
