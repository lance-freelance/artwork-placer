---
name: Art Placer interaction rules
description: Non-negotiable interaction constraints for the Living Luxury Lab Art Placer, stated by the user in the original spec.
---

# Art Placer interaction rules

The user's spec fixed these three behaviors. Treat them as constraints, not preferences.

1. **Pointer Events only.** `pointerdown` / `pointermove` / `pointerup` plus pointer capture. HTML5 drag-and-drop is explicitly forbidden.
2. **Validity is one Y comparison against the room's `bandSplit`.** Wall art above, sculptures below. No zones, polygons, or hit regions may be introduced.
3. **The crosshair is a readability aid only.** No snapping, magnetism, or grid alignment — objects settle exactly where released.

**Why:** the user wrote the spec around these; earlier attempts at "helpful" snapping or zone systems are the exact thing they ruled out.

**How to apply:** any future work on placement, alignment guides, or a phase-2 persistence layer must preserve all three. If a feature seems to need zones or snapping, ask first.

## Placement actions must call the store directly

Never route placement, repositioning or removal through a window event bus. Only the active room canvas can listen, so after navigating away and back the interaction silently does nothing — no error, and the click lands on the right element, which makes it very slow to diagnose.

**Why:** two separate user-reported bugs traced back to this one indirection.

**How to apply:** if a drag needs the canvas box, read the ref the active canvas publishes on the store. Keep the drop rules in one pure function every gesture calls.

## Pointer capture swallows clicks on nested buttons

A draggable element that takes pointer capture on pointerdown retargets the following click to itself, so a button nested inside it never fires its `onClick`. Stop the gesture on the child so the parent never takes capture.

**How to apply:** any control placed inside a draggable piece. Hover-revealed controls are also unreachable on touch — reveal them under `[@media(hover:none)]` as well.

## Drag geometry must be captured synchronously

Read the grab offsets and size from a ref set at drag start, never from React state at drag end. A fast flick can reach pointerup before React commits the drag-start render, and the drop then resolves against nothing and silently fails.

## The carousel must not be draggable

Rooms change only through the prev/next controls and the room dots. A swipeable/draggable carousel binds its own native pointer handlers to the container, which run before React's and steal the pointer mid-placement — the piece being dragged gets stranded on the canvas.

**Why:** the original spec asked for swipe-to-change-room, but in testing it collided with the art dragging and the user explicitly overrode it.

**How to apply:** never re-enable carousel dragging, and be wary of any library that grabs pointer events on a container that also hosts draggable children.

## A full-canvas tap target must never sit above the placed pieces

The select-then-place flow covers the whole canvas with an interactive overlay while something is
selected. That overlay must stay *below* the placed artwork in stacking order, or it swallows every
press on a placed piece — repositioning and the per-piece remove control both silently stop working
while a tray item is selected, and nothing about the UI explains why.

**Why:** reported as "art won't move once placed". It does not reproduce with a mouse in the obvious
way, because it needs the prior state of having tapped a tray thumbnail first — the tester only found
it by hit-testing `document.elementFromPoint` over the artwork and seeing the overlay button come back.

**How to apply:** raising the pieces above the overlay is the fix, but it makes an occupied spot a dead
zone for tap-to-place, so the piece has to forward a plain tap to the same placement call the overlay
uses. Keep that call one shared function rather than two copies of the maths. When debugging "the click
lands on the right element but nothing happens", hit-test the point before re-reading the handler.

## Undo must travel to the room the action happened in

Undoing an action performed in another room takes the board to that room, so the change is visible.

**Why:** only one room is on screen at a time. Otherwise undo silently alters a room the user cannot see and reads as a broken button.

**How to apply:** every reversible action has to carry which room it touched. Anything that spans rooms is undone from where the user was standing. Two traps: the recorded room may have been deleted by the time undo runs, and a snapshot valid when taken may hold placements that a later band-split change has invalidated — re-check both at the moment undo fires, not only when the catalog changes.

## Object sizing is real-world, calibrated per room

Pieces carry their true physical dimensions and each room carries the real width of its back wall; the on-screen size is derived from the two. A single global "canvas width ≈ 4.2m" constant used to stand in for every room and is gone — it was the bug that made the same piece read correctly in one room and wrong in the next. See [Art Placer real-world sizing](art-placer-room-sizing.md), which also covers the board zoom that any room-measuring tool must mirror.

**How to apply:** never reintroduce a per-object scale factor or a shared room-width constant. When judging a calibration, screenshot the room and check a piece against the furniture — but read the sizing note first, because measuring the source photo rather than the board's cropped view is off by the zoom factor.

## Layout constraint — the canvas is a matte, never full-bleed

The room canvas is a fixed 16:10 box inset from the viewport by a proportional matte on all four sides. It must never stretch or cover the viewport, and the room image is always `object-fit: contain`, never `cover`.

