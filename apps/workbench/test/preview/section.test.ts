import { describe, expect, it } from 'vitest';

import type { HomeSection } from '@correctiv/app-core/lib/home-layout';

import { sameSection } from '../../src/preview/home/section';

/**
 * The comparator a drawn block is memoised on, run rather than read.
 *
 * ADR 0046 §5 decides that a drawing re-draws on its section and never on the clock, and
 * this function is the whole of that decision: `effectiveAt()` hands the list back with a
 * new object for every section a moment touches, so the default comparator would redraw
 * exactly those, at every minute of the day, for the few minutes where anything about
 * them is different.
 *
 * It is tested here and not through the component because this package's tests have no
 * DOM and `HomeBlock.tsx` pulls the app's whole React Native tree behind it. A cold
 * review measured what that costs: with only the source-reading check in place, `same`
 * returning `true` unconditionally was green, and so was deleting the key-count line —
 * which is the one case ADR 0046 §5 exists for.
 */

const place = (over: Partial<HomeSection> = {}): HomeSection => ({
  id: 'hero',
  module: 'article-hero',
  ...over,
});

describe('two readings of one place', () => {
  it('is the same place when nothing about it differs', () => {
    expect(sameSection(place(), place())).toBe(true);
    expect(sameSection(place({ settings: { pin: 'a' } }), place({ settings: { pin: 'a' } }))).toBe(
      true,
    );
  });

  it('is not the same place when it is a different place', () => {
    expect(sameSection(place(), place({ id: 'hero-2' }))).toBe(false);
    expect(sameSection(place(), place({ module: 'callout' }))).toBe(false);
  });

  it('sees a block switched off and on', () => {
    expect(sameSection(place(), place({ hidden: true }))).toBe(false);
    expect(sameSection(place({ hidden: true }), place({ hidden: false }))).toBe(false);
  });

  it('reads an absent `hidden` as shown, the way the document does', () => {
    // `withHidden` takes the key out rather than writing `false`, so the two spellings
    // arrive at the same block from one side of a moment and the other. A comparator
    // that called them different would redraw every block at every moment for nothing.
    expect(sameSection(place(), place({ hidden: false }))).toBe(true);
  });

  it('sees a setting change', () => {
    expect(sameSection(place({ settings: { pin: 'a' } }), place({ settings: { pin: 'b' } }))).toBe(
      false,
    );
    expect(sameSection(place({ settings: { count: 5 } }), place({ settings: { count: 6 } }))).toBe(
      false,
    );
  });

  it('sees a setting a moment ADDS, which walking the left side alone does not', () => {
    // The case the whole mechanism is about, and the one a comparator without the count
    // is green over: the left has no key to walk, so `every` answers true for an empty
    // list and the block never redraws for the edit somebody just made.
    expect(sameSection(place(), place({ settings: { pin: 'a' } }))).toBe(false);
    expect(sameSection(place({ settings: {} }), place({ settings: { pin: 'a' } }))).toBe(false);
  });

  it('sees a setting a moment takes away', () => {
    expect(sameSection(place({ settings: { pin: 'a' } }), place())).toBe(false);
    expect(
      sameSection(place({ settings: { pin: 'a', count: 5 } }), place({ settings: { pin: 'a' } })),
    ).toBe(false);
  });

  it('sees one setting swapped for another, at the same count', () => {
    // Equal counts, different keys: `a.settings.count` against `b.settings.count` is a
    // number against `undefined`, which the per-key comparison catches. Written down
    // because the count alone would not.
    expect(sameSection(place({ settings: { count: 5 } }), place({ settings: { pin: 'a' } }))).toBe(
      false,
    );
  });

  it('reads an empty settings record and no settings record as the same', () => {
    // `parseHomeLayout` writes no `settings` key for a place that configures nothing, and
    // an edit that removes the last setting can leave `{}` behind. Neither is a change to
    // anything drawn.
    expect(sameSection(place(), place({ settings: {} }))).toBe(true);
  });
});
