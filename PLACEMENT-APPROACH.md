# Art Placement — What We're Building and How It Should Work

A product and interaction spec, written from the goal rather than from the current
implementation. Nothing here assumes the existing drag code, component structure, or
data shapes. Where the current build is mentioned, it is as evidence about which
approaches fail, not as a constraint.

---

## 1. What this product is actually for

Living Luxury Lab sells art. This is the tool that answers a buyer's real question:

> **"What would this piece look like on my wall — and is it the right size?"**

Everything else is in service of that. Two things follow from it, and they are easy to
lose sight of:

**Scale honesty is the product.** The catalog stores `realWidthInches` and
`realHeightInches` per piece; rooms store `wallWidthFeet`, calibrated in the admin panel
by laying a reference line against a door frame. That machinery exists so a 48" canvas
renders as 48" of wall. A tool that places art at a *plausible-looking* size has no
reason to exist — the buyer can already imagine that. The value is entirely in the
number being right.

**It is a showroom instrument, not a toy.** Placements are per-installation and survive
refresh: this is a shared tablet in a gallery, handled by a salesperson or a walk-up
visitor, not a personal app someone learns over time. Every interaction is somebody's
first interaction.

### What success means

| | Requirement |
|---|---|
| **Correct** | A placed piece is at true-to-life scale for that room, every time. |
| **Certain** | Every gesture produces a visible result. Nothing ever silently does nothing. |
| **Immediate** | Zero instruction. A visitor who has never seen it places a piece on the first try. |
| **Composed** | The result looks like a considered interior, not a collage. It is a luxury brand. |

The current build satisfies the first. It fails the second badly, and the second is the
one that destroys trust — a tool that ignores you at random is worse than no tool,
because the buyer stops believing the sizes too.

---

## 2. Why the present approach cannot reach 100%

The diagnosis "this is unfixable" overstates it — every individual failure is fixable,
and several now are. But the underlying instinct is right, and worth stating precisely:

> **The architecture makes placement a continuous, refusable, measurement-dependent
> gesture. That is three independent sources of failure, and all of them fail to the
> same invisible state.**

Placement today has to survive five layers, each able to abort:

1. **Gesture acquisition** — hand-rolled pointer capture, `touch-action`, movement
   thresholds, `pointercancel`, and competition from the carousel, the tray scroller,
   and any overlay sharing those pixels.
2. **Live measurement** — the drop reads `getBoundingClientRect()` at gesture time. If
   the canvas has not registered, or measures zero, the gesture is inert.
3. **A refusable outcome** — the band rule can reject a drop outright.
4. **Distributed ownership** — a gesture can be ended by the element, a window-level
   safety net, a cancel, or a blur. Only one of those paths commits a placement.
5. **Timing** — a flick can outrun React's commit of the drag-start render.

The compounding problem is not that each layer is fragile. It is that **all five failure
modes look identical to the visitor: the piece snaps back.** There is no vocabulary in
the design for "I heard you and declined" versus "I never heard you." So every failure
reads as the same thing — the app is broken — and each fix is invisible because the
next failure mode produces the same symptom.

That is a design property, not a bug count. You cannot test your way out of it, because
the acceptance criterion ("the piece ends up where I put it") is satisfied by a system
that fails 5% of the time in five different ways.

### The single highest-leverage change

**Remove "refuse" from the design.**

Any gesture that *can* fail *will* fail, and the user cannot tell a rule from a defect.
If every release is guaranteed to produce a placement — the nearest sensible one — then
the entire class of silent no-ops disappears by construction. The worst remaining outcome
is "it landed a bit off where I meant," which is visible, obviously recoverable, and
self-correcting: you move it.

This is a spec decision, not a code decision, and it is worth more than any amount of
hardening the gesture layer.

---

## 3. Approach options

Five genuinely different ways to reach the same product goal, roughly in order of how
much of the failure surface they eliminate.

### A. Anchor slots — art snaps to authored positions

Each room is authored with a handful of named placement anchors: *above the sofa*, *over
the console*, *on the mantel*, *floor, left of the window*. Each anchor knows its surface
(wall or floor) and its centre point. A piece goes to the nearest compatible anchor.