**Why:** running the photo full-bleed cover-scales it to an arbitrary window shape, which visibly softens the image and silently distorts every placement. The user rejected this on a live build. Sharpness and placement fidelity outrank filling empty viewport space — a fatter matte on an odd window ratio is the correct outcome, not a bug to fix by stretching.

**How to apply:** size the box by fitting 16:10 into the space left after the matte, driven by whichever axis is more constraining. Placements stay percentages of the *canvas box*, so the storage format never changes when the layout does — only how the box is measured. The photos are all 1600×1000, so `contain` fills the box exactly and percentages land true; a room image at a different aspect would letterbox inside the box and shift placements, so keep new room photos at 16:10.

## The matte is leftover space, never reserved padding

Persistent chrome (undo/reset stack, room chevrons, room pill, tray) must sit on the matte, never over the photo — but the matte is what is *left over* after fitting 16:10 into the space the chrome is not using. It is never fixed padding added on top of that fit.

**Why:** reserving fixed side gutters wide enough to hold the controls ate ~45% of a 390px phone, squeezing the room into a strip. The user called this a bug, not a tradeoff: on a portrait phone width is the constraining axis, so the leftover belongs top/bottom and the room should run nearly edge-to-edge. Separately, an offset tuned by eye while the canvas was full-bleed once put the control stack straight onto the image on width-constrained windows only — invisible on a laptop.

**How to apply:** measure real chrome heights and subtract them; do not hard-code pixel floors, which is what caused both failures. Controls move to whichever band actually exists — a side gutter only on wide landscape windows, otherwise a row in the bottom band. Decide that from a **viewport-only** media query, never from measured chrome, or the decision feeds back into the layout it drives. For the same reason anything whose height is measured must keep that height width-independent (no wrapping, no width-tied max-width), or box size and chrome height oscillate. Transient dismissible overlays (reset confirmation, first-use hint) are exempt and may float over the image — reserving permanent matte for them would cost every user roughly a fifth of the canvas for a card that shows once. Verify on a wide window *and* a tall/narrow one; the two constrain opposite axes.

## The matte is a warm neutral sampled from the room walls, never black

The board background must stay a warm cream/taupe in the same family as the wall tone of the room photographs. Do not return it to black or a cool grey.

**Why:** on black the photos read as screenshots floating in a void; on a warm neutral they read as mounted prints. The user called this "the single biggest fix", so it is a stated preference, not a passing style choice.

**How to apply:** the theme tokens were already a warm cream palette — the black board was an override masking them, so check the tokens before introducing new colour values. Chrome on the matte has to be dark-on-light to survive the change; anything still styled white-on-dark disappears. One asset trap: the header wordmark only ships as a *white* PNG with no dark variant, so it has to be recoloured by filter rather than swapped.

## backdrop-filter on a scrolling element paints black on mobile GPUs

Never put `backdrop-blur` on the same element that also scrolls (`overflow-x-auto`), and never let a blur be the main source of an element's visible fill. The scroll container forces a compositing layer that several mobile GPUs fail to sample, and the element paints solid black — taking any dark-on-light text with it.

**Why:** the room-selector capsule was `bg-foreground/[0.07]` + `backdrop-blur-md` + `overflow-x-auto`. At 7% opacity the blur *was* the background, so on a real phone the whole capsule went black and unreadable while looking perfect in desktop Chrome. Buttons still worked, which makes it read as a styling bug rather than a paint bug.

**How to apply:** the matte behind the chrome is a flat colour, so a blur buys nothing there — a plain tint composites identically. If a translucent surface must survive a backdrop-filter failure, keep its own background opaque enough to carry the contrast alone. Desktop preview will not reproduce this; judge it on a device.

## A cancelled pointer gesture must never commit

`pointercancel` and `pointerup` mean opposite things and must not share a handler. Cancel fires when the OS takes the gesture away (palm rejection, system edge swipe, a scroll container claiming the contact); its last known coordinate is wherever the interruption happened, not where the user meant to let go. Routing it into the drop path places artwork at an arbitrary spot.

Two further traps found together with it:

- A window-level safety net that only clears *visual* drag state is not enough. The refs inside whichever component owned the gesture stay armed, and the next `pointerup` re-runs the drop with stale geometry — committing a second placement after the ghost has already vanished. The safety net has to reach the owning hook's teardown. A module-level registry of teardowns keeps the store from having to know about individual component refs.
- That teardown must not clear the "just dragged" flag when nothing is in flight. The same `pointerup` that completes a drag bubbles on to window immediately afterwards, and clearing the flag there lets the trailing synthetic click toggle selection on the piece the user just dropped.

**Why:** all three surfaced together as "drag gets stuck / ghost strays / drops land in the wrong place" on a large tablet, and none of them reproduce with a mouse on a desktop browser.

**How to apply:** `touch-action` is latched by the browser when the gesture *starts*, so changing it mid-gesture cannot rescue a contact the browser has already claimed for panning — treat a clean cancel as the real protection, not a way to prevent cancels. Also keep the window listeners bubble-phase: React's delegated handler runs at the root, so a capture-phase window listener would abort every normal drop.
