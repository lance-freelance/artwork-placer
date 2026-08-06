import { useRef, useState, useEffect, useCallback } from 'react';
import { useStore } from '../state/Store';
import { TrayItem } from './TrayItem';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

const ARROW =
  'absolute top-1/2 -translate-y-1/2 z-10 flex items-center justify-center w-9 h-9 ' +
  'rounded-full bg-white/85 backdrop-blur-sm shadow-sm hover:bg-white transition-colors ' +
  'outline-none focus-visible:ring-2 focus-visible:ring-foreground/50 text-foreground';

/**
 * Floating art inventory tray, sized to the room canvas and sitting in the
 * bottom matte band. MainLayout measures this element to decide how much matte
 * to reserve, so its height must stay independent of its width — keep the strip
 * scrolling horizontally and never let it wrap.
 */
export function InventoryTray() {
  const { artObjects, placements } = useStore();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft]   = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const checkScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 1);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
  }, []);

  // The scroller's own box changes only with the window, and a responsive
  // resize alters scrollability without firing a scroll event.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const observer = new ResizeObserver(checkScroll);
    observer.observe(el);
    return () => observer.disconnect();
  }, [checkScroll]);

  // Content width tracks both lists, not just the catalogue: TrayItem renders
  // null once a piece is on the wall, so placing or recalling art changes what
  // the strip holds without ever resizing the scroller the observer watches.
  useEffect(() => {
    checkScroll();
  }, [artObjects, placements, checkScroll]);

  const scrollBy = (amount: number) => {
    scrollRef.current?.scrollBy({ left: amount, behavior: 'smooth' });
  };

  return (
    // 80% of the canvas box, centred, so the tray reads as a narrower shelf
    // beneath the photograph rather than matching its edges. Safe to narrow:
    // the strip scrolls horizontally and every item is shrink-0, so height
    // stays width-independent and MainLayout's measurement cannot oscillate.
    <div className="relative w-4/5 mx-auto bg-background/85 backdrop-blur-md rounded-2xl shadow-[0_10px_30px_-12px_rgba(74,63,48,0.45)] px-12 py-4 pt-[15px] pb-[15px] mt-[0px] mb-[0px] ml-[0px] mr-[0px]">
      {/* Mounted only while that direction can actually scroll: a chevron
          parked permanently at the end of its range reads as broken furniture
          on a tray short enough not to scroll at all. */}
      {canScrollLeft && (
        <button
          onClick={() => scrollBy(-220)}
          className={cn(ARROW, 'left-1.5')}
          aria-label="Scroll left"
        >
          <ChevronLeft size={20} strokeWidth={1.5} />
        </button>
      )}
      <div
        ref={scrollRef}
        onScroll={checkScroll}
        // No scroll-snap: `snap-start` aligns an item's own edge, but the first
        // item sits inside this scroller's left padding, so `snap-mandatory`
        // resolved the initial snap a few pixels off zero and lit the left
        // arrow before the user had scrolled anything.
        className="flex gap-5 overflow-x-auto hide-scrollbar items-center min-h-[90px] pl-[21px] pr-[21px]"
      >
        {artObjects.map(obj => (
          <div key={obj.id} className="shrink-0 flex items-center justify-center ml-[9px] mr-[9px]">
            <TrayItem objectId={obj.id} />
          </div>
        ))}
      </div>
      {canScrollRight && (
        <button
          onClick={() => scrollBy(220)}
          className={cn(ARROW, 'right-1.5')}
          aria-label="Scroll right"
        >
          <ChevronRight size={20} strokeWidth={1.5} />
        </button>
      )}
    </div>
  );
}
