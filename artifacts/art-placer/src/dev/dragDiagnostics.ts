/**
 * Throwaway instrumentation for the "the first drag after page load does
 * nothing" bug. Load it with `?debugDrag=1`; it is never bundled otherwise.
 *
 * It exists to decide between three surviving explanations without guessing:
 *
 *  1. The press never reaches the tray item — something is on top of it. The
 *     first-use hint is absolutely positioned over the bottom-left of the room
 *     photo and dismisses itself on its own click, so it would swallow exactly
 *     one interaction and never again. `hit` in the log is the element actually
 *     under the press point; if it is not the tray button, this is the answer.
 *
 *  2. The gesture is recognised but nothing is ready to render. The drag ghost
 *     is created at drag start and only then fetches the full-resolution image.
 *     `ghost` is how long after the press the ghost element appeared and
 *     whether its image had finished loading; `img` reports the fetch itself.
 *
 *  3. The gesture is taken away mid-flight. `end` reports whether the sequence
 *     finished on pointerup or pointercancel, and window focus changes are
 *     logged because the store aborts every live drag on blur.
 *
 * The window listeners here are read-only: capture-phase, passive, and they
 * never call preventDefault or stopPropagation, plus a HUD that is
 * pointer-events none. They cannot alter the behaviour they measure — but they
 * also cannot see inside the gesture, which is why they are now paired with the
 * drag trace (src/dev/dragTrace.ts). The app reports its own stages to that
 * channel and this file renders them interleaved with the raw pointer events,
 * so a drop that does nothing says which rule refused it rather than leaving it
 * to be inferred.
 *
 * Read the two together: a `drop action=none reason=…` line is the app
 * declining the drop on purpose, whereas a `safety-net` or `CANCEL` line with
 * no `drop` after it is the gesture being taken away before it could resolve.
 *
 * Delete this file, src/dev/dragTrace.ts, its call sites and the guarded import
 * in `main.tsx` once the cause is known.
 */

import { setDragTraceSink, type DragTraceEvent } from './dragTrace';

interface GestureRecord {
  n: number;
  t0: number;
  pointerType: string;
  pointerId: number;
  button: number;
  at: string;
  hit: string;
  /** The topmost few elements at the press point, outermost of the stack first. */
  stack: string;
  /** How many layers down the nearest draggable was; -1 if there was none. */
  buriedAt: number;
  moves: number;
  firstMoveMs: number | null;
  travelPx: number;
  ghostMs: number | null;
  ghostImgLoaded: boolean | null;
  end: string | null;
  endMs: number | null;
}

const MAX_LINES = 22;

/** A short, recognisable name for whatever was under the pointer. */
function describe(el: Element | null): string {
  if (!el) return 'none';
  const tag = el.tagName.toLowerCase();
  const label = el.getAttribute('aria-label');
  if (label) return `${tag}[${label.slice(0, 28)}]`;
  const cls = (el.getAttribute('class') ?? '').split(/\s+/).filter(Boolean);
  return cls.length ? `${tag}.${cls.slice(0, 2).join('.')}` : tag;
}

/** The drag ghost, which MainLayout renders fixed at z-50. */
function findGhost(): HTMLElement | null {
  return document.querySelector('.fixed.z-50');
}

