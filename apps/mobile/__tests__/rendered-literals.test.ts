import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import {
  excusesWithoutReason,
  filesUnder,
  floorFaults,
  ratchet,
  renderedLiterals,
  under,
  type Finding,
  type LiteralReading,
  type RenderedLiteral,
} from '@correctiv/prose-and-code';

/**
 * The string a translator never sees.
 *
 * `localisation-seam.test.ts` beside this one walks the same tree for `äöüß„“`
 * and fails on a German string written outside the catalogue. That catches a
 * German literal, and its own docblock admits how partial the net is: "Suchen"
 * slips through. This is the rest of the same hole, and the larger half.
 * `<Typo>Save</Typo>` is not German, is not a descriptor, ships in every build,
 * and nothing in this repository fails on it today. Typecheck cannot — it is a
 * string in a position that takes one. oxlint cannot, for the same reason. The
 * character net cannot — there is no umlaut in it. The workbench's `/strings`
 * cannot, because it lists what WAS extracted and the one string that was not is
 * exactly the one missing from it. So the word ships, a German reader meets it in
 * English, and there is no id anybody could hang the German on.
 *
 * **This check is language-blind on purpose.** It never asks what language a
 * literal is in. It asks whether the literal reaches a person, and one that does
 * and is not a message descriptor is the fault whatever it happens to say. That is
 * what makes it a different check rather than a wider version of its neighbour:
 * the two German lines in `home/EarlyAccessCard.tsx` are invisible to the
 * character net (no umlaut between them) and are found here, which is the
 * demonstration that the net is not the same net.
 *
 * **The alternative was a pseudo-locale, and it is rejected rather than pending.**
 * A third catalogue of accented, expanded English — `[Şåvé Ťḫḯṡ …]` — makes an
 * unextracted string obvious by eye: everything the catalogue reaches comes back
 * mangled, and whatever renders plain was never extracted. It is the standard
 * answer and it costs two things this repository should not pay. It puts a member
 * that is not a language into the core's `Locale` union, so every exhaustive
 * switch over that union has to answer for a fake; and it only finds anything when
 * somebody remembers to switch the preview to it and look. AGENTS.md prefers the
 * answer that cannot be forgotten over the one somebody has to remember to take —
 * that is the whole argument under "facts that expire" — and a case in
 * `npm run check` is taken on every push by nobody in particular. The pseudo-locale
 * would still be the better tool for judging LAYOUT under a longer language, which
 * is a different question and not one a check can answer.
 *
 * **What it does not do** is `renderedLiterals`' own docblock in
 * `@correctiv/prose-and-code`, and it is worth reading before trusting a green run
 * of this file: it reads literals where they are written and follows four shapes
 * that choose one, and a string reached through a variable or built by anything
 * else is invisible to it. On top of that this file adds its own limit — a literal
 * on a prop outside `VISIBLE` below is not read — and says nothing about whether a
 * descriptor's English is any good. It is the net for the mistake as somebody
 * makes it, a word typed straight into the markup, and it is no reason to skip
 * reading a screen in German.
 *
 * **The walk itself is not here.** The parse, the four shapes, the whitespace
 * collapsing and the word test are `@correctiv/prose-and-code`'s, because
 * `apps/workbench` needs the same walk over its own `src/` for its own reasons and
 * two copies of a compiler walk held in step by hand is the thing AGENTS.md argues
 * against. What stays in this file is the argument: which props a person reads in
 * THIS app, which calls are already messages, what is content rather than UI, and
 * every excuse with the reason for it.
 */
const SRC = resolve(__dirname, '..', 'src');

/** `components/home/HomeHeader.tsx: CORRECTIV` — the key the ratchet excuses by. */
const site = ({ file, text, slot }: RenderedLiteral): Finding => ({
  key: `${file}: ${text}`,
  as: slot,
});

