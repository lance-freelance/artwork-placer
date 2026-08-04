# Living Luxury Lab — Art Placer

A responsive, touch-first single-page app that works like a digital felt board: swipe
through a carousel of rooms and drag framed artworks and sculptures onto the walls and
floor.

## Run

The app runs from its managed workflow (`artifacts/art-placer: web`) with a single start
command:

```bash
pnpm --filter @workspace/art-placer run dev
```

## Phase 1 scope

- Placement state lives in memory only. It survives room navigation, not a page refresh.
- All room and object data is hardcoded in `src/data/`, shaped exactly as it will be read
  from the database in Phase 2, so the data modules can be swapped for a query layer
  without touching components.

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
auto-detection or validation in Phase 1 — conform to the published spec.

| File                | Room          |
| ------------------- | ------------- |
| `living-room.jpg`   | Living Room   |
| `loft.jpg`          | Loft          |
| `office.jpg`        | Office        |
| `primary-suite.jpg` | Primary Suite |

Rooms should be photographed straight on at eye level with bare walls, so there is room to
place art.

### Art and sculpture images — `public/art/`

Transparent PNGs, trimmed flush to the object with no surrounding padding or baked-in
shadow. Two files per object:

- `<id>.png` — full image, longest edge 900 px
- `<id>-thumb.png` — tray thumbnail, longest edge 320 px

Each object's `aspectRatio` in `src/data/objects.ts` must match its image
(`width / height`). `defaultScale`, `minScale` and `maxScale` are fractions of the room
canvas width the object occupies.

## Data shapes

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

// Placement (in-memory in Phase 1)
{ objectId: string, roomId: string, x: number, y: number, scale: number, band: 'wall' | 'sculpture' }
```

## Branding

The wordmark shown in the top corner comes from `src/config/branding.ts`. It is a
configurable label, not hardcoded copy — swap it there (or feed it from a CMS later).

## Adding a room or object

1. Drop the image into `public/rooms/` or `public/art/`, conforming to the spec above.
2. Add an entry to `src/data/rooms.ts` or `src/data/objects.ts`.

Nothing else needs to change.

## Phase 2 (not built)

Persistence. The placement store is isolated behind a narrow interface in `src/state/`, so
a persistence layer can be swapped in without rewriting components.
