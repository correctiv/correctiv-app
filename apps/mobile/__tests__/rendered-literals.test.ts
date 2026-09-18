import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import ts from 'typescript';

import {
  excusesWithoutReason,
  filesUnder,
  floorFaults,
  ratchet,
  under,
  type Finding,
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
 * **What it does not do.** It reads literals where they are written, so a string
 * reached through a variable, built by concatenation, or returned from a helper is
 * invisible to it, and so is a literal on a prop outside `VISIBLE` below. It says
 * nothing about whether a descriptor's English is any good. It is the net for the
 * mistake as somebody makes it — a word typed straight into the markup — and it is
 * no reason to skip reading a screen in German.
 */
const SRC = resolve(__dirname, '..', 'src');

/**
 * A literal that a person can read or hear, addressed the way the list below
 * spells it.
 */
interface Literal {
  /** Path under `src/`, with `/` on every OS. */
  file: string;
  /** The string as it would render, with its whitespace collapsed (see `words`). */
  text: string;
  /** Where it sits: `<Typo>`, `title=`, `label:`. Reported, never part of a key. */
  slot: string;
}

/** `components/home/HomeHeader.tsx: CORRECTIV` — the key the ratchet excuses by. */
const site = ({ file, text, slot }: Literal): Finding => ({ key: `${file}: ${text}`, as: slot });

/**
 * A run of two letters, which is this check's whole definition of "a word".
 *
 * It is what takes the separators out without a list of them: `·` between two
 * halves of a meta line, the `→` that ends a call to action, the `×` on the
 * player's close button, and the `A` / `A+` / `A++` type-size samples in the
 * settings are each a mark on the glass rather than something to translate. None
 * of them carries two letters in a row, so none of them is a finding and none of
 * them needs an excuse. A number, a punctuation mark and an empty `alt` fall out
 * the same way.
 *
 * The cost is a one-letter word, and German and English have none worth
 * translating. `\p{L}` rather than `[A-Za-z]` so that the check does not become
 * blind to the alphabet it is most likely to meet.
 */
const WORD = /\p{L}{2,}/u;

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
 * never a rendered one. Skipping the call's whole subtree is what lets
 * `description` stay in `VISIBLE`, where it guards `profile/SettingRow`'s rendered
 * prop of the same name.
 *
 * `coreMessage` is the core's spelling of the same thing
 * ([ADR 0049](../../../adr/0049-the-catalogue-is-a-package.md)). It appears in no
 * file this walks; it is named because this is the list of "already a message" and
 * leaving half of it out would be the kind of omission that reads as a decision.
 */
const DESCRIPTOR = /^(?:defineMessages|coreMessage)$/;

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

/**
 * What one file's parse produced, stage by stage, because each stage is somewhere
 * the walk can empty out and go green.
 */
interface Reading {
  literals: Literal[];
  /** JSX elements met. Zero of these over the tree means nothing was parsed. */
  elements: number;
  /** Non-blank JSX text nodes met, blank or not a word. Guards the text branch. */
  texts: number;
  /** Visible props and keys met, whatever their value. Guards the prop branch. */
  slots: number;
  /** Which of `VISIBLE` were met, for the other direction of that list. */
  names: Set<string>;
  /** What the parser could not read, which is this check's `eatenByStripping`. */
  unreadable: string[];
}

/** The literal a node carries, if it is one the source spells out in full. */
const literal = (node: ts.Node | undefined): string | undefined =>
  node && (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node))
    ? node.text
    : undefined;

/**
 * The rendered spelling: one space for any run of whitespace. A text child is
 * indented and wrapped by oxfmt, so without this the key would change whenever the
 * line was rewrapped and every excuse on the list would go stale on a reformat.
 */
const words = (text: string) => text.replace(/\s+/g, ' ').trim();

/**
 * The literals in one file, and the counts that say the reading happened.
 *
 * **Parsed rather than matched, and this is the one place this check departs from
 * `@correctiv/prose-and-code`.** Its comment strippers are regular expressions,
 * and its own README says what that costs: "a slash-star written after a space
 * inside a string literal opens a block in either of them". This check's whole
 * subject is string literals, so the stripper could eat the thing being read and
 * the file would come back clean. A parser has no such failure — a comment is
 * trivia and never a node, so commented-out markup and a rule's own explanation
 * are both invisible without anything being removed from the text. Everything else
 * the package offers is used: the walk, the floors, the two-sided lists and the
 * argument on every entry.
 *
 * `ScriptKind` follows the extension rather than being TSX throughout, because
 * `<T>(x: T) => x` in a `.ts` file parses as an unclosed element under TSX and
 * takes the rest of the file with it.
 */
