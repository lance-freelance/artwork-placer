# Living Luxury Lab — Art Placer

A responsive, touch-first single-page app that works like a digital felt board: move
through a carousel of rooms and drag framed artworks and sculptures onto the walls and
floor.

Note: the carousel is deliberately **not** swipeable. Rooms change only through the
prev/next controls and the room dots — a draggable carousel competes with dragging art,
stealing the pointer mid-placement and stranding the piece.

## Run

The app runs from its managed workflow (`artifacts/art-placer: web`) with a single start
command:

```bash
pnpm --filter @workspace/art-placer run dev
```

It reads all of its content from the API server, so the `artifacts/api-server: API Server`
workflow must be running too.

## Content and persistence

Nothing about the collection is hardcoded. Rooms, art objects and placements are stored as
structured metadata in Replit DB and read over the API at load:

- `GET /api/rooms`, `GET /api/art` — the catalog the board renders
- `GET /api/placements`, `PUT /api/placements` — where every piece sits; the board writes
  the whole set back, debounced, after each change, so placements survive a refresh
- `GET /api/media` — the image filenames actually present on disk
- `POST /api/media/art` — writes an uploaded artwork and its generated thumbnail

Only metadata is stored. Image files are never held in the database — they live in
`public/rooms/` and `public/art/`. Room images are dropped in by hand through Replit's
file browser; art images can be dropped in the same way or uploaded through the admin
panel, which writes them into the same directory.

## Admin panel — `/admin`

An unlisted route. It is never linked from the experience; reach it by typing the URL.
There is no authentication, so treat the deployed URL as the only thing keeping it
private.

- **Rooms** — name, a picker of the room images found on disk, and the band split, set by
  dragging a horizontal line across a live 16:10 preview of the chosen image.
- **Art Catalog** — name, type (wall or sculpture), **one** image, aspect ratio
  (auto-detected from the image's natural dimensions, and editable afterwards), and the
  three scale values.
- Both tabs list what already exists with edit and delete. Deleting a room or a piece also
  clears the placements that referenced it.

### One image per piece

A piece needs a full-size image and a tray thumbnail, but the admin only ever supplies
one file. On upload the panel draws the image into an off-screen canvas, scales it to 360
px on its longest edge, and sends both to the server, which writes them side by side:

```
harbour-study.png        the image as uploaded
harbour-study-thumb.webp generated, typically ~1% of the size
```

The scaling is done in the browser deliberately: it keeps the API to plain JSON and means
no image-processing library has to be installed on the server or kept current. WebP is
requested because the artwork is transparent and it is far smaller than PNG; a browser
that cannot encode it produces a PNG instead, and the server reads the actual type off
the data URL, so the stored extension is always honest.

The server owns the filenames. The base name is slugified from the piece's name, so it
can never escape the art directory, and a suffix is added rather than overwriting an
image that already exists.

Images already sitting in `public/art/` can still be chosen from the picker below the
upload button — that is how the shipped collection is edited. Their `-thumb` companion is
found by convention; a file without one stands in as its own thumbnail.

Uploading writes the files immediately, so abandoning the form without saving can leave a
pair of unreferenced images in the directory. They are harmless — delete them from the
file browser.

## Placement rule — banding

Each room defines a single `bandSplit` (0–100, a percentage of canvas height):

- **Wall art** may only be placed **above** the `bandSplit` line.
- **Sculptures** may only be placed **below** it.

There are no zone rectangles or polygons — validity is a single Y-coordinate comparison.
Within a valid band, placement is completely freeform: the dashed crosshair shown while
dragging is a readability aid that previews where the object will land, not a snap target.

Placed positions are stored as percentages of the canvas (`x`, `y`), so placements stay
correct across viewport sizes and orientation changes.

## Asset specs

### Room images — `public/rooms/`

**1600 × 1000 px, 16:10, JPEG.** All room images must conform to this spec. There is no
auto-detection or validation — conform to the published spec, or the image will be cropped
and the band split line will not sit where the preview showed it.

Rooms should be photographed straight on at eye level with bare walls, so there is room to
place art.

### Art and sculpture images — `public/art/`

Transparent PNGs, trimmed flush to the object with no surrounding padding or baked-in
shadow, longest edge around 900 px. Supply one file per object and let the admin panel
generate the `-thumb` companion; only images added to the directory by hand need their
own thumbnail, following the same `<name>-thumb.<ext>` convention.

`aspectRatio` is measured from the image and stored on the record, so replacing the file
on disk with one of a different shape will not update it — re-upload through the panel,
or correct the number by hand. `defaultScale`, `minScale` and `maxScale` are fractions of
the room canvas width the object occupies.

## Data shapes

Owned by the OpenAPI contract in `lib/api-spec/openapi.yaml` and generated from it, so the
board, the admin panel and the server cannot drift apart.

```ts
// Room
{ id: string, name: string, imageFilename: string, bandSplit: number }

// Art / sculpture object
{
  id: string,
  name: string,
  type: 'wall' | 'sculpture',
  thumbnailFilename: string,
  fullImageFilename: string,
  aspectRatio: number,
  defaultScale: number,
  minScale: number,
  maxScale: number
}

// Placement — which band it belongs to is derived from the object's type,
// never stored twice
{ objectId: string, roomId: string, x: number, y: number, scale: number }
```

Ids are generated on the server from the name and never change, because placements
reference them.

## Branding

The wordmark shown in the top corner comes from `src/config/branding.ts`. It is a
configurable label, not hardcoded copy.

## Adding a room or object

1. Drop the image into `public/rooms/` or `public/art/`, conforming to the spec above.
2. Open `/admin` and create the record — the new file is already in the picker.

No code change and no rebuild.
