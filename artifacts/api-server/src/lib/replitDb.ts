import { readFile } from "node:fs/promises";

/**
 * Minimal Replit DB client.
 *
 * Replit DB is an HTTP key/value store, so it needs no driver. Values are
 * stored as JSON text — structured metadata only, never binary image data.
 */

/**
 * The database URL is rotated periodically. The current one is always written
 * to this file, so a stale value in the environment can be recovered from.
 */
const DB_URL_FILE = "/tmp/replitdb";

let cachedUrl: string | null = process.env.REPLIT_DB_URL ?? null;

async function refreshUrl(): Promise<string> {
  const fromFile = (await readFile(DB_URL_FILE, "utf8")).trim();
  if (!fromFile) throw new Error("Replit DB URL is empty");
  cachedUrl = fromFile;
  return fromFile;
}

async function dbUrl(): Promise<string> {
  return cachedUrl ?? (await refreshUrl());
}

/**
 * Runs a request, retrying once against a freshly read URL. Credentials are
 * embedded in the URL, so an expired one fails with an auth status rather
 * than a network error.
 */
async function request(
  path: string,
  init?: RequestInit,
): Promise<Response> {
  const send = async (base: string) => fetch(`${base}${path}`, init);

  let response = await send(await dbUrl());
  if (response.status === 401 || response.status === 403) {
    response = await send(await refreshUrl());
  }
  return response;
}

/** Reads and parses a key. Returns null when the key is absent. */
export async function kvGet<T>(key: string): Promise<T | null> {
  const response = await request(`/${encodeURIComponent(key)}`);
  if (response.status === 404) return null;
  if (!response.ok) {
    throw new Error(`Replit DB read failed for "${key}": ${response.status}`);
  }
  const body = await response.text();
  if (body === "") return null;
  return JSON.parse(body) as T;
}

/** Writes a key as JSON. */
export async function kvSet(key: string, value: unknown): Promise<void> {
  const body = new URLSearchParams({ [key]: JSON.stringify(value) });
  const response = await request("", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  if (!response.ok) {
    throw new Error(`Replit DB write failed for "${key}": ${response.status}`);
  }
}
