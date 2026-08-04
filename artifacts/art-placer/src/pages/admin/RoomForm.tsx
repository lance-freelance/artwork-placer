import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { 
  Room, 
  useCreateRoom, 
  useUpdateRoom, 
  useListMedia, 
  useUploadRoomImage,
  getListRoomsQueryKey,
  getListMediaQueryKey,
} from '@workspace/api-client-react';
import { useToast } from '@/hooks/use-toast';
import { fileStem, loadImage, readFileAsDataUrl } from './imageTools';

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
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { BandSplitPreview } from './BandSplitPreview';
import { WallCalibrationTool } from './WallCalibrationTool';
import { AlertTriangle, Loader2, Upload } from 'lucide-react';
import { roomImageUrl } from '@/types';
import { useEffect, useRef, useState } from 'react';

/** The board canvas is 16:10; a room photo should match, within tolerance. */
const CANVAS_ASPECT = 16 / 10;
const ASPECT_TOLERANCE = 0.03;

const roomSchema = z.object({
  name: z.string().min(1, "Name is required"),
  imageFilename: z.string().min(1, "Image is required"),
  bandSplit: z.number().min(1, "Must be > 0").max(99, "Must be < 100"),
  wallWidthFeet: z.coerce.number().positive("Must be > 0"),
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
  const [isProcessingImage, setIsProcessingImage] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);
  /**
   * True when the chosen image's decoded shape is not 16:10 (within
   * tolerance). Non-blocking — it warns, it never prevents saving.
   */
  const [aspectWarning, setAspectWarning] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadImage = useUploadRoomImage();

  /**
   * Identifies the image operation in flight. Reading, decoding and uploading
   * are all awaited, so each step checks it is still the operation the form is
   * waiting for before writing anything back.
   */
  const imageOpRef = useRef(0);
  useEffect(() => () => { imageOpRef.current += 1; }, []);
  
  const form = useForm<RoomFormValues>({
    resolver: zodResolver(roomSchema),
    defaultValues: {
      name: room?.name ?? '',
      imageFilename: room?.imageFilename ?? '',
      bandSplit: room?.bandSplit ?? 50,
      wallWidthFeet: room?.wallWidthFeet ?? 13.5,
    },
  });

  const isEditing = !!room;

  // Reset form when selected room changes
  useEffect(() => {
    imageOpRef.current += 1;
    setIsProcessingImage(false);
    setImageError(null);
    setAspectWarning(null);

    if (room) {
      form.reset({
        name: room.name,
        imageFilename: room.imageFilename,
        bandSplit: room.bandSplit,
        wallWidthFeet: room.wallWidthFeet,
      });
      // Warn if an already-saved room's image is off-ratio too.
      void checkAspect(room.imageFilename);
    } else {
      form.reset({
        name: '',
        imageFilename: '',
        bandSplit: 50,
        wallWidthFeet: 13.5,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  /**
   * Decodes the chosen image and warns when its shape is not the 16:10 the
   * board canvas expects. Runs for uploads and dropdown picks alike, because
   * either can be off-ratio. Never blocks — it only sets a warning string.
   */
  async function checkAspect(filename: string) {
    if (!filename) {
      setAspectWarning(null);
      return;
    }
    try {
      const image = await loadImage(roomImageUrl(filename));
      const ratio = image.naturalWidth / image.naturalHeight;
      if (Math.abs(ratio - CANVAS_ASPECT) > ASPECT_TOLERANCE) {
        setAspectWarning(
          `This image is ${image.naturalWidth}×${image.naturalHeight} ` +
            `(${ratio.toFixed(2)}:1), not the 16:10 the board canvas uses. ` +
            `It will be cropped or stretched to fit. A 1600×1000px image avoids this.`,
        );
      } else {
        setAspectWarning(null);
      }
    } catch {
      // A broken/undecodable image is surfaced elsewhere; no aspect warning.
      setAspectWarning(null);
    }
  }

  /**
   * Reads one picked file, decodes it to check its shape, and sends it to the
   * room upload endpoint. Rooms have no thumbnail, so only { baseName, image }
   * is sent. On success the returned filename becomes the form's image.
   */
  async function handleFileChosen(file: File) {
    const op = ++imageOpRef.current;
    const current = () => imageOpRef.current === op;

    setImageError(null);
    setIsProcessingImage(true);
    try {
      const dataUrl = await readFileAsDataUrl(file);
      if (!current()) return;
      const image = await loadImage(dataUrl);
      if (!current()) return;

      const ratio = image.naturalWidth / image.naturalHeight;
      const offRatio = Math.abs(ratio - CANVAS_ASPECT) > ASPECT_TOLERANCE;

      const typedName = form.getValues('name').trim();
      const saved = await uploadImage.mutateAsync({
        data: {
          baseName: typedName || fileStem(file.name),
          image: dataUrl,
        },
      });
      if (!current()) return;

      form.setValue('imageFilename', saved.imageFilename, {
        shouldValidate: true,
        shouldDirty: true,
      });
      queryClient.invalidateQueries({ queryKey: getListMediaQueryKey() });

      if (offRatio) {
        setAspectWarning(
          `This image is ${image.naturalWidth}×${image.naturalHeight} ` +
            `(${ratio.toFixed(2)}:1), not the 16:10 the board canvas uses. ` +
            `It will be cropped or stretched to fit. A 1600×1000px image avoids this.`,
        );
      } else {
        setAspectWarning(null);
      }

      if (saved.renamedFrom) {
        toast({
          title: 'Saved under a new name',
          description:
            `An image named ${saved.renamedFrom} already exists, so this one ` +
            `was saved as ${saved.imageFilename}. If this is the same room ` +
            `uploaded twice, pick the existing image instead.`,
        });
      } else {
        toast({ title: 'Image saved' });
      }
    } catch (err: any) {
      if (!current()) return;
      const message = err?.data?.error || err?.message || 'The image could not be saved.';
      setImageError(message);
      toast({ title: 'Image not saved', description: message, variant: 'destructive' });
    } finally {
      if (current()) setIsProcessingImage(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  /** Picks an image already in the rooms folder, then checks its shape. */
  function handleExistingImageChosen(filename: string) {
    setImageError(null);
    form.setValue('imageFilename', filename, { shouldValidate: true, shouldDirty: true });
    void checkAspect(filename);
  }

  const roomImages = media?.rooms ?? [];
  const imageFilename = form.watch('imageFilename');

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 flex flex-col h-full">
        <div className="flex items-center justify-between">
          <h2 className="font-serif text-2xl tracking-wide">{isEditing ? 'Edit Room' : 'New Room'}</h2>
          <div className="space-x-2">
            <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting || isProcessingImage}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || isProcessingImage}>
              {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {isEditing ? 'Save Changes' : 'Create Room'}
            </Button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto hide-scrollbar space-y-8 pr-2">
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

          <div className="space-y-4 p-5 bg-muted/30 rounded-lg border border-border">
            <div className="flex items-center justify-between gap-4">
              {/* Plain markup, not FormLabel: this control writes the image
                  value programmatically, so it sits outside any FormField. */}
              <div>
                <Label>Room Image</Label>
                <p className="text-sm text-muted-foreground mt-1">
                  Upload a 16:10 photograph of the room (1600×1000px is ideal).
                  The board canvas is 16:10, so anything else will be cropped
                  or stretched to fit.
                </p>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/avif"
                className="hidden"
                data-testid="input-room-image"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void handleFileChosen(file);
                }}
              />
              <Button
                type="button"
                variant="outline"
                className="shrink-0"
                disabled={isProcessingImage}
                data-testid="button-upload-room-image"
                onClick={() => fileInputRef.current?.click()}
              >
                {isProcessingImage
                  ? <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  : <Upload className="w-4 h-4 mr-2" />}
                {isProcessingImage ? 'Processing…' : 'Upload Image'}
              </Button>
            </div>

            {imageFilename && (
              <figure className="min-w-0">
                <div className="h-28 bg-muted rounded-md overflow-hidden border border-border shadow-sm inline-flex items-center justify-center px-2">
                  <img
                    src={roomImageUrl(imageFilename)}
                    className="h-full w-auto object-contain"
                    alt="The selected room"
                  />
                </div>
                <figcaption className="text-[11px] text-muted-foreground mt-1.5 truncate">
                  {imageFilename}
                </figcaption>
              </figure>
            )}

            {imageError && (
              <p className="text-sm text-destructive" data-testid="text-room-image-error">
                {imageError}
              </p>
            )}
            {aspectWarning && (
              <p
                className="text-sm text-amber-600 dark:text-amber-500 flex items-start gap-1.5"
                data-testid="text-room-aspect-warning"
              >
                <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                <span>{aspectWarning}</span>
              </p>
            )}
            {form.formState.errors.imageFilename && (
              <p className="text-sm text-destructive">
                {form.formState.errors.imageFilename.message}
              </p>
            )}

            <div className="pt-1">
              <Select
                onValueChange={handleExistingImageChosen}
                value={imageFilename}
              >
                <SelectTrigger
                  disabled={isMediaLoading || isProcessingImage}
                  className="h-9 text-sm"
                  data-testid="select-existing-room-image"
                >
                  <SelectValue placeholder="…or pick an image already in the rooms folder" />
                </SelectTrigger>
                <SelectContent>
                  {roomImages.map(filename => (
                    <SelectItem key={filename} value={filename}>
                      {filename}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-sm text-muted-foreground mt-1.5">
                For images added to <code className="text-[11px]">public/rooms/</code> by hand.
              </p>
            </div>
          </div>

          <FormField
            control={form.control}
            name="bandSplit"
            render={({ field }) => (
              <FormItem className="pt-2">
                <FormLabel>Band Split</FormLabel>
                <FormControl>
                  <BandSplitPreview 
                    imageFilename={imageFilename} 
                    bandSplit={field.value}
                    onChange={field.onChange}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="wallWidthFeet"
            render={({ field }) => (
              <FormItem className="pt-2">
                <FormLabel>Wall Calibration</FormLabel>
                <FormDescription>
                  Lay the reference line along something of known size in the
                  photo — a door frame, a countertop — and set its real length.
                  This measures the back wall's true width, which every piece is
                  scaled against, so a 48" canvas reads at the correct size in
                  this room. Re-measure any time.
                </FormDescription>
                <FormControl>
                  <WallCalibrationTool
                    roomKey={room?.id ?? 'new-room'}
                    imageFilename={imageFilename}
                    wallWidthFeet={field.value}
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
