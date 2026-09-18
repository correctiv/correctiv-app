/**
 * A hand-picked walk through `apps/mobile/src/app`, one entry per route shape.
 *
 * Not generated, so a new screen will not appear here on its own. The route field
 * takes any path, and whatever the frame navigates to is read back live, so this
 * list is a convenience and never the truth about what routes exist. Generating it
 * from the router is an open question: `expo-router` serves `/_sitemap` in a dev
 * build, but the export has none, so a list that is honest in both places has to
 * come from the file tree at build time.
 *
 * An entry can carry a note, because the point of the picker is the pages nobody
 * would guess the address of. `/behauptung/claim-001` is not a thing anybody types.
 *
 * ## What is a message here and what is not
 *
 * The groups and the notes are this site describing the app, so they follow the
 * language setting like the rest of the chrome
 * ([ADR 0050](../../../../adr/0050-the-workbench-gets-a-second-audience.md) §2).
 * `wbMessage()` declares them, because a table is not a component and this module
 * may not import React; `src/i18n/messages.ts` says why it takes one descriptor per
 * call, and `preview/ui/Pages.tsx` is what formats them.
 *
 * **Most of the labels are not messages, and that is not an oversight.** The app
 * ships in German, so `Entdecken`, `Mediathek`, `Mitmachen` and the rest are the
 * screens' own names — what is written in the app's tab bar, what the team says out
 * loud, and what somebody typing into this field is looking for. Translating one
 * into English would rename a screen rather than translate a sentence, which is the
 * exemption `frame.ts` already grants `Portrait` and `Fit` and `Settings.tsx` grants
 * `English` and `Deutsch`. The three that ARE messages are the three this site
 * named itself, because the screen behind them has no name of its own.
 */
import { wbMessage, type WorkbenchMessage } from '../i18n/messages';

export interface Page {
  route: string;
  /** The screen's own name, or a message where this site had to invent one. */
  label: string | WorkbenchMessage;
  /** One line, shown beside the label. Left out where the label says it all. */
  note?: WorkbenchMessage;
}

export interface PageGroup {
  group: WorkbenchMessage;
  pages: Page[];
}

export const PAGES: PageGroup[] = [
  {
    group: wbMessage({
      id: 'frame.pages.group.tabs',
      defaultMessage: 'Tabs',
      description: 'The group of the app’s five tab-bar screens, in the page picker.',
    }),
    pages: [
      {
        route: '/',
        label: wbMessage({
          id: 'frame.pages.home',
          defaultMessage: 'Home',
          description:
            'The app’s first tab. One of the three entries in the picker this site had to name itself, because the screen carries no name of its own the way Entdecken and Mediathek do.',
        }),
      },
      { route: '/entdecken', label: 'Entdecken' },
      { route: '/mediathek', label: 'Mediathek' },
      { route: '/mitmachen', label: 'Mitmachen' },
      { route: '/profil', label: 'Profil' },
    ],
  },
  {
    group: wbMessage({
      id: 'frame.pages.group.screens',
      defaultMessage: 'Screens',
      description: 'The group of the app’s screens that are not tabs and take no id.',
    }),
    pages: [
      {
        route: '/artikel',
        label: 'Artikel',
        note: wbMessage({ id: 'frame.pages.artikel', defaultMessage: 'the reader, a WebView' }),
      },
      { route: '/spotlight', label: 'Spotlight' },
      { route: '/suche', label: 'Suche' },
      {
        route: '/gespeichert',
        label: 'Gespeichert',
        note: wbMessage({
          id: 'frame.pages.gespeichert',
          defaultMessage: 'a FlatList',
          description:
            'Beside the saved-articles screen. A FlatList is React Native’s own name for the component, and is not translated.',
        }),
      },
      { route: '/backstage', label: 'Backstage' },
      { route: '/atlas', label: 'Abriss-Atlas' },
      { route: '/bericht', label: 'Quartalsbericht' },
      { route: '/einstellungen', label: 'Einstellungen' },
      { route: '/faktenforum', label: 'Faktenforum' },
      {
        route: '/formular',
        label: 'Formular',
        note: wbMessage({
          id: 'frame.pages.formular',
          defaultMessage: 'the participation form',
        }),
      },
      {
        route: '/onboarding',
        label: 'Onboarding',
        note: wbMessage({ id: 'frame.pages.onboarding', defaultMessage: 'a modal' }),
      },
      {
        route: '/player',
        label: 'Player',
        note: wbMessage({
          id: 'frame.pages.player',
          defaultMessage: 'a modal over the running audio',
        }),
      },
      { route: '/video', label: 'Video' },
    ],
  },
  {
    group: wbMessage({
      id: 'frame.pages.group.withAnId',
      defaultMessage: 'With an id',
      description:
        'The group of route shapes whose last segment names one article, project or claim. The address in each row is one example of the shape.',
    }),
    pages: [
      { route: '/aufruf/wem-gehoert-die-stadt', label: 'Aufruf' },
      { route: '/behauptung/claim-001', label: 'Behauptung' },
      { route: '/projekt/klima', label: 'Projekt' },
      {
        route: '/serie/klima',
        label: 'Podcast-Serie',
        note: wbMessage({
          id: 'frame.pages.serie',
          defaultMessage: 'the second FlatList',
          description:
            'Beside the podcast series screen. A FlatList is React Native’s own name for the component, and is not translated; the first one is frame.pages.gespeichert.',
        }),
      },
      { route: '/tagebuch/diary-bern-2', label: 'Tagebuch' },
    ],
  },
  {
    /*
     * The not-found screen is in here as an address on purpose, because any
     * address the app has no route for is one of them.
     *
     * Not the recovery screen, though it belongs in a group like this. It has no
     * address: it is reached by something throwing, and a route that throws would
     * be published like any other. Giving it one is #112's kind of problem.
     */
    group: wbMessage({
      id: 'frame.pages.group.worthReaching',
      defaultMessage: 'Worth being able to reach',
      description:
        'The group of two addresses that are not screens of the app in the ordinary sense: its component gallery and its 404.',
    }),
    pages: [
      {
        route: '/gallery',
        label: wbMessage({
          id: 'frame.pages.gallery',
          defaultMessage: 'Component gallery',
          description:
            'The app’s own gallery screen, which this site named because the screen is a development surface with no name in the product.',
        }),
        note: wbMessage({
          id: 'frame.pages.gallery.note',
          defaultMessage: 'every component, twice, on both surfaces',
        }),
      },
      {
        route: '/diese-seite-gibt-es-nicht',
        label: wbMessage({
          id: 'frame.pages.notFound',
          defaultMessage: 'Not found',
          description:
            'The app’s own 404 screen, in the picker. nav.title.notFound is this SITE’s 404 in the browser tab and reads the same in English.',
        }),
        note: wbMessage({
          id: 'frame.pages.notFound.note',
          defaultMessage: 'any address the app has no route for',
        }),
      },
    ],
  },
];

/** Flat, for the field's own autocomplete. */
export const ROUTES: string[] = PAGES.flatMap((g) => g.pages.map((p) => p.route));
