import { useStore } from '../state/Store';
import { Undo2, RotateCcw, Trash2, ChevronLeft, ChevronRight } from 'lucide-react';
import { rooms } from '../data/rooms';
import { ResetDialog } from './ResetDialog';

export function Controls() {
  const { history, undo, resetRoom, resetAll, activeRoomId, setActiveRoomId } =
    useStore();
  const activeIndex = rooms.findIndex((r) => r.id === activeRoomId);

  return (
    <div className="flex items-center justify-between w-full max-w-4xl mx-auto px-4 md:px-6 py-2">
      {/* Room navigation */}
      <div className="flex items-center gap-1 md:gap-3">
        <button
          className="p-2 rounded-full hover:bg-foreground/5 disabled:opacity-30 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-primary"
          disabled={activeIndex === 0}
          onClick={() => setActiveRoomId(rooms[activeIndex - 1].id)}
          aria-label="Previous room"
        >
          <ChevronLeft size={20} />
        </button>
        <div className="text-sm md:text-base tracking-wide font-serif w-24 md:w-32 text-center truncate">
          {rooms[activeIndex].name}
        </div>
        <button
          className="p-2 rounded-full hover:bg-foreground/5 disabled:opacity-30 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-primary"
          disabled={activeIndex === rooms.length - 1}
          onClick={() => setActiveRoomId(rooms[activeIndex + 1].id)}
          aria-label="Next room"
        >
          <ChevronRight size={20} />
        </button>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 md:gap-2">
        <button
          onClick={undo}
          disabled={history.length === 0}
          className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-sm"
          aria-label="Undo last action"
        >
          <Undo2 size={16} />
          <span className="hidden sm:inline">Undo</span>
        </button>

        <div className="w-px h-4 bg-border mx-1 md:mx-2" />

        <ResetDialog
          title="Reset this room?"
          description={`This will return all art placed in the ${rooms[activeIndex].name} to the inventory tray.`}
          confirmLabel="Reset room"
          onConfirm={() => resetRoom(activeRoomId)}
          trigger={
            <button
              className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-sm"
              aria-label="Reset current room"
            >
              <RotateCcw size={16} />
              <span className="hidden sm:inline">Reset</span>
            </button>
          }
        />

        <ResetDialog
          destructive
          title="Clear all rooms?"
          description="This will return every piece of art across all rooms back to the inventory tray."
          confirmLabel="Clear all"
          onConfirm={resetAll}
          trigger={
            <button
              className="flex items-center gap-2 px-3 py-2 text-sm text-destructive/70 hover:text-destructive transition-colors outline-none focus-visible:ring-2 focus-visible:ring-destructive rounded-sm"
              aria-label="Clear art from all rooms"
            >
              <Trash2 size={16} />
              <span className="hidden md:inline">Clear all</span>
            </button>
          }
        />
      </div>
    </div>
  );
}
