# Living Luxury Lab — Art Placer

A touch-first "digital felt board" where you drag framed artwork and sculptures out of an inventory tray and place them freely inside a carousel of photographed rooms.

## Run & Operate

- `pnpm --filter @workspace/art-placer run dev` — run the Art Placer web app (the only artifact needed for Phase 1)
- `pnpm --filter @workspace/art-placer run typecheck` — typecheck the app
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- No env vars, database, or API server are required for Phase 1.

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Web app: React 19 + Vite 7, Tailwind CSS 4, shadcn/ui, framer-motion, embla-carousel
- State: React Context (`src/state/Store.tsx`), in memory only
- The scaffolded `@workspace/api-server` and Drizzle/Postgres packages are unused by this app.

## Where things live

- `artifacts/art-placer/` — the whole product. See its `README.md` for the asset spec and data shapes.
  - `src/types.ts` — `Room`, `ArtObject`, `Placement` types plus `assetUrl()`
  - `src/data/rooms.ts` / `src/data/objects.ts` — the hardcoded room and inventory catalogues
  - `src/config/branding.ts` — wordmark, short mark, tagline
  - `src/state/Store.tsx` — placements, single-step undo history, selection, drag state
  - `src/hooks/usePointerDrag.ts` — the pointer-capture drag primitive
  - `src/index.css` — theme tokens (warm neutral palette, Playfair Display + Inter)
  - `public/rooms/` (1600×1000 JPGs) and `public/art/` (transparent PNGs, full + `-thumb`)

## Architecture decisions

- **Placement validity is a single Y comparison.** Each room has one `bandSplit` (a % of canvas height): wall art must land above it, sculptures below. No zones, polygons, or hit regions.
- **Pointer Events only, never HTML5 drag-and-drop.** `usePointerDrag` captures the pointer and sets `touch-action`, which is what makes the same code work for mouse and touch.
- **The crosshair is a readability aid, not magnetism.** Objects settle exactly where released; nothing snaps or nudges.
- **Coordinates are percentages of the canvas box**, so placements survive any resize and every screen size.
- **State is deliberately in memory**, but shaped as a flat `Placement[]` so a persistence layer can be dropped in for Phase 2 without touching components.
- **The dragged object renders in a fixed-position layer at the document root**, so it can travel between the tray and the room without either container clipping it.

## Product

- Four rooms in a swipeable carousel, one visible at a time, with prev/next controls and a dot indicator that marks which rooms already hold art.
- A persistent bottom tray of eight unique pieces (six wall works, two sculptures) that scrolls horizontally and has chevrons at each end.
- Drag a piece into a room to place it; the valid band lights up and the invalid one dims. Release in the wrong band and it returns where it came from.
- Placed pieces can be repositioned, returned to the tray, or cleared with single-step undo, reset-this-room, and clear-all (both resets confirm first).
- Accessible alternative to dragging: tap a piece to select it, then tap a valid band to place it.

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- Asset URLs must go through `assetUrl()`. The app is served under a base path, so a leading-slash URL like `/art/foo.png` 404s.
- Room images are exactly 16:10; the canvas enforces that aspect. If you swap in an image with a different ratio it will be cropped and the `bandSplit` line will no longer sit where you expect.
- The room canvas is sized from the leftover viewport height using container query units, so the tray is always reachable without page scroll. Adding fixed-height chrome around it eats into the canvas.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
