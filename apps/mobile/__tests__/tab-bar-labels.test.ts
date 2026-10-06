import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { de } from '@correctiv/catalogue';
import { resolveText } from '@correctiv/app-core/lib/home-settings';
import {
  CONFIGURABLE_SCREENS,
  parseScreenDocument,
  screenTabLabelOf,
  SCREEN_DOCUMENTS,
  type ConfigurableScreen,
} from '@correctiv/app-core/lib/screen-layout';
import { floorFaults, withoutComments } from '@correctiv/prose-and-code';

/**
 * The five German words `LABELS_FIT_UP_TO` was measured against, pinned.
 *
 * `components/ui/BottomTabBar.tsx` drops four of the five tab labels above a system font
 * scale of 1.3. That number is not a preference and not a platform constant: it
 * is the last step of Android's own slider at which these five words, in German,
 * at 1080 px, still have space between them, photographed one step at a time
 * ([ADR 0034](../../../adr/0034-one-component-for-the-two-sided-row.md)).
 *
 * **So it goes wrong the way AGENTS.md's "facts that expire" describes**, and
 * faster than it used to. A rename was a one-line edit in a catalogue file that
 * nothing connected to a threshold measured on an emulator; since
 * [ADR 0075](../../../adr/0075-a-document-carries-its-own-words-and-a-screen-says-what-it-is-called.md)
 * §5 the words are in the screens' own documents and a rename is a `[layout]`
 * submission, so it need not pass a developer at all. A second language moves the
 * number without touching this app's German either way. Nothing about the
 * resulting bar looks wrong in `npm run check`, in a typecheck, or at 100 %.
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
const MEASURED_LABELS: Record<ConfigurableScreen, string> = {
  home: 'Home',
  entdecken: 'Entdecken',
  mediathek: 'Mediathek',
  mitmachen: 'Mitmachen',
  profil: 'Profil',
};

/** The threshold those five words produced, as `BottomTabBar.tsx` must still spell it. */
const MEASURED_THRESHOLD = '1.3';

const SRC = join(__dirname, '..', 'src');
const TABS_LAYOUT = join(SRC, 'components', 'ui', 'BottomTabBar.tsx');
/**
 * The language the bar renders in, which the host says rather than the core
 * ([ADR 0049](../../../adr/0049-the-catalogue-is-a-package.md) §4), and the store
 * binding that has to reach for it.
 */
const SHIPPED = join(SRC, 'lib', 'locale.ts');
const STORE = join(SRC, 'lib', 'store', 'core.ts');

const read = (path: string) => withoutComments(readFileSync(path, 'utf8'));

/**
 * What the bar puts under a screen's icon, out of the document the build bundles.
 *
 * The real path and not a regular expression over the JSON: the tab label defaults
 * to the title (ADR 0075 §3), the language is resolved with a fallback to German
 * (§2), and a check that read the file would be measuring a key rather than the
 * word a reader sees.
 */
function germanTabLabel(screen: ConfigurableScreen): string | null {
  const text = screenTabLabelOf(parseScreenDocument(SCREEN_DOCUMENTS[screen]).words);
  return text === null ? null : resolveText(text, 'de');
}

describe('the tab labels the 1.3 threshold was measured against', () => {
  it('reads the files it is checking (guards against a silently empty parse)', () => {
    // The assertions below are over source and over five bundled documents. A moved
    // file or a renamed key empties the match rather than breaking it, and an empty
    // record agrees with an empty record.
    expect(
      floorFaults({
        'bundled screen documents': { found: CONFIGURABLE_SCREENS.length, atLeast: 5 },
      }),
    ).toEqual([]);
    expect(read(TABS_LAYOUT)).toContain('LABELS_FIT_UP_TO');
    // The two files the locale assertion below reads, named here for the same reason.
    expect(read(SHIPPED)).toContain('SHIPPED_LOCALE');
    expect(read(STORE)).toContain('createAppStore');
  });

  it('still ships exactly those five German words (re-measure with tour-a11y.sh if one changed)', () => {
    // The whole point of the file. `Mitmachen` becoming `Engagieren` is nine
    // characters where there were nine, and `Mediathek` becoming `Audio & Video`
    // is not — and nothing else in the repository would notice either.
    expect(
      Object.fromEntries(CONFIGURABLE_SCREENS.map((screen) => [screen, germanTabLabel(screen)])),
    ).toEqual(MEASURED_LABELS);
  });

  it('names the sixth label itself, and no other tab word is in the catalogue', () => {
    // "Mehr" is the sixth label, drawn only when the bar overflows or a screen is off it.
    // It is one short word, four letters shorter than the widest of the five, and it
    // replaces a tab rather than adding one, so the bar is never wider than five. It is
    // also the ONLY tab word left in the catalogue: the five went into their documents
    // with ADR 0075 §5, and an id the catalogue kept beside them would be a second answer
    // to one question — the day they disagreed the tab would say one thing and the
    // screen's heading another.
    expect(Object.keys(de).filter((id) => id.startsWith('ui.tab'))).toEqual(['ui.tabMore']);
    expect(de['ui.tabMore']).toBe('Mehr');
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
     * It matters to a document's words exactly as it mattered to a catalogue's:
     * `resolveText` answers in the locale it is given and falls back to German
     * (ADR 0075 §2), so an English build draws whatever English a document carries
     * and the five words above stop being the five words.
     *
     * So this reads the one place the app names its shipped language. It read the
     * store binding first, and a cold review showed the hole: any second object in
     * that file holding `locale: 'de'` — a fixture, a default, a comment's leftover
     * — answered for the real one. `lib/locale.ts` holds one export and nothing
     * else, so the substring and the declaration are the same thing.
     */
    expect(read(SHIPPED)).toMatch(/export const SHIPPED_LOCALE: Locale = 'de';/);

    /*
     * And the store binding reaches for that constant rather than a literal, which
     * is the other end of the same rule. Reading only one end leaves the other
     * free: the constant could stay `'de'` while `createAppStore` is handed `'en'`
     * directly, and the first version of this check moved that hole rather than
     * closing it. Both ends, so there is nowhere to put the change.
     *
     * **`previewLocale()` in front of it is not a second language shipping.** It is
     * the preview's `workbench:locale` override, and on a phone it answers `null`
     * before it touches anything — there is no `localStorage` on a device to hold a
     * key, which `lib/locale.ts` argues in full. So the value that reaches a tab bar
     * anybody measures is still `SHIPPED_LOCALE`, and what this line holds is the
     * shape: an override in front, the named constant behind it, and no literal
     * anywhere. A `?? 'de'` there would be the same hole spelled differently.
     *
     * Both negatives are anchored on `locale:` and stop at the end of that line.
     * The fallback one was not, and read the whole file: a `?? ''` written next to
     * anything else in the store binding failed a test about tab labels with a
     * message about a language, which is the kind of red that teaches people to
     * edit the check.
     */
    expect(read(STORE)).toMatch(/locale:\s*previewLocale\(\)\s*\?\?\s*SHIPPED_LOCALE/);
    expect(read(STORE)).not.toMatch(/locale:\s*['"]/);
    expect(read(STORE)).not.toMatch(/locale:[^\n]*\?\?\s*['"]/);
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
 *  - **Anything about a document published after this build.** The words are the
 *    newsroom's now (ADR 0075 §5) and this reads the five the build bundles. The
 *    bar a phone draws tomorrow is whatever was submitted, which is what the
 *    check in the workbench is for and not what a test here can reach.
 */
export {};
