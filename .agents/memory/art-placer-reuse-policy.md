---
name: Art Placer per-room reuse policy
description: How the allowArtReuse room flag is interpreted, and the placement uniqueness invariant.
---

Rooms carry an optional `allowArtReuse` flag; absent reads as false (the original once-per-session behavior).

**The rule:** reuse policy is an *availability rule at placement time*, not a standing constraint on the data.
- Placing into a reuse room displaces only that room's own copy of the piece; copies in other rooms stay hung.
- Placing into a non-reuse room displaces the piece everywhere.
- Tray availability follows the ACTIVE room's policy.
- Toggling a room's flag off never deletes existing copies elsewhere — nothing is silently removed from a visitor's arrangement.

**The hard invariant:** at most one placement per (objectId, roomId), always. Enforced in the placements PUT route (400 on duplicates) and deduped in the Store's `livePlacements` sweep, so undo/catalog refresh cannot resurrect a duplicate.

**Why:** mixed reuse/non-reuse rooms make any stricter global-uniqueness constraint ambiguous (which copy would win?), and reconciling on toggle change would destroy user arrangements. A code review flagged this; the chosen answer is the placement-time interpretation above — keep future changes consistent with it.

**How to apply:** any new placement pathway (server import, bulk ops, new UI gestures) must go through the same displacement rule and preserve (objectId, roomId) uniqueness. `updatePlacement`/`removePlacement` are keyed by (objectId, roomId) for this reason.
