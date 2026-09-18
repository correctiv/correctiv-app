/**
 * German for the `core.*` ids: the vocabulary `packages/app-core` owns.
 *
 * Three kinds of string, and each is here for the same reason — the core states
 * the fact and never the sentence. The audio store carries a failure CODE, the
 * fact-check module a verdict SLUG, and `buildReaderHtml` is handed its words
 * because a WebView document can reach no provider.
 *
 * One measured thing to know before adding to it. The core cannot import
 * `react-intl` — it imports no React at all, and
 * `packages/app-core/test/boundary.test.ts` fails the build over it — so a core
 * descriptor goes through `coreMessage()` in `packages/app-core/src/i18n/messages.ts`,
 * which `npm run i18n:extract` is told about with `--additional-function-names`.
 * `@formatjs/cli` reads that call's SINGLE argument and nothing else: a bare
 * object literal extracts to zero messages, and so does a `defineMessages`-shaped
 * block handed to the same function. Verified against this repo on 2026-09-16.
 * That is why every value of a `Record` over there is wrapped one at a time.
 */
export const core: Record<string, string> = {
  // The player, whose state carries one of three codes (`AudioError`).
  'core.audio.unsupportedPlatform': 'Auf dieser Plattform ist keine Wiedergabe möglich.',
  'core.audio.startFailed':
    'Wiedergabe nicht möglich. Prüfen Sie Ihre Internetverbindung und versuchen Sie es erneut.',
  'core.audio.interrupted':
    'Wiedergabe unterbrochen. Prüfen Sie Ihre Internetverbindung und versuchen Sie es erneut.',

  // The ten verdicts of a CORRECTIV fact check, as they are published. The id is
  // English, the key in the core is the German slug the API states.
  'core.rating.false': 'Falsch',
  'core.rating.mostlyFalse': 'Größtenteils falsch',
  'core.rating.partlyFalse': 'Teilweise falsch',
  'core.rating.missingContext': 'Fehlender Kontext',
  'core.rating.unproven': 'Unbelegt',
  'core.rating.misleading': 'Irreführend',
  'core.rating.manipulated': 'Manipuliert',
  'core.rating.satire': 'Satire',
  'core.rating.mostlyTrue': 'Größtenteils richtig',
  'core.rating.true': 'Richtig',

  // The reader document. `factcheckBadge` is written the way the word is spelled
  // and shouted by `buildReaderHtml`, which uppercases it before it goes into the
  // markup rather than leaving that to a stylesheet the host may not append.
  'core.reader.factcheckBadge': 'Faktencheck',
  'core.reader.byline': 'von {authors}',
  'core.reader.readingTime': '{minutes} Min. Lesezeit',
  'core.reader.support': 'Ermöglicht durch Unterstützer:innen wie Sie. Danke, dass Sie dabei sind.',
};
