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

## Undo must travel to the room the action happened in

Undoing an action performed in another room takes the board to that room, so the change is visible.

**Why:** only one room is on screen at a time. Otherwise undo silently alters a room the user cannot see and reads as a broken button.

**How to apply:** every reversible action has to carry which room it touched. Anything that spans rooms is undone from where the user was standing. Two traps: the recorded room may have been deleted by the time undo runs, and a snapshot valid when taken may hold placements that a later band-split change has invalidated — re-check both at the moment undo fires, not only when the catalog changes.

## Object sizing is calibrated to the room photographs

Scales are a fraction of canvas width, judged against the furniture in the photos: a full canvas width reads as roughly 4.2m of room, so 1m ≈ 0.24 of canvas width. Guessing scales without checking them rendered in a room produces art that reads far too large.

**How to apply:** when adding or resizing objects, seed a few placements temporarily, screenshot the room, and judge against the sofa before committing numbers.

## Layout constraint — the canvas is a matte, never full-bleed

The room canvas is a fixed 16:10 box inset from the viewport by a proportional matte on all four sides. It must never stretch or cover the viewport, and the room image is always `object-fit: contain`, never `cover`.

**Why:** running the photo full-bleed cover-scales it to an arbitrary window shape, which visibly softens the image and silently distorts every placement. The user rejected this on a live build. Sharpness and placement fidelity outrank filling empty viewport space — a fatter matte on an odd window ratio is the correct outcome, not a bug to fix by stretching.

**How to apply:** size the box by fitting 16:10 into the space left after the matte, driven by whichever axis is more constraining. Placements stay percentages of the *canvas box*, so the storage format never changes when the layout does — only how the box is measured. The photos are all 1600×1000, so `contain` fills the box exactly and percentages land true; a room image at a different aspect would letterbox inside the box and shift placements, so keep new room photos at 16:10.

## Controls anchor to the matte gutter, not the viewport edge

Persistent chrome (undo/reset stack, room chevrons, room pill, tray) is positioned against the viewport and must sit on the matte, never over the photo. Pin side controls to the gutter width rather than to `left-4`-style edge offsets.

**Why:** an offset tuned by eye while the canvas was full-bleed put the control stack straight onto the image once the matte existed, and only on width-constrained windows — invisible on a normal laptop. Tying controls to the same variable that defines the matte makes the overlap impossible instead of merely unlikely.

**How to apply:** the matte insets carry pixel floors sized to fit the closed controls; shrinking a floor pushes chrome onto the photo. Transient dismissible overlays (reset confirmation, first-use hint) are deliberately exempt and may float over the image — reserving permanent matte for them would cost every user roughly a fifth of the canvas for a card that shows once. Verify layout changes on a wide window *and* a tall/narrow one; the two constrain opposite axes.
