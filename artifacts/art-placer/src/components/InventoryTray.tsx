import { useRef, useState, useEffect, useCallback } from 'react';
import { useStore } from '../state/Store';
import { TrayItem } from './TrayItem';
import { ChevronLeft, ChevronRight } from 'lucide-react';

/**
 * Floating art inventory tray, sized to the room canvas and sitting in the
 * bottom matte band. MainLayout measures this element to decide how much matte
 * to reserve, so its height must stay independent of its width — keep the strip
 * scrolling horizontally and never let it wrap.
 */
export function InventoryTray() {
  const { artObjects } = useStore();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft]   = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const checkScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 1);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
  }, []);

  // Re-evaluate whenever the content (artObjects) changes, and whenever the
  // scroller itself is resized — a responsive window change alters
  // scrollability without firing a scroll event.
  useEffect(() => {
    checkScroll();
    const el = scrollRef.current;
    if (!el) return;
    const observer = new ResizeObserver(checkScroll);
    observer.observe(el);
    return () => observer.disconnect();
  }, [artObjects, checkScroll]);

  const scrollBy = (amount: number) => {
    scrollRef.current?.scrollBy({ left: amount, behavior: 'smooth' });
  };

  // Only rendered while that direction can actually scroll — an inert arrow
  // used to sit dimmed over the edge of the tray, covering the outermost
  // piece and stealing its pointerdown.
  const arrowBase =
    'absolute top-1/2 -translate-y-1/2 z-10 flex items-center justify-center w-9 h-9 rounded-full bg-white/85 backdrop-blur-sm shadow-sm transition-[opacity,background-color] outline-none focus-visible:ring-2 focus-visible:ring-foreground/50 text-foreground hover:bg-white';

  return (
    // 80% of the canvas box, centred, so the tray reads as a narrower shelf
    // beneath the photograph rather than matching its edges. Safe to narrow:
    // the strip scrolls horizontally and every item is shrink-0, so height
    // stays width-independent and MainLayout's measurement cannot oscillate.
    <div className="relative w-4/5 mx-auto bg-background/85 backdrop-blur-md rounded-2xl shadow-[0_10px_30px_-12px_rgba(74,63,48,0.45)] px-12 py-4 pt-[15px] pb-[15px] mt-[0px] mb-[0px] ml-[0px] mr-[0px]">
      {canScrollLeft && (
        <button
          onClick={() => scrollBy(-220)}
          className={`${arrowBase} left-1.5`}
          aria-label="Scroll left"
        >
          <ChevronLeft size={20} strokeWidth={1.5} />
        </button>
      )}
      <div
        ref={scrollRef}
        onScroll={checkScroll}
        // No scroll-snap: `snap-mandatory` used to pull the strip a few pixels
        // off zero on load, which made the left arrow appear over the first
        // piece before the user ever scrolled.
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
          className={`${arrowBase} right-1.5`}
          aria-label="Scroll right"
        >
          <ChevronRight size={20} strokeWidth={1.5} />
        </button>
      )}
    </div>
  );
}
