/**
 * One channel every stage of a drag reports to.
 *
 * A placement gesture is spread across four owners — the pointer hook, the
 * piece that started it, the pure drop maths, and the Store's safety net — and
 * each of them can end it. Read separately, none of them can say why a drop
 * did nothing; a refused drop and a cancelled gesture and a drop the hook never
 * started all look the same from outside. This puts their events on one
 * timeline so the answer is a single line in the log rather than an inference.
 *
 * Off by default, and a null check when off, so the call sites can stay in the
 * production path rather than being conditionally compiled around. `?debugDrag=1`
 * installs the sink — see src/dev/dragDiagnostics.ts.
 */

export type DragTracePhase =
  /** Pointer went down on a draggable. */
  | 'press'
  /** Movement passed the threshold: this is a drag, not a tap. */
  | 'threshold'
  /** The owner accepted the gesture and captured its geometry. */
  | 'start'
  /** The owner could not start — no active room, or no canvas to measure. */
  | 'start-refused'
  /** A deliberate release. */
  | 'release'
  /** The gesture was taken away before release. */
  | 'cancel'
  /** The Store's window-level net tore down a gesture still in flight. */
  | 'safety-net'
  /** What the release actually resolved to. */
  | 'drop';

export interface DragTraceEvent {
  phase: DragTracePhase;
  /** Whatever that stage knows. Free-form on purpose — this is a diagnostic. */
  detail?: Record<string, unknown>;
}

let sink: ((event: DragTraceEvent) => void) | null = null;

/** Install a listener, or pass null to remove it. */
export function setDragTraceSink(fn: ((event: DragTraceEvent) => void) | null) {
  sink = fn;
}

/** Report a stage. A no-op — one null check — unless a sink is installed. */
export function traceDrag(
  phase: DragTracePhase,
  detail?: Record<string, unknown>,
) {
  sink?.({ phase, detail });
}
