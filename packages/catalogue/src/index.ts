import type { Locale } from '@correctiv/app-core/stores/settings';

import { de } from './de';

/**
 * Every user-facing string the app ships, by locale.
 *
 * **Why the strings are a package and not a directory in the app.** The core owns
 * vocabulary of its own — what a playback failure says, how a fact-check verdict
 * reads, the words the reader document prints — and until this package existed the
 * German for those `core.*` ids lived inside `apps/mobile`. That was tolerable while
 * the app was the only host and wrong as soon as it was not: "which app holds the
 * core's German" has no good answer, and the GTK host on the `desktop` branch was
 * already reaching the catalogue through the phone's own source tree
 * ([ADR 0049](../../../adr/0049-the-catalogue-is-a-package.md) §1).
 *
 * **What is NOT here, and each for a reason.** The descriptors are not: a
 * `{ id, defaultMessage }` lives where the string lives, next to the component or in
 * the core, which is what made the migration cheap and is [ADR 0026](../../../adr/0026-react-native-review-and-hardening.md) §6.
 * The provider is not: that holds an `intl` instance and imports React, and this
 * package imports none. The workbench's own strings are not: it has a second
 * audience and a vocabulary of its own, and the app may never depend on the
 * workbench ([ADR 0040](../../../adr/0040-the-app-does-not-depend-on-the-workbench.md)).
 *
 * The type is what keeps this honest. `Record<Locale, …>` means a locale added to
 * the core's settings slice without a catalogue here fails to typecheck — in one
 * place, for every host, rather than once per host as it did when this record sat in
 * the app's provider.
 */
export const CATALOGUES: Record<Locale, Record<string, string>> = { de };

export { de };
export type { Locale };
