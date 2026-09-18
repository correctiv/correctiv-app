import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  filesUnder,
  floorFaults,
  ratchet,
  renderedLiterals,
  under,
  type LiteralReading,
} from '@correctiv/prose-and-code';

import { ROOT } from '../plugin/collect.ts';

/**
 * The string this site writes into its own markup instead of extracting.
 *
 * `test/i18n.test.ts` beside this one holds the seam from the other end: every id
 * that IS extracted has a German wording, and every descriptor lives under one
 * name. Neither of those can see a word typed straight into the markup — there is
 * no id for them to be missing from. `<h1>Components</h1>` is not German, is not a
 * descriptor, and renders in English on a German page, which is what
 * [ADR 0052](../../../adr/0052-the-sites-own-words-follow-the-setting.md) is about.
 *
 * **This is the same check `apps/mobile` has**, calling the same walk out of
 * `@correctiv/prose-and-code`, and it is language-blind for the same reason: it
 * never asks what language a string is in, only whether it reaches a person and
 * whether it is a message. A rule stated as "translate the site's own words" has no
 * test. A rule stated as "no literal a person reads" has this one, and the two are
 * the same rule from opposite sides.
 *
 * **What this site excludes and the app does not.** Nothing, by author — every
 * literal under `src/` is this site's own writing, including the drawings' labels,
 * which ADR 0052 §1 names. What the site prints from the repository never reaches
 * this walk at all: the Markdown, the TypeDoc and the records arrive through
 * `virtual:docs`, `virtual:api` and `virtual:strings` at build time, so they are
 * not literals in any file here. That is the line drawing itself rather than
 * needing a list.
 *
 * **The ratchet is the plan.** This arrives with most of the site still unmigrated,
 * and one change that translated all of it would be a review nobody can do. So the
 * debt is counted per file and asserted in both directions: a file may not gain a
 * literal, and an entry that has become too large is as much a failure as one that
 * has become too small. Each pull request lowers a number or deletes a line.
 *
 * **A finished file does not reach zero**, and that is not debt left behind. This
 * site prints identifiers as words — a token name, a folder, a file extension, an
 * import line — and those stay in their own spelling by the same rule that leaves
 * `de` and `en` as the column heads on `/strings`. The number a file settles at is
 * its identifier count, and the two-sided ratchet freezes it there.
 */
const SRC = join(ROOT, 'apps/workbench/src');

/** `pages/Components.tsx: Components` — the key the ratchet counts by file. */
const site = ({ file }: { file: string }): string => file;

/**
 * The names this site hands a string a person reads, read off this site rather
 * than off a framework's documentation.
 *
 * Two sources and both are the source: the props its own components declare and
 * render (`label`, `legend`, `summary`, `placeholder`, `hint`, `caption`,
 * `heading`, `detail`, `text`), and the DOM attributes it actually writes
 * (`aria-label`, `title`).
 *
 * `alt` is not here, and the app's list has it. This site draws no `<img>` at all;
 * the one `alt` under `src/` is a variant key in `ui/kit/badge.tsx` holding
 * Tailwind classes, so watching the name would have manufactured a finding rather
 * than caught one. That is the cost of naming the visible props stated from the
 * other side: a name nobody writes does not excuse anything, and here it invents
 * something. The first `<img alt>` on this site arrives unguarded, and adding it
 * here is the second half of writing it.
 *
 * `description` is deliberately NOT here, which is the opposite of the app's
 * choice and is measured: every `description:` in this tree sits inside a
 * `wbMessage` or `defineMessages` call, whose subtree the walk does not enter, so
 * the name would never be met and would read as coverage. The app keeps it because
 * `profile/SettingRow` renders a prop of that name.
 *
 * What is NOT here matters as much. `className`, `variant`, `id`, `name`, `href`,
 * `value` and `route` all take a string a person never reads, and a check that read
 * every string prop would be mostly wrong and would need an exception list longer
 * than the rule.
 */
const VISIBLE: ReadonlySet<string> = new Set([
  'aria-label',
  'caption',
  'detail',
  'heading',
  'hint',
  'label',
  'legend',
  'placeholder',
  'summary',
  'text',
  'title',
]);

/**
 * A descriptor block is a message by construction, so nothing inside one is a
 * literal nobody can reach.
 *
 * `wbMessage` is this site's own spelling, for the two modules that hold titles and
 * may not import React (`src/i18n/messages.ts` argues it). Both names are typed a
 * second time in `package.json` under `i18n:extract`, so renaming one is two edits
 * there and a third here.
 */
const DESCRIPTORS = ['defineMessages', 'wbMessage'];

/** This site's argument handed to the walk, one file at a time. */
const read = (file: string, code: string): LiteralReading =>
  renderedLiterals({ file, code, visible: VISIBLE, descriptors: DESCRIPTORS });

const FILES = filesUnder(SRC, /\.tsx?$/).map((full) => under(SRC, full));

const READINGS = FILES.map((path) => read(path, readFileSync(join(SRC, path), 'utf8')));

const LITERALS = READINGS.flatMap((reading) => reading.literals);
const total = (of: (reading: LiteralReading) => number) =>
  READINGS.reduce((sum, r) => sum + of(r), 0);

