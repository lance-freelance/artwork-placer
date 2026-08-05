/**
 * Uploading an image must round-trip: the files the API claims to have saved
 * must come back as real image bytes from the API's own serving route, with
 * no rebuild in between. This is the regression the admin panel's post-upload
 * check depends on — a 201 alone proved nothing when the static host answered
 * every URL with index.html.
 *
 * Runs against a freshly spawned build of the server (`pnpm run test`).
 */
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const PORT = 42000 + Math.floor(Math.random() * 10000);
const BASE = `http://127.0.0.1:${PORT}`;
const ART_DIR = path.resolve(here, "../../art-placer/public/art");
const STEM = `upload-roundtrip-test-${Date.now()}`;

// A real 1x1 transparent PNG, so the server's magic-byte check passes.
const PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";
const DATA_URL = `data:image/png;base64,${PNG_BASE64}`;

// The same, as a real 1x1 WebP. The admin panel re-encodes to WebP whenever it
// has to touch an image — cropping a room photo to 16:10 — so the same picture
// can arrive a second time under a different extension.
const WEBP_BASE64 = "UklGRhoAAABXRUJQVlA4TA0AAAAvAAAAEAcQERGIiP4HAA==";
const WEBP_DATA_URL = `data:image/webp;base64,${WEBP_BASE64}`;

let server;
const written = [];

before(async () => {
  server = spawn("node", ["--enable-source-maps", "./dist/index.mjs"], {
    cwd: path.resolve(here, ".."),
    env: { ...process.env, PORT: String(PORT), NODE_ENV: "test" },
    stdio: "ignore",
  });
  // Wait for the server to answer.
  for (let i = 0; i < 100; i += 1) {
    try {
      const res = await fetch(`${BASE}/api/healthz`);
      if (res.ok) return;
    } catch {
      // Not up yet.
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error("The API server never came up for the test.");
});

after(async () => {
  server?.kill();
  await Promise.all(
    written.map((name) =>
      rm(path.join(ART_DIR, name), { force: true }),
    ),
  );
  // Uploads also land in object storage; delete those copies too so test
  // artifacts never show up in the admin panel's media list.
  try {
    const { Storage } = await import("@google-cloud/storage");
    const sidecar = "http://127.0.0.1:1106";
    const storage = new Storage({
      credentials: {
        audience: "replit",
        subject_token_type: "access_token",
        token_url: `${sidecar}/token`,
        type: "external_account",
        credential_source: {
          url: `${sidecar}/credential`,
          format: { type: "json", subject_token_field_name: "access_token" },
        },
        universe_domain: "googleapis.com",
      },
      projectId: "",
    });
    const bucket = storage.bucket(process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID);
    await Promise.all(
      written.map((name) =>
        bucket.file(`art/${name}`).delete({ ignoreNotFound: true }),
      ),
    );
  } catch {
    // Object storage unavailable — nothing was written there either.
  }
});

async function upload(dataUrl = DATA_URL) {
  const res = await fetch(`${BASE}/api/media/art`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      baseName: STEM,
      fullImage: dataUrl,
      thumbnail: dataUrl,
    }),
  });
  const body = await res.json();
  if (res.status === 201) {
    written.push(body.fullImageFilename, body.thumbnailFilename);
  }
  return { status: res.status, body };
}

test("an upload's files are fetchable as images, immediately", async () => {
  const { status, body } = await upload();
  assert.equal(status, 201);

  for (const filename of [body.fullImageFilename, body.thumbnailFilename]) {
    const res = await fetch(`${BASE}/api/art-image/${filename}`);
    assert.equal(res.status, 200, `${filename} should be served`);
    assert.match(
      res.headers.get("content-type") ?? "",
      /^image\//,
      `${filename} should come back as an image, not HTML`,
    );
    const bytes = Buffer.from(await res.arrayBuffer());
    // PNG magic — proves these are the bytes that were uploaded.
    assert.deepEqual(
      [...bytes.subarray(0, 4)],
      [0x89, 0x50, 0x4e, 0x47],
      `${filename} should contain PNG bytes`,
    );
  }
});

test("a missing image is an honest 404, not a fallback page", async () => {
  const res = await fetch(`${BASE}/api/art-image/${STEM}-does-not-exist.png`);
  assert.equal(res.status, 404);
});

test("a duplicate upload is renamed and says so", async () => {
  const { status, body } = await upload();
  assert.equal(status, 201);
  assert.equal(body.renamedFrom, `${STEM}.png`);
  assert.equal(body.fullImageFilename, `${STEM}-2.png`);
});

test("a duplicate in another format still collides, and names the file it hit", async () => {
  const { status, body } = await upload(WEBP_DATA_URL);
  assert.equal(status, 201);
  // Names are compared by stem: were they compared whole, this would have
  // been saved as a second `${STEM}` — one name, two files, no warning.
  assert.equal(body.fullImageFilename, `${STEM}-3.webp`);
  // The PNG already on disk, not the `.webp` name this upload asked for.
  assert.equal(body.renamedFrom, `${STEM}.png`);
});
