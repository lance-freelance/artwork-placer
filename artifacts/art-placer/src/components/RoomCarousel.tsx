import useEmblaCarousel from 'embla-carousel-react';
import { RoomCanvas } from './RoomCanvas';
import { useStore } from '../state/Store';
import { useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export function RoomCarousel() {
  const { rooms, activeRoomId, setActiveRoomId } = useStore();
  // `watchDrag: false` is deliberate: rooms change only through the prev/next
  // controls and the room dots. A draggable carousel competes with dragging
  // art — Embla steals the pointer mid-placement and the piece gets stranded.
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: false, watchDrag: false });

  const activeIndex = rooms.findIndex(r => r.id === activeRoomId);

  useEffect(() => {
    if (emblaApi && activeIndex !== -1 && emblaApi.selectedScrollSnap() !== activeIndex) {
      emblaApi.scrollTo(activeIndex);
    }
  }, [activeIndex, emblaApi]);

  const onSelect = useCallback(() => {
    if (!emblaApi) return;
    const index = emblaApi.selectedScrollSnap();
    setActiveRoomId(rooms[index].id);
  }, [emblaApi, rooms, setActiveRoomId]);

  useEffect(() => {
    if (!emblaApi) return;
    emblaApi.on('select', onSelect);
    return () => { emblaApi.off('select', onSelect); };
  }, [emblaApi, onSelect]);

  const sideArrowClass =
    'absolute top-1/2 -translate-y-1/2 z-20 flex items-center justify-center w-10 h-10 rounded-full bg-white/80 backdrop-blur-sm shadow-md hover:bg-white transition-colors outline-none focus-visible:ring-2 focus-visible:ring-white disabled:opacity-0 disabled:pointer-events-none';

  return (
    <div className="relative w-full h-full">
      {/* Embla viewport — fills entire parent */}
      <div className="overflow-hidden w-full h-full" ref={emblaRef}>
        <div className="flex h-full touch-pan-y">
          {rooms.map(room => (
            <div key={room.id} className="flex-[0_0_100%] min-w-0 h-full relative">
              <RoomCanvas roomId={room.id} isActive={room.id === activeRoomId} />
            </div>
          ))}
        </div>
      </div>

      {/* Right room-nav arrow */}
      <button
        className={`${sideArrowClass} right-16`}
        disabled={activeIndex === rooms.length - 1}
        onClick={() => setActiveRoomId(rooms[activeIndex + 1].id)}
        aria-label="Next room"
      >
        <ChevronRight size={20} className="text-foreground" />
      </button>
    </div>
  );
}
