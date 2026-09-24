import { parse, TYPE, type MessageFormatElement } from '@formatjs/icu-messageformat-parser';

/**
 * Whether a German wording can stand in for the English one, and nothing else.
 *
 * [ADR 0056](../../../../../adr/0056-a-string-is-picked-where-it-renders.md) §8: the
 * counterpart of `parseHomeLayout`, asking one question — does the German carry exactly
 * the placeholders the English carries, and does it parse as ICU. Both are refusals the
 * app would otherwise discover later and elsewhere: a lost `{count}` is a hole that never
 * fills, and a malformed pattern is an error from `Localisation.tsx`'s `onError` on
 * whatever screen renders it. It does not judge the wording.
 *
 * One function for three callers, so they cannot disagree: the panel, which says so
 * while the person is typing and publishes nothing that fails; the dev server's save,
 * which writes nothing that fails (`plugin/strings.ts`); and the submission workflow,
 * when the strings kind is built (ADR 0061 §3).
 *
 * Parsed with `ignoreTag`, as `apps/mobile/__tests__/localisation-seam.test.ts` and
 * `packages/catalogue/test/catalogue.test.ts` parse, so an angle bracket is text here
 * exactly where it is text there.
 */

export type WordingProblem =
  | { code: 'empty' }
  | { code: 'syntax'; detail: string }
  | { code: 'missing'; names: string[] }
  | { code: 'extra'; names: string[] };

/** Every argument a message names, `#` excepted, which has no name. */
export function placeholdersOf(elements: MessageFormatElement[]): Set<string> {
  const names = new Set<string>();
  const walk = (list: MessageFormatElement[]): void => {
    for (const element of list) {
      if (
        element.type !== TYPE.literal &&
        'value' in element &&
        typeof element.value === 'string'
      ) {
        names.add(element.value);
      }
      if ('options' in element)
        for (const option of Object.values(element.options)) walk(option.value);
      if ('children' in element) walk(element.children);
    }
  };
  walk(elements);
  return names;
}

function parsed(message: string): MessageFormatElement[] | string {
  try {
    return parse(message, { ignoreTag: true });
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
}

/** What is wrong with `german` as a wording of `english`. Empty when nothing is. */
export function checkWording(english: string, german: string): WordingProblem[] {
  if (german.trim() === '') return [{ code: 'empty' }];
  const theirs = parsed(german);
  if (typeof theirs === 'string') return [{ code: 'syntax', detail: theirs }];
  const ours = parsed(english);
  // The English is the repository's and parses, or the extraction would have thrown.
  const wanted = typeof ours === 'string' ? new Set<string>() : placeholdersOf(ours);
  const given = placeholdersOf(theirs);

  const problems: WordingProblem[] = [];
  const missing = [...wanted].filter((name) => !given.has(name)).sort();
  const extra = [...given].filter((name) => !wanted.has(name)).sort();
  if (missing.length > 0) problems.push({ code: 'missing', names: missing });
  if (extra.length > 0) problems.push({ code: 'extra', names: extra });
  return problems;
}
