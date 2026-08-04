# Living Luxury Lab — Art Placer

A touch-first "digital felt board" where you drag framed artwork and sculptures out of an inventory tray and place them freely inside a carousel of photographed rooms.

## Run & Operate

- Both managed workflows must run: `artifacts/art-placer: web` (the app) and `artifacts/api-server: API Server` (its content API). The app reads everything it renders from the API.
- `pnpm --filter @workspace/api-spec run codegen` — regenerate the API client and Zod schemas after editing `lib/api-spec/openapi.yaml`
- `pnpm --filter @workspace/art-placer run typecheck` — typecheck the app
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- No secrets are required. Replit DB is reached over `REPLIT_DB_URL`, which the environment provides.

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Web app: React 19 + Vite 7, Tailwind CSS 4, shadcn/ui, framer-motion, embla-carousel, wouter, TanStack Query
- API: Express 5 (`@workspace/api-server`), contract-first from `lib/api-spec/openapi.yaml`
- Storage: Replit DB (key/value over HTTP) holding structured metadata only — never image bytes. Postgres and Drizzle are scaffolded but unused.

## Where things live

- `lib/api-spec/openapi.yaml` — the single source of truth for the API contract. Codegen produces `@workspace/api-zod` (server validation) and `@workspace/api-client-react` (query hooks).
- `artifacts/api-server/` — the content API behind `/api`.
  - `src/lib/replitDb.ts` — the whole Replit DB client: HTTP GET/POST against `REPLIT_DB_URL`, no driver
  - `src/lib/catalog.ts` — one DB key per collection (`rooms`, `art`, `placements`), id generation, first-run seeding
  - `src/lib/media.ts` — lists the image files actually on disk in the app's `public/` directories
  - `src/data/seed.ts` — the collection a fresh repl starts with
  - `src/routes/{catalog,media,placements}.ts`
- `artifacts/art-placer/` — the whole product. See its `README.md` for the asset spec and data shapes.
  - `src/types.ts` — re-exports the generated `Room`, `ArtObject`, `Placement` types plus `assetUrl()`
  - `src/pages/admin/` — the unlisted admin panel at `/admin`
  - `src/config/branding.ts` — wordmark, short mark, tagline
  - `src/state/Store.tsx` — placements, the undo stack, selection, drag state
  - `src/hooks/usePointerDrag.ts` — the pointer-capture drag primitive
  - `src/index.css` — theme tokens (warm neutral palette, Playfair Display + Inter)
  - `src/pages/admin/imageTools.ts` — canvas resizing that turns one upload into an image + thumbnail
  - `public/rooms/` (1600×1000 JPGs) and `public/art/` (transparent PNGs, full + `-thumb`)

## Architecture decisions

- **Placement validity is a single Y comparison.** Each room has one `bandSplit` (a % of canvas height): wall art must land above it, sculptures below. No zones, polygons, or hit regions.
- **Pointer Events only, never HTML5 drag-and-drop.** `usePointerDrag` captures the pointer and sets `touch-action`, which is what makes the same code work for mouse and touch.
- **The crosshair is a readability aid, not magnetism.** Objects settle exactly where released; nothing snaps or nudges.
- **Coordinates are percentages of the canvas box**, so placements survive any resize and every screen size. Drops are clamped so an object's anchor stays inside the frame — the pointer can be over the canvas while the object's centre is not, and an object centred outside the frame is clipped and impossible to grab again.
- **The carousel is not draggable** (`watchDrag: false`). A swipeable carousel binds its own native pointer handlers to the container and steals the pointer mid-placement, stranding the piece being dragged. Rooms change through the controls and dots only.
- **Object scales are calibrated against the furniture in the room photographs** — a full canvas width reads as roughly 4.2m of room, so 1m ≈ 0.24 of canvas width. Each entry in the server's `src/data/seed.ts` notes the real-world size it is meant to suggest.
- **Placement actions call the store directly; there is no event bus.** The active room canvas publishes its element into a ref on the store, and one pure `resolveDrop` in `src/lib/placement.ts` decides what every release means. An earlier window-`CustomEvent` version broke after room navigation — the listener belonged to whichever canvas was active, so interactions silently did nothing.
- **Drag geometry is captured in a ref at drag start**, not read from React state at drag end: a fast flick can reach `pointerup` before React commits the drag-start render.
- **Controls nested inside a draggable piece must stop the gesture** (`stopPropagation` on pointerdown/pointerup). The parent takes pointer capture, which retargets the following click to itself and would otherwise swallow the child button's `onClick`. Hover-revealed controls also need a `[@media(hover:none)]` escape hatch to be reachable on touch.
- **The board owns placements for the session; the server is written to, not read from, after load.** `Store.tsx` reads the saved set once, then holds it — it has undo and reset, so re-reading mid-session would fight the user. Writes are the whole flat `Placement[]`, debounced, and skipped when the serialized set is unchanged.
- **A placement never stores its band.** Which side of the split a piece belongs to is `object.type`, derived at use. Storing it twice lets an admin edit make the two disagree; instead, changing a piece's type on the server clears its placements.
- **Placements referencing a deleted room or piece are dropped on load**, and deletes cascade server-side, so the board can never try to render a piece that no longer exists.
- **The store gates rendering until the catalog has loaded.** Components legitimately assume `rooms.find(...)` succeeds; the provider renders a notice instead of children until it does.
- **The dragged object renders in a fixed-position layer at the document root**, so it can travel between the tray and the room without either container clipping it.

## Product

- Four rooms in a carousel, one visible at a time, changed with prev/next controls and a dot indicator that marks which rooms already hold art.
- A persistent bottom tray of eight unique pieces (six wall works, two sculptures) that scrolls horizontally and has chevrons at each end.
- Drag a piece into a room to place it; the valid band lights up and the invalid one dims. Release in the wrong band and it returns where it came from.
- Placed pieces can be repositioned, returned to the tray, or cleared with undo, reset-this-room, and clear-all (both resets confirm first). Undo steps back through every action of the session, and travels to the room an action happened in so the change is visible.
- Accessible alternative to dragging: tap a piece to select it, then tap a valid band to place it.
- Placements survive a page refresh; the arrangement is per-installation, not per-visitor.
- The rooms and the inventory are curated in the unlisted `/admin` panel, not in code. It is a hand-built form interface over the same API. Room images are dropped into `public/rooms/` by hand and the picker lists whatever is on disk. An art piece takes a single upload: the panel scales it down in a canvas to make the tray thumbnail, and the server writes the pair into `public/art/`.

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- Asset URLs must go through `assetUrl()`. The app is served under a base path, so a leading-slash URL like `/art/foo.png` 404s.
- `/admin` has no authentication and is unlinked by design. Anyone with the URL can edit the collection.
- The image pickers list what is on disk at request time, so a file dropped into `public/rooms/` or `public/art/` is selectable immediately — but adding a file is only half the job; the record still has to be created in `/admin`.
- Art uploads write straight into the repo's `public/art/`, which is right for curating in the workspace but not for a published deployment: the container filesystem is ephemeral, so anything uploaded to a live deployment is lost on the next restart. Curate here, then publish.
- Room images are exactly 16:10; the canvas enforces that aspect. If you swap in an image with a different ratio it will be cropped and the `bandSplit` line will no longer sit where you expect.
- The room canvas is sized from the leftover viewport height using container query units, so the tray is always reachable without page scroll. Adding fixed-height chrome around it eats into the canvas.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
