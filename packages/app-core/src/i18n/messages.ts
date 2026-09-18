/**
 * The core's half of the localisation seam.
 *
 * The core owns vocabulary — the taxonomy of a playback failure, the ten verdicts
 * a fact check can carry, the words the reader document prints — and it renders
 * none of it. A descriptor names a string; the host holds the `intl` instance that
 * turns one into text, and the German that ships is data in
 * `apps/mobile/src/i18n/catalogue/de/core.ts` ([ADR 0026](../../../../adr/0026-react-native-review-and-hardening.md) §6).
 *
 * `react-intl`'s `defineMessages` would be the obvious wrapper and is not
 * available: it comes from a package that imports React, which
 * `packages/app-core/test/boundary.test.ts` rejects. So this is the identity
 * function that stands in for it, and it exists for the extractor rather than for
 * the runtime — `coreMessage(d)` returns `d`.
 *
 * **One descriptor per call, and that is measured, not stylistic.**
 * `@formatjs/cli` reads a bare `{ id, defaultMessage }` object as nothing at all.
 * Naming a function through `--additional-function-names` makes it read the
 * function's SINGLE argument as one descriptor — it does not make it read a
 * `defineMessages`-shaped block of them. Against @formatjs/cli 6.16.28 on
 * 2026-09-16, a file holding all three forms extracted exactly one message, the
 * single-descriptor call; the block and the bare literal extracted zero. A block
 * below is therefore a Record whose every VALUE is wrapped, and unwrapping one to
 * tidy it up deletes that id from `en.json` without failing anything here — the
 * app's `__tests__/localisation-seam.test.ts` is what says so, because the German
 * left in the catalogue no longer has an English side.
 *
 * The name is in `apps/mobile/package.json` under `i18n:extract`. Renaming this
 * function means renaming it there too.
 */
export interface CoreMessage {
  id: string;
  defaultMessage: string;
  /**
   * What a translator needs to know that the string itself does not say: where it
   * appears, what each placeholder holds, and which other id reads the same. It is
   * never rendered — `@formatjs/cli` carries it into `en.json` and a translation
   * tool shows it above the entry field.
   *
   * Optional here and required by `apps/mobile/__tests__/localisation-seam.test.ts`
   * for the two cases that cannot be resolved by reading the string: an id whose
   * English is word for word another id's, and an id carrying a placeholder.
   */
  description?: string;
}

export function coreMessage(message: CoreMessage): CoreMessage {
  return message;
}
