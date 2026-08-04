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

/** GCS object name prefixes for uploaded images. */
const ART_GCS_PREFIX = "art/";
const ROOM_GCS_PREFIX = "rooms/";

/**
 * The two kinds of image the app stores. Each is a directory under `public/`
 * for the seeded originals and a prefix in object storage for uploads, and
 * both resolve the same way: object storage first, filesystem second. Room
 * photographs went through this route too once they became uploadable —
 * writing them into `public/rooms/` alone would lose every upload on the next
 * publish, which is the exact failure the art route already exists to avoid.
 */
const MEDIA_KINDS = {
  art: { dir: "art", prefix: ART_GCS_PREFIX },
  rooms: { dir: "rooms", prefix: ROOM_GCS_PREFIX },
} as const;

export type MediaKind = keyof typeof MEDIA_KINDS;

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

/** Lists uploaded image filenames from object storage under one prefix. */
async function listGCSImages(prefix: string): Promise<string[]> {
  try {
    const bucket = getBucket();
    const [files] = await bucket.getFiles({ prefix });
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

/** Seeded filenames on disk for one media kind. */
async function listFilesystemImages(kind: MediaKind): Promise<string[]> {
  for (const base of publicDirCandidates()) {
    const list = await listImages(path.join(base, MEDIA_KINDS[kind].dir));
    if (list.length > 0) return list;
  }
  return [];
}

/**
 * Every filename available for one kind: the seeded originals on disk plus
 * anything uploaded to object storage since.
 */
async function listKind(kind: MediaKind): Promise<string[]> {
  const [fromDisk, fromStorage] = await Promise.all([
    listFilesystemImages(kind),
    listGCSImages(MEDIA_KINDS[kind].prefix),
  ]);

  const merged = [...fromDisk];
  const seen = new Set(fromDisk);
  for (const name of fromStorage) {
    if (!seen.has(name)) {
      seen.add(name);
      merged.push(name);
    }
  }
  return merged.sort((a, b) => a.localeCompare(b));
}

export async function listMediaFiles(): Promise<{
  rooms: string[];
  art: string[];
}> {
  const [rooms, art] = await Promise.all([listKind("rooms"), listKind("art")]);
  return { rooms, art };
}

/* -------------------------------- streaming ------------------------------- */

export interface ArtImageStream {
  stream: Readable;
  contentType: string;
  size?: number;
}

/**
 * Resolves an image filename to a readable stream.
 *
 * Checks object storage first (uploaded images), then falls back to the
 * seeded files on the filesystem. Returns null when the file does not exist
 * in either location.
 */
export async function streamImage(
  kind: MediaKind,
  filename: string,
): Promise<ArtImageStream | null> {
  const { dir, prefix } = MEDIA_KINDS[kind];

  // 1. Object storage — uploaded files live here.
  try {
    const bucket = getBucket();
    const file = bucket.file(`${prefix}${filename}`);
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
    const filepath = path.join(base, dir, filename);
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

export const streamArtImage = (filename: string) =>
  streamImage("art", filename);

export const streamRoomImage = (filename: string) =>
  streamImage("rooms", filename);

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
 * Every filename already taken for one kind, across both locations, so the
 * collision check covers seeded originals and previous uploads alike.
 */
async function takenNames(kind: MediaKind): Promise<Set<string>> {
  const names = new Set<string>();

  for (const base of publicDirCandidates()) {
    const dir = path.join(base, MEDIA_KINDS[kind].dir);
    const entries = await readdir(dir).catch(() => []);
    for (const n of entries) names.add(n);
    if (entries.length > 0) break;
  }

  try {
    const bucket = getBucket();
    const [files] = await bucket.getFiles({ prefix: MEDIA_KINDS[kind].prefix });
    for (const f of files) names.add(path.basename(f.name));
  } catch {
    // If object storage is unavailable the check only covers the filesystem.
  }

  return names;
}

/**
 * Writes one image to object storage — the copy the published app reads —
 * then mirrors it onto the filesystem so the dev server can serve it straight
 * away without going through the API route. Only the object-storage write is
 * allowed to fail loudly; the local mirror is a convenience.
 */
async function writeImage(
  kind: MediaKind,
  filename: string,
  file: { bytes: Buffer; mime: string },
): Promise<void> {
  const { dir, prefix } = MEDIA_KINDS[kind];

  await getBucket()
    .file(`${prefix}${filename}`)
    .save(file.bytes, { contentType: file.mime, resumable: false });

  try {
    const target = path.join(publicDirCandidates()[0], dir);
    await mkdir(target, { recursive: true });
    const { writeFile } = await import("node:fs/promises");
    await writeFile(path.join(target, filename), file.bytes);
  } catch {
    // Non-fatal: the object-storage copy is what counts in production.
  }
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

  const existingNames = await takenNames("art");

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

  await Promise.all([
    writeImage("art", fullImageFilename, full),
    writeImage("art", thumbnailFilename, thumb),
  ]);

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

/**
 * Saves an uploaded room photograph.
 *
 * The same path as an artwork minus the thumbnail: rooms are only ever shown
 * at full canvas size, so there is no scaled copy to generate or keep in step.
 */
export async function saveRoomImage(input: {
  baseName: string;
  image: string;
}): Promise<{ imageFilename: string; renamedFrom?: string }> {
  const image = decodeDataUrl(input.image, "The image");

  const existingNames = await takenNames("rooms");

  const wanted = safeStem(input.baseName);
  let stem = wanted;
  let suffix = 2;
  while (existingNames.has(`${stem}.${image.extension}`)) {
    stem = `${wanted}-${suffix}`;
    suffix += 1;
  }

  const imageFilename = `${stem}.${image.extension}`;
  await writeImage("rooms", imageFilename, image);

  return {
    imageFilename,
    ...(stem !== wanted
      ? { renamedFrom: `${wanted}.${image.extension}` }
      : {}),
  };
}
