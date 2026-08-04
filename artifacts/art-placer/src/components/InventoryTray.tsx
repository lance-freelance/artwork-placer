import { useRef } from 'react';
import { useStore } from '../state/Store';
import { TrayItem } from './TrayItem';
import { ChevronLeft, ChevronRight } from 'lucide-react';

/**
 * Floating art inventory tray at the bottom of the canvas.
 * Styled as a warm rounded capsule matching the reference design.
 */
export function InventoryTray() {
  const { artObjects } = useStore();
  const scrollRef = useRef<HTMLDivElement>(null);

  const scrollBy = (amount: number) => {
    scrollRef.current?.scrollBy({ left: amount, behavior: 'smooth' });
  };

  const arrowClass =
    'absolute top-1/2 -translate-y-1/2 z-10 flex items-center justify-center w-9 h-9 rounded-full bg-white/80 backdrop-blur-sm shadow-sm hover:bg-white transition-colors outline-none focus-visible:ring-2 focus-visible:ring-primary text-foreground';

  return (
    <div className="relative w-full bg-background/80 backdrop-blur-md rounded-2xl shadow-[0_8px_32px_-8px_rgba(60,50,40,0.35)] px-12 py-4">
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
