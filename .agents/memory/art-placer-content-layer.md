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


## Art images are served by the API, never by static hosting

The board's static host is a SPA with a catch-all: a missing image returns
`index.html` with a 200, so brokenness is invisible to status codes. Art images
therefore load from an API route that reads the same directory uploads are
written to, 404s honestly, and serves fresh uploads in production without a
rebuild. The admin panel loads each just-saved file back and decodes it before
declaring an upload successful.

**Why:** an upload once "succeeded" at every layer while the file was never
viewable; decode-on-read is the only trustworthy check under a SPA fallback.

**How to apply:** new image kinds should get the same API-served treatment as
art. Never verify an asset by HTTP status alone in this app. The health
endpoint is `/api/healthz`, not `/api/health`.

## Art images are served through the API, never as static assets

All art images (seeded and uploaded) go through `GET /api/art-image/:filename`.
The client uses `artImageUrl(filename)` from `src/types.ts` — never
`assetUrl('art/...')`. The route checks object storage first (uploads), then the
seeded filesystem copies.

Uploaded images are written to GCS via `@google-cloud/storage` inside
`artifacts/api-server/src/lib/media.ts` (`saveArtImages`). The bucket ID is in
`DEFAULT_OBJECT_STORAGE_BUCKET_ID`. A convenience copy is also written to the
local filesystem so the dev Vite server can serve it immediately.

`listMediaFiles()` merges filesystem names (seeded) with GCS names (uploaded);
`streamArtImage(filename)` tries GCS first, then filesystem.

**Why:** uploaded files go to object storage, not `public/art/`, because the
production build bakes static files at deploy time — a file written to the
source tree after the build is invisible to the running app. Object storage
survives deploys and is accessible to the running server regardless of when the
file was uploaded.

**Why artImageUrl not assetUrl:** `assetUrl` builds a static URL relative to
the Vite base path. That only works for files baked into the build. A single URL
scheme through the API works for both seeded and uploaded files with no
client-side branching.

**How to apply:** any new image type added to the admin panel (e.g. room photos
with an upload route) must follow the same pattern: write to GCS, serve via an
API route, expose a dedicated URL helper in `src/types.ts`.

## Room photos go through the API exactly as art does

Rooms have their own upload route and their own serve route, backed by object
storage, and the client uses a dedicated URL helper rather than a static asset
path. Media handling is written once over a map of kinds rather than duplicated
per kind.

**Why:** a spec once called for writing uploaded room photos into the source
tree under `public/`. Honouring that literally would have lost every uploaded
room on the next publish, because the production build bakes static files at
deploy time — the same reason art already went to object storage. The failure
would have been invisible in development.

**How to apply:** treat "save the upload into `public/`" as a red flag in this
project whatever a spec says. Every new image kind gets the same treatment:
object storage write, API serve route, URL helper in `src/types.ts`.

## Upload routes need their body limit widened deliberately

Images are posted as base64 inside JSON, which blows straight past Express's
default ~100kb body limit. Mount the enlarged JSON parser on the media path
prefix rather than on each individual upload route.

**Why:** it was scoped to the art upload path alone, so a later room upload
route silently inherited the default and rejected ordinary photographs with a
413 before any of its own validation ran. Path-prefix scoping means a new kind
cannot repeat this.

**How to apply:** verify with a payload over 100kb and assert the response is
the handler's own error, not a 413.

## Verification uploads are user-visible content — clean both stores

An upload written while testing the pipeline lands in *two* places (object
storage and `public/art/`) and immediately appears in the admin's "pick an image
already in the art folder" picker. A tiny placeholder image written to prove the
plumbing works therefore shows up to the user as a real, broken-looking artwork.

**Why:** the picker is driven by `listMediaFiles()`, which merges both stores and
has no notion of which files are catalog-backed. Having no art record keeps a
file off the board, but not out of the picker — that was assumed once and was
wrong; the user reported the leftover as a "1x1 pixel image" bug.

**How to apply:** either upload a real, plausibly-sized image when verifying, or
delete the test artifact from GCS *and* the filesystem before finishing. Checking
only `ls public/art/` is not enough; object storage keeps its own copy.

## The upload filename is captured when the file is picked, not on save

`baseName` is read from the Name field at the moment the file is chosen, so
picking a file mid-typing bakes the half-typed name into the stored filename.

**Why:** the pair of images is written immediately on selection rather than
deferred to form submit, so there is no later point at which the finished name
could be applied. Renaming afterwards would mean moving objects in two stores.

**How to apply:** treat a truncated-looking stored filename as this ordering
quirk, not as a slug-length bug — `safeStem` caps at 60 characters, far above
what a typical title produces.

## Testing agents mistake a rejected drop for a lost placement

A drop in the wrong band leaves the piece exactly where it already was, so the
placement is still in the API afterwards. Twice a tester read that as "the
rejection failed."

**Why:** presence is the wrong assertion; the coordinates are the signal.

**How to apply:** when asking an agent to verify band rejection, tell it to
compare the placement's `y` before and after, not whether the record exists.
