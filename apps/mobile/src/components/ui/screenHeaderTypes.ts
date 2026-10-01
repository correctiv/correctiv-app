import type { ReactNode } from 'react';

/**
 * Shared contract for the two `ScreenHeader` implementations. It exists as its
 * own module so the native and web files cannot drift apart: both import this
 * type, so a change to one signature breaks the other at compile time (the same
 * reason as in components/reader/types.ts).
 *
 * The name every screen has to give itself, intersected with a union of the two
 * ways it may be drawn. The union is there because `backLabel` and `children` are
 * meaningless without a bar to put them in: on iOS and Android the header is the
 * platform's, and a prop it cannot honour must not typecheck. That is what makes
 * the two exceptions of [ADR 0030](../../../../../adr/0030-the-platforms-header-and-ours-on-web.md)
 * visible at the call site rather than silently ignored.
 */
export type ScreenHeaderProps = {
  /**
   * The screen's name, in German.
   *
   * Route metadata on iOS and Android — the platform's header draws no title,
   * because every one of these screens prints the same word in larger type
   * directly below it — and on web it is the browser tab. Required, because until
   * ADR 0030 no `Stack.Screen` set one and every pushed route in the published
   * export carried an empty `<title>`: a defect nothing could see, since a
   * missing title looks like the address bar doing its job.
   */
  title: string;
} & (
  | {
      drawnBar?: false;
      backLabel?: never;
      children?: never;
    }
  | {
      /**
       * Keeps the app's own drawn bar on every platform instead of configuring
       * the platform's header. Two screens set it, and ADR 0030 names both:
       * `/suche`, whose search field is a different interaction on each platform,
       * and `/formular`, whose "Abbrechen" would disappear on Android because a
       * native header there shows no back title.
       */
      drawnBar: true;
      /**
       * Label of the back control. "Abbrechen" in the form, where a second
       * "Zurück" button steps within the form — two identically named buttons
       * meaning different things would be a trap.
       */
      backLabel?: string;
      /**
       * Sits right of the back control (the search field on `/suche`). When
       * something is set, back shrinks to the chevron alone — otherwise the row
       * does not fit.
       */
      children?: ReactNode;
    }
);
