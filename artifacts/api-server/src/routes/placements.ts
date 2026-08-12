import { Router, type IRouter } from "express";
import { ListPlacementsResponse, ReplacePlacementsBody } from "@workspace/api-zod";
import {
  getArt,
  getPlacements,
  getRooms,
  setPlacements,
  withCatalogLock,
} from "../lib/catalog";

const router: IRouter = Router();

router.get("/placements", async (_req, res): Promise<void> => {
  res.json(ListPlacementsResponse.parse(await getPlacements()));
});

router.put("/placements", async (req, res): Promise<void> => {
  const parsed = ReplacePlacementsBody.safeParse(req.body);
  if (!parsed.success) {
    req.log.warn({ errors: parsed.error.message }, "Invalid placement set");
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  // The board sends the whole set, so this is also where a placement
  // referencing something the admin panel has since deleted would come back
  // from the dead. Take the lock so the check cannot straddle a cascade.
  const result = await withCatalogLock(async () => {
    const [rooms, art] = await Promise.all([getRooms(), getArt()]);
    const unknown = parsed.data.find(
      (p) =>
        !rooms.some((r) => r.id === p.roomId) ||
        !art.some((a) => a.id === p.objectId),
    );
    if (unknown) return { error: unknown };

    await setPlacements(parsed.data);
    return { saved: parsed.data };
  });

  if (result.error) {
    res.status(409).json({
      error: `Placement references a room or object that no longer exists: ${result.error.roomId} / ${result.error.objectId}`,
    });
    return;
  }
  res.json(result.saved);
});

export default router;
