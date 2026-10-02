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
import profilDocument from '../data/layout/screens/profil.json';
import mediathekDocument from '../data/layout/screens/mediathek.json';

/** A screen whose arrangement is a document. A union, so a second one is a type error where unthought of. */
export type ConfigurableScreen = 'home' | 'entdecken' | 'mediathek' | 'mitmachen' | 'profil';

export const CONFIGURABLE_SCREENS: readonly ConfigurableScreen[] = [
  'home',
  'entdecken',
  'mediathek',
  'mitmachen',
  'profil',
];

/** The bundled document of each screen, as written. */
export const SCREEN_DOCUMENTS = {
  home: homeDocument,
  entdecken: entdeckenDocument,
  mediathek: mediathekDocument,
  mitmachen: mitmachenDocument,
  profil: profilDocument,
} satisfies Record<ConfigurableScreen, unknown>;

/** The version of the envelope the deploy joins the screens into. Not a screen's `version`. */
export const SCREEN_LAYOUTS_VERSION = 1;

/**
 * The published document: every screen's file under its screen id, and the navigation
 * beside them, joined and nothing else (ADR 0071 §1, §6). An app that does not know a key
 * beside `screens` ignores it.
 */
export function joinScreenDocuments(
  documents: Record<string, unknown>,
  navigation?: unknown,
): {
  version: number;
  screens: Record<string, unknown>;
  navigation?: unknown;
} {
  return navigation === undefined
    ? { version: SCREEN_LAYOUTS_VERSION, screens: documents }
    : { version: SCREEN_LAYOUTS_VERSION, screens: documents, navigation };
}

/** The navigation out of a fetched joined document, or `undefined` when it carries none. */
export function navigationDocumentOf(body: unknown): unknown {
  if (typeof body !== 'object' || body === null) return undefined;
  return Object.hasOwn(body, 'navigation')
    ? (body as { navigation: unknown }).navigation
    : undefined;
}

/**
 * One screen's document out of a fetched joined one, or `undefined` when the body is not
 * a joined document or does not carry that screen. Only the screens the caller asks for
 * are read, so one this app does not know is ignored without being named.
 */
export function screenDocumentOf(body: unknown, screen: ConfigurableScreen): unknown {
  if (typeof body !== 'object' || body === null) return undefined;
  const screens = (body as { screens?: unknown }).screens;
  if (typeof screens !== 'object' || screens === null || Array.isArray(screens)) return undefined;
  return Object.hasOwn(screens, screen) ? (screens as Record<string, unknown>)[screen] : undefined;
}
