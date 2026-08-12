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

    // A room holds at most one copy of a piece regardless of its reuse
    // policy: two placements with the same (objectId, roomId) can only be a
    // client bug, and rendering keys by objectId within a room assumes it.
    const seen = new Set<string>();
    const duplicate = parsed.data.find((p) => {
      const key = `${p.roomId}\u0000${p.objectId}`;
      if (seen.has(key)) return true;
      seen.add(key);
      return false;
    });
    if (duplicate) return { duplicate };

    await setPlacements(parsed.data);
    return { saved: parsed.data };
  });

  if (result.error) {
    res.status(409).json({
      error: `Placement references a room or object that no longer exists: ${result.error.roomId} / ${result.error.objectId}`,
    });
    return;
  }
  if (result.duplicate) {
    res.status(400).json({
      error: `Duplicate placement of the same object in the same room: ${result.duplicate.roomId} / ${result.duplicate.objectId}`,
    });
    return;
  }
  res.json(result.saved);
});

export default router;
