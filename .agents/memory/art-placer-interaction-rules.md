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

## The carousel must not be draggable

Rooms change only through the prev/next controls and the room dots. A swipeable/draggable carousel binds its own native pointer handlers to the container, which run before React's and steal the pointer mid-placement — the piece being dragged gets stranded on the canvas.

**Why:** the original spec asked for swipe-to-change-room, but in testing it collided with the art dragging and the user explicitly overrode it.

**How to apply:** never re-enable carousel dragging, and be wary of any library that grabs pointer events on a container that also hosts draggable children.

## Object sizing is calibrated to the room photographs

Scales are a fraction of canvas width, judged against the furniture in the photos: a full canvas width reads as roughly 4.2m of room, so 1m ≈ 0.24 of canvas width. Guessing scales without checking them rendered in a room produces art that reads far too large.

**How to apply:** when adding or resizing objects, seed a few placements temporarily, screenshot the room, and judge against the sofa before committing numbers.

## Layout constraint

The room canvas is derived from leftover viewport height (container query units) rather than from width, because a 16:10 canvas at full width pushes the controls and inventory tray off screen on a laptop. Any new fixed-height chrome shrinks the canvas — check the tray is still visible at 1280×800 and at mobile widths after layout changes.
