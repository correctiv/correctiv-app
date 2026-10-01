/**
 * Which screens have an arrangement the newsroom edits, and where each one's document is.
 *
 * [ADR 0054](../../../../adr/0054-a-block-declares-where-it-may-appear.md) §5 left the
 * parser half open while one screen existed. A screen's document is now keyed by this id,
 * and `parseHomeLayout` takes the screen it is reading so that it can refuse a block the
 * app declares for other screens only. Moments, conditions and audiences
 * (ADR 0039, ADR 0060) are part of the document's grammar, so they apply to every screen.
 *
 * The type is the core's because the parser is; the declaration of which block belongs
 * where stays in the app (`apps/mobile/src/lib/home/screens.ts`) and arrives through
 * `module-screens.generated.ts`.
 */

import entdeckenDocument from '../data/layout/screens/entdecken.json';
import mitmachenDocument from '../data/layout/screens/mitmachen.json';
import homeDocument from '../data/layout/screens/home.json';
import mediathekDocument from '../data/layout/screens/mediathek.json';

/** A screen whose arrangement is a document. A union, so a second one is a type error where unthought of. */
export type ConfigurableScreen = 'home' | 'entdecken' | 'mediathek' | 'mitmachen';

export const CONFIGURABLE_SCREENS: readonly ConfigurableScreen[] = [
  'home',
  'entdecken',
  'mediathek',
  'mitmachen',
];

/** The bundled document of each screen, as written. */
export const SCREEN_DOCUMENTS = {
  home: homeDocument,
  entdecken: entdeckenDocument,
  mediathek: mediathekDocument,
  mitmachen: mitmachenDocument,
} satisfies Record<ConfigurableScreen, unknown>;
