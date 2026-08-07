/**
 * Everything the admin panel needs to turn one uploaded file into the pair of
 * images an art record points at.
 *
 * The scaling happens here, in a canvas, rather than on the server: it keeps
 * the API to plain JSON and means no image-processing dependency has to be
 * installed or kept current.
 */

/** Longest edge of a tray thumbnail, in pixels. */
export const THUMBNAIL_MAX_EDGE = 360;

/**
 * The shape of the board canvas, and so the shape every room photograph is
 * cropped to. The board shows a room exactly as it is stored, so a photo that
 * is not this ratio would sit in the frame with blank bands beside or above
 * it — and those bands would count as wall in the room's calibration.
 */
export const ROOM_ASPECT = 16 / 10;

/**
 * How far from the target ratio an image may sit before it is worth cropping.
 * Inside this, the few pixels gained are not worth re-encoding the photograph
 * and losing a generation of quality.
 */
export const ASPECT_TOLERANCE = 0.03;

export interface CropResult {
  /** The image to upload: re-encoded when cropped, the original when not. */
  dataUrl: string;
  width: number;
  height: number;
  /** The source shape, present only when a crop actually happened. */
  croppedFrom: { width: number; height: number } | null;
}

/**
 * Centre-crops an image to `aspect`, taking the largest rectangle of that
 * shape that fits inside it.
 *
 * Centre rather than a chooser because the subject of a room photograph is the
 * back wall, which is what a photographer centres; and the trim is small by
 * construction, since only one axis is ever cut and only as far as the other
 * axis allows. An image already at the ratio is returned untouched — not
 * re-encoded — so an ideal 1600×1000 upload is stored byte-for-byte.
 */
export function cropToAspect(
  image: HTMLImageElement,
  dataUrl: string,
  aspect = ROOM_ASPECT,
  tolerance = ASPECT_TOLERANCE,
): CropResult {
  const sourceWidth = image.naturalWidth;
  const sourceHeight = image.naturalHeight;
  const ratio = sourceWidth / sourceHeight;

  if (!Number.isFinite(ratio) || Math.abs(ratio - aspect) <= tolerance) {
    return {
      dataUrl,
      width: sourceWidth,
      height: sourceHeight,
      croppedFrom: null,
    };
  }

  // Too wide: keep the full height and trim the sides. Too tall: the reverse.
  const width = ratio > aspect ? Math.round(sourceHeight * aspect) : sourceWidth;
  const height = ratio > aspect ? sourceHeight : Math.round(sourceWidth / aspect);
  const left = Math.round((sourceWidth - width) / 2);
  const top = Math.round((sourceHeight - height) / 2);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('This browser could not open a drawing canvas.');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(image, left, top, width, height, 0, 0, width, height);

  return {
    // WebP for the same reason as thumbnails: far smaller than PNG at this
    // size, and a browser that cannot encode it returns a PNG data URL rather
    // than failing. The server reads the type back out of the URL either way.
    dataUrl: canvas.toDataURL('image/webp', 0.92),
    width,
    height,
    croppedFrom: { width: sourceWidth, height: sourceHeight },
  };
}

/**
 * Alpha below this counts as empty when trimming transparent margins.
 * Anti-aliased edges and soft shadows sit well above it, so they survive;
 * near-invisible padding pixels left by export tools do not.
 */
export const TRIM_ALPHA_THRESHOLD = 8;

/**
 * Above this many pixels the trim is skipped rather than attempted: the scan
 * needs a full RGBA copy in memory, and a compressed file can decode to
 * hundreds of megabytes. Skipping keeps the upload path exactly what it was
 * before trimming existed, so a huge image is stored as-is, never rejected.
 */
export const TRIM_MAX_PIXELS = 24_000_000;

/** The server rejects any single image above this many bytes. */
export const MAX_IMAGE_BYTES = 6 * 1024 * 1024;

/** Decoded byte size of a `data:` URL's base64 payload. */
export function dataUrlBytes(dataUrl: string): number {
  const comma = dataUrl.indexOf(',');
  const b64 = comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
  return Math.floor((b64.length * 3) / 4);
}

export interface TrimResult {
  /** The image to use: re-encoded when trimmed, the original when not. */
  dataUrl: string;
  image: HTMLImageElement;
  /** The source shape, present only when a trim actually happened. */
  trimmedFrom: { width: number; height: number } | null;
}

/**
 * Crops away fully transparent margins around an artwork.
 *
 * Export tools often leave the piece floating in a large transparent canvas,
 * and since rendered size comes from the image's aspect ratio against the
 * entered physical dimensions, that padding makes the art draw at the wrong
 * size on the wall. Trimming to the opaque bounding box makes the pixels and
 * the physical dimensions describe the same rectangle.
 *
 * An image with no transparent border — including any JPEG — is returned
 * untouched, byte-for-byte, so nothing is re-encoded without need. A fully
 * transparent image is also returned untouched rather than cropped to nothing.
 */
