import { mkdir, readdir, stat } from "node:fs/promises";
import { createReadStream } from "node:fs";
import { Readable } from "node:stream";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { objectStorageClient } from "./objectStorage";

/**
 * Reads the image directories the app serves from.
 *
 * Seeded images (shipped in the repo) live on the filesystem; uploaded images
 * live in object storage. Both are served through `GET /api/art-image/:filename`
 * so the client uses a single URL scheme regardless of where the file came from.
 */

const IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp", ".avif"]);

const EXT_TO_MIME: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  avif: "image/avif",
};

/** GCS object name prefix for uploaded art images. */
const ART_GCS_PREFIX = "art/";

/**
 * Where the web app's static (seeded) images live. Resolved from this module
 * rather than the working directory, which differs between the dev workflow
 * (the api-server package) and production (the repo root). The built app
 * copies `public/` into its output, so either location is a valid answer.
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

/** Returns the GCS bucket, or throws if object storage is not configured. */
function getBucket() {
  const bucketId = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID;
  if (!bucketId) throw new Error("DEFAULT_OBJECT_STORAGE_BUCKET_ID is not set");
  return objectStorageClient.bucket(bucketId);
}

/** Lists image files under a single filesystem directory. */
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
    return [];
  }
}

/** Lists uploaded art image filenames from object storage. */
async function listGCSArt(): Promise<string[]> {
  try {
    const bucket = getBucket();
    const [files] = await bucket.getFiles({ prefix: ART_GCS_PREFIX });
    return files
      .map((f) => path.basename(f.name))
      .filter(
        (name) =>
          !name.startsWith(".") &&
          IMAGE_EXTENSIONS.has(path.extname(name).toLowerCase()),
      )
      .sort((a, b) => a.localeCompare(b));
  } catch {
    // Object storage not configured or unavailable — degrade gracefully.
    return [];
  }
}

export async function listMediaFiles(): Promise<{
  rooms: string[];
  art: string[];
}> {
  // Rooms: filesystem only — there is no upload route for rooms.
  let rooms: string[] = [];
  for (const base of publicDirCandidates()) {
    const list = await listImages(path.join(base, "rooms"));
    if (list.length > 0) {
      rooms = list;
      break;
    }
  }

  // Art: filesystem (seeded originals) + object storage (uploaded).
  let fsArt: string[] = [];
  for (const base of publicDirCandidates()) {
    const list = await listImages(path.join(base, "art"));
    if (list.length > 0) {
      fsArt = list;
      break;
    }
  }
  const gcsArt = await listGCSArt();

  // Merge, preserving filesystem order first, then new GCS names.
  const seen = new Set<string>(fsArt);
  const merged = [...fsArt];
  for (const name of gcsArt) {
    if (!seen.has(name)) {
      seen.add(name);
      merged.push(name);
    }
  }
  merged.sort((a, b) => a.localeCompare(b));

  return { rooms, art: merged };
}

/* -------------------------------- streaming ------------------------------- */

export interface ArtImageStream {
  stream: Readable;
  contentType: string;
  size?: number;
}

/**
 * Resolves an art image filename to a readable stream.
 *
 * Checks object storage first (uploaded images), then falls back to the
 * seeded files on the filesystem. Returns null when the file does not exist
 * in either location.
 */
export async function streamArtImage(
  filename: string,
): Promise<ArtImageStream | null> {
  // 1. Object storage — uploaded files live here.
  try {
    const bucket = getBucket();
    const file = bucket.file(`${ART_GCS_PREFIX}${filename}`);
    const [exists] = await file.exists();
    if (exists) {
      const [metadata] = await file.getMetadata();
      return {
        stream: file.createReadStream() as unknown as Readable,
        contentType:
          (metadata.contentType as string) || "application/octet-stream",
        size: metadata.size ? Number(metadata.size) : undefined,
      };
    }
  } catch {
    // Object storage unavailable — fall through to filesystem.
  }

  // 2. Filesystem — seeded images that ship with the repo.
  const ext = path.extname(filename).toLowerCase().slice(1);
  const mime = EXT_TO_MIME[ext] || "application/octet-stream";

  for (const base of publicDirCandidates()) {
    const filepath = path.join(base, "art", filename);
    try {
      const info = await stat(filepath);
      if (info.isFile()) {
        return {
          stream: createReadStream(filepath),
          contentType: mime,
          size: info.size,
        };
      }
    } catch {
      continue;
    }
  }

  return null;
}

