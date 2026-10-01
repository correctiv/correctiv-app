import { useEffect, useState } from 'react';

/**
 * A media query as state, so layout can branch in JSX rather than only in CSS.
 *
 * Used where the two layouts are different trees, not different classes: below
 * the wide breakpoint the sidebars are overlays that close on a tap outside, and
 * above it they are panels in a resizable group. A class cannot turn one into the
 * other.
 *
 * The initial read happens during the first render, not in an effect, because a
 * phone would otherwise get one frame of the desktop layout, and that frame is
 * what the resizable group measures itself against.
 */
export function useMedia(query: string): boolean {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches);

  useEffect(() => {
    const list = window.matchMedia(query);
    const onChange = () => setMatches(list.matches);
    onChange();
    list.addEventListener('change', onChange);
    return () => list.removeEventListener('change', onChange);
  }, [query]);

  return matches;
}

/**
 * Where the shell stops being an editor with two docked sidebars.
 *
 * 64rem, the same 1024 the preview uses to decide that a drawn phone would be
 * smaller than the screen it is drawn on.
 */
export const WIDE = '(min-width: 64rem)';
