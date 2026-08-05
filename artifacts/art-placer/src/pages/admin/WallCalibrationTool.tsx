import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { roomImageUrl } from '@/types';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  toDecimalFeet,
  wallWidthFromReference,
  formatFeetInches,
} from '@/lib/sizing';

interface WallCalibrationToolProps {
  /**
   * Identifies which room is being calibrated, so the line is re-laid when the
   * selection changes. Deliberately not the image filename: two rooms may
   * share one photograph while having quite different saved widths.
   */
  roomKey: string;
  imageFilename: string | undefined;
  /** The room's current calibrated wall width. */
  wallWidthFeet: number;
  onChange: (wallWidthFeet: number) => void;
}

/** A reference endpoint as a fraction (0–1) of the rendered image box. */
interface Point {
  x: number;
  y: number;
}

/** Which endpoint a live pointer gesture is dragging. */
type DragTarget = 'a' | 'b';

/** A standard door frame — the reference most photos have to hand. */
const DEFAULT_REFERENCE_FEET = 6;
const DEFAULT_REFERENCE_INCHES = 8;

/** Keeps the opening endpoints clear of the very edges of the frame. */
const MAX_INITIAL_SPAN = 0.94;

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

/**
 * Lays the opening line down so that measuring it reproduces the width the
 * room is already calibrated to.
 *
 * Without this the tool would open showing one number while displaying a line
 * that means a completely different one, and the admin's first nudge of a
 * handle would jump the value wildly.
 *
 * The line is drawn upright where it can be, since the default reference is a
 * door frame and that is how a door reads. A narrow room needs a reference
 * that is longer than the frame is tall, though, so past that point the line
 * tilts to gain the length it needs — the diagonal is the longest chord
 * available. Tilting keeps the opening measurement exact for any room down to
 * about six feet wide rather than quietly clamping to a different number.
 */
function initialPoints(
  wallWidthFeet: number,
  referenceFeet: number,
  box: { width: number; height: number },
): { a: Point; b: Point } {
  const fallback = { a: { x: 0.5, y: 0.15 }, b: { x: 0.5, y: 0.85 } };
  if (!(wallWidthFeet > 0) || !(referenceFeet > 0) || box.width <= 0 || box.height <= 0) {
    return fallback;
  }

  // The length the reference must span for the measurement to come back out
  // as the saved width.
  const targetPx = box.width * (referenceFeet / wallWidthFeet);

  // Spend the frame's height first, then borrow width only if still short.
  const dy = Math.min(targetPx, box.height * MAX_INITIAL_SPAN);
  const shortfall = Math.sqrt(Math.max(0, targetPx * targetPx - dy * dy));
  const dx = Math.min(shortfall, box.width * MAX_INITIAL_SPAN);

  const halfX = dx / box.width / 2;
  const halfY = dy / box.height / 2;

  return {
    a: { x: clamp01(0.5 - halfX), y: clamp01(0.5 - halfY) },
    b: { x: clamp01(0.5 + halfX), y: clamp01(0.5 + halfY) },
  };
}

