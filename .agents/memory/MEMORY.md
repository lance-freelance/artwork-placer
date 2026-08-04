# Memory index

- [Art Placer interaction rules](art-placer-interaction-rules.md) — pointer events only, one-Y-comparison band validity, crosshair never snaps; canvas is a matted 16:10 box (never full-bleed) and controls pin to the matte gutter.
- [Art Placer content layer](art-placer-content-layer.md) — Replit DB over plain HTTP, why a static artifact borrows api-server, and never persisting a placement's band.
- [Monorepo typechecking](monorepo-typecheck.md) — always use root `pnpm run typecheck`; a bare per-artifact tsc reads stale lib dist `.d.ts` and invents phantom errors.
