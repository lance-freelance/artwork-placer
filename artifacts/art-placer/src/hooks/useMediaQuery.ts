import { useEffect, useState } from 'react';

/**
 * Subscribe to a CSS media query and re-render when it flips.
 *
 * Used to decide where the floating controls live. Deliberately driven by the
 * viewport alone: the answer must never depend on anything the controls
 * themselves affect, or the decision would feed back into the layout it drives.
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() =>
    typeof window === 'undefined' ? false : window.matchMedia(query).matches,
  );

  useEffect(() => {
    const mql = window.matchMedia(query);
    const onChange = () => setMatches(mql.matches);
    onChange();
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, [query]);

  return matches;
}
