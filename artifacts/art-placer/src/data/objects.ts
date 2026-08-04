import type { ArtObject } from '@/types';

/**
 * Phase 1: hardcoded placeholder inventory, shaped exactly as it will be read
 * from the database in Phase 2.
 *
 * All files live in `/public/art/` as transparent PNGs. `aspectRatio` is
 * width / height. `defaultScale` is expressed as a fraction of the room canvas
 * width the object should occupy at rest.
 *
 * Scales are calibrated against the furniture in the room photographs: a full
 * canvas width reads as roughly 4.2m of room, so 1m ≈ 0.24 of canvas width.
 * The comment on each piece is the real-world size it is meant to suggest.
 */
export const artObjects: ArtObject[] = [
  {
    id: 'art-portrait-figure',
    name: 'Seated Figure, No. 4',
    type: 'wall',
    thumbnailFilename: 'art-portrait-figure-thumb.png',
    fullImageFilename: 'art-portrait-figure.png',
    aspectRatio: 0.65,
    // ~50cm wide framed work
    defaultScale: 0.11,
    minScale: 0.06,
    maxScale: 0.22,
  },
  {
    id: 'art-landscape-meadow',
    name: 'Meadow at Dusk',
    type: 'wall',
    thumbnailFilename: 'art-landscape-meadow-thumb.png',
    fullImageFilename: 'art-landscape-meadow.png',
    aspectRatio: 1.23,
    // ~70cm wide landscape in a heavy gilt frame
    defaultScale: 0.16,
    minScale: 0.09,
    maxScale: 0.3,
  },
  {
    id: 'art-square-abstract',
    name: 'Black Form',
    type: 'wall',
    thumbnailFilename: 'art-square-abstract-thumb.png',
    fullImageFilename: 'art-square-abstract.png',
    aspectRatio: 0.93,
    // ~55cm square canvas
    defaultScale: 0.12,
    minScale: 0.07,
    maxScale: 0.24,
  },
  {
    id: 'art-oversized-monochrome',
    name: 'Ink Study (Oversized)',
    type: 'wall',
    thumbnailFilename: 'art-oversized-monochrome-thumb.png',
    fullImageFilename: 'art-oversized-monochrome.png',
    aspectRatio: 0.71,
    // ~85cm wide, ~1.2m tall — the statement piece, without swallowing the wall
    defaultScale: 0.2,
    minScale: 0.12,
    maxScale: 0.34,
  },
  {
    id: 'art-oval-portrait',
    name: 'Portrait of a Woman',
    type: 'wall',
    thumbnailFilename: 'art-oval-portrait-thumb.png',
    fullImageFilename: 'art-oval-portrait.png',
    aspectRatio: 0.76,
    // ~40cm oval portrait
    defaultScale: 0.09,
    minScale: 0.05,
    maxScale: 0.18,
  },
  {
    id: 'art-small-sketch',
    name: 'Line Study',
    type: 'wall',
    thumbnailFilename: 'art-small-sketch-thumb.png',
    fullImageFilename: 'art-small-sketch.png',
    aspectRatio: 0.62,
    // ~30cm sketch, the smallest piece in the collection
    defaultScale: 0.07,
    minScale: 0.04,
    maxScale: 0.15,
  },
  {
    id: 'sculpture-stone-form',
    name: 'Travertine Loop',
    type: 'sculpture',
    thumbnailFilename: 'sculpture-stone-form-thumb.png',
    fullImageFilename: 'sculpture-stone-form.png',
    aspectRatio: 0.53,
    // ~70cm tall stone form on its plinth
    defaultScale: 0.08,
    minScale: 0.05,
    maxScale: 0.16,
  },
  {
    id: 'sculpture-bronze-figure',
    name: 'Bronze Reclining Figure',
    type: 'sculpture',
    thumbnailFilename: 'sculpture-bronze-figure-thumb.png',
    fullImageFilename: 'sculpture-bronze-figure.png',
    aspectRatio: 1.32,
    // ~45cm long reclining bronze
    defaultScale: 0.1,
    minScale: 0.06,
    maxScale: 0.2,
  },
];
