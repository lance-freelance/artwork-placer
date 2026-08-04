import { useRef } from 'react';
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

  const scrollBy = (amount: number) => {
    scrollRef.current?.scrollBy({ left: amount, behavior: 'smooth' });
  };

  const arrowClass =
    'absolute top-1/2 -translate-y-1/2 z-10 flex items-center justify-center w-9 h-9 rounded-full bg-white/85 backdrop-blur-sm shadow-sm hover:bg-white transition-colors outline-none focus-visible:ring-2 focus-visible:ring-foreground/50 text-foreground';

  return (
    // 80% of the canvas box, centred, so the tray reads as a narrower shelf
    // beneath the photograph rather than matching its edges. Safe to narrow:
    // the strip scrolls horizontally and every item is shrink-0, so height
    // stays width-independent and MainLayout's measurement cannot oscillate.
    <div className="relative w-4/5 mx-auto bg-background/85 backdrop-blur-md rounded-2xl shadow-[0_10px_30px_-12px_rgba(74,63,48,0.45)] px-12 py-4 pt-[15px] pb-[15px] mt-[0px] mb-[0px] ml-[0px] mr-[0px]">
      <button
        onClick={() => scrollBy(-220)}
        className={`${arrowClass} left-1.5`}
        aria-label="Scroll left"
      >
        <ChevronLeft size={20} strokeWidth={1.5} />
      </button>
      <div
        ref={scrollRef}
        className="flex gap-5 overflow-x-auto snap-x snap-mandatory hide-scrollbar items-center min-h-[90px] pl-[21px] pr-[21px]"
      >
        {artObjects.map(obj => (
          <div key={obj.id} className="snap-start shrink-0 flex items-center justify-center ml-[9px] mr-[9px]">
            <TrayItem objectId={obj.id} />
          </div>
        ))}
      </div>
      <button
        onClick={() => scrollBy(220)}
        className={`${arrowClass} right-1.5`}
        aria-label="Scroll right"
      >
        <ChevronRight size={20} strokeWidth={1.5} />
      </button>
    </div>
  );
}
