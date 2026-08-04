import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useStore } from '../state/Store';

/**
 * Room prev/next chevrons.
 *
 * These are anchored to the viewport rather than to the room canvas so they
 * always sit out on the matte and never overlap the room photograph. The
 * matte insets in MainLayout carry pixel floors sized to keep this true down
 * to small screens.
 */
export function RoomNavArrows() {
  const { rooms, activeRoomId, setActiveRoomId } = useStore();
  const activeIndex = rooms.findIndex((r) => r.id === activeRoomId);

  // Each arrow occupies its matte gutter and is centred within it, so the
  // pair stays symmetric and clear of the room photograph at any window ratio.
  const gutterClass =
    'absolute top-1/2 -translate-y-1/2 z-20 flex items-center justify-center';
  const gutterStyle = { width: 'var(--matte-x)' };

  const arrowClass =
    'flex items-center justify-center w-10 h-10 rounded-full ' +
    'bg-white/80 backdrop-blur-sm shadow-md hover:bg-white transition-colors ' +
    'outline-none focus-visible:ring-2 focus-visible:ring-white ' +
    'disabled:opacity-35 disabled:cursor-not-allowed';

  return (
    <>
      <div className={`${gutterClass} left-0`} style={gutterStyle}>
        <button
          className={arrowClass}
          disabled={activeIndex <= 0}
          onClick={() => setActiveRoomId(rooms[activeIndex - 1].id)}
          aria-label="Previous room"
        >
          <ChevronLeft size={20} className="text-foreground" />
        </button>
      </div>

      <div className={`${gutterClass} right-0`} style={gutterStyle}>
        <button
          className={arrowClass}
          disabled={activeIndex === rooms.length - 1}
          onClick={() => setActiveRoomId(rooms[activeIndex + 1].id)}
          aria-label="Next room"
        >
          <ChevronRight size={20} className="text-foreground" />
        </button>
      </div>
    </>
  );
}
