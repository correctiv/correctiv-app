import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  excusesWithoutReason,
  filesUnder,
  floorFaults,
  ratchet,
  under,
  withoutComments,
} from '@correctiv/prose-and-code';

/**
 * A two-sided row is written once, in `ui/SplitRow`, and not again.
 *
 * `justify-between` is the class that looks finished and is not. It distributes
 * the room left over, so a row built from it is correct exactly while there IS
 * room left over — and at 200 % system font there is none. The accessibility tour
 * photographed four of those in one walk
 * ([#158](https://github.com/correctiv/correctiv-app/issues/158)): Home's date
 * off the right edge, `SPOTLIGHTAlle Ausgaben →` as one word, the door's two
 * footer links overlapping with the second half of the second one off screen.
 * `SplitRow` holds the two things they were each missing, a gap that cannot
 * collapse and permission to wrap, and this is what keeps the next row from being
 * written by hand instead.
 *
 * **Why a check rather than a note in AGENTS.md.** Every one of those four passed
 * `npm run check`, passed review, and was invisible at 100 %. A convention that
 * can only be broken silently is not a convention; this one fails.
 *
 * **Read as text, not parsed.** `no-numeric-utilities.test.ts` draws the line and
 * the reason is the same here: a class is a word on a line, and a line is the
 * whole of the context needed to judge it. Comments are stripped, so this file's
 * own prose and `SplitRow`'s docblock do not count as uses.
 */
const SRC = join(__dirname, '..', 'src');

/** Where the row is allowed to be built, because it is where it is built. */
const THE_PRIMITIVE = 'components/ui/SplitRow.tsx';

/**
 * The gallery, excluded as `accessibility.test.ts` and `colour-tiers.test.ts`
 * exclude it: a developer's catalogue of the components, read by nobody else, and
 * its specimens are deliberately bare.
 */
const DEVELOPER_ONLY = /^gallery\//;

/**
 * The places that spell `justify-between` themselves, and why each one is not a
 * two-sided row.
 *
 * **Addressed by file and not by line**, which is the opposite of the choice
 * `accessibility.test.ts` makes and is a weaker check for it: a second
 * `justify-between` added lower down one of these files inherits its excuse. The
 * reason is that these two entries are about elements nobody is editing, in files
 * several people are — a line number here would fail the suite on somebody else's
 * unrelated edit, which is how a check gets deleted. The stale half below is the
 * part that still holds: an entry whose file no longer contains the class fails.
 */
const NOT_A_TWO_SIDED_ROW: Record<string, string> = {
  'app/artikel.tsx':
    'The floating header over an article: a back button on one side, share and bookmark on the other, all of them fixed-size icons that do not grow with the type. Wrapping is the wrong answer for a bar that is positioned absolutely over the article — it would grow downwards into the text it floats over.',
  'components/home/MediathekReihe.tsx':
    'A column, not a row: `flex-1 justify-between` pushes the meta line to the bottom of a tile of fixed height. The defect this check is about is horizontal, and there is no second side here to collide with.',
  'components/ui/NavRail.tsx':
    'A vertical column, not a horizontal row: `flex-1 justify-between` pins the tab list to the top of the rail and the mini player to its bottom. The rail is 88 px wide and full-height; the tabs grow downward from the top, the mini player is fixed-height and pinned to the bottom, and the two cannot collide even at 200 % font scale. The defect this check is about — horizontal text overlap when space runs out — does not apply to a vertical stack whose children do not share an axis.',
};

const FILES = filesUnder(SRC, /\.tsx?$/).filter((path) => !DEVELOPER_ONLY.test(under(SRC, path)));

/** Every file under `src/` that spells the class, comments stripped. */
const users = FILES.filter((path) =>
  withoutComments(readFileSync(path, 'utf8')).includes('justify-between'),
).map((path) => under(SRC, path));

/**
 * The primitive is not an offender, so it is taken out before the ratchet rather
 * than excused in it: an entry in `NOT_A_TWO_SIDED_ROW` is a place the rule is
 * broken and tolerated, and this is the place the rule is kept.
 */
const byHand = users.filter((file) => file !== THE_PRIMITIVE);

describe('a two-sided row goes through SplitRow', () => {
  const { arrivals, stale } = ratchet(byHand, NOT_A_TWO_SIDED_ROW);

  it('reads the app it is checking (guards against a silently empty walk)', () => {
    // A moved directory or a comment stripper that ate the file would otherwise
    // make every assertion below pass by having nothing to read.
    expect(floorFaults({ 'files under src/': { found: FILES.length, atLeast: 50 } })).toEqual([]);
    expect(users).toContain(THE_PRIMITIVE);
  });

  it('builds the row in one place', () => {
    expect(arrivals).toEqual([]);
  });

  it('excuses nothing that no longer spells the class', () => {
    // The direction a one-sided list cannot do. When the reader's header is
    // rebuilt or the media tile stops distributing, its entry goes with it rather
    // than standing as permission for whatever lands in that file next.
    expect(stale).toEqual([]);
  });

  it('gives every exception a reason rather than a path', () => {
    expect(excusesWithoutReason(NOT_A_TWO_SIDED_ROW)).toEqual([]);
  });
});

/**
 * The primitive itself, held to what the docblock claims it does.
 *
 * Without this the check above is satisfied by a `SplitRow` that has quietly lost
 * its gap or its wrap — every call site would still be "going through SplitRow"
 * and every one of them would be broken again at 200 %, which is exactly the state
 * the app was in before it existed.
 */
describe('SplitRow keeps what the call sites stopped declaring', () => {
  const source = withoutComments(readFileSync(join(SRC, THE_PRIMITIVE), 'utf8'));

  it('keeps a gap that cannot collapse', () => {
    expect(source).toMatch(/\bgap-s\b/);
  });

  it('lets the row wrap', () => {
    expect(source).toMatch(/\bflex-wrap\b/);
  });

  it('is still a row', () => {
    expect(source).toMatch(/\bflex-row\b/);
  });
});

/**
 * **What a green run here does NOT mean.**
 *
 *  - **That the row looks right.** This reads class names. Whether two stacked
 *    lines are the right picture for a heading and its link is a question for
 *    `screens/tools/tour-a11y.sh` and somebody looking at what it takes.
 *  - **That every row that should be a `SplitRow` is one.** A row with one side
 *    pushed over by `ml-auto`, or a three-part row, is invisible here. The class
 *    is the spelling this app actually used, eleven times, and it is the one a
 *    person reaching for the pattern would type next.
 *  - **Anything about the tab bar.** That bar is Material's and this app does not
 *    lay it out; `app/(tabs)/_layout.tsx` carries its own answer and its own
 *    measurement.
 */
export {};
