import { useEffect, useRef } from 'react';
import { useStore } from '../state/Store';
import { cn } from '@/lib/utils';

/**
 * Pill-shaped room selector, centred in the top matte band.
 *
 * Tuned for the light matte: ink text on a translucent capsule, with the active
 * room lifted onto solid white so it reads as "you are here".
 */
export function RoomTabs() {
  const { rooms, activeRoomId, setActiveRoomId, placements } = useStore();
  const activeRef = useRef<HTMLButtonElement>(null);

  // The capsule scrolls on narrow screens, so the active room can sit outside
  // the visible strip after a prev/next step. Keep it in view or the "you are
  // here" state silently disappears.
  useEffect(() => {
    const reduceMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches;
    activeRef.current?.scrollIntoView({
      behavior: reduceMotion ? 'auto' : 'smooth',
      block: 'nearest',
      inline: 'nearest',
    });
  }, [activeRoomId]);

  return (
    // min-w-0 lets the capsule shrink below its content width; without it the
    // flex item refuses to shrink and the last room name runs off screen
    // instead of scrolling.
    <div className="flex items-center gap-1 bg-foreground/[0.07] backdrop-blur-md rounded-full px-1 py-1 min-w-0 max-w-full overflow-x-auto hide-scrollbar">
      {rooms.map((room) => {
        const isActive = room.id === activeRoomId;
        const hasArt = placements.some((p) => p.roomId === room.id);

        return (
          <button
            key={room.id}
            ref={isActive ? activeRef : undefined}
            onClick={() => setActiveRoomId(room.id)}
            aria-label={`Go to ${room.name}${hasArt ? ' (has placed art)' : ''}`}
            className={cn(
              // Compact below `sm` so all four room names fit a 390px phone
              // rather than relying on the scroll fallback below.
              'relative flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3.5 py-1.5 rounded-full text-[11px] sm:text-[13px] font-medium tracking-wide whitespace-nowrap shrink-0 transition-all duration-200 outline-none focus-visible:ring-2 focus-visible:ring-foreground/50',
              isActive
                ? 'bg-white text-foreground shadow-[0_2px_8px_-2px_rgba(74,63,48,0.35)]'
                : 'text-foreground/60 hover:text-foreground hover:bg-white/40',
            )}
          >
            {room.name}
            {/* Small dot when art has been placed in this room */}
            {hasArt && (
              <span
                aria-hidden="true"
                className={cn(
                  'w-1.5 h-1.5 rounded-full flex-shrink-0 transition-colors',
                  isActive ? 'bg-foreground/40' : 'bg-foreground/30',
                )}
              />
            )}
          </button>
        );
      })}
    </div>
  );
}
