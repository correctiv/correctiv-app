import { parse, TYPE, type MessageFormatElement } from '@formatjs/icu-messageformat-parser';

/**
 * Which message id put a rendered string on screen, read back from its text.
 *
 * [ADR 0056](../../../../../adr/0056-a-string-is-picked-where-it-renders.md) §1 chose
 * this over marking the output at run time: the app is asked for nothing, and the table
 * `virtual:strings` carries is a complete list of what the app can say, so a string on
 * screen can be looked up in it. The cost is ambiguity, and the three decisions that
 * keep it small are all here — the owner chain breaks a tie (§1), the text node is
 * offered before the element's text (§2, which is the caller's order, see `resolve`),
 * and a message that is almost all placeholders takes no part (§3).
 *
 * Pure, and handed its wordings rather than reading `virtual:strings`, so the tests can
 * build an index out of three lines and the panel can build one over the German with
 * the person's own edits in it: an edited wording is what the frame shows, so it is
 * what has to be recognised.
 */

/**
 * The fewest letters and digits a message's fixed text may have and still be matched.
 *
 * §3: counted in letters and digits, not characters, because `{cta}: {title}` has a
 * colon and a space and pins nothing down. `von {authors}` has three and is the
 * measured case the threshold sits above.
 */
export const MIN_FIXED = 4;

/** At most this many renderings per message. A plural inside a select multiplies. */
const MAX_VARIANTS = 64;

/**
 * A message as it can render: fixed text, and a hole where a value goes.
 *
 * `number` is a hole that only a number fills: `#` in a plural branch and a
 * `{n, number}` argument. It matches digits and the separators a formatted number
 * carries, so `# Tage` does not also match "Alle Tage". `any` is every other argument,
 * whose value the table cannot know.
 */
type Hole = { hole: 'any' | 'number' };
type Part = string | Hole;

const ANY: Hole = { hole: 'any' };
const NUMBER: Hole = { hole: 'number' };

const isHole = (part: Part | undefined): part is Hole => typeof part === 'object';

/** Whitespace as a browser lays it out, so a line break in a catalogue matches a space. */
export function normalise(text: string): string {
  return text.replace(/\s+/gu, ' ').trim();
}

/**
 * Every way a message can render, with its holes.
 *
 * Every branch of a plural or a select is a rendering of its own, which is how the
 * measurement in the ADR was taken and the only way `# Artikel` and `Ein Artikel` are
 * both recognised.
 */
function variants(elements: MessageFormatElement[]): Part[][] {
  let out: Part[][] = [[]];
  for (const element of elements) {
    if (element.type === TYPE.literal) {
      out = out.map((parts) => parts.concat(element.value));
    } else if (element.type === TYPE.plural || element.type === TYPE.select) {
      const branches = Object.values(element.options).flatMap((option) => variants(option.value));
      out = out
        .flatMap((parts) => branches.map((branch) => parts.concat(branch)))
        .slice(0, MAX_VARIANTS);
    } else if (element.type === TYPE.tag) {
      // Not reached while messages are parsed with `ignoreTag`, which is how the app's
      // own checks parse them; a tag's children render inline if one ever is.
      const inner = variants(element.children);
      out = out.flatMap((parts) => inner.map((branch) => parts.concat(branch)));
    } else if (element.type === TYPE.pound || element.type === TYPE.number) {
      out = out.map((parts) => parts.concat(NUMBER));
    } else {
      out = out.map((parts) => parts.concat(ANY));
    }
  }
  return out;
}

/**
 * Adjacent literals joined and adjacent holes folded, so the pattern has one shape.
 * Two holes side by side are one hole; it is a number only if both were.
 */
function compact(parts: Part[]): Part[] {
  const out: Part[] = [];
  for (const part of parts) {
    const last = out[out.length - 1];
    if (isHole(part)) {
      if (!isHole(last)) out.push(part);
      else if (last.hole !== part.hole) out[out.length - 1] = ANY;
    } else if (typeof last === 'string') out[out.length - 1] = last + part;
    else out.push(part);
  }
  return out;
}

