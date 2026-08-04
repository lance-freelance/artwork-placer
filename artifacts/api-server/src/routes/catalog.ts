import { Router, type IRouter } from "express";
import {
  CreateArtBody,
  UpdateArtBody,
  ListArtResponse,
  ListRoomsResponse,
  CreateRoomBody,
  UpdateRoomBody,
  type ArtObject,
  type Room,
} from "@workspace/api-zod";
import {
  getArt,
  getPlacements,
  getRooms,
  makeId,
  setArt,
  setPlacements,
  setRooms,
  withCatalogLock,
} from "../lib/catalog";

const router: IRouter = Router();

/* ------------------------------ rooms ------------------------------ */

router.get("/rooms", async (_req, res): Promise<void> => {
  res.json(ListRoomsResponse.parse(await getRooms()));
});

router.post("/rooms", async (req, res): Promise<void> => {
  const parsed = CreateRoomBody.safeParse(req.body);
  if (!parsed.success) {
    req.log.warn({ errors: parsed.error.message }, "Invalid room input");
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const room = await withCatalogLock(async () => {
    const rooms = await getRooms();
    const created: Room = {
      id: makeId(parsed.data.name, rooms.map((r) => r.id)),
      ...parsed.data,
    };
    await setRooms([...rooms, created]);
    return created;
  });
  res.status(201).json(room);
});

router.patch("/rooms/:roomId", async (req, res): Promise<void> => {
  const parsed = UpdateRoomBody.safeParse(req.body);
  if (!parsed.success) {
    req.log.warn({ errors: parsed.error.message }, "Invalid room update");
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const updated = await withCatalogLock(async () => {
    const rooms = await getRooms();
    const existing = rooms.find((r) => r.id === req.params.roomId);
    if (!existing) return null;

    const next: Room = { ...existing, ...parsed.data };
    await setRooms(rooms.map((r) => (r.id === next.id ? next : r)));
    return next;
  });

  if (!updated) {
    res.status(404).json({ error: "No such room" });
    return;
  }
  res.json(updated);
});

router.delete("/rooms/:roomId", async (req, res): Promise<void> => {
  const deleted = await withCatalogLock(async () => {
    const rooms = await getRooms();
    if (!rooms.some((r) => r.id === req.params.roomId)) return false;

    await setRooms(rooms.filter((r) => r.id !== req.params.roomId));
    // Placements reference the room, so they go with it.
    const placements = await getPlacements();
    await setPlacements(
      placements.filter((p) => p.roomId !== req.params.roomId),
    );
    return true;
  });

  if (!deleted) {
    res.status(404).json({ error: "No such room" });
    return;
  }
  res.status(204).send();
});

/* ------------------------------- art ------------------------------- */

router.get("/art", async (_req, res): Promise<void> => {
  res.json(ListArtResponse.parse(await getArt()));
});

router.post("/art", async (req, res): Promise<void> => {
  const parsed = CreateArtBody.safeParse(req.body);
  if (!parsed.success) {
    req.log.warn({ errors: parsed.error.message }, "Invalid art input");
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const object = await withCatalogLock(async () => {
    const art = await getArt();
    const created: ArtObject = {
      id: makeId(parsed.data.name, art.map((a) => a.id)),
      ...parsed.data,
    };
    await setArt([...art, created]);
    return created;
  });
  res.status(201).json(object);
});

router.patch("/art/:artId", async (req, res): Promise<void> => {
  const parsed = UpdateArtBody.safeParse(req.body);
  if (!parsed.success) {
    req.log.warn({ errors: parsed.error.message }, "Invalid art update");
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const updated = await withCatalogLock(async () => {
    const art = await getArt();
    const existing = art.find((a) => a.id === req.params.artId);
    if (!existing) return null;

    const next: ArtObject = { ...existing, ...parsed.data };
    await setArt(art.map((a) => (a.id === next.id ? next : a)));

    // A piece that changed band can no longer sit where it was placed.
    if (parsed.data.type && parsed.data.type !== existing.type) {
      const placements = await getPlacements();
      await setPlacements(placements.filter((p) => p.objectId !== next.id));
    }
    return next;
  });

  if (!updated) {
    res.status(404).json({ error: "No such art object" });
    return;
  }
  res.json(updated);
});

router.delete("/art/:artId", async (req, res): Promise<void> => {
  const deleted = await withCatalogLock(async () => {
    const art = await getArt();
    if (!art.some((a) => a.id === req.params.artId)) return false;

    await setArt(art.filter((a) => a.id !== req.params.artId));
    const placements = await getPlacements();
    await setPlacements(
      placements.filter((p) => p.objectId !== req.params.artId),
    );
    return true;
  });

  if (!deleted) {
    res.status(404).json({ error: "No such art object" });
    return;
  }
  res.status(204).send();
});

export default router;
