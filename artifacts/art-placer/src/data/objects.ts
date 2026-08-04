import type { ArtObject } from '@/types';

/**
 * Phase 1: hardcoded placeholder inventory, shaped exactly as it will be read
 * from the database in Phase 2.
 *
 * All files live in `/public/art/` as transparent PNGs. `aspectRatio` is
 * width / height. `defaultScale` is expressed as a fraction of the room canvas
 * width the object should occupy at rest.
 */
export const artObjects: ArtObject[] = [
  {
    id: 'art-portrait-figure',
    name: 'Seated Figure, No. 4',
    type: 'wall',
    thumbnailFilename: 'art-portrait-figure-thumb.png',
    fullImageFilename: 'art-portrait-figure.png',
    aspectRatio: 0.65,
    defaultScale: 0.13,
    minScale: 0.07,
    maxScale: 0.24,
  },
  {
    id: 'art-landscape-meadow',
    name: 'Meadow at Dusk',
    type: 'wall',
    thumbnailFilename: 'art-landscape-meadow-thumb.png',
    fullImageFilename: 'art-landscape-meadow.png',
    aspectRatio: 1.23,
    defaultScale: 0.18,
    minScale: 0.09,
    maxScale: 0.32,
  },
  {
    id: 'art-square-abstract',
    name: 'Black Form',
    type: 'wall',
    thumbnailFilename: 'art-square-abstract-thumb.png',
    fullImageFilename: 'art-square-abstract.png',
    aspectRatio: 0.93,
    defaultScale: 0.14,
    minScale: 0.08,
    maxScale: 0.28,
  },
  {
    id: 'art-oversized-monochrome',
    name: 'Ink Study (Oversized)',
    type: 'wall',
    thumbnailFilename: 'art-oversized-monochrome-thumb.png',
    fullImageFilename: 'art-oversized-monochrome.png',
    aspectRatio: 0.71,
    defaultScale: 0.26,
    minScale: 0.15,
    maxScale: 0.42,
  },
  {
    id: 'art-oval-portrait',
    name: 'Portrait of a Woman',
    type: 'wall',
    thumbnailFilename: 'art-oval-portrait-thumb.png',
    fullImageFilename: 'art-oval-portrait.png',
    aspectRatio: 0.76,
    defaultScale: 0.1,
    minScale: 0.06,
    maxScale: 0.2,
  },
  {
    id: 'art-small-sketch',
    name: 'Line Study',
    type: 'wall',
    thumbnailFilename: 'art-small-sketch-thumb.png',
    fullImageFilename: 'art-small-sketch.png',
    aspectRatio: 0.62,
    defaultScale: 0.08,
    minScale: 0.05,
    maxScale: 0.16,
  },
  {
    id: 'sculpture-stone-form',
    name: 'Travertine Loop',
    type: 'sculpture',
    thumbnailFilename: 'sculpture-stone-form-thumb.png',
    fullImageFilename: 'sculpture-stone-form.png',
    aspectRatio: 0.53,
    defaultScale: 0.11,
    minScale: 0.06,
    maxScale: 0.22,
  },
  {
    id: 'sculpture-bronze-figure',
    name: 'Bronze Reclining Figure',
    type: 'sculpture',
    thumbnailFilename: 'sculpture-bronze-figure-thumb.png',
    fullImageFilename: 'sculpture-bronze-figure.png',
    aspectRatio: 1.32,
    defaultScale: 0.13,
    minScale: 0.07,
    maxScale: 0.24,
  },
];