function fixedLetters(parts: Part[]): number {
  return parts.reduce(
    (sum, part) =>
      sum + (typeof part === 'string' ? (part.match(/[\p{L}\p{N}]/gu)?.length ?? 0) : 0),
    0,
  );
}

function escape(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/gu, '\\s+');
}

/** A formatted number: a digit, then digits, separators and the spaces `Intl` groups with. */
const NUMBER_PATTERN = '(\\d[\\d.,\\s\\u00a0\\u202f]*?)';

/**
 * The separators the app joins values into one line with, where a line is composed in
 * code rather than written as a message: `Autorin · 23. September · 3 Min. Lesezeit`.
 */
const SEPARATORS = [' · '];

/**
 * A free hole at the start or end of a pattern, kept from reaching across a separator.
 *
 * ADR 0056 §2 decided to match on the text node, and names two shapes it can meet:
 * decoration beside a message, and a message spanning children. A line the app composes
 * in code is a third, which §2 does not cover: author, date and reading time joined with
 * " · " arrive as ONE text node, and a message that begins with a hole,
 * `{minutes} Min. Lesezeit`, matched the whole line by swallowing the author and the date
 * through that hole. Measured on 2026-09-24, it was then the only candidate, so the panel
 * named the wrong id with confidence.
 *
 * So an edge hole may not swallow a separator the message's own fixed text does not
 * contain. Such a line then resolves to no id, or to the right one, and never to a wrong
 * one alone; "no id" is an honest answer for a line that is mostly content. A hole in
 * the middle is left as it is, because fixed text on both sides already anchors it, and
 * a number hole never matches a separator anyway.
 */
function edgeHole(forbidden: readonly string[]): string {
  if (forbidden.length === 0) return '([\\s\\S]+?)';
  const not = forbidden.map((separator) => escape(separator)).join('|');
  return `((?:(?!${not})[\\s\\S])+?)`;
}

function toPattern(parts: Part[]): RegExp {
  const fixed = parts.filter((part): part is string => typeof part === 'string').join('');
  const forbidden = SEPARATORS.filter((separator) => !normalise(fixed).includes(separator.trim()));
  const body = parts
    .map((part, index) => {
      if (isHole(part)) {
        if (part.hole === 'number') return NUMBER_PATTERN;
        const edge = index === 0 || index === parts.length - 1;
        return edge ? edgeHole(forbidden) : '([\\s\\S]+?)';
      }
      let text = part;
      if (index === 0) text = text.trimStart();
      if (index === parts.length - 1) text = text.trimEnd();
      return escape(text);
    })
    .join('');
  return new RegExp(`^${body}$`, 'u');
}

/**
 * A message's renderings, or the whole wording as one literal where it does not parse.
 *
 * A wording that does not parse is one somebody is in the middle of typing; the app
 * renders nothing sensible for it either, and matching it as text costs nothing.
 */
function renderings(wording: string): Part[][] {
  try {
    return variants(parse(wording, { ignoreTag: true })).map(compact);
  } catch {
    return [[wording]];
  }
}

export interface StringIndex {
  /** Messages with no hole, by their normalised text. */
  exact: ReadonlyMap<string, readonly string[]>;
  /** Messages with holes, as anchored patterns. */
  patterns: readonly { id: string; pattern: RegExp }[];
  /** Ids too loose to match on, which take no part and which §3 has the panel name. */
  loose: ReadonlySet<string>;
}

/**
 * The index over every wording.
 *
 * **Loose is decided per id, not per rendering.** One branch of a plural under the
 * threshold takes the whole id out, its exact branches included. The first version
 * decided per rendering, so `1 Tag` could not be picked while `3 Tage` could, and the
 * panel called the id "cannot be picked" either way; the cold review of #259 found it.
 * A person who is told an id cannot be pointed at should find that true of every branch.
 */
