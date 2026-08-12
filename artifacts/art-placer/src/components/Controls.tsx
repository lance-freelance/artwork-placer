import { useState, useRef, useEffect } from 'react';
import { useStore } from '../state/Store';
import { Maximize2, Minimize2, Undo2, RotateCcw } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useFullscreen } from '../hooks/useFullscreen';

type Layout = 'vertical' | 'horizontal';

/**
 * Undo + Reset (with an inline confirm popover).
 *
 * Renders in whichever matte band has room: a stacked column in the left
 * gutter on wide landscape windows, or a compact row in the bottom band when
 * width is the constraining axis and there is no gutter to stand in.
 */
export function Controls({ layout = 'vertical' }: { layout?: Layout }) {
  const { history, undo, resetRoom, resetAll, activeRoomId } = useStore();

  const [resetOpen, setResetOpen] = useState(false);
  const resetRef = useRef<HTMLDivElement>(null);

  const isVertical = layout === 'vertical';

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

  // Close on layout change so a popover anchored to the old position cannot be
  // left hanging in the wrong band after a rotate or resize.
  useEffect(() => setResetOpen(false), [layout]);

  const circle =
    cn(
      'rounded-full bg-white/85 backdrop-blur-sm shadow-[0_4px_14px_-4px_rgba(74,63,48,0.45)]',
      'hover:bg-white transition-colors outline-none',
      'focus-visible:ring-2 focus-visible:ring-foreground/50',
      'disabled:opacity-40 disabled:cursor-not-allowed',
      'flex items-center justify-center',
      isVertical ? 'w-14 h-14' : 'w-12 h-12',
    );

  const label = cn(
    'font-medium tracking-wide text-foreground/70 mt-1',
    isVertical ? 'text-xs' : 'text-[11px]',
  );

  const iconSize = isVertical ? 20 : 18;

  return (
    <div
      className={cn(
        'z-20 flex',
        isVertical
          ? 'absolute left-0 flex-col items-center'
          : 'flex-row items-start gap-4',
      )}
      style={
        isVertical
          ? { width: 'var(--gutter)', top: 'var(--box-top)' }
          : undefined
      }
    >
      {/* ── Undo ── */}
      <div className="relative flex flex-col items-center">
        <button
          onClick={undo}
          disabled={history.length === 0}
          className={circle}
          aria-label={
            history.length > 1 ? `Undo (${history.length})` : 'Undo last action'
          }
        >
          <Undo2 size={iconSize} className="text-foreground" />
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

      {isVertical && <div className="h-3" />}

      {/* ── Reset (with inline popover) ── */}
      <div className="relative flex flex-col items-center" ref={resetRef}>
        <button
          onClick={() => setResetOpen((v) => !v)}
          className={cn(
            circle,
            resetOpen && 'bg-white ring-2 ring-foreground/30',
          )}
          aria-label="Reset"
          aria-expanded={resetOpen}
        >
          <RotateCcw size={iconSize} className="text-foreground" />
        </button>
        <span className={label}>Reset</span>

        {/*
          Confirmation popover. Opens rightward out of the gutter in the
          vertical layout, and upward in the bottom band where there is no
          horizontal room. A transient dialog is allowed to float over the
          photograph — see the scope note in MainLayout.
        */}
        <AnimatePresence>
          {resetOpen && (
            <motion.div
              initial={{ opacity: 0, x: isVertical ? -6 : 0, y: isVertical ? 0 : 6 }}
              animate={{ opacity: 1, x: 0, y: 0 }}
              exit={{ opacity: 0, x: isVertical ? -6 : 0, y: isVertical ? 0 : 4 }}
              transition={{ duration: 0.15 }}
              className={cn(
                'absolute z-30 bg-white rounded-2xl shadow-xl p-4 w-52 text-left',
                isVertical
                  ? 'left-[calc(100%+10px)] top-0'
                  : 'bottom-[calc(100%+12px)] left-1/2 -translate-x-1/2',
              )}
            >
              {/* Caret pointing back at the Reset button */}
              <span
                aria-hidden="true"
                className={cn(
                  'absolute w-0 h-0',
                  isVertical
                    ? '-left-[9px] top-5 border-y-[9px] border-y-transparent border-r-[9px] border-r-white'
                    : '-bottom-[9px] left-1/2 -translate-x-1/2 border-x-[9px] border-x-transparent border-t-[9px] border-t-white',
                )}
              />
              <p className="text-[13px] text-foreground leading-snug">
                Reset will clear all art in all rooms. Are you sure?
              </p>
              <div className="mt-3 flex items-center gap-3">
                <button
                  onClick={() => {
                    resetAll();
                    setResetOpen(false);
                  }}
                  className="text-[13px] font-semibold text-[#8B3A2A] hover:text-[#6d2d1f] transition-colors"
                >
                  Yes, reset
                </button>
                <button
                  onClick={() => {
                    resetRoom(activeRoomId);
                    setResetOpen(false);
                  }}
                  className="text-[12px] text-muted-foreground hover:text-foreground transition-colors"
                >
                  This room only
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

    </div>
  );
}

/** A deliberately quiet escape hatch for displays that cannot use native fullscreen. */
export function FullscreenButton() {
  const { supported, isFullscreen, toggle } = useFullscreen();

  if (!supported) return null;

  return (
    <button
      type="button"
      onClick={toggle}
      className={cn(
        'absolute right-3 bottom-3 z-20 h-[18px] w-[18px] rounded-full',
        'flex items-center justify-center bg-white/20 text-foreground/35',
        'backdrop-blur-sm transition-colors hover:bg-white/70 hover:text-foreground',
        'outline-none focus-visible:ring-2 focus-visible:ring-foreground/50',
      )}
      aria-label={isFullscreen ? 'Exit full screen' : 'Enter full screen'}
      title={isFullscreen ? 'Exit full screen' : 'Enter full screen'}
    >
      {isFullscreen ? <Minimize2 size={9} /> : <Maximize2 size={9} />}
    </button>
  );
}
