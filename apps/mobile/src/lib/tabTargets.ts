import { defineMessages, type MessageDescriptor } from 'react-intl';

/**
 * The one label of the bar that is the app's, in ENGLISH; the German ships in
 * `packages/catalogue/src/de/ui.ts` (ADR 0026 §6).
 *
 * Every other tab is a screen, and a screen's tab label and icon are in the screen's own
 * document ([ADR 0075](../../../../adr/0075-a-document-carries-its-own-words-and-a-screen-says-what-it-is-called.md)
 * §5). "Mehr" is the one tab with no document: it is the list the bar draws when a screen
 * has no room on it, so its word stays a message, and `lib/navigation/tabWords.ts` is where
 * a bar reads it. Which screens a bar holds, and in what order, is the layout's navigation
 * ([ADR 0078](../../../../adr/0078-layouts-ship-and-demo.md) §5), and nothing here lists
 * them.
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
