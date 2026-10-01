import { useEffect } from 'react';

/**
 * The title the document was served with, and what the tab goes back to when no
 * screen is naming it.
 *
 * Read once, at module scope, before any screen has written one — so it is the
 * `<title>` in the shipped HTML rather than whatever the last screen happened to
 * leave behind. In the published export that string is empty, because the export
 * contains no rendered screen at all
 * ([ADR 0030](../../../../../adr/0030-the-platforms-header-and-ours-on-web.md)),
 * and an empty tab is what the tab roots and the entry page show today.
 */
const served = typeof document === 'undefined' ? '' : document.title;

/**
 * Every screen currently naming itself, in the order they mounted. The last one
 * is the one on top of the stack, and therefore the one the tab shows.
 */
let naming: { title: string }[] = [];

function write(): void {
  document.title = naming.length > 0 ? naming[naming.length - 1].title : served;
}

/**
 * Names the browser tab for as long as this screen is mounted.
 *
 * **Why this is a list and not a saved string.** The obvious version reads
 * `document.title` on mount and writes it back on unmount, and it is correct for
 * one screen at a time. It is wrong the moment two screens go at once: React runs
 * cleanups in tree order, so the screen underneath restores first and the screen
 * on top then puts the underneath one's title back — and that title belongs to a
 * screen that has just been dismissed. The app has one path that does it,
 * `formular.tsx`'s `router.dismissTo('/(tabs)/mitmachen')` over
 * `(tabs) > /aufruf/[slug] > /formular`, and the tab it lands on would be left
 * reading "Mitmach-Aufruf". Nothing here reads the document, so no order of
 * cleanups can produce a title nobody claims: the tab is a function of who is
 * mounted.
 *
 * **Why the header does not do this itself.** Five routes have no `ScreenHeader`
 * — the reader, the player, the onboarding, the gallery and the 404 — and a
 * pushed route that names nothing leaves the tab reading the screen underneath
 * it. That is worse than an empty tab, because it names a different screen, so
 * those five call this directly. ADR 0030 carries the measurement.
 */
export function useDocumentTitle(title: string): void {
  useEffect(() => {
    const entry = { title };
    naming.push(entry);
    write();
    return () => {
      naming = naming.filter((other) => other !== entry);
      write();
    };
  }, [title]);
}
