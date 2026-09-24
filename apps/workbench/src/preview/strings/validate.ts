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
 * **A placeholder is its name and its kind.** `{count, plural, …}` and `{count, date,
 * short}` share a name and are different holes: the app hands the same number to both,
 * and one prints „3 Artikel“ while the other prints a date in 1970. So the German has to
 * carry each name with the same type and the same style as the English (ADR 0062 §4).
 *
 * One function for three callers, so they cannot disagree: the panel, which says so
 * while the person is typing and publishes nothing that fails; the dev server's save,
 * which writes nothing that fails (`plugin/strings.ts`); and the submission workflow's
 * strings kind (ADR 0061 §3, ADR 0062), which refuses an issue with one failure in it.
 *
 * **Two refusals are not about ICU, and both arrived with the workflow** (ADR 0062 §4).
 * A wording longer than `WORDING_MAX`, and a wording holding a character a reviewer
 * cannot see in a diff (`HIDDEN`). None of them is in the catalogue, and the only thing
 * one does in a pull request is make the wording on the page differ from the wording in
 * the review. The soft hyphen is the one exception by name: it breaks a long German word
 * in a narrow button and is a translator's tool. A wording that is blank once the soft
 * hyphens are taken out is empty.
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
  | { code: 'extra'; names: string[] }
  | { code: 'kind'; names: string[] };

/**
 * What each argument a message names is, `#` excepted, which has no name: its type, and
 * for a number, a date or a time its style, and for a plural whether it counts or orders.
 * A name used twice in different ways carries both.
 */
export function placeholdersOf(elements: MessageFormatElement[]): Map<string, Set<string>> {
  const names = new Map<string, Set<string>>();
  const add = (name: string, kind: string) =>
    names.set(name, (names.get(name) ?? new Set<string>()).add(kind));
  const walk = (list: MessageFormatElement[]): void => {
    for (const element of list) {
      if (
        element.type !== TYPE.literal &&
        'value' in element &&
        typeof element.value === 'string'
      ) {
        add(element.value, kindOf(element));
      }
      if ('options' in element)
        for (const option of Object.values(element.options)) walk(option.value);
      if ('children' in element) walk(element.children);
    }
  };
  walk(elements);
  return names;
}

function kindOf(element: MessageFormatElement): string {
  const type = TYPE[element.type] ?? String(element.type);
  if ('pluralType' in element) return `${type}:${element.pluralType ?? 'cardinal'}`;
  if ('style' in element) {
    const style = element.style;
    return `${type}:${typeof style === 'string' ? style : style ? JSON.stringify(style) : ''}`;
  }
  return type;
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

/**
 * Every character a reviewer cannot see in a diff, by category where Unicode has one: the
 * controls (line break and tab among them), the format characters (direction marks and
 * isolates, zero-width characters, the byte-order mark, the tags), the line and paragraph
 * separators, surrogates, private use, the noncharacters, and every code point Unicode
 * has not assigned yet, which a font draws as nothing or as a box.
 */
const HIDDEN = /[\p{Cc}\p{Cf}\p{Cs}\p{Co}\p{Cn}\p{Noncharacter_Code_Point}\p{Zl}\p{Zp}]/u;

/**
 * And by name, where the category calls a character visible that renders as nothing: the
 * combining grapheme joiner, the variation selectors, the Hangul fillers, which are
 * letters that draw blank, and the blank Braille pattern.
 */
function blankByName(point: number): boolean {
  return (
    point === 0x034f ||
    (point >= 0xfe00 && point <= 0xfe0f) ||
    (point >= 0xe0100 && point <= 0xe01ef) ||
    point === 0x115f ||
    point === 0x1160 ||
    point === 0x3164 ||
    point === 0xffa0 ||
    point === 0x2800
  );
}

const SOFT_HYPHEN = 0xad;

/** Whether a code point is one a reviewer cannot see, the soft hyphen excepted. */
function invisible(unit: string): boolean {
  const point = unit.codePointAt(0)!;
  if (point === SOFT_HYPHEN) return false;
  return HIDDEN.test(unit) || blankByName(point);
}

/** The first invisible character, as `U+XXXX`, and its place counted in characters from one. */
function firstInvisible(text: string): { character: string; position: number } | null {
  let position = 0;
  // `for…of` walks code points, and yields half of a broken pair on its own.
  for (const unit of text) {
    position++;
    if (invisible(unit)) {
      const point = unit.codePointAt(0)!;
      return { character: `U+${point.toString(16).toUpperCase().padStart(4, '0')}`, position };
    }
  }
  return null;
}

/** Whether nothing is left of a wording once the invisible characters and soft hyphens go. */
function blank(text: string): boolean {
  for (const unit of text)
    if (!invisible(unit) && unit.codePointAt(0) !== SOFT_HYPHEN && unit.trim() !== '') return false;
  return true;
}

/** What is wrong with `german` as a wording of `english`. Empty when nothing is. */
export function checkWording(english: string, german: string): WordingProblem[] {
  if (blank(german)) return [{ code: 'empty' }];
  if (german.length > WORDING_MAX) return [{ code: 'too-long', max: WORDING_MAX }];
  const hidden = firstInvisible(german);
  if (hidden) return [{ code: 'unsafe', ...hidden }];
  const theirs = parsed(german);
  if (typeof theirs === 'string') return [{ code: 'syntax', detail: theirs }];
  const ours = parsed(english);
  // The English is the repository's and parses, or the extraction would have thrown.
  const wanted = typeof ours === 'string' ? new Map<string, Set<string>>() : placeholdersOf(ours);
  const given = placeholdersOf(theirs);

  const problems: WordingProblem[] = [];
  const missing = [...wanted.keys()].filter((name) => !given.has(name)).sort();
  const extra = [...given.keys()].filter((name) => !wanted.has(name)).sort();
  const kind = [...wanted.keys()]
    .filter((name) => given.has(name) && !sameKinds(wanted.get(name)!, given.get(name)!))
    .sort();
  if (missing.length > 0) problems.push({ code: 'missing', names: missing });
  if (extra.length > 0) problems.push({ code: 'extra', names: extra });
  if (kind.length > 0) problems.push({ code: 'kind', names: kind });
  return problems;
}

function sameKinds(a: ReadonlySet<string>, b: ReadonlySet<string>): boolean {
  return a.size === b.size && [...a].every((kind) => b.has(kind));
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
