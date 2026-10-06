/**
 * The `demo` layout, for the workbench and the tests (ADR 0078 §3).
 *
 * The app bundles `ship` and nothing else, so nothing under `src/` or in `apps/mobile` may
 * import this file: `test/layouts.test.ts` fails when one does. The typed object, rather than
 * a `Record<string, unknown>`, is deliberate: the documents are what the grammar's tests and
 * the editor's baseline are written against.
 */
import entdecken from './screens/entdecken.json';
import home from './screens/home.json';
import mediathek from './screens/mediathek.json';
import mitmachen from './screens/mitmachen.json';
import profil from './screens/profil.json';
import navigation from './navigation.json';

export const DEMO_SCREENS = { home, entdecken, mediathek, mitmachen, profil };

export const DEMO_NAVIGATION: unknown = navigation;
