import { describe, expect, it } from 'vitest';

import { CLIP_SLACK, clips } from '../src/components/clipped.ts';

/**
 * The one decision behind the marker on a card that cannot show a whole
 * component.
 *
 * A pure function of two numbers, tested as one, because the alternative shape —
 * a list of the components that do not fit — is the thing this replaces. That
 * list would be right on the day it was written: the set changes with the column
 * the grid gives a card, with the window, with the right-hand panel, and with the
 * app, where a component gaining one row grows by 24 pixels. Measured on
 * 2026-09-11, the same 47 specimens clip nine times in a 277px column and three
 * times in a 340px one, and nothing in the repository moved between those two
 * numbers except the width.
 */
describe('whether a card is cropping the component it draws', () => {
  it('says nothing before the first layout, when both boxes are zero', () => {
    // The state a card mounts in. Answering "clipped" here would paint a marker
    // on all 47 for one frame, and then take 44 of them off again.
    expect(clips(0, 0)).toBe(false);
    expect(clips(0, 340)).toBe(false);
    expect(clips(484, 0)).toBe(false);
  });

  it('says so when the specimen is taller than the square', () => {
    // `RecoveryScreen`, 484px tall, in a 340px column. Measured 2026-09-11.
    expect(clips(484, 340)).toBe(true);
  });

  it('says nothing when the specimen fits, exactly or with room to spare', () => {
    expect(clips(122, 340)).toBe(false);
    expect(clips(340, 340)).toBe(false);
  });

  it('ignores a difference no larger than the slack', () => {
    // The two boxes are laid out by different rules — one from `aspect-ratio` on
    // a fractional column width, the other from a specimen's own content — so a
    // component that fits exactly would otherwise flicker its marker on and off
    // as the column crosses a half pixel.
    expect(clips(340 + CLIP_SLACK, 340)).toBe(false);
    expect(clips(340 + CLIP_SLACK + 1, 340)).toBe(true);
  });
});
