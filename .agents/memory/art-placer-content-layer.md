---
name: Art Placer content and persistence layer
description: Durable decisions behind reading the felt board's collection from a key/value store and curating it through the unlisted admin route.
---

## Replit DB was the right size for this, and needs no driver

The store is reachable over plain HTTP from the environment, so nothing had to be
installed. Collections are kept one key per collection rather than one key per
record: they are tiny, and a single key preserves display order without a
separate index.

**Why:** the alternative — Postgres and a schema — buys ordering, joins and
concurrency this product has no use for.

**How to apply:** reach for this before assuming a persistence need means
Postgres. The `database` skill covers Postgres and does not describe this store.
The tradeoff is real though: every mutation is a read-modify-write of a whole
collection, so mutations must be serialized (see below).

## A static artifact cannot be the backend

The board is served statically and has no runtime, so it can neither read a
directory server-side nor hold a database connection. The existing `api-server`
artifact already owns `/api` at the same origin under the path router, so a
relative call from the board just works.

**Why:** the alternative — giving the board its own runtime — means changing its
artifact config away from static serving for no gain.

**How to apply:** when an otherwise-static artifact in this monorepo grows a
server-side need, extend `api-server` rather than converting the artifact.

## Derived state is never persisted alongside its source

A placement stores position only. Which band it belongs to is the art object's
`type`, read at the point of use.

**Why:** the admin panel can change a piece from wall to sculpture. Had the band
been copied into the placement, the two would silently disagree and the piece
would sit in an invalid band forever.

**How to apply:** any new per-placement attribute that is really a property of the
art object or the room belongs on that record. Deletes and type changes cascade
into placements server-side, and the board drops orphans on load and whenever the
catalog changes under it.

## The board owns placements for the session

They are read from the server once at load, then held in memory; only writes go
back, debounced and chained.

**Why:** the board has an undo stack and reset-all. Refetching mid-session, or
invalidating the placements query after a write, would clobber whatever the user
is in the middle of. Writes send the whole set, so an older request landing after
a newer one would quietly undo it — hence the chain rather than parallel fires.

**How to apply:** keep the write path one-directional. If a second concurrent
viewer ever matters, that is a real design change, not a cache-invalidation fix.

## Image resizing belongs in the browser, not the server

The admin supplies one artwork file; the panel scales it down in an off-screen
canvas and posts both images as data URLs for the server to write side by side.

**Why:** the alternative is an image-processing dependency on the server, which
is a native build to install and keep current, for work the browser already
does. It also keeps the API to plain JSON with no multipart parsing.

**How to apply:** ask for WebP from the canvas and read the type back out of the
data URL rather than assuming it — a browser that cannot encode the format
returns PNG instead of failing, so the stored extension has to follow what was
actually produced. Filenames must be derived server-side from a slugified stem;
a name typed by a human is untrusted path input.

## Testing agents mistake a rejected drop for a lost placement

A drop in the wrong band leaves the piece exactly where it already was, so the
placement is still in the API afterwards. Twice a tester read that as "the
rejection failed."

**Why:** presence is the wrong assertion; the coordinates are the signal.

**How to apply:** when asking an agent to verify band rejection, tell it to
compare the placement's `y` before and after, not whether the record exists.
