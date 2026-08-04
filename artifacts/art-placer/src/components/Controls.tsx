import { useState, useRef, useEffect } from 'react';
import { useStore } from '../state/Store';
import { Undo2, RotateCcw, ChevronLeft } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { cn } from '@/lib/utils';

/**
 * Left floating column: Undo → Reset (with inline popover) → large gap → prev-room arrow.
 * The left carousel arrow is owned here so spacing is controlled in one place.
 */
export function Controls() {
  const { rooms, history, undo, resetRoom, resetAll, activeRoomId, setActiveRoomId } =
    useStore();
  const activeIndex = rooms.findIndex((r) => r.id === activeRoomId);

  const [resetOpen, setResetOpen] = useState(false);
  const resetRef = useRef<HTMLDivElement>(null);

  // Dismiss the popover when the user clicks anywhere outside it.
  useEffect(() => {
    if (!resetOpen) return;
    const handle = (e: MouseEvent) => {
      if (resetRef.current && !resetRef.current.contains(e.target as Node)) {
        setResetOpen(false);
      }
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [resetOpen]);

  // Warm cream circle matching the reference — uses the app's secondary token.
  const circle =
    'w-14 h-14 rounded-full bg-secondary/90 backdrop-blur-sm shadow-md ' +
    'hover:bg-secondary transition-colors outline-none ' +
    'focus-visible:ring-2 focus-visible:ring-white ' +
    'disabled:opacity-30 disabled:cursor-not-allowed ' +
    'flex items-center justify-center';

  const label = 'text-[11px] text-white/90 font-medium tracking-wide drop-shadow mt-1.5';

  return (
    <div className="absolute left-4 top-[18%] z-20 flex flex-col items-center">

      {/* ── Undo ── */}
      <div className="relative flex flex-col items-center">
        <button
          onClick={undo}
          disabled={history.length === 0}
          className={circle}
          aria-label={history.length > 1 ? `Undo (${history.length})` : 'Undo last action'}
        >
          <Undo2 size={20} className="text-foreground" />
          {history.length > 1 && (
            <span
              aria-hidden="true"
              className="absolute -top-0.5 -right-0.5 text-[9px] tabular-nums leading-none px-1 py-0.5 rounded-full bg-foreground text-background min-w-[16px] text-center"
            >
              {history.length}
            </span>
          )}
        </button>
        <span className={label}>Undo</span>
      </div>

      {/* Small gap between Undo and Reset */}
      <div className="h-3" />

      {/* ── Reset (with inline popover) ── */}
      <div className="relative flex flex-col items-center" ref={resetRef}>
        <button
          onClick={() => setResetOpen((v) => !v)}
          className={cn(circle, resetOpen && 'bg-secondary ring-2 ring-white/40')}
          aria-label="Reset"
          aria-expanded={resetOpen}
        >
          <RotateCcw size={20} className="text-foreground" />
        </button>
        <span className={label}>Reset</span>

        {/* Inline popover card — appears to the right of the button */}
        <AnimatePresence>
          {resetOpen && (
            <motion.div
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -6 }}
              transition={{ duration: 0.15 }}
              className="absolute left-[calc(100%+10px)] top-0 z-30 bg-white rounded-2xl shadow-xl p-4 w-52 text-left"
            >
              {/* Triangle caret pointing left toward the Reset button */}
              <span
                aria-hidden="true"
                className="absolute -left-[9px] top-5 w-0 h-0
                  border-y-[9px] border-y-transparent
                  border-r-[9px] border-r-white"
              />
              <p className="text-[13px] text-foreground leading-snug">
                Reset will clear all art in all rooms. Are you sure?
              </p>
              <div className="mt-3 flex items-center gap-3">
                <button
                  onClick={() => { resetAll(); setResetOpen(false); }}
                  className="text-[13px] font-semibold text-[#8B3A2A] hover:text-[#6d2d1f] transition-colors"
                >
                  Yes, reset
                </button>
                <button
                  onClick={() => { resetRoom(activeRoomId); setResetOpen(false); }}
                  className="text-[12px] text-muted-foreground hover:text-foreground transition-colors"
                >
                  This room only
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Large gap before the room-nav arrow */}
      <div className="h-10" />

      {/* ── Previous-room arrow ── */}
      <button
        className={cn(
          circle,
          activeIndex === 0 && 'opacity-0 pointer-events-none',
        )}
        disabled={activeIndex === 0}
        onClick={() => setActiveRoomId(rooms[activeIndex - 1].id)}
        aria-label="Previous room"
      >
        <ChevronLeft size={20} className="text-foreground" />
      </button>
    </div>
  );
}
