import { useRef, useState, useEffect, useCallback } from 'react';
import { useStore } from '../state/Store';
import { TrayItem } from './TrayItem';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

// Always on the page so the tray's frame reads consistently, but layered
// BENEATH the scroll strip (z-0 vs the strip's z-10): a piece passing over an
// arrow always sits on top and keeps its pointerdown. When its direction
// cannot scroll, an arrow fades and lets clicks pass through.
const ARROW =
  'absolute top-1/2 -translate-y-1/2 z-0 flex items-center justify-center w-9 h-9 ' +
  'rounded-full bg-white/85 backdrop-blur-sm shadow-sm transition-[opacity,background-color] ' +
  'outline-none focus-visible:ring-2 focus-visible:ring-foreground/50 text-foreground';
const ARROW_ACTIVE = 'hover:bg-white opacity-100';
const ARROW_DIMMED = 'opacity-25 cursor-default pointer-events-none';

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

  // Content width tracks both lists, not just the catalogue: TrayItem renders a
  // same-sized placeholder once a piece is on the wall, so placing or recalling
  // art changes the contents without changing the reserved slot footprint.
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
      <button
        onClick={() => scrollBy(-220)}
        className={cn(ARROW, 'left-1.5', canScrollLeft ? ARROW_ACTIVE : ARROW_DIMMED)}
        aria-label="Scroll left"
        tabIndex={canScrollLeft ? 0 : -1}
      >
        <ChevronLeft size={20} strokeWidth={1.5} />
      </button>
      <div
        ref={scrollRef}
        onScroll={checkScroll}
        // relative + z-10 keeps the strip (and every piece in it) stacked above
        // the arrows. No scroll-snap: `snap-start` aligns an item's own edge,
        // but the first item sits inside this scroller's left padding, so
        // `snap-mandatory` resolved the initial snap a few pixels off zero and
        // lit the left arrow before the user had scrolled anything.
        className="relative z-10 flex gap-5 overflow-x-auto hide-scrollbar items-center min-h-[90px] pl-[21px] pr-[21px]"
      >
        {artObjects.map(obj => (
            <div
              key={obj.id}
              className="shrink-0 flex items-center justify-center ml-[23px] mr-[23px]"
            >
            <TrayItem objectId={obj.id} />
          </div>
        ))}
      </div>
      <button
        onClick={() => scrollBy(220)}
        className={cn(ARROW, 'right-1.5', canScrollRight ? ARROW_ACTIVE : ARROW_DIMMED)}
        aria-label="Scroll right"
        tabIndex={canScrollRight ? 0 : -1}
      >
        <ChevronRight size={20} strokeWidth={1.5} />
      </button>
    </div>
  );
}
