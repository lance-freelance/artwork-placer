import { useStore } from '../state/Store';
import { rooms } from '../data/rooms';
import { cn } from '@/lib/utils';

export function RoomIndicator() {
  const { activeRoomId, setActiveRoomId, placements } = useStore();

  return (
    <div className="flex gap-2 justify-center py-2 shrink-0">
      {rooms.map(room => {
        const hasArt = placements.some(p => p.roomId === room.id);
        const isActive = room.id === activeRoomId;
        return (
          <button
            key={room.id}
            onClick={() => setActiveRoomId(room.id)}
            className="group relative flex items-center justify-center w-8 h-8 outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-full"
            aria-label={`Go to ${room.name}`}
          >
            <div className={cn(
              "w-2 h-2 rounded-full transition-all duration-300",
              isActive ? "bg-foreground scale-125" : "bg-muted-foreground/30 group-hover:bg-muted-foreground/60"
            )} />
            {hasArt && (
              <div className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-foreground rounded-full border border-background shadow-sm" />
            )}
          </button>
        );
      })}
    </div>
  );
}