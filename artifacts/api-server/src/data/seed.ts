import type { ArtObject, Room } from "@workspace/api-zod";

/**
 * The collection the app ships with. Written to Replit DB the first time the
 * server starts against an empty database, so a fresh repl has something to
 * place. Once seeded, the admin panel is the only thing that edits it.
 *
 * Pieces carry their true physical dimensions in inches. How large each one
 * draws is worked out at render time against the room's own `wallWidthFeet`,
 * so the same artwork reads correctly in rooms photographed at different
 * fields of view. Each figure below was read off furniture of known size in
 * the photograph — the sofa, the desk, the headboard — and measures the whole
 * frame, because the board shows the photograph exactly as uploaded. They are
 * starting points the calibration tool in the admin panel is meant to refine
 * against the real rooms.
 */

/*
 * `referenceLengthFeet` is the furniture each width above was read off, so the
 * calibration tool opens on the object the estimate actually came from rather
 * than a door frame nobody measured. It is the reference, not the width: the
 * two agree by construction, since the width is the reference divided by the
 * fraction of the frame it spans.
 */
export const seedRooms: Room[] = [
  // Curved bouclé sofa (~8'4") spans a little over half the frame.
  { id: "living-room", name: "Living Room", imageFilename: "living-room.jpg", bandSplit: 58, wallWidthFeet: 15, referenceLengthFeet: 8.3333 },
  // Widest of the four: a 4'6" console reads as only a quarter of the frame.
  { id: "loft", name: "Loft", imageFilename: "loft.jpg", bandSplit: 62, wallWidthFeet: 18, referenceLengthFeet: 4.5 },
  // Tightest: the executive desk (~7') fills more than half the width.
  { id: "office", name: "Office", imageFilename: "office.jpg", bandSplit: 55, wallWidthFeet: 13.5, referenceLengthFeet: 7 },
  // King headboard (~6'8") sits in the wall plane at ~42% of the frame.
  { id: "primary-suite", name: "Primary Suite", imageFilename: "primary-suite.jpg", bandSplit: 60, wallWidthFeet: 15.5, referenceLengthFeet: 6.6667 },
];

/**
 * Dimensions are the real-world sizes the collection was designed around,
 * converted from the centimetre figures each piece was originally specified
 * in. A 20% resize range is the house default: enough to nudge a piece for
 * effect, not enough to misrepresent how large it actually is.
 */
export const seedArt: ArtObject[] = [
  {
    id: "art-portrait-figure",
    name: "Seated Figure, No. 4",
    type: "wall",
    thumbnailFilename: "art-portrait-figure-thumb.png",
    fullImageFilename: "art-portrait-figure.png",
    // ~50cm wide framed work
    realWidthInches: 19.7,
    realHeightInches: 30.3,
    resizeRangePercent: 20,
  },
  {
    id: "art-landscape-meadow",
    name: "Meadow at Dusk",
    type: "wall",
    thumbnailFilename: "art-landscape-meadow-thumb.png",
    fullImageFilename: "art-landscape-meadow.png",
    // ~70cm wide landscape in a heavy gilt frame
    realWidthInches: 27.6,
    realHeightInches: 22.4,
    resizeRangePercent: 20,
  },
  {
    id: "art-square-abstract",
    name: "Black Form",
    type: "wall",
    thumbnailFilename: "art-square-abstract-thumb.png",
    fullImageFilename: "art-square-abstract.png",
    // ~55cm square canvas
    realWidthInches: 21.7,
    realHeightInches: 23.3,
    resizeRangePercent: 20,
  },
  {
    id: "art-oversized-monochrome",
    name: "Ink Study (Oversized)",
    type: "wall",
    thumbnailFilename: "art-oversized-monochrome-thumb.png",
    fullImageFilename: "art-oversized-monochrome.png",
    // ~85cm wide, ~1.2m tall — the statement piece
    realWidthInches: 33.5,
    realHeightInches: 47.2,
    resizeRangePercent: 20,
  },
  {
    id: "art-oval-portrait",
    name: "Portrait of a Woman",
    type: "wall",
    thumbnailFilename: "art-oval-portrait-thumb.png",
    fullImageFilename: "art-oval-portrait.png",
    // ~40cm oval portrait
    realWidthInches: 15.7,
    realHeightInches: 20.7,
    resizeRangePercent: 20,
  },
  {
    id: "art-small-sketch",
    name: "Line Study",
    type: "wall",
    thumbnailFilename: "art-small-sketch-thumb.png",
    fullImageFilename: "art-small-sketch.png",
    // ~30cm sketch, the smallest piece in the collection
    realWidthInches: 11.8,
    realHeightInches: 19,
    resizeRangePercent: 20,
  },
  {
    id: "sculpture-stone-form",
    name: "Travertine Loop",
    type: "sculpture",
    thumbnailFilename: "sculpture-stone-form-thumb.png",
    fullImageFilename: "sculpture-stone-form.png",
    // ~70cm tall stone form on its plinth
    realWidthInches: 14.6,
    realHeightInches: 27.6,
    resizeRangePercent: 20,
  },
  {
    id: "sculpture-bronze-figure",
    name: "Bronze Reclining Figure",
    type: "sculpture",
    thumbnailFilename: "sculpture-bronze-figure-thumb.png",
    fullImageFilename: "sculpture-bronze-figure.png",
    // ~45cm long reclining bronze
    realWidthInches: 17.7,
    realHeightInches: 13.4,
    resizeRangePercent: 20,
  },
];
