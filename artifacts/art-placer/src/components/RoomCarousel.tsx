import useEmblaCarousel from 'embla-carousel-react';
import { RoomCanvas } from './RoomCanvas';
import { useStore } from '../state/Store';
import { useEffect, useCallback } from 'react';

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

  return (
    <div
      className="overflow-hidden w-[min(100%,160cqh)] shadow-[0_18px_40px_-18px_rgba(60,50,40,0.45)] rounded-sm bg-muted"
      ref={emblaRef}
    >
      <div className="flex touch-pan-y">
        {rooms.map(room => (
          <div key={room.id} className="flex-[0_0_100%] min-w-0 relative">
            <RoomCanvas roomId={room.id} isActive={room.id === activeRoomId} />
          </div>
        ))}
      </div>
    </div>
  );
}