export function buildIndex(
  wordings: Iterable<readonly [id: string, wording: string]>,
): StringIndex {
  const exact = new Map<string, string[]>();
  const patterns: { id: string; pattern: RegExp }[] = [];
  const loose = new Set<string>();

  for (const [id, wording] of wordings) {
    const all = renderings(wording);
    if (all.some((parts) => parts.some(isHole) && fixedLetters(parts) < MIN_FIXED)) {
      loose.add(id);
      continue;
    }
    const seen = new Set<string>();
    for (const parts of all) {
      if (!parts.some(isHole)) {
        const text = normalise(parts.join(''));
        if (!text || seen.has(`=${text}`)) continue;
        seen.add(`=${text}`);
        const ids = exact.get(text);
        if (ids) ids.push(id);
        else exact.set(text, [id]);
        continue;
      }
      const pattern = toPattern(parts);
      if (seen.has(pattern.source)) continue;
      seen.add(pattern.source);
      patterns.push({ id, pattern });
    }
  }
  return { exact, patterns, loose };
}

/**
 * The ids that could have rendered this text.
 *
 * A message with no holes that matches outright is preferred to any pattern that also
 * does. `Alle ansehen` is `home.viewAll` and not a guess at `{thing} ansehen`; the
 * pattern candidates are only consulted when nothing matched word for word.
 */
export function candidates(index: StringIndex, text: string): string[] {
  const needle = normalise(text);
  if (!needle) return [];
  const exact = index.exact.get(needle);
  if (exact) return [...exact];
  const ids = new Set<string>();
  for (const { id, pattern } of index.patterns) if (pattern.test(needle)) ids.add(id);
  return [...ids];
}

/**
 * Whether a frame of the owner chain is this repository-relative file.
 *
 * Metro's symbolicator answers with whatever path it resolved, which is absolute on this
 * machine, so the comparison is a suffix on a path boundary in either direction.
 */
export function sameFile(frame: string, file: string): boolean {
  const a = frame.replaceAll('\\', '/');
  const b = file.replaceAll('\\', '/');
  return a === b || a.endsWith(`/${b}`) || b.endsWith(`/${a}`);
}

export interface Resolution {
  /** The text that matched, or the first one offered where nothing did. */
  text: string;
  /** Every id that could have produced it, after the owner chain narrowed them. */
  ids: string[];
  /** Whether the owner chain is what took several candidates down to these. */
  narrowed: boolean;
}

/**
 * The id or ids behind a pick.
 *
 * `texts` is in the order §2 decided: the text node under the pointer, then the element's
 * whole text. The first that matches anything wins, which is why the element's text is
 * only a fallback: `Alle ansehen →` as a whole matches nothing, the node `Alle ansehen`
 * beside the arrow does.
 *
 * `owners` is the picker's owner chain, `null` where there is none (the published
 * export). Where several ids could have produced the text, those whose descriptor is
 * written in a file on that chain are the ones on screen. If none is, nothing is
 * narrowed: a core descriptor is written in a file no component's owner chain passes
 * through, and throwing it out would throw out the right answer.
 */
export function resolve(
  index: StringIndex,
  texts: readonly string[],
  owners: readonly string[] | null,
  fileOf: (id: string) => string | undefined,
): Resolution | null {
  const offered = texts.map(normalise).filter((text) => text.length > 0);
  if (offered.length === 0) return null;

  for (const text of offered) {
    const ids = candidates(index, text);
    if (ids.length === 0) continue;
    if (ids.length > 1 && owners && owners.length > 0) {
      const owned = ids.filter((id) => {
        const file = fileOf(id);
        return file !== undefined && owners.some((frame) => sameFile(frame, file));
      });
      if (owned.length > 0 && owned.length < ids.length) {
        return { text, ids: owned, narrowed: true };
      }
    }
    return { text, ids, narrowed: false };
  }
  return { text: offered[0]!, ids: [], narrowed: false };
}