- **Eliminates:** free coordinates, band validity rules, edge clamping, refusal. There is
  always a nearest compatible anchor, so a placement always exists.
- **Wins the "composed" criterion outright.** Free-form placement mostly produces badly
  hung art — off-centre, too high, floating. Anchors mean every arrangement a visitor
  makes looks like the room was styled. For a luxury brand this is not a consolation
  prize, it is an upgrade.
- **Scale stays fully honest.** Anchors position; real dimensions still size.
- **Cost:** per-room authoring. But this is the same class of tool as the existing
  band-split editor — drag a marker onto a live preview — and it is authored once per
  room, not per visit.
- **Risk:** feels less free. Mitigate by allowing a nudge after placing.

### B. Tap to place — remove dragging entirely

Tap a piece to select it, tap a spot to place it. This path already exists in the build
as the accessibility alternative.

- **Eliminates:** layers 1 and 5 completely — no capture, no thresholds, no cancel
  semantics, no ghost, no race against a render commit. Two discrete, unmissable events.
- Identical on mouse and touch. Nothing to arbitrate with the carousel or the tray.
- **Cost:** less tactile. But a tap that always works is a better experience than a drag
  that usually does, and "drag" is not the thing being sold.

### C. Place first, adjust after

Tapping a piece places it immediately at a sensible default position. Dragging exists
only to refine what is already on the wall.

- **The key move:** it makes the risky gesture *non-essential*. If a refine-drag fails,
  the piece simply stays where it was — visible, harmless, retryable. The gesture no
  longer carries the outcome.
- Near-zero UX cost for a very large reliability gain. Composes with A and B.

### D. Keep free-form drag, adopt a maintained library

`dnd-kit`, Atlassian's Pragmatic drag-and-drop, or interact.js instead of a hand-rolled
pointer primitive.

- **Fixes:** layer 1, and most of layer 5. Cancel semantics, capture, and touch handling
  become someone else's tested problem.
- **Does not fix:** refusal, live measurement, or distributed ownership — the three that
  actually produce the silent failures. This is worth doing, but on its own it is the
  least valuable option here.

### E. Invert the flow — choose the surface, then the piece

Tap a wall or the floor; the tray filters to pieces that belong there; tap one.

- **Guarantees validity by construction** — the invalid combination is never offered, so
  there is nothing to reject.
- Doubles as merchandising: "what fits here?" is a better sales question than "where does
  this go?"
- **Cost:** a bigger departure from the felt-board metaphor in the brief.

---

## 4. Recommended approach

**C + A + B, in that order of importance: place on tap, snap to authored anchors, drag
only to refine.**

The flow:

1. Visitor taps a piece in the tray. It is **placed immediately** at the best free
   compatible anchor in the current room, at true scale.
2. It can be dragged to another anchor. The drag is forgiving — release anywhere and it
   goes to the nearest compatible anchor. There is no invalid release.
3. A small nudge affordance allows fine adjustment around an anchor for anyone who wants
   it.
4. Dragging a piece well below the room returns it to the tray — the one gesture that
   should remain positional, because it is deliberately coarse.

Why this specific combination:

- **No gesture is load-bearing.** The primary path (tap) has no failure mode. Dragging is
  an enhancement, and its worst case is a no-op on an already-placed piece.
- **No outcome is refusable.** Nearest-compatible-anchor always exists.
- **No decision depends on a live DOM measurement.** Anchors are authored percentages;
  resolution is arithmetic on stored numbers.
- **It is more beautiful, not less.** Anchored art is well-hung art.
- **It is dramatically more testable** — see §5.10.

Keep from the current design: percentage coordinates, real-dimension scaling, the
calibration tool, catalog-driven content, undo, session persistence. None of those are
implicated in the failures.

---

## 5. If we keep the current code: the spec changes required for 100%

Ordered by leverage. These are specification changes — most cost little code, and they
are worth adopting even if the rewrite in §4 happens later.

**5.1 — A release can never fail.** Delete refusal for out-of-bounds and wrong-band. Every
release resolves to the nearest valid position. The only non-placement outcomes are the
two the visitor clearly asked for: return-to-tray, and cancel.

