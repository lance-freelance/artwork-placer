import { useState } from 'react';
import { 
  useListArt, 
  useDeleteArt,
  getListArtQueryKey
} from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Plus, Trash2, Loader2, Image as ImageIcon } from 'lucide-react';
import { ArtForm } from './ArtForm';
import { DeleteDialog } from './DeleteDialog';
import { artImageUrl } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';

export function ArtManager() {
  const { data: artItems, isLoading } = useListArt();
  const [selectedArtId, setSelectedArtId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const deleteArt = useDeleteArt();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const handleCreateNew = () => {
    setSelectedArtId(null);
    setIsCreating(true);
  };

  const handleEdit = (id: string) => {
    setSelectedArtId(id);
    setIsCreating(false);
  };

  const handleDelete = (id: string) => {
    deleteArt.mutate({ artId: id }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListArtQueryKey() });
        toast({ title: 'Art piece deleted' });
        if (selectedArtId === id) {
          setSelectedArtId(null);
        }
      },
      onError: (err: any) => {
        toast({ 
          title: 'Error deleting art', 
          description: err?.data?.error || err.message, 
          variant: 'destructive' 
        });
      }
    });
  };

  const selectedArt = artItems?.find(a => a.id === selectedArtId);
  const showForm = isCreating || selectedArtId;

  return (
    <div className="flex h-full w-full">
      {/* Sidebar List */}
      <div className="w-1/3 min-w-[300px] max-w-[400px] border-r border-border bg-card/30 flex flex-col">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <h2 className="font-serif text-lg">Art Catalog</h2>
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
            ) : artItems?.length === 0 ? (
              <div className="text-center p-8 text-muted-foreground bg-muted/30 rounded-lg border border-border border-dashed">
                <p className="text-sm">No art found</p>
              </div>
            ) : (
              artItems?.map(item => (
                <Card 
                  key={item.id} 
                  className={`overflow-hidden transition-colors cursor-pointer group flex items-stretch h-24 ${
                    selectedArtId === item.id ? 'ring-2 ring-primary border-transparent' : 'hover:border-primary/50'
                  }`}
                  onClick={() => handleEdit(item.id)}
                >
                  <div className="w-24 h-full bg-muted/50 border-r border-border flex items-center justify-center p-2 relative shrink-0">
                    <img 
                      src={artImageUrl(item.thumbnailFilename)} 
                      alt={item.name} 
                      className="max-w-full max-h-full object-contain drop-shadow-md"
                    />
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <DeleteDialog 
                        title="Delete Art Piece?"
                        description={`Are you sure you want to delete "${item.name}"? This will also remove any active placements of this piece in all rooms. This action cannot be undone.`}
                        onConfirm={() => handleDelete(item.id)}
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
                  <div className="p-3 flex-1 flex flex-col justify-center min-w-0">
                    <h3 className="font-medium text-sm truncate mb-1" title={item.name}>{item.name}</h3>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-[10px] uppercase font-mono px-1.5 py-0">
                        {item.type}
                      </Badge>
                      <span className="text-xs text-muted-foreground truncate">
                        AR: {item.aspectRatio}
                      </span>
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
          <ArtForm 
            art={selectedArt} 
            onSuccess={() => {
              setIsCreating(false);
            }}
            onCancel={() => {
              setIsCreating(false);
              setSelectedArtId(null);
            }}
          />
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-muted-foreground space-y-4">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
              <ImageIcon className="w-8 h-8 opacity-50" />
            </div>
            <p className="font-serif text-lg">Select a piece to edit, or create a new one.</p>
          </div>
        )}
      </div>
    </div>
  );
}
