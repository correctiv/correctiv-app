import type { IntlShape, MessageDescriptor } from 'react-intl';

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

/**
 * A label's words, whichever of the two kinds it holds.
 *
 * Two tables on this site hold a mixture: `ui/Settings.tsx`'s language picker,
 * where „English“ and „Deutsch“ are literals because a language names itself, and
 * `preview/home/document.ts`'s module labels, where an id the tool has no name for
 * falls back to the id. Both need one line that formats a descriptor and passes a
 * string through, and one line in two places is one too many.
 *
 * Takes `intl` rather than calling the hook, and `preview/home/document.ts` is why:
 * `blockName()` is a plain function in a module with no React, so there is no hook
 * to call there at all. In a component a hook would work and an argument is one
 * word more, which is the price of the two kinds of caller sharing one line.
 *
 * Both descriptor shapes, because the two tables declare them differently:
 * `defineMessages` in a component gives a `MessageDescriptor` whose `id` may be a
 * number, and `wbMessage` in a data module gives one whose `id` is a string. This
 * is the one place that has to know they are the same thing.
 */
export function say(intl: IntlShape, words: string | WorkbenchMessage | MessageDescriptor): string {
  return typeof words === 'string' ? words : intl.formatMessage(words);
}
