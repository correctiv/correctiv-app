/**
 * The identity function a module without React uses to declare a message.
 *
 * `defineMessages` comes from `react-intl`, which imports React. Two modules here
 * may not have it: `shell/views.ts` says in its own header that it is "Pure data on
 * purpose, no React and no icon", because five test files import it to ask about a
 * route and a test that had to pull the page tree in is a test that stops being
 * run; `nav.ts` is the same kind of table. Both hold titles a reader sees.
 *
 * So this is the identity function that stands in, and it exists for the extractor
 * rather than for the runtime — `wbMessage(d)` returns `d`. It is the same answer
 * `coreMessage()` gives in `packages/app-core/src/i18n/messages.ts` for the same
 * reason, and it carries the same measured constraint:
 *
 * **One descriptor per call.** `@formatjs/cli` reads a named function's SINGLE
 * argument as one descriptor. A bare `{ id, defaultMessage }` literal extracts to
 * nothing, and so does a `defineMessages`-shaped block handed to this function. A
 * `Record` of them is therefore a Record whose every VALUE is wrapped one at a
 * time, and unwrapping one to tidy it up deletes that id from `en.json` without
 * failing anything here.
 *
 * The name is typed a second time in `apps/workbench/package.json` under
 * `i18n:extract`, so renaming it is two edits.
 */
export interface WorkbenchMessage {
  id: string;
  defaultMessage: string;
  /**
   * What a translator needs that the string itself does not say: where it appears,
   * what each placeholder holds, and which other id reads the same. Never rendered.
   * `test/i18n.test.ts` requires one in the two cases where the string cannot speak
   * for itself, which is the rule the app already keeps.
   */
  description?: string;
}

export function wbMessage(message: WorkbenchMessage): WorkbenchMessage {
  return message;
}
