import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { ratchet, withoutComments } from '@correctiv/prose-and-code';
import { describe, expect, it } from 'vitest';

import { ROOT } from '../../plugin/collect.ts';

/**
 * The header is one row, and this is the check that the three bars which make it up
 * have all been told so.
 *
 * **The finding was a picture.** At 1280, 1600 and 2000 CSS pixels alike the
 * workbench header broke into three rows: the device picker and the orientation on
 * one, the mark, the actions and the search on the next, the route field and the
 * last two buttons on a third. A bar that grows pushes the frame down and moves
 * everything under it, so where the controls sit depends on the width of the
 * window, and the header is where a reader's eye starts.
 *
 * **A class, read from the source, because that is what it is.** Rendering the bars
 * would say nothing: jsdom lays no boxes out, which is the other half of the problem
 * and is what `test/ui/header-row.test.tsx` is for, and the layout is a decision the
 * ladder makes at runtime rather than one a class settles. So this asks the smaller
 * question — is the rule that wrapped still in these files — and
 * `apps/workbench/scripts/measure-header.mjs` asks the larger one, in a browser, at
 * the three widths where it broke.
 *
 * **Comments stripped first, and each file has to still read.** Every one of the three
 * says `flex-wrap` in prose, which is how each of them remembers what it used to do,
 * and a match on those three sentences would be a check that fails on its own
 * history. `withoutComments` is a regular expression and its own docblock names what
 * that costs, so each file is also asked for a name that cannot be inside a comment
 * — a stripper that ate a file's middle would otherwise report it as the cleanest
 * file in the repository.
 */
const BARS = [
  {
    file: 'ui/Header.tsx',
    what: 'the header itself',
    /** A name from the file's code rather than from its prose. */
    still: 'export function Header(',
  },
  {
    file: 'ui/ToolActions.tsx',
    what: "the open tool's actions",
    still: 'export function ToolActions()',
  },
  {
    file: 'preview/ui/Toolbar.tsx',
    what: "the frame's own controls",
    still: 'export function Toolbar({',
  },
];

/**
 * `flex-wrap` as a class, with or without a variant in front of it, so a
 * `max-sm:flex-wrap` on a narrow window is the finding it looks like.
 */
const WRAPS = /(?:^|[\s"'`])((?:[a-z]+:)*flex-wrap)\b/;

const code = (file: string) =>
  withoutComments(readFileSync(join(ROOT, 'apps/workbench/src', file), 'utf8'));

describe('the header never wraps', () => {
  it.each(BARS)(
    '$what still reads as code, so the finding below is over code',
    ({ file, still }) => {
      expect(code(file)).toContain(still);
    },
  );

  it.each(BARS)('$what carries no wrapping class at all', ({ file }) => {
    expect(code(file).match(WRAPS)).toBeNull();
  });

  it.each(BARS)('$what asks for one line by name', ({ file }) => {
    /*
     * `flex-nowrap` is already what a flex row does, so this asks for the word
     * rather than for the behaviour. A bar that is nowrap by accident is one edit
     * away from being a bar that wraps again, and nobody would see it happen.
     */
    expect(code(file)).toContain('flex-nowrap');
  });
});

describe('the excuse list', () => {
  it('is empty, and cannot hold anything without this failing', () => {
    /*
     * The ratchet over the same finding, and the reason it is a ratchet and not the
     * three assertions above: an excuse list is what makes "this one may wrap" a
     * thing somebody has to write down with a reason, and it is only a list if
     * something checks that the entries are still there. An entry for a bar that no
     * longer wraps is as much a failure as a bar that wraps with no entry.
     */
    const wrapping = BARS.filter(({ file }) => WRAPS.test(code(file))).map(({ file }) => file);
    const report = ratchet(wrapping, {});
    expect(report.arrivals).toEqual([]);
    expect(report.stale).toEqual([]);
  });
});