/* ----------------------------- writing art -------------------------------- */

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
      return ascii(4, "ftyp") && (ascii(8, "avif") || ascii(8, "avis"));
    default:
      return false;
  }
}

export class UploadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UploadError";
    Object.setPrototypeOf(this, UploadError.prototype);
  }
}

function decodeDataUrl(
  dataUrl: string,
  label: string,
): { bytes: Buffer; extension: string; mime: string } {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/s);
  if (!match) throw new UploadError(`${label} is not a valid data URL`);

  const [, mime, b64] = match;
  const extension = ENCODABLE.get(mime);
  if (!extension) {
    throw new UploadError(
      `${label} has an unsupported type "${mime}". Use PNG, JPEG, WebP, or AVIF.`,
    );
  }

  const bytes = Buffer.from(b64, "base64");
  if (bytes.length > MAX_IMAGE_BYTES) {
    throw new UploadError(
      `${label} is too large (${(bytes.length / 1024 / 1024).toFixed(1)} MB). The limit is ${MAX_IMAGE_BYTES / 1024 / 1024} MB.`,
    );
  }
  if (!looksLikeImage(bytes, mime)) {
    throw new UploadError(`${label} is not really a ${mime}`);
  }
  return { bytes, extension, mime };
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
 * Writes go to object storage so they survive deploys and are immediately
 * accessible in the published app. The seeded originals continue to live
 * on the filesystem and are served by the same `/api/art-image` route.
 */
export async function saveArtImages(input: {
  baseName: string;
  fullImage: string;
  thumbnail: string;
}): Promise<{
  fullImageFilename: string;
  thumbnailFilename: string;
  renamedFrom?: string;
}> {
  const full = decodeDataUrl(input.fullImage, "The image");
  const thumb = decodeDataUrl(input.thumbnail, "The thumbnail");

  // Build the set of names that already exist in EITHER location so the
  // collision-avoidance logic covers both seeded files and prior uploads.
  const existingNames = new Set<string>();

  // Filesystem names (seeded originals).
  for (const base of publicDirCandidates()) {
    const dir = path.join(base, "art");
    const names = await readdir(dir).catch(() => []);
    for (const n of names) existingNames.add(n);
    if (names.length > 0) break;
  }

  // GCS names (previous uploads).
  try {
    const bucket = getBucket();
    const [gcsFiles] = await bucket.getFiles({ prefix: ART_GCS_PREFIX });
    for (const f of gcsFiles) existingNames.add(path.basename(f.name));
  } catch {
    // If GCS is unavailable the collision check only covers the filesystem.
  }

  const wanted = safeStem(input.baseName);
  let stem = wanted;
  let suffix = 2;
  while (
    existingNames.has(`${stem}.${full.extension}`) ||
    existingNames.has(`${stem}-thumb.${thumb.extension}`)
  ) {
    stem = `${wanted}-${suffix}`;
    suffix += 1;
  }

  const fullImageFilename = `${stem}.${full.extension}`;
  const thumbnailFilename = `${stem}-thumb.${thumb.extension}`;

  // Write to object storage — this is where the published app reads from.
  const bucket = getBucket();
  await Promise.all([
    bucket.file(`${ART_GCS_PREFIX}${fullImageFilename}`).save(full.bytes, {
      contentType: full.mime,
      resumable: false,
    }),
    bucket.file(`${ART_GCS_PREFIX}${thumbnailFilename}`).save(thumb.bytes, {
      contentType: thumb.mime,
      resumable: false,
    }),
  ]);

  // Also write to the local filesystem so the dev Vite server can serve the
  // file immediately without going through the API route. This is a
  // convenience only — the GCS copy is the authoritative one.
  try {
    const dir = path.join(publicDirCandidates()[0], "art");
    await mkdir(dir, { recursive: true });
    const { writeFile } = await import("node:fs/promises");
    await Promise.all([
      writeFile(path.join(dir, fullImageFilename), full.bytes),
      writeFile(path.join(dir, thumbnailFilename), thumb.bytes),
    ]);
  } catch {
    // Non-fatal: the GCS copy is what counts in production.
  }

  // A suffixed stem almost always means the same piece was uploaded twice.
  // The rename is reported so the client can say so, instead of a `-2` copy
  // appearing with no explanation.
  return {
    fullImageFilename,
    thumbnailFilename,
    ...(stem !== wanted
      ? { renamedFrom: `${wanted}.${full.extension}` }
      : {}),
  };
}