/**
 * The names that reach a person, read off this app rather than off React Native's
 * documentation.
 *
 * Two sources, and both are the source: the props this app's own components
 * declare as `string` and then render (`label` on `ui/Badge`, `title` on
 * `ui/Button`, `subtitle` and `title` on `profile/NavCard`, `meta` on
 * `media/EpisodeRow`, `tierLabel`, `backLabel`, `actionLabel`, `detail`, `text`,
 * `description`), and the platform props this app actually passes
 * (`accessibilityLabel`, `accessibilityValue`, `placeholder`, `alt`,
 * `headerTitle`). Nothing here is a guess: `accessibilityHint` and `tabBarLabel`
 * would both be reasonable and neither is written in this app, so neither is
 * listed — a name nobody passes excuses nothing and reads as coverage.
 *
 * Held to that by the case below, which fails on a name in this list that the app
 * no longer writes. The cost of the rule is stated rather than hidden: the first
 * `accessibilityHint` in this app arrives unguarded, and adding it here is the
 * second half of writing it.
 *
 * What is NOT here matters as much. `className`, `variant`, `tone`, `color`,
 * `icon`, `name`, `align` and `testID` all take a string a person never reads —
 * a class, a token, an Ionicons name, a route segment — so a check that read every
 * string prop would be mostly wrong and would need an exception list longer than
 * the rule. Naming the visible props instead is why this one needs almost none.
 */
const VISIBLE: ReadonlySet<string> = new Set([
  'accessibilityLabel',
  'accessibilityValue',
  'actionLabel',
  'alt',
  'backLabel',
  'description',
  'detail',
  'headerTitle',
  'label',
  'meta',
  'placeholder',
  'subtitle',
  'text',
  'tierLabel',
  'title',
]);

/**
 * A descriptor block is a message by construction, so nothing inside one can be a
 * literal nobody can reach — and `description` is the field a translator READS,
 * never a rendered one. The walk skips the call's whole subtree, which is what lets
 * `description` stay in `VISIBLE`, where it guards `profile/SettingRow`'s rendered
 * prop of the same name.
 *
 * `coreMessage` is the core's spelling of the same thing
 * ([ADR 0049](../../../adr/0049-the-catalogue-is-a-package.md)). It appears in no
 * file this walks; it is named because this is the list of "already a message" and
 * leaving half of it out would be the kind of omission that reads as a decision.
 */
const DESCRIPTORS = ['defineMessages', 'coreMessage'];

/**
 * Bundled CONTENT rather than UI, excluded for the reason and with the wording
 * `localisation-seam.test.ts` uses, so that the two checks read one app rather
 * than two: the offline article and podcast snapshots are CORRECTIV's own German
 * journalism as `npm run offline-articles` fetched it, and translating an article
 * is not what this seam is for.
 */
const CONTENT = new Set([
  'lib/articles/offlineBundle.generated.ts',
  'lib/podcasts/offlineBundle.generated.ts',
]);

/**
 * The gallery, excluded for the reason its two neighbours exclude it: it is a
 * developer's catalogue of the components, read by nobody else, and its fixtures
 * exist to show those components carrying the copy they really carry. Every line
 * in it would be a finding here and every one of them would be wrong.
 */
const DEVELOPER_ONLY = /^gallery\//;

/**
 * The names this app writes the same way in every language, and why each is one.
 *
 * **Keyed by the STRING and not by the place**, which is the opposite of the
 * neighbouring check's choice and is deliberate. A German sentence is a decision
 * about a screen, so its excuse names the file it sits in. A mark is a decision
 * about the WORD: `Backstage` is Backstage on the teaser, in the header and inside
 * `backstage.allFromBackstage`, and an entry per site would be the same argument
 * written three times and three places to forget. The cost is the other side of
 * that coin: a mark pasted into a new screen inherits the decision without anybody
 * looking, which is right for a name and would not be right for a sentence.
 *
 * Exact-string, so this excuses the word and not a sentence containing it.
 * `<Typo>Backstage</Typo>` passes; `<Typo>Alles aus Backstage</Typo>` is a finding,
 * which is the case that matters — the sentence around a mark is ordinary copy and
 * `mediathek.fromBackstage` is the id it already has.
 *
 * Asserted in both directions: a mark this app has stopped writing fails here, so
 * the list shrinks with the screens rather than outliving them.
 */
