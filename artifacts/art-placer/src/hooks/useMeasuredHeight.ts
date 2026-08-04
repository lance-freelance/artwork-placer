import { useLayoutEffect, useState } from 'react';

/**
 * Track an element's rendered height, live across resizes.
 *
 * The matte reserves space for the top and bottom chrome by *measuring* it
 * rather than hard-coding pixel floors, so the room canvas always gets every
 * pixel the chrome is not using — and the chrome can change size (wrapping
 * room tabs, a taller tray) without anyone re-tuning a constant.
 *
 * Returns a ref callback and the current height. The initial value is only
 * used for the first paint, before the observer reports.
 */
export function useMeasuredHeight(initial: number) {
  const [node, setNode] = useState<HTMLElement | null>(null);
  const [height, setHeight] = useState(initial);

  useLayoutEffect(() => {
    if (!node) return;

    const update = () => {
      const next = node.getBoundingClientRect().height;
      // Ignore sub-pixel churn. Equal values also let React bail out of the
      // re-render, which is what keeps a width-driven resize from looping.
      setHeight((prev) => (Math.abs(prev - next) < 0.5 ? prev : next));
    };

    update();
    const observer = new ResizeObserver(update);
    observer.observe(node);
    return () => observer.disconnect();
  }, [node]);

  return [setNode, height] as const;
}
