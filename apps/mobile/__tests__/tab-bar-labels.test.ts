import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { withoutComments } from '@correctiv/prose-and-code';

/**
 * The five German words `LABELS_FIT_UP_TO` was measured against, pinned.
 *
 * `app/(tabs)/_layout.tsx` drops four of the five tab labels above a system font
 * scale of 1.3. That number is not a preference and not a platform constant: it
 * is the last step of Android's own slider at which these five words, in German,
 * at 1080 px, still have space between them, photographed one step at a time
 * ([ADR 0034](../../../adr/0034-one-component-for-the-two-sided-row.md)).
 *
 * **So it goes wrong the way AGENTS.md's "facts that expire" describes**, and
 * faster than most: renaming a tab is a one-line edit in a catalogue file that
 * nothing connects to a threshold measured on an emulator, and a second language
 * moves it without touching this app's German at all. Nothing about the resulting
 * bar looks wrong in `npm run check`, in a typecheck, or at 100 %.
 *
 * This is the check that ships with the fact. It cannot re-measure — no test can
 * put five words on a 1080 px bar and look at them — so it holds the INPUTS to the
 * measurement still, and fails when one of them moves. A red run here does not
 * mean the code is broken; it means the number is no longer known to be right, and
 * the answer is `OUT=out/a11y bash screens/tools/tour-a11y.sh` and a look at the
 * bar, not an edit to this file.
 *
 * **Which rung this is.** Mechanism 4 on
 * [ADR 0031](../../../adr/0031-four-mechanisms-for-this-must-not-be-forgotten.md)'s
 * ladder, and it is there because the three above it cannot reach: the set is not
 * a union anybody typed, no generator can read a screenshot, and there is no
 * primitive to take away. Its obligations are met below — the exception carries
 * its reason, the limits are written at the assertions, and it was proved by
 * breaking it.
 */
const MEASURED_LABELS: Record<string, string> = {
  'ui.tabHome': 'Home',
  'ui.tabDiscover': 'Entdecken',
  'ui.tabMediathek': 'Mediathek',
  'ui.tabParticipate': 'Mitmachen',
  'ui.tabProfile': 'Profil',
};

/** The threshold those five words produced, as `_layout.tsx` must still spell it. */
const MEASURED_THRESHOLD = '1.3';

const SRC = join(__dirname, '..', 'src');
const TABS_LAYOUT = join(SRC, 'app', '(tabs)', '_layout.tsx');
/**
 * The German left this app for a package in
 * [ADR 0049](../../../adr/0049-the-catalogue-is-a-package.md) §1, so the first read
 * below reaches out of the workspace. The second reads this host's own store
 * binding, because §4 made the language a thing the host says rather than a
 * constant anybody could read off the core.
 */
const GERMAN_UI = join(SRC, '..', '..', '..', 'packages', 'catalogue', 'src', 'de', 'ui.ts');
const SHIPPED = join(SRC, 'lib', 'locale.ts');
const STORE = join(SRC, 'lib', 'store', 'core.ts');

const read = (path: string) => withoutComments(readFileSync(path, 'utf8'));

/** `'ui.tabHome': 'Home',` in the German catalogue, as a record of what ships. */
function germanLabels(source: string): Record<string, string> {
  const entries = [...source.matchAll(/'(ui\.tab\w+)': '([^']*)'/g)];
  return Object.fromEntries(entries.map(([, id, german]) => [id, german]));
}

