/**
 * The four pure computations behind `/strings`, apart from the page.
 *
 * Each takes its input as an argument rather than closing over `virtual:strings`,
 * so a test can hand it a handful of fixtures without the build-time join that
 * produces the real table. `Strings.tsx` calls these once at module scope with the
 * real `ENTRIES` and `LOCALES`; this module owns only what they mean, not where
 * they come from.
 */

/**
 * One user-facing string of the app, joined from the three places that each know
 * part of it: the extraction knows the id and where the descriptor is written, the
 * catalogues know the words, and the descriptor knows what a translator needs.
 *
 * Declared here rather than in `virtual:strings` so that this module — and a test
 * of it — need not resolve that virtual module at all. `virtual-strings.d.ts`
 * imports the type from here instead of declaring its own.
 */
export interface StringEntry {
  id: string;
  /** The part before the first dot, which is the screen or the area it belongs to. */
  namespace: string;
  /**
   * The `defaultMessage`, which is the source and therefore English.
   *
   * The same words as `translations.en`, and not a third copy of them: the English
   * catalogue is compiled from the extraction this field comes from. It is kept apart
   * because it is what the descriptor SAYS, which is what `twinsOf` compares; the
   * column beside it is what the catalogue holds.
   */
  english: string;
  /** What a translator is told, where the string cannot speak for itself. */
  description: string | null;
  /** Repository-relative, so it is an address somebody can paste into an editor. */
  file: string;
  line: number;
  /** Every language's wording, `null` where a catalogue has no entry. */
  translations: Record<string, string | null>;
}

/**
 * Every id whose English another id carries word for word, mapped to those others.
 *
 * Computed once from the model rather than per keystroke: it is a property of the
 * whole set, so filtering must not change it. A row that says "same English as
 * three others" has to keep saying it while two of the three are filtered out —
 * otherwise the fact quietly becomes a fact about the query.
 *
 * Grouped by the wording as written, byte for byte. "Take part" and "Take Part" are
 * therefore two wordings and not one, which is the answer a translator wants: two
 * spellings of the same phrase is itself the thing to look at, and folding them
 * together would hide it behind the word "same".
 *
 * The empty string is the one wording that groups nothing, because it is the absence
 * of one. `apps/mobile/__tests__/localisation-seam.test.ts` already refuses an id
 * without a `defaultMessage`, so `scripts/strings.mjs`'s `?? ''` cannot fire today;
 * the line is here because this function is what the page trusts, not the seam test.
 */
export function twinsOf(entries: readonly StringEntry[]): Map<string, string[]> {
  const byEnglish = new Map<string, string[]>();
  for (const entry of entries) {
    if (entry.english === '') continue;
    byEnglish.set(entry.english, [...(byEnglish.get(entry.english) ?? []), entry.id]);
  }

  const twins = new Map<string, string[]>();
  for (const ids of byEnglish.values()) {
    if (ids.length < 2) continue;
    for (const id of ids)
      twins.set(
        id,
        ids.filter((other) => other !== id),
      );
  }
  return twins;
}

/** A catalogue with nothing for this id, in any of the languages that ship. */
export function hasGap(entry: StringEntry, locales: readonly string[]): boolean {
  return locales.some((locale) => !entry.translations[locale]);
}

/**
 * What the free text is matched against, built once.
 *
 * The id, every language's wording and the description, because all three are
 * things somebody arrives knowing: the id from a stack trace, a wording from a
 * screenshot, and the description from the argument about what a string meant.
 */
export function haystackOf(entries: readonly StringEntry[]): Map<string, string> {
  return new Map(
    entries.map((entry) => [
      entry.id,
      [entry.id, entry.english, ...Object.values(entry.translations), entry.description ?? '']
        .join(' ')
        .toLowerCase(),
    ]),
  );
}

export interface Namespace {
  name: string;
  entries: StringEntry[];
}

/** The entries in the order they arrive, cut at each change of namespace. */
export function group(entries: readonly StringEntry[]): Namespace[] {
  const groups: Namespace[] = [];
  for (const entry of entries) {
    const last = groups.at(-1);
    if (last?.name === entry.namespace) last.entries.push(entry);
    else groups.push({ name: entry.namespace, entries: [entry] });
  }
  return groups;
}
