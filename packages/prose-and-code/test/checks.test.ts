import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  driftAfterRegenerating,
  excusesWithoutReason,
  floorFaults,
  numberInProse,
  ratchet,
  spelledNumber,
} from '../src/index';

describe('floorFaults', () => {
  it('names the stage that came back empty', () => {
    const faults = floorFaults({
      'files under src/': { found: 0, atLeast: 50 },
      'JSX elements': { found: 900, atLeast: 300 },
    });

    expect(faults.length).toBe(1);
    expect(faults[0]).toContain('files under src/');
    expect(faults[0]).toContain('at least 50');
  });

  it('passes at the floor and fails under it', () => {
    expect(floorFaults({ x: { found: 50, atLeast: 50 } })).toEqual([]);
    expect(floorFaults({ x: { found: 49, atLeast: 50 } }).length).toBe(1);
  });

  it('prints a proportional floor as a figure rather than as 8.5 of a record', () => {
    expect(floorFaults({ 'records with a strike': { found: 1, atLeast: 34 / 4 } })[0]).toContain(
      'at least 8.5',
    );
  });
});

describe('ratchet', () => {
  it('fails on a violation nobody excused', () => {
    const { arrivals, stale } = ratchet(['app/a.tsx:12', 'app/b.tsx:4'], {
      'app/a.tsx:12': 'measured on a device and left, see the issue',
    });

    expect(arrivals).toEqual(['app/b.tsx:4']);
    expect(stale).toEqual([]);
  });

  it('fails on an excuse whose violation has gone, which is the half that shrinks', () => {
    const { arrivals, stale } = ratchet([], { 'app/a.tsx:12': 'a reason' });

    expect(arrivals).toEqual([]);
    expect(stale).toEqual(['app/a.tsx:12']);
  });

  it('counts, so one more in a file that already had some is an arrival', () => {
    const found = ['app/atlas.tsx: grey-500', 'app/atlas.tsx: grey-500', 'app/atlas.tsx: grey-500'];

    expect(ratchet(found, { 'app/atlas.tsx: grey-500': 2 }).arrivals).toEqual([
      'app/atlas.tsx: grey-500 (×3, excused ×2)',
    ]);
    expect(ratchet(found, { 'app/atlas.tsx: grey-500': 4 }).stale).toEqual([
      'app/atlas.tsx: grey-500 (excused ×4, found ×3)',
    ]);
    expect(ratchet(found, { 'app/atlas.tsx: grey-500': 3 })).toEqual({ arrivals: [], stale: [] });
  });

  it('carries the detail into the report without putting it in the key', () => {
    const { arrivals } = ratchet(
      [{ key: 'app/a.tsx:12', as: '<View style={{ height: 44 }}> holds text' }],
      [],
    );

    expect(arrivals).toEqual(['app/a.tsx:12 → <View style={{ height: 44 }}> holds text']);
  });

  it('takes a bare list of keys where there is nothing to say about them', () => {
    expect(ratchet(['a', 'b'], ['a']).arrivals).toEqual(['b']);
    expect(ratchet(['a'], ['a', 'b']).stale).toEqual(['b']);
  });

  it('reports in an order two machines can compare', () => {
    expect(ratchet(['c', 'a', 'b'], []).arrivals).toEqual(['a', 'b', 'c']);
  });
});

describe('excusesWithoutReason', () => {
  it('finds the entry that carries a path and no argument', () => {
    expect(
      excusesWithoutReason({
        'app/a.tsx': 'TODO',
        'app/b.tsx':
          'The floating header over an article: fixed-size icons that do not grow with the type.',
      }),
    ).toEqual(['app/a.tsx']);
  });
});

/** A committed artefact on disk, which is what a drift check is about. */
function generated(committed: string): { root: string; file: string } {
  const root = mkdtempSync(join(tmpdir(), 'prose-and-code-'));
  writeFileSync(join(root, 'out.ts'), committed);
  return { root, file: 'out.ts' };
}