export function WallCalibrationTool({
  roomKey,
  imageFilename,
  wallWidthFeet,
  onChange,
}: WallCalibrationToolProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  /**
   * The live gesture, plus the endpoints as they were before it started. A
   * cancelled pointer restores that snapshot, so an interrupted drag leaves
   * the calibration exactly as it found it.
   */
  const dragRef = useRef<{
    target: DragTarget;
    pointerId: number;
    from: { a: Point; b: Point };
  } | null>(null);

  const [box, setBox] = useState<{ width: number; height: number } | null>(null);
  const [points, setPoints] = useState<{ a: Point; b: Point } | null>(null);
  const [feet, setFeet] = useState(DEFAULT_REFERENCE_FEET);
  const [inches, setInches] = useState(DEFAULT_REFERENCE_INCHES);

  const referenceFeet = toDecimalFeet(feet, inches);

  // Track the rendered size so the measurement can be derived rather than
  // captured, which keeps the readout honest across resizes.
  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setBox((prev) =>
        prev && prev.width === width && prev.height === height ? prev : { width, height },
      );
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [imageFilename]);

  /**
   * Lay the line down once per room, from that room's saved width. Keyed on
   * the room and its photo rather than on the width, so committing a
   * measurement does not drag the handles out from under the person making it.
   */
  const laidOutFor = useRef<string | null>(null);
  useEffect(() => {
    if (!imageFilename || !box) return;
    const identity = `${roomKey}:${imageFilename}`;
    if (laidOutFor.current === identity) return;
    laidOutFor.current = identity;
    setPoints(initialPoints(wallWidthFeet, referenceFeet, box));
    // Only a change of room or photo should re-lay the line.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomKey, imageFilename, box]);

  /** The width the line currently describes, or null if it is too short. */
  const measure = (candidate: { a: Point; b: Point } | null): number | null => {
    if (!candidate || !box || box.width <= 0) return null;
    const dx = (candidate.a.x - candidate.b.x) * box.width;
    const dy = (candidate.a.y - candidate.b.y) * box.height;
    return wallWidthFromReference({
      lineLengthPx: Math.hypot(dx, dy),
      canvasWidthPx: box.width,
      referenceFeet,
    });
  };

  const measured = measure(points);

  const pointFromEvent = (clientX: number, clientY: number, el: HTMLDivElement): Point => {
    const rect = el.getBoundingClientRect();
    return {
      x: clamp01((clientX - rect.left) / rect.width),
      y: clamp01((clientY - rect.top) / rect.height),
    };
  };

  const movePoint = (target: DragTarget, point: Point) =>
    setPoints((prev) => (prev ? { ...prev, [target]: point } : prev));

  const handlePointerDown = (target: DragTarget) => (e: React.PointerEvent) => {
    e.stopPropagation();
    const el = containerRef.current;
    if (!el || !points) return;
    el.setPointerCapture(e.pointerId);
    dragRef.current = { target, pointerId: e.pointerId, from: points };
    movePoint(target, pointFromEvent(e.clientX, e.clientY, el));
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    const el = containerRef.current;
    const drag = dragRef.current;
    if (!el || !drag || drag.pointerId !== e.pointerId) return;
    // Moves only redraw. Nothing is handed to the form until the gesture ends,
    // so an interrupted drag cannot leave a half-measured width behind.
    movePoint(drag.target, pointFromEvent(e.clientX, e.clientY, el));
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    const el = containerRef.current;
    const drag = dragRef.current;
    if (!el || !drag || drag.pointerId !== e.pointerId) return;
    if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId);

    const next = { ...drag.from, [drag.target]: pointFromEvent(e.clientX, e.clientY, el) };
    dragRef.current = null;
    setPoints(next);

    const width = measure(next);
    if (width !== null) onChange(width);
  };

  /**
   * A cancelled pointer puts the endpoints back and commits nothing. Cancel is
   * emphatically not an alias for pointer-up here: the browser fires it when a
   * gesture is stolen — a scroll takes over, the touch leaves the digitiser —
   * and treating that as a measurement would save a width nobody chose.
   */
  const handlePointerCancel = (e: React.PointerEvent) => {
    const el = containerRef.current;
    const drag = dragRef.current;
    if (!el || !drag || drag.pointerId !== e.pointerId) return;
    if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId);
    setPoints(drag.from);
    dragRef.current = null;
  };

  /** Reference edits re-measure the existing line straight away. */
  const commitReference = (nextFeet: number, nextInches: number) => {
    if (!points || !box || box.width <= 0) return;
    const dx = (points.a.x - points.b.x) * box.width;
    const dy = (points.a.y - points.b.y) * box.height;
    const width = wallWidthFromReference({
      lineLengthPx: Math.hypot(dx, dy),
      canvasWidthPx: box.width,
      referenceFeet: toDecimalFeet(nextFeet, nextInches),
    });
    if (width !== null) onChange(width);
  };

  const parseField = (value: string) => {
    const n = Number(value);
    return Number.isFinite(n) ? Math.max(0, n) : 0;
  };

  const handleFeetChange = (value: string) => {
    const next = parseField(value);
    setFeet(next);
    commitReference(next, inches);
  };

  const handleInchesChange = (value: string) => {
    const next = parseField(value);
    setInches(next);
    commitReference(feet, next);
  };

  const handleStyle =
    'absolute w-4 h-4 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary border-2 border-primary-foreground shadow-md cursor-grab active:cursor-grabbing touch-none z-20';

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
        <div className="space-y-1.5">
          <Label>Reference length</Label>
          <div className="flex items-end gap-2">
            <div className="space-y-1">
              <span className="text-xs text-muted-foreground">Feet</span>
              <Input
                type="number"
                min="0"
                step="1"
                value={feet}
                onChange={(e) => handleFeetChange(e.target.value)}
                className="w-20"
                data-testid="input-reference-feet"
              />
            </div>
            <div className="space-y-1">
              <span className="text-xs text-muted-foreground">Inches</span>
              <Input
                type="number"
                min="0"
                step="1"
                value={inches}
                onChange={(e) => handleInchesChange(e.target.value)}
                className="w-20"
                data-testid="input-reference-inches"
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Defaults to a standard door frame (6 ft 8 in). Change it to match
            whatever you laid the line along — a countertop, a window, a door.
          </p>
        </div>

        <div className="space-y-1.5">
          <Label>Measured wall width</Label>
          <div className="bg-muted/50 rounded-md border border-border/50 px-3 py-2">
            {measured === null && points !== null ? (
              <p className="text-sm text-muted-foreground" data-testid="text-calibration-guidance">
                Draw the line a little longer along your reference — it is too
                short to measure reliably yet.
              </p>
            ) : (
              <p
                className="text-sm text-foreground font-medium"
                data-testid="text-calibration-result"
              >
                This wall is {formatFeetInches(measured ?? wallWidthFeet)} wide.
              </p>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            Every piece is scaled against this width, so it is what makes a 48"
            canvas read at the correct size in this particular room. Re-drag the
            endpoints any time to redo the measurement.
          </p>
        </div>
      </div>

      <div
        ref={containerRef}
        className="relative w-full aspect-[16/10] bg-card border border-border rounded-lg overflow-hidden shadow-sm select-none touch-none"
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
      >
        {imageFilename ? (
          /*
            Framed exactly as RoomCanvas frames it — a 16:10 box, the photo
            `object-contain` inside it and otherwise untouched — so this box
            shows precisely the wall the visitor sees. Framing it any other way
            here measures a different span of wall than the board renders, and
            every piece in the room then hangs at the wrong size.
          */
          <img
            src={roomImageUrl(imageFilename)}
            className="w-full h-full object-contain pointer-events-none"
            alt="Room to calibrate"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground font-serif bg-muted/30">
            <span className="mb-2">No image selected</span>
            <span className="text-xs font-sans">
              Pick or upload a room image to calibrate its wall width
            </span>
          </div>
        )}

        {imageFilename && points && (
          <>
            {/* The reference line between the two endpoints. */}
            <svg
              className="absolute inset-0 w-full h-full pointer-events-none z-10"
              preserveAspectRatio="none"
            >
              <line
                x1={`${points.a.x * 100}%`}
                y1={`${points.a.y * 100}%`}
                x2={`${points.b.x * 100}%`}
                y2={`${points.b.y * 100}%`}
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                strokeDasharray="6 4"
              />
            </svg>

            <div
              className={handleStyle}
              style={{ left: `${points.a.x * 100}%`, top: `${points.a.y * 100}%` }}
              onPointerDown={handlePointerDown('a')}
              data-testid="handle-reference-a"
            />
            <div
              className={handleStyle}
              style={{ left: `${points.b.x * 100}%`, top: `${points.b.y * 100}%` }}
              onPointerDown={handlePointerDown('b')}
              data-testid="handle-reference-b"
            />
          </>
        )}
      </div>
    </div>
  );
}
