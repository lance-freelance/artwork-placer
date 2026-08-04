import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { 
  Room, 
  useCreateRoom, 
  useUpdateRoom, 
  useListMedia, 
  getListRoomsQueryKey,
} from '@workspace/api-client-react';
import { useToast } from '@/hooks/use-toast';

import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { BandSplitPreview } from './BandSplitPreview';
import { Loader2 } from 'lucide-react';
import { useEffect } from 'react';

const roomSchema = z.object({
  name: z.string().min(1, "Name is required"),
  imageFilename: z.string().min(1, "Image is required"),
  bandSplit: z.number().min(1, "Must be > 0").max(99, "Must be < 100")
});

type RoomFormValues = z.infer<typeof roomSchema>;

interface RoomFormProps {
  room?: Room;
  onSuccess: () => void;
  onCancel: () => void;
}

export function RoomForm({ room, onSuccess, onCancel }: RoomFormProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: media, isLoading: isMediaLoading } = useListMedia();
  
  const form = useForm<RoomFormValues>({
    resolver: zodResolver(roomSchema),
    defaultValues: {
      name: room?.name ?? '',
      imageFilename: room?.imageFilename ?? '',
      bandSplit: room?.bandSplit ?? 50,
    },
  });

  const isEditing = !!room;

  // Reset form when selected room changes
  useEffect(() => {
    if (room) {
      form.reset({
        name: room.name,
        imageFilename: room.imageFilename,
        bandSplit: room.bandSplit,
      });
    } else {
      form.reset({
        name: '',
        imageFilename: '',
        bandSplit: 50,
      });
    }
  }, [room, form]);

  const createRoom = useCreateRoom();
  const updateRoom = useUpdateRoom();

  const isSubmitting = createRoom.isPending || updateRoom.isPending;

  function onSubmit(data: RoomFormValues) {
    if (isEditing) {
      updateRoom.mutate({ roomId: room.id, data }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListRoomsQueryKey() });
          toast({ title: 'Room updated' });
          onSuccess();
        },
        onError: (err: any) => {
          toast({ 
            title: 'Error updating room', 
            description: err?.data?.error || err.message, 
            variant: 'destructive' 
          });
        }
      });
    } else {
      createRoom.mutate({ data }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListRoomsQueryKey() });
          toast({ title: 'Room created' });
          onSuccess();
        },
        onError: (err: any) => {
          toast({ 
            title: 'Error creating room', 
            description: err?.data?.error || err.message, 
            variant: 'destructive' 
          });
        }
      });
    }
  }

  const roomImages = media?.rooms ?? [];

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 flex flex-col h-full">
        <div className="flex items-center justify-between">
          <h2 className="font-serif text-2xl tracking-wide">{isEditing ? 'Edit Room' : 'New Room'}</h2>
          <div className="space-x-2">
            <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {isEditing ? 'Save Changes' : 'Create Room'}
            </Button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto hide-scrollbar space-y-8 pr-2">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Room Name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. Minimalist Gallery" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="imageFilename"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Background Image</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger disabled={isMediaLoading}>
                        <SelectValue placeholder="Select image file" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {roomImages.map(filename => (
                        <SelectItem key={filename} value={filename}>
                          {filename}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    Requires a 1600x1000px (16:10) image placed in <code>public/rooms/</code>
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={form.control}
            name="bandSplit"
            render={({ field }) => (
              <FormItem className="pt-2">
                <FormLabel>Band Split</FormLabel>
                <FormControl>
                  <BandSplitPreview 
                    imageFilename={form.watch('imageFilename')} 
                    bandSplit={field.value}
                    onChange={field.onChange}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
      </form>
    </Form>
  );
}
