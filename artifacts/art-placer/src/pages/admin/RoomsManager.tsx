import { useState } from 'react';
import { 
  useListRooms, 
  useDeleteRoom,
  getListRoomsQueryKey
} from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Plus, Trash2, Loader2, LayoutDashboard } from 'lucide-react';
import { RoomForm } from './RoomForm';
import { DeleteDialog } from './DeleteDialog';
import { roomImageUrl } from '@/types';
import { useToast } from '@/hooks/use-toast';

export function RoomsManager() {
  const { data: rooms, isLoading } = useListRooms();
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const deleteRoom = useDeleteRoom();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const handleCreateNew = () => {
    setSelectedRoomId(null);
    setIsCreating(true);
  };

  const handleEdit = (id: string) => {
    setSelectedRoomId(id);
    setIsCreating(false);
  };

  const handleDelete = (id: string) => {
    deleteRoom.mutate({ roomId: id }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListRoomsQueryKey() });
        toast({ title: 'Room deleted' });
        if (selectedRoomId === id) {
          setSelectedRoomId(null);
        }
      },
      onError: (err: any) => {
        toast({ 
          title: 'Error deleting room', 
          description: err?.data?.error || err.message, 
          variant: 'destructive' 
        });
      }
    });
  };

  const selectedRoom = rooms?.find(r => r.id === selectedRoomId);
  const showForm = isCreating || selectedRoomId;

  return (
    <div className="flex h-full w-full">
      {/* Sidebar List */}
      <div className="w-1/3 min-w-[300px] max-w-[400px] border-r border-border bg-card/30 flex flex-col">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <h2 className="font-serif text-lg">Rooms</h2>
          <Button size="sm" onClick={handleCreateNew} disabled={isCreating}>
            <Plus className="w-4 h-4 mr-1" /> New
          </Button>
        </div>
        <ScrollArea className="flex-1">
          <div className="p-4 space-y-3">
            {isLoading ? (
              <div className="flex items-center justify-center p-8 text-muted-foreground">
                <Loader2 className="w-6 h-6 animate-spin" />
              </div>
            ) : rooms?.length === 0 ? (
              <div className="text-center p-8 text-muted-foreground bg-muted/30 rounded-lg border border-border border-dashed">
                <p className="text-sm">No rooms found</p>
              </div>
            ) : (
              rooms?.map(room => (
                <Card 
                  key={room.id} 
                  className={`overflow-hidden transition-colors cursor-pointer group ${
                    selectedRoomId === room.id ? 'ring-2 ring-primary border-transparent' : 'hover:border-primary/50'
                  }`}
                  onClick={() => handleEdit(room.id)}
                >
                  <div className="aspect-[16/10] bg-muted relative">
                    <img 
                      src={roomImageUrl(room.imageFilename)} 
                      alt={room.name} 
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-3">
                      <div className="flex gap-2 w-full justify-end">
                        <DeleteDialog 
                          title="Delete Room?"
                          description={`Are you sure you want to delete "${room.name}"? This will also remove any art currently placed in this room. This action cannot be undone.`}
                          onConfirm={() => handleDelete(room.id)}
                          trigger={
                            <div onClick={e => e.stopPropagation()}>
                              <Button size="icon" variant="destructive" className="h-8 w-8 rounded-full shadow-md">
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          }
                        />
                      </div>
                    </div>
                  </div>
                  <div className="p-3 bg-card flex justify-between items-center">
                    <div>
                      <h3 className="font-medium text-sm truncate">{room.name}</h3>
                      <p className="text-xs text-muted-foreground">Split: {room.bandSplit}%</p>
                    </div>
                  </div>
                </Card>
              ))
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 p-6 lg:p-10 overflow-hidden bg-background">
        {showForm ? (
          <RoomForm
            /*
              Mounted fresh per room. The form resets itself when `room`
              changes, but that reset runs in a parent effect — React runs it
              *after* the effects of the controls inside, so anything that
              seeds itself from the form on a room change reads the previously
              selected room's values and keeps them. That is how the
              calibration tool came to show the last room's reference length.
              Remounting sidesteps the ordering entirely: every control starts
              from the right room on its first render.

              The key is the room, not the query result, so a refetch after
              saving still updates the mounted form in place rather than
              throwing away whatever is being edited.
            */
            key={selectedRoomId ?? 'new-room'}
            room={selectedRoom}
            onSuccess={() => {
              setIsCreating(false);
              // keep selection if editing, or clear if creating
            }}
            onCancel={() => {
              setIsCreating(false);
              setSelectedRoomId(null);
            }}
          />
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-muted-foreground space-y-4">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
              <LayoutDashboard className="w-8 h-8 opacity-50" />
            </div>
            <p className="font-serif text-lg">Select a room to edit, or create a new one.</p>
          </div>
        )}
      </div>
    </div>
  );
}