describe('the walk reads the site it is checking', () => {
  it('finds files, elements, text and visible props (guards against an empty walk)', () => {
    // Four stages, four numbers, because a walk that found the files and parsed
    // nothing satisfies a floor on the files alone. Each is far enough below the
    // real figure to need no maintenance and far enough above zero that a branch
    // which stopped matching cannot pass it.
    expect(
      floorFaults({
        'files under src/': { found: FILES.length, atLeast: 80 },
        'JSX elements parsed': { found: total((r) => r.elements), atLeast: 1000 },
        'JSX text nodes': { found: total((r) => r.texts), atLeast: 400 },
        'visible props and keys': { found: total((r) => r.slots), atLeast: 150 },
      }),
    ).toEqual([]);
  });

  it('parses every file it read', () => {
    expect(READINGS.flatMap((reading) => reading.unreadable)).toEqual([]);
  });

  it('writes every name it watches for', () => {
    // The other direction of `VISIBLE`. A prop that leaves this site leaves a line
    // above that reads as coverage and is not, and the next person adds a second
    // guess beside it.
    const written = new Set<string>();
    for (const reading of READINGS) for (const name of reading.names) written.add(name);
    expect(ratchet(written, [...VISIBLE]).stale).toEqual([]);
  });
});

/**
 * What is still written into this site's markup, by file.
 *
 * **A count and not a list of strings**, which is the opposite of the app's
 * choice beside it and is decided by size. The app excuses eighteen literals and
 * names every one; this site has over a thousand, and a list of them would be a
 * file nobody reads and a merge conflict on every pull request. What the number
 * has to do is go down, and a number does that legibly.
 *
 * **Asserted in both directions.** A file may not gain a literal, and an entry
 * larger than what is there is as much a failure as one that is too small — so a
 * pull request that translates half a page has to lower its line, and a line for
 * a file that is finished has to be deleted.
 *
 * A comment marks every entry that is already at its floor. Those are not debt:
 * this site prints identifiers as words, and a wordmark is the same word in every
 * language.
 */
const STILL_IN_THE_MARKUP: Record<string, number> = {
  // One line, printed when a borrowed component throws.
  'components/AppHost.tsx': 1,
  // The six drawings. ADR 0052 §1 names their titles and captions, so they are in
  // scope; a good part of each number is module and file names inside the boxes,
  // which will stay. They are the largest single piece of this and want a pass of
  // their own, because a label is sized by its text and a longer German word
  // reflows a diagram.
  'diagrams/ArticlePath.tsx': 117,
  'diagrams/CoreAndHost.tsx': 102,
  'diagrams/DecisionsChain.tsx': 32,
  'diagrams/InsideCore.tsx': 115,
  'diagrams/Services.tsx': 47,
  'diagrams/SignIn.tsx': 151,
  'diagrams/index.ts': 6,
  'diagrams/layout.ts': 6,
  // The frame around a drawing rather than a drawing: the scroll region's name and
  // the heading over the list underneath.
  'diagrams/shared.tsx': 2,
  // At its floor. `canvas`, `surface`, `.tsx`, `.web.tsx` and an import line: this
  // site prints an identifier in its own spelling.
  'pages/ComponentDetail.tsx': 5,
  // At its floor: two import lines.
  'pages/Components.tsx': 2,
  'pages/Decisions.tsx': 68,
  'pages/Design.tsx': 46,
  'pages/DiagramIndex.tsx': 3,
  'pages/DiagramView.tsx': 5,
  'pages/Document.tsx': 12,
  'pages/Handbook.tsx': 10,
  'pages/Landing.tsx': 30,
  'pages/Reference.tsx': 14,
  'pages/Sources.tsx': 106,
  // Including this page's own heading, which the board says out loud.
  'pages/Strings.tsx': 23,
  'preview/AppFrame.tsx': 2,
  'preview/api.ts': 4,
  'preview/devices.ts': 11,
  'preview/frame/measure.ts': 4,
  'preview/frame/seed.ts': 20,
  // The app's screen names. That file's own docblock argues they are marks — the
  // app calls a route „Entdecken“ in German and nothing else — so some of this is a
  // floor rather than debt, and separating the two is that pass's job.
  'preview/routes.ts': 22,
  'preview/ui/Panels.tsx': 65,
  'preview/ui/Readout.tsx': 11,
  // At its floor: the wordmark, twice. A translator is not being asked to rename
  // the organisation.
  'ui/Header.tsx': 2,
  // At its floor: „English“ and „Deutsch“ and the hint under each, which are
  // written in the language of the row they belong to. `ui/Settings.tsx`'s own
  // docblock argues it: a German reader offered „Englisch“ has been answered in
  // the language they are trying to leave.
  'ui/Settings.tsx': 4,
};

describe('the site says its own words through a descriptor', () => {
  const { arrivals, stale } = ratchet(LITERALS.map(site), STILL_IN_THE_MARKUP);

  it('writes no new literal a person reads', () => {
    expect(arrivals).toEqual([]);
  });

  it('excuses nothing that has since been extracted', () => {
    // The direction a one-sided list cannot do. Without it the table only ever
    // grows, a file that was finished keeps its line, and the next reader cannot
    // tell what is left from what was left behind.
    expect(stale).toEqual([]);
  });

  it('counts a literal in every shape the walk follows', () => {
    // A self-test over fixture source, because every assertion above is about a
    // number and a number cannot say whether the walk is still looking. The shapes
    // themselves are `@correctiv/prose-and-code`'s to get right and its own test
    // asserts each; this asserts that THIS site's two lists reach them.
    const found = (code: string) => read('fixture.tsx', code).literals.map((l) => l.slot);

    expect(found('<p>Some words</p>')).toEqual(['<p>']);
    expect(found('<Filter label="Some words" />')).toEqual(['label=']);
    expect(found('<Filter className="grid gap-xs" />')).toEqual([]);
    // A descriptor call is a message by construction, subtree and all.
    expect(found("wbMessage({ id: 'a.b', defaultMessage: 'Some words' })")).toEqual([]);
    expect(found("defineMessages({ a: { id: 'a.b', defaultMessage: 'Some words' } })")).toEqual([]);
    // And the word test: a separator between two halves of a line is not a word.
    expect(found('<p>·</p>')).toEqual([]);
  });
});
