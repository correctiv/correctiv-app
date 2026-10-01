/**
 * `/gallery` — every component in `src/components`, on one page.
 *
 * A page for developers and designers rather than for readers, and it is
 * published like any other route. That was measured rather than assumed: the
 * components it draws are already in the bundle, because real screens use them,
 * so the page costs its catalogue and its fixtures and nothing else. ADR 0025
 * carries the figure, and is the only place it is written down, because a
 * measurement typed twice is a measurement that goes wrong in one of them.
 *
 * **The address alone does not reach this page on the dev server.** A development
 * bundle does not apply `experiments.baseUrl` when it matches routes, so
 * `/app/gallery` renders the app's own 404 — as does `/app/` itself
 * ([ADR 0025](../../../../adr/0025-the-published-app-is-a-production-bundle.md)).
 * A frame gets here anyway, by handing the route to the app's own router over the
 * dev handle; the workbench's `preview/AppFrame.tsx` is what does it. Outside a
 * frame, `npm run web:root` starts the dev server without the base path so that
 * route matching works, and `/gallery` is then an ordinary address.
 */
import { useLocalSearchParams } from 'expo-router';

import { Gallery } from '@/gallery/Gallery';
import { useDocumentTitle } from '@/lib/navigation/documentTitle';

/**
 * `?c=ui/SectionCard` narrows the page to one component, `&bare=1` strips the
 * page's own furniture off it.
 *
 * `c` is what lets the workbench's reference link here, and what the way back is
 * addressed with. `componentId` in `gallery/catalogue.tsx` is the shape of it, and
 * the reference resolves the same two parts to its own rows.
 *
 * `bare` is for the frame that reference draws in each of its rows: 393 pixels
 * wide, one component in it, and the surrounding page already saying everything
 * this page's header says. It is a display, so it takes no chrome.
 */
export default function GalleryRoute() {
  // English, like the page's own heading and everything else on it: this one is
  // read by developers and designers rather than by readers (AGENTS.md, Language).
  useDocumentTitle('Component gallery');
  const { c, bare } = useLocalSearchParams<{ c?: string; bare?: string }>();
  return <Gallery only={typeof c === 'string' && c ? c : undefined} bare={bare === '1'} />;
}