describe('driftAfterRegenerating', () => {
  it('says nothing when the committed file is what the generator writes now', () => {
    const { root, file } = generated('a\nb\n');

    expect(
      driftAfterRegenerating({
        root,
        files: [file],
        regenerate: () => writeFileSync(join(root, file), 'a\nb\n'),
      }),
    ).toEqual([]);
  });

  it('names the file and the first line that differs', () => {
    const { root, file } = generated('a\nb\n');
    const drifted = driftAfterRegenerating({
      root,
      files: [file],
      regenerate: () => writeFileSync(join(root, file), 'a\nc\n'),
    });

    expect(drifted.length).toBe(1);
    expect(drifted[0]).toContain('out.ts drifted at line 2');
    expect(drifted[0]).toContain('"b"');
    expect(drifted[0]).toContain('"c"');
  });

  it('leaves the working tree exactly as it found it', () => {
    // The part that makes this safe to run in a suite at all. Without it a failing
    // drift check leaves the regenerated file in place, and the next run compares
    // the generator with itself and passes.
    const { root, file } = generated('a\nb\n');
    driftAfterRegenerating({
      root,
      files: [file],
      regenerate: () => writeFileSync(join(root, file), 'a\nc\n'),
    });

    expect(readFileSync(join(root, file), 'utf8')).toBe('a\nb\n');
  });

  it('puts the bytes back when the generator throws', () => {
    const { root, file } = generated('a\nb\n');
    expect(() =>
      driftAfterRegenerating({
        root,
        files: [file],
        regenerate: () => {
          writeFileSync(join(root, file), 'half a file');
          throw new Error('the generator fell over');
        },
      }),
    ).toThrow('the generator fell over');

    expect(readFileSync(join(root, file), 'utf8')).toBe('a\nb\n');
  });
});

describe('numberInProse', () => {
  const documents = [{ name: 'AGENTS.md', text: 'which is what all 49 existing call sites use' }];
  const pattern = /all (\d+) existing call sites/;

  it('says nothing while the sentence and the code agree', () => {
    expect(numberInProse({ documents, pattern, value: 49 })).toEqual([]);
  });

  it('quotes the sentence and says what the code says', () => {
    const faults = numberInProse({ documents, pattern, value: 45, what: 'the app writes' });

    expect(faults.length).toBe(1);
    expect(faults[0]).toContain('AGENTS.md says "all 49 existing call sites"');
    expect(faults[0]).toContain('the app writes 45');
  });

  it('fails when the sentence has been rewritten out from under the check', () => {
    // The fault a caller would forget to assert, which is why it is a fault here
    // and not a second assertion. A document is edited far more often than a rule
    // is broken, and a check that stops finding its sentence has been deleted
    // without anybody deciding to.
    const faults = numberInProse({
      documents: [{ name: 'AGENTS.md', text: 'which is what every call site uses' }],
      pattern,
      value: 49,
    });

    expect(faults.length).toBe(1);
    expect(faults[0]).toContain('nothing matched');
  });

  it('reads a word and a numeral as the same number', () => {
    const drawing = [{ name: 'CoreAndHost.tsx', text: 'the five ports' }];

    expect(numberInProse({ documents: drawing, pattern: /\b(\w+) ports\b/, value: 5 })).toEqual([]);
  });

  it('asks for the word where prose spells its numbers', () => {
    const drawing = [{ name: 'CoreAndHost.tsx', text: 'the 5 ports' }];
    const faults = numberInProse({
      documents: drawing,
      pattern: /\b(\w+) ports\b/,
      value: 5,
      spelling: 'word',
    });

    expect(faults.length).toBe(1);
    expect(faults[0]).toContain('spell it "five"');
  });

  it('reads a pattern some other reader has already walked', () => {
    // A pattern declared at the top of a file is shared, and `lastIndex` is state.
    // Handed the object through, the sweep starts where the last `test` stopped,
    // finds no sentence, and returns the empty list the caller is asserting against
    // — green over a claim nothing compared. The one global pattern that reaches
    // here today is read with `matchAll` elsewhere, which clones; the next one will
    // not be.
    const shared = /all (\d+) existing call sites/g;
    shared.test('all 45 existing call sites, and then some');
    expect(shared.lastIndex).toBeGreaterThan(0);
    const left = shared.lastIndex;

    expect(numberInProse({ documents, pattern: shared, value: 49 })).toEqual([]);
    expect(numberInProse({ documents, pattern: shared, value: 45 }).length).toBe(1);
    expect(shared.lastIndex).toBe(left);
  });

  it('says so when what it captured is not a number at all', () => {
    const faults = numberInProse({
      documents: [{ name: 'a.tsx', text: 'the several ports' }],
      pattern: /\b(\w+) ports\b/,
      value: 5,
    });

    expect(faults[0]).toContain('not a number this can read');
  });
});

describe('spelledNumber', () => {
  it('writes the word where there is one and the digits otherwise', () => {
    expect(spelledNumber(0)).toBe('no');
    expect(spelledNumber(5)).toBe('five');
    expect(spelledNumber(34)).toBe('34');
  });
});
