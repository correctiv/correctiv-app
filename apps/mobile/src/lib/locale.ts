import type { Locale } from '@correctiv/app-core/stores/settings';

/**
 * The language this app ships in, said once.
 *
 * **One place, because three things need the same answer and none of them can ask
 * the others.** `lib/store/core.ts` hands it to `createAppStore()`
 * ([ADR 0049](../../../../adr/0049-the-catalogue-is-a-package.md) §4);
 * `app/+html.tsx` writes it into the static export's `<html lang>`, and it renders
 * at export time with no store anywhere to ask; and
 * `__tests__/tab-bar-labels.test.ts` reads it, because the tab bar's measured
 * width threshold was taken against five German words and stops meaning anything
 * the day the app ships another language.
 *
 * It was two places for an afternoon — the store's option and the settings slice's
 * own default — and a cold review pointed out what that produced: the export said
 * `lang="de"` while the app rendered English, because the shell had read the core's
 * constant rather than this host's answer.
 *
 * **Not in the core.** Which language CORRECTIV ships to phones is this product's
 * decision, and `packages/app-core` is shared with hosts that will answer it
 * differently. The core keeps a default so a store built by a test has one; this is
 * what the app says.
 *
 * There is no user-facing switch and this is not one: a developer's switch belongs
 * in the workbench (ADR 0026 §6), and changing this line changes what ships.
 */
export const SHIPPED_LOCALE: Locale = 'de';
