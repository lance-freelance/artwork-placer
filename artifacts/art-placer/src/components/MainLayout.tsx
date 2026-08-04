import { motion } from 'framer-motion';
import { branding } from '../config/branding';
import { RoomCarousel } from './RoomCarousel';
import { InventoryTray } from './InventoryTray';
import { Controls } from './Controls';
import { RoomIndicator } from './RoomIndicator';
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
    <div className="h-[100dvh] w-full flex flex-col overflow-hidden bg-background text-foreground font-sans selection:bg-foreground selection:text-background">
      <GlobalDragLayer />
      <InstructionOverlay />

      {/* Header */}
      <header className="px-5 md:px-6 py-3 md:py-4 flex items-center justify-between shrink-0">
        <div>
          <h1 className="font-serif text-lg md:text-xl tracking-wide leading-none">
            {branding.wordmark}
          </h1>
          <p className="text-[10px] text-muted-foreground uppercase tracking-[0.22em] mt-1.5">
            {branding.tagline}
          </p>
        </div>
        <div className="text-[11px] tracking-[0.2em] border border-foreground/10 px-3 py-1.5 rounded-sm shrink-0">
          {branding.shortMark}
        </div>
      </header>

      {/* Room canvas — sized to whatever vertical space is left over so the
          tray is always reachable without scrolling the page. */}
      <main className="flex-1 min-h-0 w-full flex flex-col items-center px-3 md:px-8">
        <div className="flex-1 min-h-0 w-full max-w-[1200px] flex items-center justify-center [container-type:size]">
          <RoomCarousel />
        </div>
        <RoomIndicator />
      </main>

      {/* Controls and tray */}
      <div className="shrink-0 bg-background/95 backdrop-blur-md border-t border-border">
        <Controls />
        <InventoryTray />
      </div>
    </div>
  );
}