const MARKS: Record<string, string> = {
  CORRECTIV:
    'The wordmark, set letterspaced on Home’s masthead. A translator is not being asked to rename the organisation.',
  'Abriss-Atlas':
    'The demolition atlas. Reporting into it happens on abriss-atlas.de under that name, and `atlas.report` keeps the domain inside a sentence that is translated.',
  Backstage:
    'The members’ area. The catalogue writes it untranslated inside German sentences (`backstage.allFromBackstage`, `mediathek.fromBackstage`), so a bare one is the same word.',
  Club: 'The membership tier, on the badge. `profile.nav.clubAccessibility` carries it inside a message as `{title}, Club`, which is where the sentence around it is translated.',
  Faktenforum:
    'CORRECTIV’s community fact-checking platform, kept in its own spelling even in English prose (`claim.submitOwn`).',
  Klima:
    'The third newsletter’s name. `(tabs)/profil.tsx` says it where the list is built: a newsletter’s name is its name in every language, and only the line under it is a message.',
  Spotlight:
    'The newsletter, and the briefing named after it. The German catalogue keeps the word (`home.allSpotlightIssues`).',
  'Spotlight Schweiz':
    'The Swiss edition of that newsletter — a name rather than a phrase, and already in the language it ships in.',
};

/**
 * The literals that are not marks, are not messages, and have a reason anyway.
 *
 * Keyed by `file: text`, because each of these is a decision about one place. The
 * ratchet is two-sided, so an entry whose string has since become a message fails
 * with the rest — the reason leaves with the string it was about and cannot rot
 * into an excuse for whatever is written there next.
 *
 * Both entries are one decision, and it is the file's own: the card's badge and
 * its action are its vocabulary and carry ids, while the headline and the teaser
 * are a sample article standing in for one the feed will supply. That makes them
 * content rather than words the app chose, the same category as the bundled
 * journalism above, and they will arrive in German as data when the source is
 * wired up.
 */
const LITERALS_OUTSIDE_THE_CATALOGUE: Record<string, string> = {
  'components/home/EarlyAccessCard.tsx: Die Pensionskassen-Recherche, exklusiv vorab':
    'Sample article headline, standing in for one the feed will supply; the file’s own docblock argues it and gives the badge and the action ids instead.',
  'components/home/EarlyAccessCard.tsx: Sie lesen jetzt, drei Tage vor allen anderen.':
    'The teaser under that sample headline, and the same decision: content arriving as data later, not a word this card chose.',
};

/** This app's argument handed to the walk, one file at a time. */
const read = (file: string, code: string): LiteralReading =>
  renderedLiterals({ file, code, visible: VISIBLE, descriptors: DESCRIPTORS });

const FILES = filesUnder(SRC, /\.tsx?$/)
  .map((full) => under(SRC, full))
  .filter((path) => !CONTENT.has(path) && !DEVELOPER_ONLY.test(path));

const READINGS = FILES.map((path) => read(path, readFileSync(join(SRC, path), 'utf8')));

const LITERALS = READINGS.flatMap((reading) => reading.literals);
const total = (of: (reading: LiteralReading) => number) =>
  READINGS.reduce((sum, r) => sum + of(r), 0);

describe('the walk reads the app it is checking', () => {
  it('finds files, elements, text and visible props (guards against an empty walk)', () => {
    // Four stages, four numbers, because a walk that found the files and parsed
    // nothing satisfies a floor on the files alone. Each is far enough below the
    // real figure to need no maintenance and far enough above zero that a branch
    // which stopped matching cannot pass it.
    expect(
      floorFaults({
        'files under src/': { found: FILES.length, atLeast: 100 },
        'JSX elements parsed': { found: total((r) => r.elements), atLeast: 500 },
        'JSX text nodes': { found: total((r) => r.texts), atLeast: 10 },
        'visible props and keys': { found: total((r) => r.slots), atLeast: 150 },
      }),
    ).toEqual([]);
  });

  it('parses every file it read', () => {
    expect(READINGS.flatMap((reading) => reading.unreadable)).toEqual([]);
  });

  it('writes every name it watches for', () => {
    // The other direction of `VISIBLE`. A prop that leaves the app leaves a line
    // here that reads as coverage and is not, and the next person adds a second
    // guess beside it.
    //
    // A name counts as written when it is MET, not when it carries a literal —
    // `description: COPY.spotlight` in the `NEWSLETTERS` table `(tabs)/profil.tsx`
    // builds and `description={intl.formatMessage(…)}` on the settings rows both
    // keep `description` out of `stale`. That is the walk's shape and the note
    // beside `names` on `LiteralReading` argues it; the cost here is that a key
    // sharing a rendered prop's spelling in a plain data structure would read as
    // coverage, and nothing in this file would notice.
    const written = new Set<string>();
    for (const reading of READINGS) for (const name of reading.names) written.add(name);
    expect(ratchet(written, [...VISIBLE]).stale).toEqual([]);
  });
});

