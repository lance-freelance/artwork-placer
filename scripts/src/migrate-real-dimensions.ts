import { readFile } from 'node:fs/promises';

/**
 * Migrates the felt board from abstract canvas scales to real-world sizing.
 *
 * Before this change every room was assumed to be the same width — a single
 * global constant of roughly 4.2m (13.78ft) of wall across the canvas — and
 * each artwork stored the fraction of that canvas it should occupy. Rooms are
 * now calibrated individually and pieces carry their true physical
 * dimensions, so the two have to be prised apart in the stored data:
 *
 *   rooms  gain  wallWidthFeet
 *   art    swaps aspectRatio/defaultScale/minScale/maxScale
 *          for   realWidthInches/realHeightInches/resizeRangePercent
 *
 * Safe to run more than once: records that already carry the new fields are
 * left untouched, so this can be pointed at a database that is half-migrated
 * or fully migrated without doing damage.
 */

/** The global wall width the app assumed before rooms were calibrated. */
const LEGACY_WALL_WIDTH_FEET = 13.78;

/** The house default: ±20% around a piece's true size. */
const DEFAULT_RESIZE_RANGE_PERCENT = 20;

/**
 * Real sizes for the shipped collection, converted from the centimetre
 * figures each piece was originally specified in. Preferred over
 * back-computing from the old scale, which only ever encoded how large the
 * piece looked rather than how large it is.
 */
const KNOWN_ART_INCHES: Record<string, { width: number; height: number }> = {
  'art-portrait-figure': { width: 19.7, height: 30.3 },
  'art-landscape-meadow': { width: 27.6, height: 22.4 },
  'art-square-abstract': { width: 21.7, height: 23.3 },
  'art-oversized-monochrome': { width: 33.5, height: 47.2 },
  'art-oval-portrait': { width: 15.7, height: 20.7 },
  'art-small-sketch': { width: 11.8, height: 19 },
  'sculpture-stone-form': { width: 14.6, height: 27.6 },
  'sculpture-bronze-figure': { width: 17.7, height: 13.4 },
};

/**
 * Back-wall widths read off furniture of known size in each photograph, then
 * reduced by the board's 1.2x zoom: the canvas shows the middle ~83% of the
 * photo, so the wall the visitor actually sees is narrower than the wall in
 * the file. These are starting points — the calibration tool in the admin
 * panel exists so they can be corrected against the real rooms.
 */
const KNOWN_ROOM_WALL_FEET: Record<string, number> = {
  'living-room': 12.5,
  loft: 15,
  office: 11.25,
  'primary-suite': 12.9,
};

/* ------------------------------- Replit DB -------------------------------- */

const DB_URL_FILE = '/tmp/replitdb';
let cachedUrl: string | null = process.env.REPLIT_DB_URL ?? null;

async function dbUrl(): Promise<string> {
  if (cachedUrl) return cachedUrl;
  const fromFile = (await readFile(DB_URL_FILE, 'utf8')).trim();
  if (!fromFile) throw new Error('Replit DB URL is empty');
  cachedUrl = fromFile;
  return fromFile;
}

async function kvGet<T>(key: string): Promise<T | null> {
  const response = await fetch(`${await dbUrl()}/${encodeURIComponent(key)}`);
  if (response.status === 404) return null;
  if (!response.ok) {
    throw new Error(`Replit DB read failed for "${key}": ${response.status}`);
  }
  const body = await response.text();
  return body === '' ? null : (JSON.parse(body) as T);
}

async function kvSet(key: string, value: unknown): Promise<void> {
  const response = await fetch(await dbUrl(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ [key]: JSON.stringify(value) }).toString(),
  });
  if (!response.ok) {
    throw new Error(`Replit DB write failed for "${key}": ${response.status}`);
  }
}

/* -------------------------------- migration ------------------------------- */

interface LegacyArt {
  id: string;
  name: string;
  aspectRatio?: number;
  defaultScale?: number;
  minScale?: number;
  maxScale?: number;
  realWidthInches?: number;
  realHeightInches?: number;
  resizeRangePercent?: number;
  [key: string]: unknown;
}

interface LegacyRoom {
  id: string;
  name: string;
  wallWidthFeet?: number;
  [key: string]: unknown;
}

interface StoredPlacement {
  objectId: string;
  roomId: string;
  scale?: number;
  [key: string]: unknown;
}

function migrateRoom(room: LegacyRoom): { room: LegacyRoom; changed: boolean } {
  if (typeof room.wallWidthFeet === 'number' && room.wallWidthFeet > 0) {
    return { room, changed: false };
  }
  const wallWidthFeet = KNOWN_ROOM_WALL_FEET[room.id] ?? LEGACY_WALL_WIDTH_FEET;
  return { room: { ...room, wallWidthFeet }, changed: true };
}

const isPositive = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value > 0;

