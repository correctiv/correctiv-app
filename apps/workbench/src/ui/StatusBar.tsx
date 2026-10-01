import type { ReactNode } from 'react';

/**
 * The line along the bottom, which is always there and always says the same
 * kinds of thing.
 *
 * On the app view it carries what the preview used to put in its own footer:
 * which appearance combination is on screen, the frame's size and zoom, and
 * whether the build has a dev handle. Elsewhere it carries where you are. A bar
 * that appears and disappears is furniture; one that is always there is a place
 * to look.
 */
export function StatusBar({ children }: { children: ReactNode }) {
  return (
    <footer className="flex h-[1.75rem] shrink-0 items-center gap-s overflow-hidden border-t border-stroke bg-surface px-s text-s text-on-canvas-muted">
      {children}
    </footer>
  );
}
