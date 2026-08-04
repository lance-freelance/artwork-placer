import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { 
  ArtObject,
  useCreateArt,
  useUpdateArt,
  useListMedia,
  useUploadArtImage,
  getListArtQueryKey,
  getListMediaQueryKey,
} from '@workspace/api-client-react';
import { useToast } from '@/hooks/use-toast';
import { useEffect, useRef, useState } from 'react';
import {
  fileStem,
  findThumbnailFor,
  generateThumbnail,
  isThumbnail,
  loadImage,
  readFileAsDataUrl,
  THUMBNAIL_MAX_EDGE,
} from './imageTools';

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
import { Loader2, Upload, Wand2 } from 'lucide-react';
import { assetUrl } from '@/types';
import { Badge } from '@/components/ui/badge';

const artSchema = z.object({
  name: z.string().min(1, "Name is required"),
  type: z.enum(["wall", "sculpture"]),
  thumbnailFilename: z.string().min(1, "Thumbnail is required"),
  fullImageFilename: z.string().min(1, "Full image is required"),
  aspectRatio: z.coerce.number().positive("Must be > 0"),
  minScale: z.coerce.number().min(0.01).max(1),
  defaultScale: z.coerce.number().min(0.01).max(1),
  maxScale: z.coerce.number().min(0.01).max(1),
}).refine(data => data.minScale <= data.defaultScale, {
  message: "Min scale must be <= default scale",
  path: ["minScale"]
}).refine(data => data.defaultScale <= data.maxScale, {
  message: "Default scale must be <= max scale",
  path: ["defaultScale"]
}).refine(data => data.minScale <= data.maxScale, {
  message: "Min scale must be <= max scale",
  path: ["maxScale"]
});

type ArtFormValues = z.infer<typeof artSchema>;

interface ArtFormProps {
  art?: ArtObject;
  onSuccess: () => void;
  onCancel: () => void;
}