function migrateArt(art: LegacyArt): { art: LegacyArt; changed: boolean } {
  // Legacy keys are stripped even from an already-migrated record, so a
  // half-migrated database converges rather than keeping dead fields forever.
  const { aspectRatio, defaultScale, minScale, maxScale, ...rest } = art;
  const hadLegacyKeys =
    aspectRatio !== undefined ||
    defaultScale !== undefined ||
    minScale !== undefined ||
    maxScale !== undefined;

  // Each new field is filled only when it is actually missing. A record that
  // already carries real dimensions has been measured — by an earlier run or
  // by hand in the admin panel — and those figures always win over anything
  // derived here, even if only one of the three fields made it in last time.
  const hasWidth = isPositive(rest.realWidthInches);
  const hasHeight = isPositive(rest.realHeightInches);
  // Checked against the range the API actually accepts, not merely "is a
  // number": a corrupt negative or out-of-range value left in place would be
  // written straight back and then fail response validation on every read.
  const hasRange =
    typeof rest.resizeRangePercent === 'number' &&
    Number.isFinite(rest.resizeRangePercent) &&
    rest.resizeRangePercent >= 0 &&
    rest.resizeRangePercent <= 100;

  if (hasWidth && hasHeight && hasRange) {
    return { art: rest as LegacyArt, changed: hadLegacyKeys };
  }

  const known = KNOWN_ART_INCHES[art.id];
  const ratio = isPositive(aspectRatio) ? aspectRatio : 1;

  let derivedWidth: number;
  let derivedHeight: number;

  if (known) {
    derivedWidth = known.width;
    derivedHeight = known.height;
  } else {
    // An admin-added piece: the only record of its size is how large it was
    // drawn, so read that back through the constant it was drawn against.
    const scale = isPositive(defaultScale) ? defaultScale : 0.15;
    derivedWidth = Math.round(scale * LEGACY_WALL_WIDTH_FEET * 12 * 10) / 10;
    derivedHeight = Math.round((derivedWidth / ratio) * 10) / 10;
  }

  const width = hasWidth ? (rest.realWidthInches as number) : derivedWidth;
  // If a width survived but a height did not, prefer a height consistent with
  // that surviving width rather than an unrelated derived pair.
  const height = hasHeight
    ? (rest.realHeightInches as number)
    : hasWidth
      ? Math.round((width / ratio) * 10) / 10
      : derivedHeight;

  return {
    art: {
      ...rest,
      realWidthInches: width,
      realHeightInches: height,
      resizeRangePercent: hasRange
        ? (rest.resizeRangePercent as number)
        : DEFAULT_RESIZE_RANGE_PERCENT,
    },
    changed: true,
  };
}

async function main(): Promise<void> {
  const [rooms, art, placements] = await Promise.all([
    kvGet<LegacyRoom[]>('rooms'),
    kvGet<LegacyArt[]>('art'),
    kvGet<StoredPlacement[]>('placements'),
  ]);

  if (!rooms || !art) {
    console.log('Nothing to migrate: the catalog is empty (it will be seeded).');
    return;
  }

  const migratedRooms = rooms.map(migrateRoom);
  const migratedArt = art.map(migrateArt);

  const roomsChanged = migratedRooms.filter((r) => r.changed).length;
  const artChanged = migratedArt.filter((a) => a.changed).length;

  const nextRooms = migratedRooms.map((r) => r.room);
  const nextArt = migratedArt.map((a) => a.art);

  for (const room of nextRooms) {
    console.log(`  room  ${room.id.padEnd(32)} wallWidthFeet=${room.wallWidthFeet}`);
  }
  for (const piece of nextArt) {
    console.log(
      `  art   ${piece.id.padEnd(32)} ${piece.realWidthInches}" x ${piece.realHeightInches}"`,
    );
  }

  // Placements keep a stored `scale`, but it is no longer what the board
  // renders from — size is recomputed live so recalibrating a room resizes
  // what is already hanging in it. Rewriting it here just stops the stored
  // copy from contradicting what is on screen.
  let placementsChanged = 0;
  const nextPlacements = (placements ?? []).map((placement) => {
    const piece = nextArt.find((a) => a.id === placement.objectId);
    const room = nextRooms.find((r) => r.id === placement.roomId);
    if (!piece?.realWidthInches || !room?.wallWidthFeet) return placement;

    const scale = piece.realWidthInches / 12 / room.wallWidthFeet;
    if (placement.scale === scale) return placement;
    placementsChanged += 1;
    return { ...placement, scale };
  });

  await Promise.all([
    roomsChanged > 0 ? kvSet('rooms', nextRooms) : Promise.resolve(),
    artChanged > 0 ? kvSet('art', nextArt) : Promise.resolve(),
    placementsChanged > 0 ? kvSet('placements', nextPlacements) : Promise.resolve(),
  ]);

  console.log(
    `\nMigrated ${roomsChanged} room(s), ${artChanged} artwork(s), ` +
      `${placementsChanged} placement(s). ${nextPlacements.length} placement(s) preserved.`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
