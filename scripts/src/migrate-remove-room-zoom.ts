import { readFile } from 'node:fs/promises';

/**
 * Re-bases stored room data now that the board shows room photographs exactly
 * as uploaded.
 *
 * The canvas used to render the photo `object-contain` and then scale it up by
 * 1.2, so the visible box was the middle ~83% of the frame. Two stored numbers
 * were measured against that cropped view and are wrong the moment the zoom
 * comes out:
 *
 *   rooms       wallWidthFeet   the box now spans the whole photo, so it
 *                               covers 1.2x more wall than it used to
 *   placements  x / y           percentages of the box, and the photo content
 *                               under them shrinks toward the centre by 1.2
 *
 * Both corrections are the same uniform scale about the centre of the box, so
 * they apply to every room regardless of the photo's shape — a letterboxed
 * photo shrinks about that centre exactly like a full-bleed one.
 *
 * `bandSplit` is deliberately left alone. It was always dragged over an
 * unzoomed preview in the admin panel, so the stored value already describes
 * the photo rather than the zoomed canvas — it was the board that disagreed
 * with it, and removing the zoom is what brings the two into line.
 *
 * Placement `scale` is rewritten from the new wall widths. The board recomputes
 * size at render time and ignores the stored copy; this only stops that copy
 * from contradicting what is on screen.
 *
 * Runs once and once only: applying it twice would inflate every room by 44%,
 * so it records a marker key and refuses to repeat itself.
 *
 * Prints the plan and changes nothing unless passed `--apply`.
 */

/** The zoom the board used to apply to every room photograph. */
const REMOVED_ZOOM = 1.2;

/** Set once the correction has been applied, so a second run is a no-op. */
const MARKER_KEY = 'migrations:room-zoom-removed';

/** Mirrors `EDGE_MARGIN` in the app: how close to the edge an anchor may sit. */
const EDGE_MARGIN = 3;

const APPLY = process.argv.includes('--apply');

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

interface StoredRoom {
  id: string;
  name: string;
  wallWidthFeet?: number;
  [key: string]: unknown;
}

interface StoredArt {
  id: string;
  realWidthInches?: number;
  [key: string]: unknown;
}

interface StoredPlacement {
  objectId: string;
  roomId: string;
  x: number;
  y: number;
  scale?: number;
  [key: string]: unknown;
}

const isPositive = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value > 0;

const round = (value: number, places: number) => {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
};

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

/**
 * Undoes the zoom for a percentage measured across the box. The old view was
 * the middle `1 / zoom` of the photo blown up about the centre, so a feature
 * that sat at `value` slides back toward 50 by the same factor.
 */
const unzoomPercent = (value: number) =>
  clamp(50 + (value - 50) / REMOVED_ZOOM, EDGE_MARGIN, 100 - EDGE_MARGIN);

async function main(): Promise<void> {
  if (await kvGet<boolean>(MARKER_KEY)) {
    console.log(
      'Already migrated: the zoom correction has been applied to this database.',
    );
    return;
  }

  const [rooms, art, placements] = await Promise.all([
    kvGet<StoredRoom[]>('rooms'),
    kvGet<StoredArt[]>('art'),
    kvGet<StoredPlacement[]>('placements'),
  ]);

  if (!rooms || rooms.length === 0) {
    // An empty database is seeded by the server with widths that already
    // measure the whole photo, so mark it done rather than leaving it exposed
    // to a later run that would inflate those seeded values.
    console.log('Nothing to migrate: the catalog is empty (it will be seeded).');
    if (APPLY) await kvSet(MARKER_KEY, true);
    return;
  }

  const nextRooms = rooms.map((room) => {
    if (!isPositive(room.wallWidthFeet)) return room;
    return {
      ...room,
      wallWidthFeet: round(room.wallWidthFeet * REMOVED_ZOOM, 2),
    };
  });

  for (const [i, room] of nextRooms.entries()) {
    console.log(
      `  room  ${room.id.padEnd(24)} wallWidthFeet ` +
        `${rooms[i].wallWidthFeet} -> ${room.wallWidthFeet}` +
        `   bandSplit ${room.bandSplit} (unchanged)`,
    );
  }

  const nextPlacements = (placements ?? []).map((placement) => {
    const x = round(unzoomPercent(placement.x), 4);
    const y = round(unzoomPercent(placement.y), 4);

    const piece = art?.find((a) => a.id === placement.objectId);
    const room = nextRooms.find((r) => r.id === placement.roomId);
    const scale =
      isPositive(piece?.realWidthInches) && isPositive(room?.wallWidthFeet)
        ? piece.realWidthInches / 12 / room.wallWidthFeet
        : placement.scale;

    console.log(
      `  place ${placement.objectId.padEnd(24)} in ${placement.roomId.padEnd(16)} ` +
        `(${round(placement.x, 1)}, ${round(placement.y, 1)}) -> (${round(x, 1)}, ${round(y, 1)})`,
    );

    return { ...placement, x, y, ...(scale === undefined ? {} : { scale }) };
  });

  if (!APPLY) {
    console.log(
      `\nDry run: ${nextRooms.length} room(s) and ${nextPlacements.length} ` +
        'placement(s) would change. Re-run with --apply to write them.',
    );
    return;
  }

  await Promise.all([
    kvSet('rooms', nextRooms),
    nextPlacements.length > 0
      ? kvSet('placements', nextPlacements)
      : Promise.resolve(),
  ]);
  // Written last: a marker set before the data would strand a half-applied
  // migration with no way to finish it.
  await kvSet(MARKER_KEY, true);

  console.log(
    `\nMigrated ${nextRooms.length} room(s) and ${nextPlacements.length} placement(s).`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
