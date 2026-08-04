import { Router, type IRouter } from "express";
import { ListMediaResponse, UploadArtImageBody } from "@workspace/api-zod";
import {
  listMediaFiles,
  saveArtImages,
  streamArtImage,
  UploadError,
} from "../lib/media";

const router: IRouter = Router();

router.get("/media", async (_req, res): Promise<void> => {
  res.json(ListMediaResponse.parse(await listMediaFiles()));
});

router.post("/media/art", async (req, res): Promise<void> => {
  const parsed = UploadArtImageBody.safeParse(req.body);
  if (!parsed.success) {
    req.log.warn({ errors: parsed.error.message }, "Invalid art upload");
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  try {
    const files = await saveArtImages(parsed.data);
    req.log.info(files, "Saved art image and thumbnail");
    res.status(201).json(files);
  } catch (err) {
    // A rejected image is the caller's problem to fix, not a server fault.
    if (err instanceof UploadError) {
      res.status(400).json({ error: err.message });
      return;
    }
    throw err;
  }
});

/**
 * Serves an art image by filename.
 *
 * Checks object storage first (uploaded files), then the seeded filesystem
 * copies, so a single URL scheme works regardless of where the file came from.
 * The client always uses `/api/art-image/<filename>` — never a direct static
 * asset path — so uploaded images are visible in both dev and production.
 */
router.get("/art-image/:filename", async (req, res): Promise<void> => {
  const { filename } = req.params;

  // Reject anything that isn't a safe basename: no path separators, no dots
  // outside the extension, only the image formats we actually produce.
  if (!/^[a-z0-9][a-z0-9_-]*\.(png|jpg|jpeg|webp|avif)$/i.test(filename)) {
    res.status(400).json({ error: "Invalid filename" });
    return;
  }

  const result = await streamArtImage(filename);
  if (!result) {
    res.status(404).json({ error: "Image not found" });
    return;
  }

  res.setHeader("Content-Type", result.contentType);
  // Art images are content-addressed by name (stems include the piece slug).
  // One year is appropriate; if the file changes, the name changes.
  res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
  if (result.size !== undefined) {
    res.setHeader("Content-Length", String(result.size));
  }
  result.stream.pipe(res);
});

export default router;