function read(file: string, code: string): Reading {
  const source = ts.createSourceFile(
    file,
    code,
    ts.ScriptTarget.Latest,
    true,
    file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const reading: Reading = {
    literals: [],
    elements: 0,
    texts: 0,
    slots: 0,
    names: new Set(),
    unreadable: [],
  };

  /*
   * `parseDiagnostics` is the parser saying it gave up somewhere, and a file it
   * gave up on yields a partial tree and no findings — the silently empty walk,
   * one file at a time. It is not in the public typings, so a version that stops
   * carrying it is itself the fault: `undefined` is reported here rather than read
   * as "nothing went wrong". `tsc --noEmit` over these same files runs earlier in
   * `npm run check` and would fail first, which is why this is a guard and not the
   * defence.
   */
  const faults = (source as ts.SourceFile & { parseDiagnostics?: readonly ts.Diagnostic[] })
    .parseDiagnostics;
  if (!Array.isArray(faults)) reading.unreadable.push(`${file}: the parser reported nothing`);
  else if (faults[0] !== undefined) {
    reading.unreadable.push(
      `${file}: ${ts.flattenDiagnosticMessageText(faults[0].messageText, ' ')}`,
    );
  }

  const keep = (slot: string, text: string) => {
    if (WORD.test(text)) reading.literals.push({ file, text: words(text), slot });
  };

  const visit = (node: ts.Node): void => {
    if (ts.isCallExpression(node) && DESCRIPTOR.test(node.expression.getText(source))) return;

    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) reading.elements += 1;

    if (ts.isJsxText(node)) {
      // A text child in React Native is rendered by definition: anything that is
      // not inside a text component throws before a reader can see it, so this
      // needs no list of which tags count.
      if (node.text.trim() !== '') reading.texts += 1;
      const tag = ts.isJsxElement(node.parent)
        ? node.parent.openingElement.tagName.getText(source)
        : '?';
      keep(`<${tag}>`, node.text);
    }

    if (
      ts.isJsxExpression(node) &&
      (ts.isJsxElement(node.parent) || ts.isJsxFragment(node.parent))
    ) {
      // `<Typo>{'Save'}</Typo>` and `` <Typo>{`Page ${n}`}</Typo> ``: the same
      // rendered text, one brace further out. The template is read with its holes
      // removed, so `{`${a}${b}`}` carries no words and is not a finding.
      const child = literal(node.expression);
      if (child !== undefined) keep('child', child);
      if (node.expression !== undefined && ts.isTemplateExpression(node.expression)) {
        keep('child', node.expression.getText(source).replace(/\$\{[^}]*\}/g, ''));
      }
    }

    if (ts.isJsxAttribute(node)) {
      const name = node.name.getText(source);
      if (VISIBLE.has(name)) {
        reading.slots += 1;
        reading.names.add(name);
        const value =
          literal(node.initializer) ??
          (node.initializer !== undefined && ts.isJsxExpression(node.initializer)
            ? literal(node.initializer.expression)
            : undefined);
        if (value !== undefined) keep(`${name}=`, value);
      }
    }

    if (ts.isPropertyAssignment(node)) {
      // The same names one layer in: `options={{ title: 'Einstellungen' }}` on a
      // route, and the arrays of rows a screen builds before it maps them.
      const name = node.name.getText(source).replace(/['"]/g, '');
      if (VISIBLE.has(name)) {
        reading.slots += 1;
        reading.names.add(name);
        const value = literal(node.initializer);
        if (value !== undefined) keep(`${name}:`, value);
      }
    }

    ts.forEachChild(node, visit);
  };
  visit(source);
  return reading;
}

const FILES = filesUnder(SRC, /\.tsx?$/)
  .map((full) => under(SRC, full))
  .filter((path) => !CONTENT.has(path) && !DEVELOPER_ONLY.test(path));

const READINGS = FILES.map((path) => read(path, readFileSync(join(SRC, path), 'utf8')));

const LITERALS = READINGS.flatMap((reading) => reading.literals);
const total = (of: (reading: Reading) => number) => READINGS.reduce((sum, r) => sum + of(r), 0);

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
        'JSX text nodes': { found: total((r) => r.texts), atLeast: 5 },
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
    const written = new Set<string>();
    for (const reading of READINGS) for (const name of reading.names) written.add(name);
    expect(ratchet(written, [...VISIBLE]).stale).toEqual([]);
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