**5.2 — Exactly one code path commits a placement.** Today an element handler, a
window-level safety net, a cancel, and a blur can all end a gesture. Specify one owner.
Everything else may only *report*, never *decide*.

**5.3 — No DOM measurement during a gesture.** Canvas geometry is published when it
changes and read from state. A gesture must never depend on something being measurable at
that instant. This removes the entire "no canvas registered / zero-width rect" class.

**5.4 — The resolver is a pure function.** `(piece, room, releasePoint) → placement`, with
no DOM access and no ambient state. This is what makes exhaustive testing possible: the
whole placement surface can be swept in a loop.

**5.5 — What you see is what lands.** The ghost is currently drawn centred on the pointer
while validity is judged from a separately computed centre. Specify a single geometry
that drives both the preview and the outcome, so a visitor can never be shown one thing
and given another.

**5.6 — Bands attract, they do not gate.** A piece's type selects which surface it is
drawn to. It never causes a rejection.

**5.7 — Every gesture has a visible outcome.** If anything is declined or interrupted,
say so on screen. No state transition is allowed to be silent. (This is now partly built.)

**5.8 — Nothing may share pixels with a draggable.** No overlay, hint, control, or arrow
may overlap a piece or the placement surface — regardless of `pointer-events`, because
that guarantee has already been broken once by a self-dismissing hint sitting over the
floor band.

**5.9 — First-interaction parity.** Nothing may behave differently on the first
interaction than on the hundredth. No self-dismissing overlays in the interaction area,
no lazy registration a gesture depends on, no cold-start measurement. Every visitor is a
first-time visitor; "works after the first try" means "broken" here.

**5.10 — The acceptance criterion is a sweep, not a demo.** "Dragging works" is not
testable. Specify it as: *for every piece, at every point on a grid across the canvas,
the resolver returns a placement, and that placement survives reconciliation.* That is a
loop over a pure function, and it either passes everywhere or names the exact coordinate
where it does not.

---

## 6. Suggested sequencing

Each step is independently shippable and independently valuable.

| Phase | Change | Removes |
|---|---|---|
| 1 | **5.1** — never refuse a release | The entire silent-no-op class |
| 2 | **5.3 + 5.4** — pure resolver, no gesture-time measurement | Cold-start and timing failures |
| 3 | **Tap-to-place becomes the primary path** (§3B/C) | Dependence on the drag gesture |
| 4 | **Authored anchors** (§3A) | Free coordinates, validity rules, bad-looking results |
| 5 | Retire the hand-rolled pointer primitive, or replace with a library (§3D) | Gesture-acquisition failures |

Phase 1 alone should change the felt reliability more than everything done so far,
because it converts every remaining bug from "nothing happened" into "something happened,
slightly wrong" — which a visitor can see, understand, and undo.

---

## 7. Open questions worth deciding before building

1. **How much freedom is actually wanted?** Anchors versus free placement is the fork
   everything else follows from. The brief says "felt board," but the product goal —
   *will this piece work in this room* — is arguably served better by good anchors.
2. **Is repositioning a real requirement, or an artifact?** If a visitor mostly tries one
   piece per wall, the reposition gesture is carrying a lot of risk for little use.
3. **Should a room hold multiple pieces at once?** If not, placement collapses to
   "choose a piece" and most of this complexity disappears.
4. **Who operates it?** A salesperson who can be trained tolerates a different interface
   from an unattended walk-up kiosk. The current design implicitly assumes the latter,
   which is the harder target.

---

## 8. Note on the existing documentation

`README.md` and `replit.md` describe the art record as carrying `defaultScale`,
`minScale`, and `maxScale`. The live contract uses `realWidthInches`,
`realHeightInches`, and `resizeRangePercent`, and rooms have gained `wallWidthFeet` and
`referenceLengthFeet`. The scaling model moved from "a fraction of canvas width" to "real
dimensions against a calibrated wall" — a significant improvement, and the reason scale
honesty is achievable at all — but the docs never caught up. Worth correcting whichever
direction this goes, since those documents are what a future reader will trust.
