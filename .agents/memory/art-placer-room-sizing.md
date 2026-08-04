---
name: Art Placer real-world sizing and room calibration
description: How artwork size is derived from physical dimensions against a per-room wall calibration, and the board zoom that any room-measuring tool must mirror.
---

# Real-world sizing and room calibration

Artwork is sized from its true physical dimensions against each room's own
calibration, not from an abstract per-object scale:

    scale = (realWidthInches / 12) / room.wallWidthFeet

`wallWidthFeet` is the real width of the back wall at the point where it fills
the canvas. It is measured in the admin panel with a draggable reference line
laid along something of known length (a door frame by default).

## Size is computed at render time, never read from the placement

**Why:** recalibrating a room has to resize everything already hanging in it.
A copy stored on the placement would silently keep the old size, and the room
would disagree with itself. A placement still carries a `scale`, but it is a
stale convenience value — the board does not render from it.

**How to apply:** anything that needs a piece's on-screen size derives it. Do
not "optimise" this into stored state.

## Only the computed width is stored, never the reference line

The line's endpoint coordinates are throwaway UI state. Storing them would
pin the calibration to one rendered box size.

## Any tool that measures a room must mirror the board's framing

This is the trap. The board does not show the whole room photograph — it
renders it `object-contain` and then applies a zoom, so the visible canvas is
only the middle portion of the file. A measuring tool that shows the untouched
photo is measuring wall the visitor never sees, and every calibration taken
through it comes out too wide by exactly the zoom factor. Every piece in that
room then hangs proportionally too small, and nothing anywhere reports an
error.

**Why:** found only by comparing the board render against the source image and
noticing the doorway at the edge of the photo was missing on screen. It
survives typechecking, review of either file alone, and looks entirely
plausible in a screenshot.

**How to apply:** the zoom lives in one shared constant that both the canvas
and the calibration tool consume — keep it that way rather than re-declaring
it locally. The same warning applies to the band-split preview, which measures
a fraction of canvas *height* against an unzoomed photo and therefore has this
bug today. When estimating a room width by eye from a photo, remember the
estimate is against the whole file and must be reduced by the zoom.

## The calibration tool must open already agreeing with itself

Lay the opening reference line down *from* the room's saved width, so the line
and the readout mean the same thing on arrival.

**Why:** with the line at a fixed default position it described a completely
different width from the one displayed, so the admin's first nudge of a handle
jumped the value wildly. A tester read that jump as an inverted drag direction
— the arithmetic was right and the starting state was the lie.

**How to apply:** derive the endpoints by inverting the measurement. An
upright line cannot be longer than the frame is tall, so for a narrow room
tilt the line to borrow the diagonal instead of clamping the span — clamping
silently reintroduces the mismatch. Re-lay the line on room identity, not on
image filename: two rooms may share one photograph and have different widths.

## Resize bounds are computed but nothing consumes them

`resizeRangePercent` is stored per piece and bounds are derived from it, but
the app has no resize interaction at all — the scale fields it replaced were
equally unread. Do not treat the unused bounds as a bug or invent a resize UI
to justify them.
