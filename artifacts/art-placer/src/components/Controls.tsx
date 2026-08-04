import { useStore } from '../state/Store';
import { Undo2, RotateCcw } from 'lucide-react';
import { ResetDialog } from './ResetDialog';
import { cn } from '@/lib/utils';

/**
 * Floating left-side action panel — Undo and Clear room stacked vertically,
 * matching the reference layout where controls sit over the room canvas.
 */
export function Controls() {
  const { rooms, history, undo, resetRoom, resetAll, activeRoomId } = useStore();
  const activeIndex = rooms.findIndex((r) => r.id === activeRoomId);
  const buttonClass =
    'flex flex-col items-center gap-1 w-12 h-12 rounded-xl bg-white/85 backdrop-blur-sm shadow-md hover:bg-white transition-colors outline-none focus-visible:ring-2 focus-visible:ring-white disabled:opacity-30 disabled:cursor-not-allowed justify-center';

  return (
    <div className="absolute left-4 top-[28%] z-20 flex flex-col gap-3 items-center">
      {/* Undo */}
      <div className="flex flex-col items-center gap-1">
        <button
          onClick={undo}
          disabled={history.length === 0}
          className={buttonClass}
          aria-label={
            history.length > 1
              ? `Undo last action, ${history.length} available`
              : 'Undo last action'
          }
        >
          <Undo2 size={18} className="text-foreground" />
          {history.length > 1 && (
            <span
              aria-hidden="true"
              className="absolute -top-1 -right-1 text-[9px] tabular-nums leading-none px-1 py-0.5 rounded-full bg-foreground text-background min-w-[16px] text-center"
            >
              {history.length}
            </span>
          )}
        </button>
        <span className="text-[10px] text-white font-medium tracking-wide drop-shadow">Undo</span>
      </div>

      {/* Clear room / Start over */}
      <div className="flex flex-col items-center gap-1">
        <ResetDialog
          roomName={rooms[activeIndex]?.name ?? ''}
          onResetRoom={() => resetRoom(activeRoomId)}
          onResetAll={resetAll}
          trigger={
            <button
              className={cn(buttonClass, 'relative')}
              aria-label="Clear room"
            >
              <RotateCcw size={18} className="text-foreground" />
            </button>
          }
        />
        <span className="text-[10px] text-white font-medium tracking-wide drop-shadow">Reset</span>
      </div>
    </div>
  );
}
