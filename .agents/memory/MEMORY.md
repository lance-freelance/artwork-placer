# Memory index

- [Art Placer interaction rules](art-placer-interaction-rules.md) — pointer events only, one-Y-comparison band validity, crosshair never snaps; canvas is a matted 16:10 box (never full-bleed) and controls pin to the matte gutter.
- [Art Placer content layer](art-placer-content-layer.md) — Replit DB over plain HTTP, why a static artifact borrows api-server, never persisting a placement's band, and why uploads must never land in `public/`.
- [Art Placer real-world sizing](art-placer-room-sizing.md) — size derives from physical dimensions over a per-room wall calibration; any room-measuring tool must mirror the board's zoom or it calibrates too wide.
- [Catalog visibility compatibility](room-visibility.md) — missing visibility flags are treated as visible; only explicit false hides a room or art object from the public UX.
- [Monorepo typechecking](monorepo-typecheck.md) — always use root `pnpm run typecheck`; a bare per-artifact tsc reads stale lib dist `.d.ts` and invents phantom errors.
