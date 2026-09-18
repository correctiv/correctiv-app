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
 * **What this site excludes and the app does not.** No directory, and no author —
 * every literal under `src/` was written here, the drawings' labels included, which
 * ADR 0052 §1 names. What the site prints from the repository never reaches this
 * walk at all: the Markdown and the records arrive through `virtual:docs`, the
 * TypeDoc through `virtual:api` and the app's own wordings through
 * `virtual:strings`, at build time, so none of them is a literal in any file here.
 * That is the line drawing itself rather than needing a list.
 *
 * Written here is not the same as invented here, and the table below marks the
 * places where it is not: `preview/routes.ts` holds the app's screen names, which
 * that file's own docblock argues are marks.
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
 * `alt` is not here, and the app's list has it. This site draws no `<img>` at all,
 * so nothing here means by `alt` what the platform means. What it does mean is two
 * other things, and a cold review measured both: on the drawings it is a BOOLEAN,
 * `<CoreAndHost alt={false} />` and the `alt` prop in `diagrams/shared.tsx`, which
 * says whether to draw the list under a drawing; and in `ui/kit/badge.tsx` it is a
 * variant key holding Tailwind classes. Watching the name therefore catches one
 * string, and that string is a class list, so it manufactures a finding rather
 * than finding one.
 *
 * The first `<img alt>` on this site arrives unguarded, and adding it here is the
 * second half of writing it. A first version of this paragraph said the variant
 * key was the only `alt` in the tree, which is wrong by 45 occurrences.
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
 * `wbMessage` is this site's own spelling, for the modules that hold strings and
 * may not import React — `shell/views.ts`, `preview/routes.ts`, `nav.ts` and
 * `preview/home/write.ts` today; `src/i18n/messages.ts` argues why. `wbMessage` is
 * typed a second time in `package.json` under `i18n:extract`, as
 * `--additional-function-names`, so renaming it is two edits there and a third
 * here. `defineMessages` is not: FormatJS knows it, and this list has to name it
 * because the walk does not.
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
    // Three stages, three numbers, because a walk that found the files and parsed
    // nothing satisfies a floor on the files alone. Each survives this site being
    // migrated: files only grow, extraction turns a text child into an expression
    // without removing the element around it, and `slots` counts a visible prop's
    // NAME whether or not it still carries a literal.
    //
    // **There is no floor on text nodes**, and a cold review is why. There was one,
    // at 400 against 889 — and 840 of those 889 are the literals this whole file
    // exists to remove, 564 of them in the drawings alone. The pass the table below
    // schedules would have taken the figure to 318 and had to lower its own floor,
    // which is the opposite of what a floor is for. What guards that branch of the
    // walk instead is the fixture at the bottom of this file, which asserts a text
    // child is read at all.
    expect(
      floorFaults({
        'files under src/': { found: FILES.length, atLeast: 80 },
        'JSX elements parsed': { found: total((r) => r.elements), atLeast: 1000 },
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
  'pages/Document.tsx': 12,
  'pages/Landing.tsx': 30,
  // At its floor: one import line.
  'pages/Reference.tsx': 1,
  'pages/Sources.tsx': 106,
  // At its floor: six product names. A phone is called the same thing in every
  // language, and `Laptop`, `Desktop`, `Custom` and the two descriptions beside
  // them are words and are messages.
  'preview/devices.ts': 6,
  // At its floor: two headlines out of CORRECTIV's own journalism, standing in the
  // fixture that seeds a saved-articles list. Content, the way the app's own
  // offline bundle is content.
  'preview/frame/seed.ts': 2,
  // At its floor: the name of a browser panel, and a token prefix in monospace.
  'preview/ui/Panels.tsx': 2,
  // The app's screen names. That file's own docblock argues they are marks — the
  // app calls a route „Entdecken“ in German and nothing else — so some of this is a
  // floor rather than debt, and separating the two is that pass's job.
  'preview/routes.ts': 22,
  // At its floor: the wordmark, and the wordmark with the product word after it.
  // `ui/Header.tsx` argues both as names, and a translator is not being asked to
  // rename the organisation.
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
    //
    // The fixture carries a VISIBLE name, and that is the whole of it. A cold
    // review emptied `DESCRIPTORS` and all six cases stayed green, because the
    // pair this once used — `id` and `defaultMessage` — is invisible to the walk
    // either way, so the case passed for a reason that had nothing to do with the
    // list it claimed to be testing.
    expect(found("wbMessage({ id: 'a.b', title: 'Some words' })")).toEqual([]);
    expect(found("defineMessages({ a: { id: 'a.b', title: 'Some words' } })")).toEqual([]);
    // And the same property one call out IS found, or the two above would pass
    // against a walk that had stopped reading properties at all.
    expect(found("notAMessage({ id: 'a.b', title: 'Some words' })")).toEqual(['title:']);
    // And the word test: a separator between two halves of a line is not a word.
    expect(found('<p>·</p>')).toEqual([]);
  });
});
