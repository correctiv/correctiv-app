import { defineMessages, type MessageDescriptor } from 'react-intl';

import type { ConfigurableScreen } from '@correctiv/app-core/lib/screen-layout';

/**
 * What a tab can be, declared where the app is: the route file it is, and the screen
 * whose document says what it is called. The navigation document in the core only
 * chooses among these ids and orders them
 * ([ADR 0071](../../../../adr/0071-screens-become-documents-and-the-tab-bar-becomes-one-too.md)
 * §4).
 *
 * **The words and the icon left this table**
 * ([ADR 0075](../../../../adr/0075-a-document-carries-its-own-words-and-a-screen-says-what-it-is-called.md)
 * §5). A destination used to declare its label as a message and its icon in each
 * platform's vocabulary; both now come out of the screen's own document, because a
 * screen that is not on the bar still has a name and the newsroom means to change it
 * without waiting for a release. `lib/navigation/tabWords.ts` is where a bar reads
 * them, out of the one copy of the document the entries come from, and
 * `screenIcons.ts` is still where the icon a key names is declared.
 *
 * What is left here is placement: which route files exist, which of them a document
 * may name, and which screen each one draws. The feature a destination belongs to is
 * `TAB_FEATURES` in `features.ts`, which is where `feature-gating.test.ts` holds it
 * against `features.json`; it is not repeated here, so there is one place to be wrong.
 */
export interface TabTarget {
  /** The route file under `app/(tabs)/`, which is also the id the document names. */
  readonly route: string;
  /**
   * The screen whose document carries this tab's label and icon, absent for a tab that
   * is the app's own rather than the newsroom's.
   *
   * The route and the screen are the same word for the four destinations and are not
   * for Home, whose route file is `index.tsx` and whose document is `home.json`. "Mehr"
   * has no document at all: it is the screen the app draws when the bar overflows
   * (ADR 0071 §5), so its word stays a message below.
   */
  readonly screen?: ConfigurableScreen;
}

/**
 * The one label of the bar that is the app's, in ENGLISH; the German ships in
 * `packages/catalogue/src/de/ui.ts` (ADR 0026 §6).
 *
 * The other five left the catalogue with ADR 0075 §5: a screen's tab label is in the
 * screen's document now, and an id the catalogue carries beside it would be a second
 * answer to one question.
 */
const COPY = defineMessages({
  more: {
    id: 'ui.tabMore',
    defaultMessage: 'More',
    description:
      'The last tab when the bar has more destinations than it can show, and the heading of the screen that lists the rest. One short word.',
  },
});

/** What "Mehr" is called, for the bars and for the screen itself. */
export const MORE_LABEL: MessageDescriptor = COPY.more;

const HOME: TabTarget = { route: 'index', screen: 'home' };

const MORE: TabTarget = { route: 'mehr' };

/** What the navigation document may name, after Home. */
export const DESTINATIONS: Readonly<Record<string, TabTarget>> = {
  entdecken: { route: 'entdecken', screen: 'entdecken' },
  mediathek: { route: 'mediathek', screen: 'mediathek' },
  mitmachen: { route: 'mitmachen', screen: 'mitmachen' },
  profil: { route: 'profil', screen: 'profil' },
};

/** The ids a navigation document may name: the parser's `known` set (ADR 0071 §6). */
export const KNOWN_DESTINATIONS: ReadonlySet<string> = new Set(Object.keys(DESTINATIONS));

/** Every route file under `app/(tabs)/` and how it is drawn as a tab. */
export const TAB_TARGETS: Readonly<Record<string, TabTarget>> = {
  index: HOME,
  ...DESTINATIONS,
  mehr: MORE,
};

/** Every tab route, in the order the files are declared to the navigator when nothing overflows. */
export const TAB_ROUTES: readonly string[] = Object.keys(TAB_TARGETS);
