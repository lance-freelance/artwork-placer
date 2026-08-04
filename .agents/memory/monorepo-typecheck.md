---
name: Monorepo typechecking
description: Why a per-artifact tsc invocation reports phantom type errors in this workspace, and what to run instead.
---

# Typecheck from the root, never per-artifact

Run `pnpm run typecheck` at the workspace root. Do **not** reach for the seemingly-equivalent
`npx tsc --noEmit -p artifacts/<name>/tsconfig.json`.

**Why:** the shared libraries under `lib/` are consumed through TypeScript project references.
Project references redirect an import from the referenced project's *source* to its *emitted*
`.d.ts` under `dist/`. A bare per-artifact `tsc` does not build referenced projects, so it
typechecks against whatever `dist/` happened to be left on disk. When a lib has been regenerated
more recently than it was built — which is the normal state after a task merge, since the merge
regenerates source from the OpenAPI spec — that stale `dist/` produces confident, entirely fake
"Property 'x' does not exist on type 'Y'" errors pointing at application code that is perfectly
correct.

The root script avoids this because it runs `tsc --build` first, which brings every referenced
project's `dist/` up to date before the per-artifact `--noEmit` passes run.

**The detail that makes this genuinely misleading:** the lib packages set
`"exports": { ".": "./src/index.ts" }`, so Vite, the dev server, and the running app always resolve
to fresh source. Only TypeScript looks at `dist/`. So the app runs fine and the browser shows no
error while `tsc` insists the code is broken — which reads like a real bug rather than a tooling
artifact, and invites "fixing" correct code to satisfy the compiler.

**How to apply:** before concluding a type error is real, re-run it through the root
`pnpm run typecheck`. If the error evaporates, it was stale `dist/`. Note that the post-merge script
only installs dependencies and pushes the database schema — it does not rebuild lib `dist/`, so a
freshly merged task reliably leaves this trap armed.
