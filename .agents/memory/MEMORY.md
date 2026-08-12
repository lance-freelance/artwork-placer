# Memory index

- [Art Placer interaction rules](art-placer-interaction-rules.md) — pointer events only, one-Y-comparison band validity, crosshair never snaps; canvas is a matted 16:10 box (never full-bleed) and controls pin to the matte gutter.
- [Art Placer content layer](art-placer-content-layer.md) — Replit DB over plain HTTP, why a static artifact borrows api-server, never persisting a placement's band, and why uploads must never land in `public/`.
- [Art Placer real-world sizing](art-placer-room-sizing.md) — size derives from physical dimensions over a per-room wall calibration; any room-measuring tool must mirror the board's zoom or it calibrates too wide.
- [Art image aspect consistency](art-image-aspect-consistency.md) — alpha trimming cannot correct opaque images; catalog physical dimensions must match the uploaded image's actual orientation.
- [Art Placer reuse policy](art-placer-reuse-policy.md) — allowArtReuse is an availability rule at placement time; hard invariant is one placement per (object, room), enforced server-side and in the live sweep.
- [Catalog visibility compatibility](room-visibility.md) — missing visibility flags are treated as visible; only explicit false hides a room or art object from the public UX.
- [Desktop drag selection](art-placer-desktop-selection.md) — a "stuck blue ghost" on desktop is native ::selection, not drag state; keep preventDefault on pointerdown and select-none on the board.
- [Monorepo typechecking](monorepo-typecheck.md) — always use root `pnpm run typecheck`; a bare per-artifact tsc reads stale lib dist `.d.ts` and invents phantom errors.
