import { useRef } from 'react';
import { artObjects } from '../data/objects';
import { TrayItem } from './TrayItem';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export function InventoryTray() {
  const scrollRef = useRef<HTMLDivElement>(null);

  const scrollBy = (amount: number) => {
    scrollRef.current?.scrollBy({ left: amount, behavior: 'smooth' });
  };

  return (
    <div className="relative w-full max-w-4xl mx-auto px-12 py-6">
      <button 
        onClick={() => scrollBy(-200)}
        className="absolute left-2 top-1/2 -translate-y-1/2 p-2 text-muted-foreground hover:text-foreground transition-colors outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-full"
        aria-label="Scroll left"
      >
        <ChevronLeft size={24} strokeWidth={1.5} />
      </button>

      <div 
        ref={scrollRef}
        className="flex gap-6 overflow-x-auto snap-x snap-mandatory hide-scrollbar px-4 items-center min-h-[100px]"
      >
        {artObjects.map(obj => (
          <div key={obj.id} className="snap-start shrink-0 flex items-center justify-center">
            <TrayItem objectId={obj.id} />
          </div>
        ))}
      </div>

      <button 
        onClick={() => scrollBy(200)}
        className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-muted-foreground hover:text-foreground transition-colors outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-full"
        aria-label="Scroll right"
      >
        <ChevronRight size={24} strokeWidth={1.5} />
      </button>
    </div>
  );
}