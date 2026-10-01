import { defineMessages, type IntlShape } from 'react-intl';

import type { RadioCopy } from '@correctiv/app-core/stores/audio';

/**
 * How the Salon5 live stream names itself, in ENGLISH; the German that ships is
 * in `packages/catalogue/src/de/player.ts` (ADR 0026 §6).
 *
 * Descriptors rather than strings, because this module holds no React and so
 * cannot call `useIntl`: whoever puts these on a screen formats them. They live
 * here rather than in the banner because the banner and the lock screen print the
 * same words, and the station's name is one fact.
 *
 * `liveSubtitle` is the third because the stream's line is not the same on every
 * surface. The banner carries a `Live` badge of its own and prints `subtitle`
 * under it; the mini bar and the lock screen have no badge, so what they print is
 * the marked line. It is declared in `app/player.tsx` too, under this same id —
 * the full player says it in its own voice, and `npm run i18n:extract --throws`
 * fails on one id carrying two different defaults.
 */
export const SALON5_RADIO_COPY = defineMessages({
  title: { id: 'player.radioTitle', defaultMessage: 'Salon5 Radio' },
  subtitle: { id: 'player.radioSubtitle', defaultMessage: '24/7 from Bottrop' },
  liveSubtitle: { id: 'player.liveSubtitle', defaultMessage: '● LIVE · 24/7 from Bottrop' },
});

/**
 * The words `playRadio` cannot say for itself, formatted. For the mini bar and the
 * lock screen.
 *
 * **A function and not a constant, and that is the whole point of this file.** It
 * was `SALON5_RADIO`, an object holding two of the descriptors above under `title`
 * and `artist` — the keys a lock screen wants strings in. Nothing built a track
 * from it, measured across the app, the workbench and the tests on 2026-09-15, so
 * the first thing that did would have been the first thing to find out: a
 * descriptor is an ordinary object, `${…}` renders it `[object Object]`, and a
 * platform API taking `any` metadata would have posted that to the notification
 * shade. There is no shape for the caller to get wrong here, because there is no
 * shape until the caller passes an `intl` — the same trade `calloutKicker` in
 * `lib/participate/calloutStyle.ts` makes for the same reason.
 *
 * It had no caller at all until the core stopped carrying its own copy of these
 * words (#141), which is why it returns `RadioCopy` and not a track: the stream's
 * URL is the core's fact and stays there.
 */
export function salon5RadioCopy(intl: IntlShape): RadioCopy {
  return {
    title: intl.formatMessage(SALON5_RADIO_COPY.title),
    subtitle: intl.formatMessage(SALON5_RADIO_COPY.liveSubtitle),
  };
}