export async function trimTransparentEdges(
  image: HTMLImageElement,
  dataUrl: string,
  alphaThreshold = TRIM_ALPHA_THRESHOLD,
): Promise<TrimResult> {
  const width = image.naturalWidth;
  const height = image.naturalHeight;

  // Too big to scan safely — store as-is, exactly as before trimming existed.
  if (width * height > TRIM_MAX_PIXELS) {
    return { dataUrl, image, trimmedFrom: null };
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('This browser could not open a drawing canvas.');
  ctx.drawImage(image, 0, 0);

  const { data } = ctx.getImageData(0, 0, width, height);

  let left = width;
  let right = -1;
  let top = height;
  let bottom = -1;
  for (let y = 0; y < height; y++) {
    const row = y * width * 4;
    for (let x = 0; x < width; x++) {
      if (data[row + x * 4 + 3] > alphaThreshold) {
        if (x < left) left = x;
        if (x > right) right = x;
        if (y < top) top = y;
        if (y > bottom) bottom = y;
      }
    }
  }

  // Nothing opaque at all, or nothing to cut: hand back the original.
  const empty = right < 0;
  const alreadyTight =
    left === 0 && top === 0 && right === width - 1 && bottom === height - 1;
  if (empty || alreadyTight) {
    return { dataUrl, image, trimmedFrom: null };
  }

  const cropWidth = right - left + 1;
  const cropHeight = bottom - top + 1;
  const out = document.createElement('canvas');
  out.width = cropWidth;
  out.height = cropHeight;
  const outCtx = out.getContext('2d');
  if (!outCtx) throw new Error('This browser could not open a drawing canvas.');
  outCtx.drawImage(image, left, top, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight);

  // PNG keeps the crop lossless and keeps the transparency; the artwork is
  // stored once, so the size difference against WebP is not worth another
  // generation of quality loss on the actual pixels. But the server caps an
  // image at MAX_IMAGE_BYTES, and a canvas PNG can come out bigger than the
  // compressed original — so fall back to WebP (which also keeps alpha), and
  // if even that is too large, keep the original untrimmed rather than fail.
  let trimmedUrl = out.toDataURL('image/png');
  if (dataUrlBytes(trimmedUrl) > MAX_IMAGE_BYTES) {
    trimmedUrl = out.toDataURL('image/webp', 0.92);
  }
  if (
    dataUrlBytes(trimmedUrl) > MAX_IMAGE_BYTES ||
    !trimmedUrl.startsWith('data:image/')
  ) {
    return { dataUrl, image, trimmedFrom: null };
  }
  const trimmedImage = await loadImage(trimmedUrl);
  return {
    dataUrl: trimmedUrl,
    image: trimmedImage,
    trimmedFrom: { width, height },
  };
}

/** Reads a picked file as a `data:` URL, which is what the API accepts. */
export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('That file could not be read.'));
    reader.readAsDataURL(file);
  });
}

/** Decodes a URL into an image, so its real dimensions can be measured. */
export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('That image could not be decoded.'));
    img.src = src;
  });
}

/**
 * Draws the image into an off-screen canvas at tray size.
 *
 * WebP is asked for because the artwork is transparent — a JPEG would fill the
 * cut-out with black — and it is a fraction of the size of a PNG. A browser
 * that cannot encode WebP returns a PNG data URL instead of failing, and the
 * server reads the actual type back out of the URL, so either is fine.
 */
export function generateThumbnail(
  image: HTMLImageElement,
  maxEdge = THUMBNAIL_MAX_EDGE,
): string {
  const longest = Math.max(image.naturalWidth, image.naturalHeight);
  const scale = Math.min(1, maxEdge / longest);
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('This browser could not open a drawing canvas.');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(image, 0, 0, width, height);

  return canvas.toDataURL('image/webp', 0.86);
}

/**
 * Confirms a just-saved asset really comes back as an image.
 *
 * The app is a SPA with a catch-all route, so a missing file is served as
 * `index.html` with a 200 — the status code proves nothing. Decoding is the
 * test: HTML will not decode as an image, so a broken save fails here loudly
 * instead of much later. The cache-buster makes sure the check hits the
 * server rather than a cached copy.
 */
export async function verifyImageAsset(url: string): Promise<void> {
  const bust = `${url}${url.includes('?') ? '&' : '?'}v=${Date.now()}`;
  try {
    await loadImage(bust);
  } catch {
    throw new Error(
      'The server reported the image as saved, but it cannot be loaded back. ' +
        'It was most likely not written where the app serves images from.',
    );
  }
}

/** `Ink Study (Oversized).png` becomes `ink-study-oversized`. */
export function fileStem(filename: string): string {
  return filename.replace(/\.[^.]+$/, '');
}

/**
 * The thumbnail that belongs to an image already sitting in the art directory.
 *
 * Uploads always write the two together, but the shipped collection was put
 * there by hand, so the sibling is looked up by convention rather than assumed.
 * With no sibling the full image stands in for itself — heavier in the tray,
 * but never a broken picture.
 */
export function findThumbnailFor(
  fullImageFilename: string,
  available: string[],
): string {
  const stem = fileStem(fullImageFilename);
  return (
    available.find((name) => fileStem(name) === `${stem}-thumb`) ??
    fullImageFilename
  );
}

/** Whether a filename is a thumbnail, and so not offered as an artwork. */
export function isThumbnail(filename: string): boolean {
  return fileStem(filename).endsWith('-thumb');
}
