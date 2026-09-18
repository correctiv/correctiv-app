import { DIAGRAMS } from './diagrams';
import { wbMessage, type WorkbenchMessage } from './i18n/messages';

/**
 * A page's name: a descriptor where this site wrote it, a plain string where it
 * came out of the repository.
 *
 * Both, because the table below holds both and the difference is the language
 * rule rather than an inconsistency
 * ([ADR 0050](../../../adr/0050-the-workbench-gets-a-second-audience.md) §2). The
 * site's chrome follows the language setting; the repository's content does not,
 * and a drawing's caption is content. So a diagram's title arrives from
 * `DIAGRAMS` already spelled and stays that way, and everything this file names
 * itself is a message.
 */
export type PageTitle = WorkbenchMessage | string;

/**
 * What each self-answered route is called, for the browser tab and the palette.
 *
 * The document routes take their title from the document's own h1. These have no
 * document, and deriving a title from the path gave "preview — Workbench" in
 * lower case, which is what a route is named and not what a page is called.
 *
 * No React here, the way `shell/views.ts` has none and for a weaker version of the
 * same reason: this is a table, and `wbMessage()` is the identity function that
 * lets a table declare a message without `react-intl` and so without React.
 * `src/i18n/messages.ts` says why it takes one descriptor per call.
 */
export const PAGE_TITLES: Record<string, PageTitle> = {
  // The site's own name, which is a name rather than a sentence: a German reader
  // looking for this tab is looking for the same six words. `English` and
  // `Deutsch` in the settings picker are exempt for the same reason.
  '/': 'CORRECTIV app workbench',
  '/handbook': wbMessage({
    id: 'nav.handbook',
    defaultMessage: 'Handbook',
    description:
      'The documents area of this site, at /handbook. The word is this repository’s own name for it and appears in the browser tab and in the search palette.',
  }),
  ...Object.fromEntries(DIAGRAMS.map((d) => [`/diagrams/${d.id}`, d.title])),
  '/components': wbMessage({ id: 'nav.components', defaultMessage: 'Components, the app’s own' }),
  '/decisions': wbMessage({ id: 'nav.decisions', defaultMessage: 'Decision records' }),
  '/design': wbMessage({ id: 'nav.design', defaultMessage: 'Design, the Figma file' }),
  '/diagrams': wbMessage({ id: 'nav.diagrams', defaultMessage: 'Architecture diagrams' }),
  '/reference': wbMessage({ id: 'nav.reference', defaultMessage: 'Reference, the core' }),
  '/sources': wbMessage({ id: 'nav.sources', defaultMessage: 'Sources status board' }),
  '/preview': wbMessage({ id: 'nav.preview', defaultMessage: 'Preview' }),
};

/** The two titles the tab needs that no route in the table above carries. */
export const TITLE_COPY = {
  component: wbMessage({
    id: 'nav.title.component',
    defaultMessage: '{name}, a component',
    description:
      'The browser tab on a component’s own page. {name} is the component’s own name, which is an identifier and is never translated.',
  }),
  notFound: wbMessage({
    id: 'nav.title.notFound',
    defaultMessage: 'Not found',
    description: 'The browser tab on an address this site answers with its 404 body.',
  }),
};

/**
 * One place that knows a title may be either, so no reader carries the `typeof`.
 *
 * The formatter is passed in rather than imported, which is what keeps this file
 * free of React: the caller has `useWorkbenchIntl()` already.
 */
export function pageTitleText(
  title: PageTitle,
  format: (message: WorkbenchMessage) => string,
): string {
  return typeof title === 'string' ? title : format(title);
}

/**
 * The anchor the reference gives each symbol, and the palette jumps to.
 *
 * Here rather than in either of them: two places deriving the same id is how a
 * search result quietly stops landing anywhere.
 */
export function symbolId(subpath: string, name: string): string {
  return `s-${subpath.replace(/\//g, '-')}-${name}`;
}

/**
 * The same, for a component, and the platform is part of it.
 *
 * `media/VideoFrame` is two components with one name, one for the device and one
 * for the web, and an anchor that ignored the difference would send both halves
 * of the palette to whichever row rendered first.
 */
export function componentId(group: string, name: string, platform: string | null): string {
  return `c-${group}-${name}${platform ? `-${platform}` : ''}`;
}