export function startDragDiagnostics() {
  const log: GestureRecord[] = [];
  const lines: string[] = [];
  let current: GestureRecord | null = null;
  let count = 0;

  const hud = document.createElement('div');
  hud.setAttribute('data-drag-diagnostics', '');
  hud.style.cssText = [
    'position:fixed',
    'top:0',
    'left:0',
    // Under the artwork on purpose. The drag ghost and the refusal notice are
    // both z-50, so a piece in flight and the reason a drop was refused always
    // read over the top of this rather than being hidden behind it.
    //
    // The HUD cannot swallow a press at any depth: `pointer-events:none` takes
    // it out of hit-testing entirely, so `document.elementFromPoint` — which is
    // what `hit=` below reports — looks straight through it. If `hit=` ever
    // names this element, that is a bug in this file, not the app.
    'z-index:40',
    'max-width:60vw',
    'padding:6px 8px',
    'font:11px/1.35 ui-monospace,SFMono-Regular,Menlo,monospace',
    'white-space:pre',
    'color:#0f0',
    'background:rgba(0,0,0,.82)',
    'pointer-events:none',
  ].join(';');
  document.body.appendChild(hud);

  const say = (line: string) => {
    lines.push(line);
    if (lines.length > MAX_LINES) lines.shift();
    hud.textContent = lines.join('\n');
    console.log('[drag]', line);
  };

  const ms = (t: number) => Math.round(t);

  // -- what the app itself says is happening --------------------------------

  /** Percentages carry a long tail that makes the HUD unreadable. */
  const fmt = (v: unknown) =>
    typeof v === 'number' && !Number.isInteger(v) ? v.toFixed(1) : String(v);

  const trace: DragTraceEvent[] = [];
  /**
   * Whether the app's own hook saw the press that is currently in flight.
   *
   * This is the whole point of pairing the two channels. A press the hook never
   * receives produces a window `down` line and then silence — no `press`, no
   * `start`, no `drop` — which is exactly what "the first touch does nothing"
   * looks like, and it cannot be diagnosed from either channel alone.
   */
  let pressReachedApp = false;

  setDragTraceSink((event) => {
    if (event.phase === 'press') pressReachedApp = true;
    trace.push(event);
    const detail = Object.entries(event.detail ?? {})
      .map(([k, v]) => `${k}=${fmt(v)}`)
      .join(' ');
    // Indented so the app's own stages read as belonging to the pointer event
    // above them rather than as separate gestures.
    say(`    ${event.phase}${detail ? ' ' + detail : ''}`);
  });

  // -- the gesture itself ---------------------------------------------------

  window.addEventListener(
    'pointerdown',
    (e: PointerEvent) => {
      count += 1;
      // The whole stack at the press point, topmost first, so a draggable that
      // is present but buried can be named along with whatever is sitting on it.
      const stack = document.elementsFromPoint(e.clientX, e.clientY);
      const buriedAt = stack.findIndex((el) => el.closest('[data-draggable]'));

      current = {
        n: count,
        t0: e.timeStamp,
        pointerType: e.pointerType,
        pointerId: e.pointerId,
        button: e.button,
        at: `${Math.round(e.clientX)},${Math.round(e.clientY)}`,
        hit: describe(stack[0] ?? null),
        stack: stack.slice(0, 4).map(describe).join(' > '),
        buriedAt,
        moves: 0,
        firstMoveMs: null,
        travelPx: 0,
        ghostMs: null,
        ghostImgLoaded: null,
        end: null,
        endMs: null,
      };
      log.push(current);
      say(
        `#${count} down ${e.pointerType} id=${e.pointerId} btn=${e.button} @${current.at}\n` +
          `    hit=${current.hit}`,
      );

      // A press that lands on top of a draggable rather than on it is the
      // classic "does nothing once, then works forever" cause: an overlay that
      // dismisses itself on its own click swallows exactly one interaction.
      if (buriedAt > 0) {
        say(
          `#${count} !! draggable is ${buriedAt} layer(s) down, covered by\n` +
            `    ${describe(stack[0] ?? null)}\n    stack=${current.stack}`,
        );
      }

      // React's delegated handler runs after this capture-phase listener but
      // within the same task, so a macrotask later is enough to know whether
      // the hook ever saw the press.
      pressReachedApp = false;
      const pressed = current;
      setTimeout(() => {
        if (pressReachedApp || pressed.buriedAt === -1) return;
        say(
          `#${pressed.n} !! press never reached the drag hook\n` +
            `    stack=${pressed.stack}`,
        );
      }, 0);
    },
    { capture: true, passive: true },
  );

  window.addEventListener(
    'pointermove',
    (e: PointerEvent) => {
      if (!current || current.end) return;
      current.moves += 1;
      if (current.firstMoveMs === null) {
        current.firstMoveMs = e.timeStamp - current.t0;
      }
      const [x0, y0] = current.at.split(',').map(Number);
      current.travelPx = Math.round(Math.hypot(e.clientX - x0, e.clientY - y0));
    },
    { capture: true, passive: true },
  );

  const finish = (kind: string) => (e: PointerEvent) => {
    if (!current || current.end) return;
    const elapsed = e.timeStamp - current.t0;
    current.end = kind;
    current.endMs = elapsed;
    const g = current;
    say(
      `#${g.n} ${kind} after ${ms(elapsed)}ms moves=${g.moves} travel=${g.travelPx}px\n` +
        `    firstMove=${g.firstMoveMs === null ? 'never' : ms(g.firstMoveMs) + 'ms'} ` +
        `ghost=${g.ghostMs === null ? 'NEVER' : ms(g.ghostMs) + 'ms'} ` +
        `img=${g.ghostImgLoaded === null ? '-' : g.ghostImgLoaded ? 'loaded' : 'PENDING'}`,
    );
  };

  window.addEventListener('pointerup', finish('up'), { capture: true, passive: true });
  window.addEventListener('pointercancel', finish('CANCEL'), {
    capture: true,
    passive: true,
  });
  window.addEventListener('lostpointercapture', () => {
    if (current && !current.end) say(`#${current.n} lostpointercapture`);
  }, { capture: true, passive: true });

  // -- did the ghost ever appear, and was its image ready? ------------------

  new MutationObserver(() => {
    if (!current || current.ghostMs !== null) return;
    const ghost = findGhost();
    if (!ghost) return;
    // Event timeStamps and performance.now() share performance.timeOrigin, so
    // this is a straight delta from the press.
    current.ghostMs = Math.max(0, performance.now() - current.t0);
    const img = ghost.querySelector('img');
    current.ghostImgLoaded = img ? img.complete && img.naturalWidth > 0 : null;
    say(
      `#${current.n} ghost @${ms(current.ghostMs)}ms img=${
        current.ghostImgLoaded ? 'loaded' : 'PENDING'
      }`,
    );
  }).observe(document.body, { childList: true, subtree: true });

  // -- the things that abort a drag out from under the app ------------------

  window.addEventListener('blur', () => say('window BLUR'));
  window.addEventListener('focus', () => say('window focus'));
  document.addEventListener('visibilitychange', () =>
    say(`visibility=${document.visibilityState}`),
  );

  // -- how long the full-resolution art actually takes to arrive ------------

  try {
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (!entry.name.includes('/api/art-image/')) continue;
        const file = entry.name.split('/').pop() ?? entry.name;
        say(`img ${decodeURIComponent(file).slice(0, 24)} ${ms(entry.duration)}ms`);
      }
    }).observe({ type: 'resource', buffered: true });
  } catch {
    // Older webOS builds may not support the resource entry type; the rest of
    // the diagnostic is still useful without it.
  }

  Object.assign(window as unknown as Record<string, unknown>, {
    __dragLog: log,
    __dragTrace: trace,
  });
  say('drag diagnostics on — window.__dragLog / __dragTrace');
}
