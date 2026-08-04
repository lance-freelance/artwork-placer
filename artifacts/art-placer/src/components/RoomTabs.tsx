import { useStore } from '../state/Store';
import { cn } from '@/lib/utils';

/**
 * Pill-shaped room selector bar centred at the top of the canvas.
 * All room names are visible at once; the active one gets a solid white
 * background so it reads as "you are here".
 */
export function RoomTabs() {
  const { rooms, activeRoomId, setActiveRoomId, placements } = useStore();

  return (
    <div className="flex items-center gap-1 bg-white/15 backdrop-blur-md rounded-full px-1 py-1 shadow-sm">
      {rooms.map((room) => {
        const isActive = room.id === activeRoomId;
        const hasArt = placements.some((p) => p.roomId === room.id);

        return (
          <button
            key={room.id}
            onClick={() => setActiveRoomId(room.id)}
            aria-label={`Go to ${room.name}${hasArt ? ' (has placed art)' : ''}`}
            className={cn(
              'relative flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-[13px] font-medium tracking-wide transition-all duration-200 outline-none focus-visible:ring-2 focus-visible:ring-white',
              isActive
                ? 'bg-white text-foreground shadow-sm'
                : 'text-white/90 hover:text-white hover:bg-white/10',
            )}
          >
            {room.name}
            {/* Small dot when art has been placed in this room */}
            {hasArt && (
              <span
                aria-hidden="true"
                className={cn(
                  'w-1.5 h-1.5 rounded-full flex-shrink-0 transition-colors',
                  isActive ? 'bg-foreground/40' : 'bg-white/60',
                )}
              />
            )}
          </button>
        );
      })}
    </div>
  );
}
