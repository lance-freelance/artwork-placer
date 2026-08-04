import type { ReactNode } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';

/**
 * Confirmation gate for clearing placed art. The scope is chosen inside the
 * dialog so the toolbar only needs one clear-room control.
 */
export function ResetDialog({
  trigger,
  roomName,
  onResetRoom,
  onResetAll,
}: {
  trigger: ReactNode;
  roomName: string;
  onResetRoom: () => void;
  onResetAll: () => void;
}) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="font-serif text-xl">
            Clear room?
          </AlertDialogTitle>
          <AlertDialogDescription>
            Choose whether to clear the art from the {roomName} or return every
            piece across all rooms to the inventory tray.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onResetRoom}>
            Clear this room
          </AlertDialogAction>
          <AlertDialogAction
            onClick={onResetAll}
            className={cn(
              'bg-destructive text-destructive-foreground hover:bg-destructive/90',
            )}
          >
            Start over
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
