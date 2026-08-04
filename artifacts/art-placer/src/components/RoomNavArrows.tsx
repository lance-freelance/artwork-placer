import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useStore } from '../state/Store';
import { cn } from '@/lib/utils';

const ARROW =
  'flex items-center justify-center w-11 h-11 rounded-full bg-white/85 ' +
  'backdrop-blur-sm shadow-[0_4px_14px_-4px_rgba(74,63,48,0.45)] hover:bg-white ' +
  'transition-colors outline-none focus-visible:ring-2 focus-visible:ring-foreground/50 ' +
  'disabled:opacity-35 disabled:cursor-not-allowed';

/**
 * A single room step button. Used inline in the bottom control band on narrow
 * windows, where there is no side gutter to stand in.
 */
export function RoomNavButton({ dir }: { dir: 'prev' | 'next' }) {
  const { rooms, activeRoomId, setActiveRoomId } = useStore();
  const activeIndex = rooms.findIndex((r) => r.id === activeRoomId);
  const target = dir === 'prev' ? activeIndex - 1 : activeIndex + 1;
  const disabled = target < 0 || target >= rooms.length;

  return (
    <button
      className={cn(ARROW, 'shrink-0')}
      disabled={disabled}
      onClick={() => !disabled && setActiveRoomId(rooms[target].id)}
      aria-label={dir === 'prev' ? 'Previous room' : 'Next room'}
    >
      {dir === 'prev' ? (
        <ChevronLeft size={20} className="text-foreground" />
      ) : (
        <ChevronRight size={20} className="text-foreground" />
      )}
    </button>
  );
}

/**
 * Room prev/next chevrons for wide landscape windows.
 *
 * Each occupies its side gutter — the natural leftover matte beside the 16:10
 * canvas — and is centred both within that gutter and against the photo's
 * vertical midline, so the pair reads as symmetric furniture around the print.
 */
export function RoomNavArrows() {
  const gutter = 'absolute z-20 flex items-center justify-center';
  const style = {
    width: 'var(--gutter)',
    top: 'calc(var(--box-top) + var(--box-h) / 2)',
    transform: 'translateY(-50%)',
  };

  return (
    <>
      <div className={cn(gutter, 'left-0')} style={style}>
        <RoomNavButton dir="prev" />
      </div>
      <div className={cn(gutter, 'right-0')} style={style}>
        <RoomNavButton dir="next" />
      </div>
    </>
  );
}
