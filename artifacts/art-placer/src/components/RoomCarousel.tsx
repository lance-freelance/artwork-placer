import useEmblaCarousel from 'embla-carousel-react';
import { RoomCanvas } from './RoomCanvas';
import { useStore } from '../state/Store';
import { useEffect, useCallback } from 'react';

/**
 * Holds the room slides. This component fills the matted canvas box supplied
 * by MainLayout — it does not size itself against the viewport, so every
 * measurement taken inside a slide is canvas-relative.
 *
 * The prev/next chevrons deliberately live outside this component (see
 * RoomNavArrows) so they can be positioned against the viewport matte.
 */
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

  // No manual resize handling here: the canvas box resizes with the matte, and
  // Embla's own `watchResize` (on by default) observes the root node and
  // re-measures slide offsets for us.

  return (
    <div className="relative w-full h-full">
      {/* Embla viewport — fills the matted canvas box */}
      <div className="overflow-hidden w-full h-full" ref={emblaRef}>
        <div className="flex h-full touch-pan-y">
          {rooms.map(room => (
            <div key={room.id} className="flex-[0_0_100%] min-w-0 h-full relative border-t-[30px] border-r-[30px] border-b-[30px] border-l-[30px]">
              <RoomCanvas roomId={room.id} isActive={room.id === activeRoomId} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
