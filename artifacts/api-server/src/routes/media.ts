import { Router, type IRouter } from "express";
import { ListMediaResponse, UploadArtImageBody } from "@workspace/api-zod";
import { listMediaFiles, saveArtImages, UploadError } from "../lib/media";

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

export default router;