/**
 * This app's two lists, run over fixture source with a KNOWN answer.
 *
 * **The shapes the walk follows are not tested here any more.** A ternary, a `&&`,
 * a `+`, an array joined with `.join`, a template's holes read out: those are
 * `@correctiv/prose-and-code`'s to get right, its own test asserts each of them
 * against a fixture, and a second copy of those cases here would be the duplication
 * the extraction removed, one layer up.
 *
 * What is left is the half that is this app's and that nothing else can assert:
 * `VISIBLE` and `DESCRIPTORS` are two lists of strings handed to a walk, and a
 * typo in either is invisible to every floor above — the walk goes on parsing, the
 * counts stay satisfied, and the findings quietly stop arriving. These cases are
 * the only thing between that and a green run.
 *
 * One file name throughout, `fixture.tsx`, because `read`'s first argument only
 * ever affects the `file` field of a literal and the choice of `ScriptKind`.
 */
describe('this app’s lists reach the walk', () => {
  const at = (code: string): { slot: string; text: string }[] =>
    read('fixture.tsx', code).literals.map(({ slot, text }) => ({ slot, text }));

  it('reads a literal on a prop this app renders, in both spellings', () => {
    expect(at("const X = () => <Button title='Plain prop' />;")).toEqual([
      { slot: 'title=', text: 'Plain prop' },
    ]);
    expect(at("const ROWS = [{ title: 'Row title' }];")).toEqual([
      { slot: 'title:', text: 'Row title' },
    ]);
  });

  it('reads a text child, which needs no name at all', () => {
    expect(at('const X = () => <Text>Save</Text>;')).toEqual([{ slot: '<Text>', text: 'Save' }]);
  });

  it('stays quiet on a prop this app never renders', () => {
    expect(at('const X = () => <Text testID="save-button">{count}</Text>;')).toEqual([]);
  });

  it('stays quiet inside a descriptor, `description` included', () => {
    // The field a translator reads and nobody renders, inside a call named in
    // `DESCRIPTORS` — which is what lets `description` stay in `VISIBLE`.
    expect(
      at(
        "const COPY = defineMessages({ save: { id: 'x.save', defaultMessage: 'Save', description: 'A button' } });",
      ),
    ).toEqual([]);
    expect(
      at("const M = coreMessage({ id: 'x.fail', defaultMessage: 'Playback failed' });"),
    ).toEqual([]);
  });
});

describe('a rendered literal is a message or has a reason', () => {
  it('routes every literal through a descriptor, a mark or a reason', () => {
    const { arrivals } = ratchet(
      LITERALS.filter(({ text }) => !(text in MARKS)).map(site),
      LITERALS_OUTSIDE_THE_CATALOGUE,
    );
    expect(arrivals).toEqual([]);
  });

  it('excuses no literal that has since become a message', () => {
    const { stale } = ratchet(
      LITERALS.filter(({ text }) => !(text in MARKS)).map(site),
      LITERALS_OUTSIDE_THE_CATALOGUE,
    );
    expect(stale).toEqual([]);
  });

  it('keeps no mark this app has stopped writing', () => {
    // The arrivals half belongs to the case above, which sees everything that is
    // not a mark; this one is here so the mark list can only shrink.
    const written = new Set(LITERALS.filter(({ text }) => text in MARKS).map(({ text }) => text));
    expect(ratchet(written, MARKS).stale).toEqual([]);
  });

  it('says why for every entry on both lists', () => {
    // A path and no argument says nothing about whether an entry is a debt or a
    // decision, and a list of bare keys is how a list of two becomes a list of
    // thirty.
    expect(excusesWithoutReason(MARKS)).toEqual([]);
    expect(excusesWithoutReason(LITERALS_OUTSIDE_THE_CATALOGUE)).toEqual([]);
  });
});