describe('the tab labels the 1.3 threshold was measured against', () => {
  it('reads the files it is checking (guards against a silently empty parse)', () => {
    // Every assertion below is over a regular expression against source. A moved
    // file or a renamed key empties the match rather than breaking it, and an
    // empty record agrees with an empty record.
    expect(Object.keys(germanLabels(read(GERMAN_UI)))).toHaveLength(5);
    expect(read(TABS_LAYOUT)).toContain('LABELS_FIT_UP_TO');
    // The third file this reads, added with the locale assertion below and named
    // here for the same reason as the other two: a moved file empties a match
    // rather than breaking it.
    expect(read(SHIPPED)).toContain('SHIPPED_LOCALE');
    expect(read(STORE)).toContain('createAppStore');
  });

  it('still ships exactly those five German words (re-measure with tour-a11y.sh if one changed)', () => {
    // The whole point of the file. `Mitmachen` becoming `Engagieren` is nine
    // characters where there were nine, and `Mediathek` becoming `Audio & Video`
    // is not — and nothing else in the repository would notice either.
    expect(germanLabels(read(GERMAN_UI))).toEqual(MEASURED_LABELS);
  });

  it('declares those five ids in the tab bar itself', () => {
    // The other end of the same string. A tab renamed in `_layout.tsx` takes a new
    // id with it, the catalogue keeps the old one, and the assertion above would
    // pass while the bar drew something nobody measured.
    const declared = [...read(TABS_LAYOUT).matchAll(/id: '(ui\.tab\w+)'/g)].map(([, id]) => id);

    expect(declared.sort()).toEqual(Object.keys(MEASURED_LABELS).sort());
  });

  it('still carries the threshold those five words produced', () => {
    // A number moved by hand without a new round of photographs is the failure
    // this whole file exists for, and it is the one that looks most like a fix.
    expect(read(TABS_LAYOUT)).toContain(`const LABELS_FIT_UP_TO = ${MEASURED_THRESHOLD};`);
  });

  it('still renders the language those words are in', () => {
    /*
     * The other thing that moves the number, and it is not how many catalogues
     * exist. The bar is as wide as its longest label in whatever language is ON,
     * so what has to hold is that this app still renders German.
     *
     * **It used to read the registry**, and asserted that `CATALOGUES` held `de`
     * and nothing else. That was right while the locale was a constant in the core
     * and a second catalogue could only mean a second shipped language. Since
     * [ADR 0049](../../../adr/0049-the-catalogue-is-a-package.md) §3 and §4 the two
     * are different questions: English is a catalogue so that the second language
     * can be looked at, and this host names `'de'` at construction. A registry that
     * grows now says nothing about the bar; the host's own line says everything.
     *
     * So this reads the one place the app names its shipped language. It read the
     * store binding first, and a cold review showed the hole: any second object in
     * that file holding `locale: 'de'` — a fixture, a default, a comment's leftover
     * — answered for the real one. `lib/locale.ts` holds one export and nothing
     * else, so the substring and the declaration are the same thing.
     *
     * If somebody ships English, the five words are not the five words any more and
     * 1.3 is a number nobody measured.
     */
    expect(read(SHIPPED)).toMatch(/export const SHIPPED_LOCALE: Locale = 'de';/);

    /*
     * And the store binding reaches for that constant rather than a literal, which
     * is the other end of the same rule. Reading only one end leaves the other
     * free: the constant could stay `'de'` while `createAppStore` is handed `'en'`
     * directly, and the first version of this check moved that hole rather than
     * closing it. Both ends, so there is nowhere to put the change.
     */
    expect(read(STORE)).toMatch(/locale:\s*SHIPPED_LOCALE/);
    expect(read(STORE)).not.toMatch(/locale:\s*['"]/);
  });
});

/**
 * **What a green run here does NOT mean.**
 *
 *  - **That 1.3 is right.** It means the five words and the one language it was
 *    taken against have not moved. The measurement itself is a photograph, and
 *    photographs are in `screens/evidence/`.
 *  - **That the bar is legible at 1.3.** Two pixels between `Mediathek` and
 *    `Mitmachen` is what ADR 0034 chose and names as open. Nothing here reads a
 *    pixel.
 *  - **Anything about a second device.** The number is a property of 1080 px as
 *    much as of the words, and no test in this repository can see a screen width.
 */
export {};
