/**
 * Domain types for the felt-board art placement experience.
 *
 * These shapes are deliberately identical to how the data will be read from a
 * persistence layer in Phase 2 — nothing here depends on where the data came
 * from, so the hardcoded data modules in `src/data/` can be swapped for a
 * fetch/query layer without touching any component.
 */

export type ObjectType = 'wall' | 'sculpture';

/** A room the user can place objects into. */
export interface Room {
  id: string;
  name: string;
  /** References `/public/rooms/<file>` — 1600x1000px, 16:10. */
  imageFilename: string;
  /** 0–100, % of canvas height. Wall art above, sculptures below. */
  bandSplit: number;
}

/** A framed artwork or sculpture available in the inventory. */
export interface ArtObject {
  id: string;
  name: string;
  type: ObjectType;
  /** References `/public/art/<file>`. */
  thumbnailFilename: string;
  /** References `/public/art/<file>`. */
  fullImageFilename: string;
  /** width / height */
  aspectRatio: number;
  defaultScale: number;
  minScale: number;
  maxScale: number;
}

/**
 * A single placed object. `x` and `y` are percentages (0–100) of the room
 * canvas so placements stay correct across viewport sizes and orientations.
 */
export interface Placement {
  objectId: string;
  roomId: string;
  x: number;
  y: number;
  scale: number;
  band: ObjectType;
}

/**
 * Resolve a `/public` asset path against the artifact's base URL.
 * Never build these URLs with a leading slash — the app is served under a
 * base path prefix.
 */
export function assetUrl(path: string): string {
  return `${import.meta.env.BASE_URL}${path.replace(/^\//, '')}`;
}
