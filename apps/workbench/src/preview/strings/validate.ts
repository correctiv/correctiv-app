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
 * which writes nothing that fails (`plugin/strings.ts`); and the submission workflow's
 * strings kind (ADR 0061 §3, ADR 0062), which refuses an issue with one failure in it.
 *
 * **Two refusals are not about ICU, and both arrived with the workflow** (ADR 0062 §4).
 * A wording longer than `WORDING_MAX`, and a wording holding a character a reviewer
 * cannot see in a diff: a control character, a line or paragraph separator, a mark that
 * reverses the direction of the text around it, a zero-width character, a byte-order
 * mark, a noncharacter or half of a surrogate pair. None of them is in the catalogue, and
 * the only thing one does in a pull request is make the wording on the page differ from
 * the wording in the review. The soft hyphen is allowed; it breaks a long German word in a
 * narrow button and is a translator's tool.
 *
 * Parsed with `ignoreTag`, as `apps/mobile/__tests__/localisation-seam.test.ts` and
 * `packages/catalogue/test/catalogue.test.ts` parse, so an angle bracket is text here
 * exactly where it is text there.
 */

export type WordingProblem =
  | { code: 'empty' }
  | { code: 'too-long'; max: number }
  | { code: 'unsafe'; character: string; position: number }
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

/**
 * The longest wording taken. The longest German in the catalogue is a little over two
 * hundred characters, measured on 2026-09-24; four times that is room for a sentence
 * somebody means and a bound on what a public issue can make the workflow parse.
 */
export const WORDING_MAX = 1000;

/** Whether a code point is one a reviewer cannot see, as the header says. */
function invisible(point: number): boolean {
  return (
    point <= 0x1f ||
    (point >= 0x7f && point <= 0x9f) ||
    point === 0x061c ||
    (point >= 0x200b && point <= 0x200f) ||
    (point >= 0x2028 && point <= 0x202e) ||
    (point >= 0x2060 && point <= 0x2069) ||
    (point >= 0xd800 && point <= 0xdfff) ||
    point === 0xfeff ||
    point === 0xfffe ||
    point === 0xffff
  );
}

/** The first invisible character, as `U+XXXX`, and its place counted in characters from one. */
function firstInvisible(text: string): { character: string; position: number } | null {
  let position = 0;
  // `for…of` walks code points, and yields half of a broken pair on its own.
  for (const unit of text) {
    position++;
    const point = unit.codePointAt(0)!;
    if (invisible(point))
      return { character: `U+${point.toString(16).toUpperCase().padStart(4, '0')}`, position };
  }
  return null;
}

/** What is wrong with `german` as a wording of `english`. Empty when nothing is. */
export function checkWording(english: string, german: string): WordingProblem[] {
  if (german.trim() === '') return [{ code: 'empty' }];
  if (german.length > WORDING_MAX) return [{ code: 'too-long', max: WORDING_MAX }];
  const hidden = firstInvisible(german);
  if (hidden) return [{ code: 'unsafe', ...hidden }];
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

/**
 * Whether a parsed JSON value is id to German: an object, not an array, every value a
 * string. Nothing about the ids or the wordings; `checkWording` and the catalogue answer
 * those. Shared by the dev server's save and the submission workflow.
 */
export function isWordings(value: unknown): value is Record<string, string> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    Object.values(value).every((wording) => typeof wording === 'string')
  );
}
