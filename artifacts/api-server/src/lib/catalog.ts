import type { ArtObject, Placement, Room } from "@workspace/api-zod";
import { kvGet, kvSet } from "./replitDb";
import { logger } from "./logger";
import { seedArt, seedRooms } from "../data/seed";

/**
 * The persisted content of the felt board.
 *
 * Each collection lives under one Replit DB key rather than one key per
 * record: the collections are small, and a single key preserves the display
 * order of rooms and the tray without a separate index.
 */

const ROOMS_KEY = "rooms";
const ART_KEY = "art";
const PLACEMENTS_KEY = "placements";

export const getRooms = async (): Promise<Room[]> =>
  (await kvGet<Room[]>(ROOMS_KEY)) ?? [];

export const getArt = async (): Promise<ArtObject[]> =>
  (await kvGet<ArtObject[]>(ART_KEY)) ?? [];

export const getPlacements = async (): Promise<Placement[]> =>
  (await kvGet<Placement[]>(PLACEMENTS_KEY)) ?? [];

export const setRooms = (rooms: Room[]): Promise<void> =>
  kvSet(ROOMS_KEY, rooms);

export const setArt = (art: ArtObject[]): Promise<void> => kvSet(ART_KEY, art);

export const setPlacements = (placements: Placement[]): Promise<void> =>
  kvSet(PLACEMENTS_KEY, placements);

/**
 * Every mutation is a read-modify-write of a whole collection, and a delete
 * touches two of them. Two overlapping requests would each read the same
 * "before" and the second would erase the first. There is one server process,
 * so chaining the mutations through a single promise is enough to make each
 * one see the previous one's result.
 */
let mutations: Promise<unknown> = Promise.resolve();

export function withCatalogLock<T>(work: () => Promise<T>): Promise<T> {
  const next = mutations.then(work, work);
  // Keep the chain alive even when a caller's work rejects.
  mutations = next.catch(() => undefined);
  return next;
}

/**
 * Turns a name into a stable, readable id, keeping it unique within its
 * collection. Ids are referenced by placements, so they never change once a
 * record exists.
 */
export function makeId(name: string, taken: string[]): string {
  const base =
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "item";

  if (!taken.includes(base)) return base;
  let suffix = 2;
  while (taken.includes(`${base}-${suffix}`)) suffix += 1;
  return `${base}-${suffix}`;
}

/**
 * Writes the shipped collection the first time the server runs against an
 * empty database, so a fresh repl is not a blank felt board. Never overwrites
 * anything the admin panel has already saved.
 */
export async function seedIfEmpty(): Promise<void> {
  const [rooms, art] = await Promise.all([getRooms(), getArt()]);

  if (rooms.length === 0) {
    await setRooms(seedRooms);
    logger.info({ count: seedRooms.length }, "Seeded rooms");
  }
  if (art.length === 0) {
    await setArt(seedArt);
    logger.info({ count: seedArt.length }, "Seeded art objects");
  }
}
