/**
 * The pure computations behind `/strings`, apart from the page.
 *
 * Each takes its input as an argument rather than closing over `virtual:strings`,
 * so a test can hand it a handful of fixtures without the build-time join that
 * produces the real table. `Strings.tsx` calls these once at module scope with the
 * real `ENTRIES` and `LOCALES`; this module owns only what they mean, not where
 * they come from.
 */

/**
 * Which of the two sets of strings a row belongs to.
 *
 * `'app'` is what ships through a store; `'workbench'` is this site's own
 * interface. They are separate catalogues because the audiences are
 * ([ADR 0050](../../../../adr/0050-the-workbench-gets-a-second-audience.md) §3),
 * and they are on one board because somebody looking up a wording does not know
 * which of the two they saw it on.
 *
 * A string rather than a union of the two names: this comes out of a generated
 * file, and a type that promised more than the file guarantees would be a promise
 * nothing checks.
 */
export type Surface = string;

/**
 * One user-facing string, joined from the three places that each know part of it:
 * the extraction knows the id and where the descriptor is written, the catalogues
 * know the words, and the descriptor knows what a translator needs.
 *
 * Declared here rather than in `virtual:strings` so that this module — and a test
 * of it — need not resolve that virtual module at all. `virtual-strings.d.ts`
 * imports the type from here instead of declaring its own.
 */
export interface StringEntry {
  /**
   * Unique only WITH `surface`. `settings.title` is an id in both of them, and so
   * is every id a future shared namespace produces; `keyOf` is the whole key and
   * everything in this module that maps by an entry maps by that.
   */
  id: string;
  surface: Surface;
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
  /**
   * The line the DESCRIPTOR BLOCK starts on, not the line the id is on.
   *
   * `@formatjs/cli --extract-source-location` reports the position of the
   * `defineMessages(...)` call, so a `COPY` block of thirty ids gives thirty rows
   * one address. That is the block a reader wants to be taken to, so it is a fair
   * address; it is not the promise "your id is on this line", and a first version
   * of this comment made that promise.
   *
   * No count here. The first version had one and a cold review found a bigger
   * case two files away, which is what a figure measured against this repository
   * does on its own; the mechanism is the part that cannot drift.
   */
  line: number;
  /** Every language's wording, `null` where a catalogue has no entry. */
  translations: Record<string, string | null>;
}

/** As much of a row as the lookups below need, so a fixture need be no more. */
export type Row = Pick<StringEntry, 'surface' | 'id'>;

/**
 * What identifies a row: the surface and the id together.
 *
 * Written once here rather than inline at each of the three places that need it,
 * because getting it wrong is silent. A `Map` keyed by the id alone kept one of
 * `app`'s `settings.title` and `workbench`'s and dropped the other, and the page
 * would have shown a description against the wrong wording rather than failing.
 */
export function keyOf(entry: Row): string {
  // A space around the separator, because it is also what the heading prints and
  // what an error out of `scripts/strings.mjs` names a section by. One spelling.
  return `${entry.surface} \u00b7 ${entry.id}`;
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
 *
 * **Within a surface and never across it.** `settings.title` reads "Settings" in
 * both sets of strings, and that is not a coincidence a translator has to resolve:
 * they are two catalogues with two audiences, and whoever writes the German for one
 * of them never opens the other. A line pointing across is a line nobody can act
 * on, and it would sit on rows whose genuine twin — the other id in their OWN
 * catalogue — is the thing the line exists for.
 *
 * A first version of this paragraph put two figures on that, and a cold review
 * measured both wrong in opposite directions. They are not here now, because the
 * argument does not need them and the numbers move with every string anybody
 * writes.
 */
export function twinsOf(entries: readonly StringEntry[]): Map<string, string[]> {
  const byEnglish = new Map<string, StringEntry[]>();
  for (const entry of entries) {
    if (entry.english === '') continue;
    const wording = `${entry.surface} \u00b7 ${entry.english}`;
    byEnglish.set(wording, [...(byEnglish.get(wording) ?? []), entry]);
  }

  const twins = new Map<string, string[]>();
  for (const group of byEnglish.values()) {
    if (group.length < 2) continue;
    for (const entry of group)
      twins.set(
        keyOf(entry),
        // The bare ids, because the row printing them is in that surface already
        // and repeating its name on each is noise.
        group.filter((other) => other.id !== entry.id).map((other) => other.id),
      );
  }
  return twins;
}

/**
 * Whatever a map keyed by `keyOf` holds for this row.
 *
 * **The page reaches into these maps only through here**, and that is a rule
 * rather than a guarantee. `TWINS.get(entry.id)` is valid TypeScript — a
 * `Map<string, …>` takes any string — and on the real table it returns
 * `undefined` for every row, so the filter matches nothing and the "Same English"
 * segment shows nothing. A cold review put all three call sites back to
 * `entry.id` and the whole suite stayed green.
 *
 * Taking the ROW is what makes the right call the short one and puts the reason
 * in one place. What actually holds it is `test/strings.test.ts`, which fails if
 * `Strings.tsx` calls `.get(` on either map at all — the mistake stays spellable,
 * it just stops being publishable.
 */
export function lookup<T>(map: ReadonlyMap<string, T>, entry: Row): T | undefined {
  return map.get(keyOf(entry));
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
 *
 * And the surface, which is what lets the box answer "which of these two sets" as
 * well: typing `workbench` narrows to this site's own strings, and it does so
 * exactly — measured, no app row contains that word. A third control in the bar
 * would have said the same thing and taken the room the filter needs at 390px.
 *
 * **It does not work the other way round**, and a cold review caught the claim
 * that it did. `app` is a substring of "App language", "Appearance", "Put the day
 * away" and forty-odd others, so typing it brings the app's rows AND every row of
 * this site's whose wording happens to contain those three letters. That is what a
 * substring filter is, and it is the price of not having a third control; the
 * honest way to reach one surface is the headings, which name it.
 */
export function haystackOf(entries: readonly StringEntry[]): Map<string, string> {
  return new Map(
    entries.map((entry) => [
      keyOf(entry),
      [
        entry.surface,
        entry.id,
        entry.english,
        ...Object.values(entry.translations),
        entry.description ?? '',
      ]
        .join(' ')
        .toLowerCase(),
    ]),
  );
}

export interface Section {
  surface: Surface;
  name: string;
  entries: StringEntry[];
}

/**
 * The entries in the order they arrive, cut at each change of section.
 *
 * A section is a surface and a namespace together. Cutting on the namespace alone
 * would have run `app · settings` and `workbench · settings` into one heading the
 * moment the second surface arrived — two sets of strings under one name, with the
 * file path under each row as the only thing saying which was which.
 */
export function group(entries: readonly StringEntry[]): Section[] {
  const sections: Section[] = [];
  for (const entry of entries) {
    const last = sections.at(-1);
    if (last?.name === entry.namespace && last.surface === entry.surface) last.entries.push(entry);
    else sections.push({ surface: entry.surface, name: entry.namespace, entries: [entry] });
  }
  return sections;
}