export function ArtForm({ art, onSuccess, onCancel }: ArtFormProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: media, isLoading: isMediaLoading } = useListMedia();
  const [autoDetectedRatio, setAutoDetectedRatio] = useState(false);
  const [isProcessingImage, setIsProcessingImage] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadImage = useUploadArtImage();

  /**
   * Identifies the image operation in flight. Reading, decoding and uploading
   * are all awaited, and in the meantime the form can be reset onto a
   * different piece or closed entirely — so each step checks it is still the
   * operation the form is waiting for before writing anything back.
   */
  const imageOpRef = useRef(0);
  useEffect(() => () => { imageOpRef.current += 1; }, []);
  
  const form = useForm<ArtFormValues>({
    resolver: zodResolver(artSchema),
    defaultValues: {
      name: art?.name ?? '',
      type: art?.type ?? 'wall',
      thumbnailFilename: art?.thumbnailFilename ?? '',
      fullImageFilename: art?.fullImageFilename ?? '',
      aspectRatio: art?.aspectRatio ?? 1,
      minScale: art?.minScale ?? 0.05,
      defaultScale: art?.defaultScale ?? 0.15,
      maxScale: art?.maxScale ?? 0.4,
    },
  });

  const isEditing = !!art;

  useEffect(() => {
    // The form is about to be pointed at a different piece, so anything still
    // uploading belongs to the old one and must not land on this one.
    imageOpRef.current += 1;
    setIsProcessingImage(false);
    setImageError(null);

    if (art) {
      form.reset({
        name: art.name,
        type: art.type,
        thumbnailFilename: art.thumbnailFilename,
        fullImageFilename: art.fullImageFilename,
        aspectRatio: art.aspectRatio,
        minScale: art.minScale,
        defaultScale: art.defaultScale,
        maxScale: art.maxScale,
      });
      setAutoDetectedRatio(false);
    } else {
      form.reset({
        name: '',
        type: 'wall',
        thumbnailFilename: '',
        fullImageFilename: '',
        aspectRatio: 1,
        minScale: 0.05,
        defaultScale: 0.15,
        maxScale: 0.4,
      });
      setAutoDetectedRatio(false);
    }
  }, [art, form]);

  const createArt = useCreateArt();
  const updateArt = useUpdateArt();

  const isSubmitting = createArt.isPending || updateArt.isPending;

  function onSubmit(data: ArtFormValues) {
    if (isEditing) {
      updateArt.mutate({ artId: art.id, data }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListArtQueryKey() });
          toast({ title: 'Art piece updated' });
          onSuccess();
        },
        onError: (err: any) => {
          toast({ 
            title: 'Error updating art', 
            description: err?.data?.error || err.message, 
            variant: 'destructive' 
          });
        }
      });
    } else {
      createArt.mutate({ data }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListArtQueryKey() });
          toast({ title: 'Art piece created' });
          onSuccess();
        },
        onError: (err: any) => {
          toast({ 
            title: 'Error creating art', 
            description: err?.data?.error || err.message, 
            variant: 'destructive' 
          });
        }
      });
    }
  }

  /** Shape is a property of the picture, so it is measured, never typed in. */
  const applyAspectRatio = (image: HTMLImageElement) => {
    const rounded = Math.round((image.naturalWidth / image.naturalHeight) * 100) / 100;
    form.setValue('aspectRatio', rounded, { shouldValidate: true, shouldDirty: true });
    setAutoDetectedRatio(true);
    return rounded;
  };

  const setImageFilenames = (fullImageFilename: string, thumbnailFilename: string) => {
    form.setValue('fullImageFilename', fullImageFilename, { shouldValidate: true, shouldDirty: true });
    form.setValue('thumbnailFilename', thumbnailFilename, { shouldValidate: true, shouldDirty: true });
  };

  /**
   * One picked file becomes both images: it is measured for its aspect ratio,
   * scaled down in a canvas for the tray, and the pair is sent to be written
   * together. The thumbnail is never something the admin has to supply.
   */
  const handleFileChosen = async (file: File) => {
    const op = ++imageOpRef.current;
    const current = () => imageOpRef.current === op;

    setImageError(null);
    setIsProcessingImage(true);
    try {
      const dataUrl = await readFileAsDataUrl(file);
      if (!current()) return;
      const image = await loadImage(dataUrl);
      if (!current()) return;

      const ratio = applyAspectRatio(image);
      const thumbnail = generateThumbnail(image);

      // Name the files after the piece where there is a name to use, so the
      // directory stays readable; otherwise keep whatever the file was called.
      const typedName = form.getValues('name').trim();
      const saved = await uploadImage.mutateAsync({
        data: {
          baseName: typedName || fileStem(file.name),
          fullImage: dataUrl,
          thumbnail,
        },
      });
      // The images are written either way; they are simply no longer this
      // form's business, so nothing is set and nothing is announced.
      if (!current()) return;

      setImageFilenames(saved.fullImageFilename, saved.thumbnailFilename);
      queryClient.invalidateQueries({ queryKey: getListMediaQueryKey() });
      toast({
        title: 'Image saved',
        description: `Thumbnail generated at ${THUMBNAIL_MAX_EDGE}px · aspect ratio ${ratio}`,
      });
    } catch (err: any) {
      if (!current()) return;
      const message = err?.data?.error || err?.message || 'The image could not be saved.';
      setImageError(message);
      toast({ title: 'Image not saved', description: message, variant: 'destructive' });
    } finally {
      if (current()) setIsProcessingImage(false);
      // Let the same file be picked again after a failure.
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  /** Reuses a picture already in the art directory, thumbnail and all. */
  const handleExistingImageChosen = async (filename: string) => {
    setImageError(null);
    setImageFilenames(filename, findThumbnailFor(filename, media?.art ?? []));
    try {
      applyAspectRatio(await loadImage(assetUrl(`art/${filename}`)));
    } catch {
      // Leave the ratio alone; it stays editable by hand.
    }
  };

  const artImages = media?.art ?? [];
  /** Thumbnails are derived, so they are never offered as the artwork itself. */
  const selectableArtImages = artImages.filter((name) => !isThumbnail(name));
  const fullImageFilename = form.watch('fullImageFilename');
  const thumbnailFilename = form.watch('thumbnailFilename');

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 flex flex-col h-full">
        <div className="flex items-center justify-between">
          <h2 className="font-serif text-2xl tracking-wide">{isEditing ? 'Edit Art Piece' : 'New Art Piece'}</h2>
          <div className="space-x-2">
            {/* Both are held while an image is in flight: leaving would strand
                the upload, and saving would store filenames not settled yet. */}
            <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting || isProcessingImage}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || isProcessingImage}>
              {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {isEditing ? 'Save Changes' : 'Create Art'}
            </Button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto hide-scrollbar space-y-6 pr-2">
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Piece Name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. Bronze Statue" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Placement Type</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="wall">Wall Art</SelectItem>
                      <SelectItem value="sculpture">Sculpture</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    Determines which side of the room's band split this piece occupies.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div className="space-y-4 p-5 bg-muted/30 rounded-lg border border-border">
            <div className="flex items-center justify-between gap-4">
              {/* Plain markup, not FormLabel: this control writes two form
                  values programmatically, so it sits outside any FormField. */}
              <div>
                <Label>Artwork Image</Label>
                <p className="text-sm text-muted-foreground mt-1">
                  Upload one image. The tray thumbnail is generated from it
                  automatically at {THUMBNAIL_MAX_EDGE}px, and the aspect ratio is
                  read off the file.
                </p>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/avif"
                className="hidden"
                data-testid="input-art-image"
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
                data-testid="button-upload-art-image"
                onClick={() => fileInputRef.current?.click()}
              >
                {isProcessingImage
                  ? <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  : <Upload className="w-4 h-4 mr-2" />}
                {isProcessingImage ? 'Processing…' : 'Upload Image'}
              </Button>
            </div>

            {(fullImageFilename || thumbnailFilename) && (
              <div className="flex items-end gap-5 pt-1">
                {fullImageFilename && (
                  <figure className="min-w-0">
                    <div className="h-28 bg-muted rounded-md overflow-hidden border border-border shadow-sm inline-flex items-center justify-center px-2">
                      <img
                        src={assetUrl(`art/${fullImageFilename}`)}
                        className="h-full w-auto object-contain"
                        alt="The artwork as placed in a room"
                      />
                    </div>
                    <figcaption className="text-[11px] text-muted-foreground mt-1.5 truncate">
                      {fullImageFilename}
                    </figcaption>
                  </figure>
                )}
                {thumbnailFilename && (
                  <figure>
                    <div className="w-20 h-20 bg-muted rounded-md overflow-hidden border border-border shadow-sm flex items-center justify-center">
                      <img
                        src={assetUrl(`art/${thumbnailFilename}`)}
                        className="w-full h-full object-contain"
                        alt="The generated tray thumbnail"
                      />
                    </div>
                    <figcaption className="text-[11px] text-muted-foreground mt-1.5 flex items-center gap-1">
                      <Wand2 className="w-3 h-3 shrink-0" />
                      <span className="truncate">{thumbnailFilename}</span>
                    </figcaption>
                  </figure>
                )}
              </div>
            )}

            {imageError && (
              <p className="text-sm text-destructive" data-testid="text-image-error">
                {imageError}
              </p>
            )}
            {form.formState.errors.fullImageFilename && (
              <p className="text-sm text-destructive">
                {form.formState.errors.fullImageFilename.message}
              </p>
            )}

            <div className="pt-1">
              <Select
                onValueChange={(v) => void handleExistingImageChosen(v)}
                value={fullImageFilename}
              >
                <SelectTrigger
                  disabled={isMediaLoading || isProcessingImage}
                  className="h-9 text-sm"
                  data-testid="select-existing-art-image"
                >
                  <SelectValue placeholder="…or pick an image already in the art folder" />
                </SelectTrigger>
                <SelectContent>
                  {selectableArtImages.map(filename => (
                    <SelectItem key={filename} value={filename}>
                      {filename}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-sm text-muted-foreground mt-1.5">
                For images added to the folder by hand. Their{' '}
                <code className="text-[11px]">-thumb</code> companion is found
                automatically.
              </p>
            </div>
          </div>

          <div className="space-y-4 pt-2">
            <div className="flex items-center gap-2">
              <h3 className="font-serif text-lg">Dimensions & Scale</h3>
              <div className="h-px bg-border flex-1 ml-4" />
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <FormField
                control={form.control}
                name="aspectRatio"
                render={({ field }) => (
                  <FormItem>
                    <div className="flex items-center justify-between mb-2">
                      <FormLabel className="mb-0">Aspect Ratio</FormLabel>
                      {autoDetectedRatio && (
                        <Badge variant="secondary" className="text-[10px] h-5 flex items-center gap-1 bg-primary/10 text-primary hover:bg-primary/20 transition-colors">
                          <Wand2 className="w-3 h-3" /> Auto
                        </Badge>
                      )}
                    </div>
                    <FormControl>
                      <Input type="number" step="0.01" {...field} onChange={e => {
                        field.onChange(e);
                        setAutoDetectedRatio(false);
                      }} />
                    </FormControl>
                    <FormDescription>Width / height</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="minScale"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Min Scale</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" {...field} />
                    </FormControl>
                    <FormDescription>0 to 1</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="defaultScale"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Default Scale</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" {...field} />
                    </FormControl>
                    <FormDescription>0 to 1</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="maxScale"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Max Scale</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" {...field} />
                    </FormControl>
                    <FormDescription>0 to 1</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            
            <div className="bg-muted/50 p-4 rounded-md text-sm text-muted-foreground border border-border/50">
              <p>Scale values represent the fraction of the room canvas width the piece occupies.</p>
              <ul className="list-disc pl-5 mt-1 space-y-1">
                <li>0.11 spans 11% of room width (approx. 50cm framed work)</li>
                <li>0.20 spans 20% of room width (approx. 1.2m statement piece)</li>
              </ul>
            </div>
          </div>
        </div>
      </form>
    </Form>
  );
}
