import { mkdir, readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Reads the image directories the app serves from.
 *
 * Images are managed by hand through the file browser, so the directories are
 * read on every request: dropping a file in makes it selectable in the admin
 * panel with no code change and no restart.
 */

const IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp", ".avif"]);

/**
 * Where the web app's images live. Resolved from this module rather than the
 * working directory, which differs between the dev workflow (the api server
 * package) and production (the repo root). The built app copies `public/`
 * into its output, so either location is a valid answer.
 */
function publicDirCandidates(): string[] {
  const here = path.dirname(fileURLToPath(import.meta.url));
  // dist/ or src/lib/ inside artifacts/api-server, so walk up to artifacts/.
  const artifactsDir = here.includes(`${path.sep}src${path.sep}`)
    ? path.resolve(here, "../../..")
    : path.resolve(here, "../..");
  const app = path.join(artifactsDir, "art-placer");
  return [path.join(app, "public"), path.join(app, "dist", "public")];
}

async function listImages(dir: string): Promise<string[]> {
  try {
    const entries = await readdir(dir);
    const files: string[] = [];
    for (const entry of entries) {
      if (entry.startsWith(".")) continue;
      if (!IMAGE_EXTENSIONS.has(path.extname(entry).toLowerCase())) continue;
      const info = await stat(path.join(dir, entry));
      if (info.isFile()) files.push(entry);
    }
    return files.sort((a, b) => a.localeCompare(b));
  } catch {
    // A missing directory just means nothing has been added yet.
    return [];
  }
}

export async function listMediaFiles(): Promise<{
  rooms: string[];
  art: string[];
}> {
  for (const base of publicDirCandidates()) {
    const [rooms, art] = await Promise.all([
      listImages(path.join(base, "rooms")),
      listImages(path.join(base, "art")),
    ]);
    if (rooms.length > 0 || art.length > 0) return { rooms, art };
  }
  return { rooms: [], art: [] };
}

/* ---------------------------- writing art ---------------------------- */

/** What a browser canvas can hand us, and the extension each is stored under. */
const ENCODABLE = new Map([
  ["image/png", "png"],
  ["image/jpeg", "jpg"],
  ["image/webp", "webp"],
  ["image/avif", "avif"],
]);

/**
 * Generous for a single artwork — they are around 1MB — and deliberately set
 * so the limit is the one that actually bites. Two images travel in one JSON
 * body as base64, which inflates them by a third, so a pair at this size
 * arrives as roughly 16MB and still fits inside the route's 20MB body cap.
 * A larger figure here would be fiction: the parser would reject the request
 * first, with a far less helpful message.
 */
const MAX_IMAGE_BYTES = 6 * 1024 * 1024;

/**
 * The first bytes each format must begin with. The declared type in a data URL
 * is just a claim by the caller, and these files are written into a directory
 * the web server hands out to anyone, so the bytes have to agree with it.
 */
function looksLikeImage(bytes: Buffer, mime: string): boolean {
  const startsWith = (...sig: number[]) =>
    sig.every((byte, i) => bytes[i] === byte);
  const ascii = (offset: number, text: string) =>
    bytes.subarray(offset, offset + text.length).toString("ascii") === text;

  switch (mime) {
    case "image/png":
      return startsWith(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a);
    case "image/jpeg":
      return startsWith(0xff, 0xd8, 0xff);
    case "image/webp":
      return ascii(0, "RIFF") && ascii(8, "WEBP");
    case "image/avif":
      // An ISO base media file: a `ftyp` box whose brand mentions AVIF.
      return ascii(4, "ftyp") && bytes.subarray(8, 24).includes("avif");
    default:
      return false;
  }
}

export class UploadError extends Error {}

interface DecodedImage {
  bytes: Buffer;
  extension: string;
}

/**
 * Turns a `data:` URL into bytes. The type is read from the URL rather than
 * trusted from a filename, because a canvas silently falls back to PNG when
 * asked for a format the browser cannot encode.
 */
function decodeDataUrl(value: string, label: string): DecodedImage {
  const match = /^data:([a-z0-9.+/-]+);base64,(.+)$/i.exec(value.trim());
  if (!match) {
    throw new UploadError(`${label} is not a base64 data URL`);
  }

  const [, mime, payload] = match;
  const extension = ENCODABLE.get(mime.toLowerCase());
  if (!extension) {
    throw new UploadError(`${label} is a ${mime}, which is not a usable image`);
  }

  const bytes = Buffer.from(payload, "base64");
  if (bytes.length === 0) throw new UploadError(`${label} is empty`);
  if (bytes.length > MAX_IMAGE_BYTES) {
    throw new UploadError(
      `${label} is ${Math.round(bytes.length / 1024 / 1024)}MB, over the ${MAX_IMAGE_BYTES / 1024 / 1024}MB limit`,
    );
  }
  if (!looksLikeImage(bytes, mime.toLowerCase())) {
    throw new UploadError(`${label} is not really a ${mime}`);
  }
  return { bytes, extension };
}

/**
 * The file stem is derived from the piece's name, so it arrives as arbitrary
 * text. Everything outside the safe set is dropped rather than escaped: the
 * result can only ever be a plain name in the art directory, with no way to
 * express a path.
 */
function safeStem(baseName: string): string {
  const stem = baseName
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  if (!stem) throw new UploadError("The name has no usable characters in it");
  return stem;
}

/**
 * Saves an uploaded artwork and the thumbnail generated from it.
 *
 * Writes go to the source `public/` directory — the one that lives in the repo
 * and is copied into a build — never to a build output.
 */
export async function saveArtImages(input: {
  baseName: string;
  fullImage: string;
  thumbnail: string;
}): Promise<{ fullImageFilename: string; thumbnailFilename: string }> {
  const full = decodeDataUrl(input.fullImage, "The image");
  const thumb = decodeDataUrl(input.thumbnail, "The thumbnail");

  const dir = path.join(publicDirCandidates()[0], "art");
  await mkdir(dir, { recursive: true });
  const existing = new Set(await readdir(dir).catch(() => []));

  // Both files share a stem, so they are claimed together: a stem is only free
  // if neither the image nor its thumbnail would overwrite something.
  const wanted = safeStem(input.baseName);
  let stem = wanted;
  let suffix = 2;
  while (
    existing.has(`${stem}.${full.extension}`) ||
    existing.has(`${stem}-thumb.${thumb.extension}`)
  ) {
    stem = `${wanted}-${suffix}`;
    suffix += 1;
  }

  const fullImageFilename = `${stem}.${full.extension}`;
  const thumbnailFilename = `${stem}-thumb.${thumb.extension}`;
  await Promise.all([
    writeFile(path.join(dir, fullImageFilename), full.bytes),
    writeFile(path.join(dir, thumbnailFilename), thumb.bytes),
  ]);

  return { fullImageFilename, thumbnailFilename };
}
