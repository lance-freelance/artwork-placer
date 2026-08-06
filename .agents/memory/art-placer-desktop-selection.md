---
name: Desktop drag needs native-selection suppression
description: Why pointer-event drags on desktop must preventDefault on pointerdown and keep select-none on the board
---

# Desktop drag vs. native text selection

**Rule:** any pointer-event drag surface in the felt board must prevent the mousedown default (`e.preventDefault()` in pointerdown) and the board container keeps `select-none`.

**Why:** verified live (Aug 2026) — without it, mousedown anchors a native selection; rapid consecutive desktop drags register as double/triple-clicks and sweep the blue `::selection` highlight across the artwork `<img>`s. It looks exactly like a stuck drag ghost / broken drop, but the drops actually commit (PUT /api/placements 200). `document.getSelection().removeAllRanges()` clearing the "ghost" was the proof. Touch never shows this — `touch-action` owns that path — so it's invisible on tablets and easy to reintroduce.

**How to apply:** when debugging "drag looks broken on desktop but placements save", check `document.getSelection()` first. Don't remove the `preventDefault` in `usePointerDrag.onPointerDown` or the `select-none` on MainLayout's root; note `preventDefault` on pointerdown suppresses click-focus (fine — draggables style via focus-visible).
