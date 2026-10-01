import { describe, expect, it } from 'vitest';

import { berlinInstant } from '@correctiv/app-core/lib/berlin-time';
import type { HomeLayout } from '@correctiv/app-core/lib/home-layout';

import {
  bandsIn,
  chooseByKey,
  chosenDays,
  daysOf,
  isWeekend,
  stepped,
  weekNumberOf,
} from '../../src/preview/home/calendar';
import {
  editableFrom,
  SHIPPED,
  targetAt,
  withEditionAcross,
  withEditionSpan,
} from '../../src/preview/home/document';
import { fromAddress, INITIAL, toAddress, type PreviewState } from '../../src/preview/state';
import { parseAddress, writeAddress } from '../../src/shell/address';
import { VIEWS } from '../../src/shell/views';

/**
 * The week and the month under the frame, ADR 0059 §2's two outer zooms of the one axis.
 *
 * What is held here is what a screenshot cannot show: which lane a band is put in, where
 * a band that runs past the edge says so, what a drag across days writes into the document
 * on the two Sundays a year the clock changes, and that the keyboard reaches the same
 * edition the pointer does (ADR 0047 §3: two controls, one operation).
 */

/** An edition over a wall-clock span, added to the shipped day through the editor's own writes. */
function withSpan(layout: HomeLayout, id: string, from: string, until: string): HomeLayout {
  const made = withEditionAcross(layout, from.slice(0, 10), from.slice(0, 10));
  const renamed = {
    ...made.layout,
    editions: made.layout.editions.map((edition) =>
      edition.id === made.id ? { ...edition, id } : edition,
    ),
  };
  return withEditionSpan(renamed, id, from, until);
}

/** The week of the made-up election night in the scenario: Monday 23 to Sunday 29 September 2030. */
const WEEK = daysOf('week', '2030-09-25');

describe('which days a zoom shows', () => {
  it('runs a week from Monday, as a German calendar does', () => {
    expect(WEEK[0]).toBe('2030-09-23');
    expect(WEEK[6]).toBe('2030-09-29');
    expect(daysOf('week', '2030-09-29')).toEqual(WEEK);
    expect(daysOf('week', '2030-09-23')).toEqual(WEEK);
  });

  it('runs a month from the first to its last day, a leap February included', () => {
    expect(daysOf('month', '2030-09-17')).toHaveLength(30);
    expect(daysOf('month', '2028-02-10')).toHaveLength(29);
    expect(daysOf('month', '2030-10-31').at(-1)).toBe('2030-10-31');
  });

  it('tints Saturday and Sunday and nothing else', () => {
    expect(WEEK.map(isWeekend)).toEqual([false, false, false, false, false, true, true]);
  });

  it('numbers the week the way "KW" does', () => {
    expect(weekNumberOf('2030-09-25')).toBe(39);
    // 1 January 2027 is a Friday, so it belongs to the last week of 2026.
    expect(weekNumberOf('2027-01-01')).toBe(53);
    expect(weekNumberOf('2026-12-28')).toBe(53);
  });

  it('steps a month to the same day, or to the last one the month has', () => {
    expect(stepped('month', '2030-01-31', 1)).toBe('2030-02-28');
    expect(stepped('month', '2030-03-15', -1)).toBe('2030-02-15');
    expect(stepped('month', '2030-12-05', 1)).toBe('2031-01-05');
    expect(stepped('week', '2030-09-25', -1)).toBe('2030-09-18');
    expect(stepped('day', '2030-09-25', 1)).toBe('2030-09-26');
  });
});

describe('the lanes the bands are laid out in', () => {
  it('puts overlapping editions in lanes of their own, the longer first', () => {
    const campaign = withSpan(SHIPPED, 'kampagne', '2030-09-24T00:00', '2030-09-28T00:00');
    const layout = withSpan(campaign, 'wahlabend', '2030-09-26T18:00', '2030-09-27T02:00');
    const { bands, lanes } = bandsIn(layout, WEEK);

    expect(lanes).toBe(2);
    const byId = Object.fromEntries(bands.map((band) => [band.edition.id, band]));
    expect(byId.kampagne!.lane).toBe(0);
    expect(byId.wahlabend!.lane).toBe(1);
    // Thursday 18:00 is three and three quarter days into a week of seven.
    expect(byId.wahlabend!.from).toBeCloseTo(3.75 / 7);
    expect(byId.wahlabend!.to).toBeCloseTo((4 + 2 / 24) / 7);
  });

  it('shares a lane between an edition ending at midnight and one starting there', () => {
    const one = withSpan(SHIPPED, 'eins', '2030-09-23T00:00', '2030-09-25T00:00');
    const layout = withSpan(one, 'zwei', '2030-09-25T00:00', '2030-09-26T00:00');
    const { bands, lanes } = bandsIn(layout, WEEK);

    expect(lanes).toBe(1);
    expect(bands.map((band) => band.lane)).toEqual([0, 0]);
    expect(bands[0]!.to).toBeCloseTo(2 / 7);
  });

  it('names the day before as the last day of an edition that ends at midnight', () => {
    const layout = withSpan(SHIPPED, 'eins', '2030-09-23T00:00', '2030-09-25T00:00');
    const [band] = bandsIn(layout, WEEK).bands;
    expect(band!.firstDay).toBe('2030-09-23');
    expect(band!.lastDay).toBe('2030-09-24');
  });

  it('clips a band at either edge and says that it runs on', () => {
    const layout = withSpan(SHIPPED, 'lang', '2030-09-20T12:00', '2030-10-02T12:00');
    const [band] = bandsIn(layout, WEEK).bands;
    expect(band).toMatchObject({ from: 0, to: 1, before: true, after: true });
    expect(band!.firstDay).toBe('2030-09-20');
    expect(band!.lastDay).toBe('2030-10-02');

    const inside = withSpan(SHIPPED, 'kurz', '2030-09-24T00:00', '2030-09-25T00:00');
    expect(bandsIn(inside, WEEK).bands[0]).toMatchObject({ before: false, after: false });
  });

  it('leaves out an edition that only touches the range at its edge', () => {
    // Ends at the Monday's first minute, which is the week's opening instant.
    const layout = withSpan(SHIPPED, 'vorher', '2030-09-22T00:00', '2030-09-23T00:00');
    expect(bandsIn(layout, WEEK)).toEqual({ bands: [], lanes: 0 });
  });

  it('gives a two-hour edition in the month a day’s width, its title beside it, and a lane', () => {
    const MONTH = daysOf('month', '2030-09-01');
    const SIZES = { min: 1, title: 4 };
    const night = withSpan(SHIPPED, 'wahlabend', '2030-09-10T18:00', '2030-09-10T20:00');
    // Starts at the next midnight: exactly, it would not touch the two hours at all.
    const layout = withSpan(night, 'kampagne', '2030-09-11T00:00', '2030-09-20T00:00');

    expect(bandsIn(layout, MONTH).lanes).toBe(1);

    const { bands, lanes } = bandsIn(layout, MONTH, SIZES);
    const byId = Object.fromEntries(bands.map((band) => [band.edition.id, band]));
    const two = byId.wahlabend!;
    expect(lanes).toBe(2);
    expect(two.lane).not.toBe(byId.kampagne!.lane);
    // Still where it really is, only drawn a day wide.
    expect(two.from).toBeCloseTo((9 + 18 / 24) / 30);
    expect(two.left).toBe(two.from);
    expect(two.right - two.left).toBeCloseTo(1 / 30);
    // Four days of title do not fit into one, so it goes beside the band, where it has room.
    expect(two).toMatchObject({ label: 'right', labelLeft: two.right });
    expect(two.labelRight - two.labelLeft).toBeCloseTo(4 / 30);
    // The campaign is ten days, room enough for its title inside.
    expect(byId.kampagne!.label).toBe('inside');
  });

  it('puts the title on the left of a short edition at the strip’s right edge', () => {
    const MONTH = daysOf('month', '2030-09-01');
    const layout = withSpan(SHIPPED, 'spaet', '2030-09-30T22:00', '2030-10-01T00:00');
    const [band] = bandsIn(layout, MONTH, { min: 1, title: 4 }).bands;
    // Pushed back from the edge so that it is a day wide and still ends there.
    expect(band!.right).toBe(1);
    expect(band!.right - band!.left).toBeCloseTo(1 / 30);
    expect(band).toMatchObject({ label: 'left', labelRight: band!.left });
  });

  it('frees a lane for a later edition once the one in it has ended', () => {
    let layout = withSpan(SHIPPED, 'a', '2030-09-23T00:00', '2030-09-27T00:00');
    layout = withSpan(layout, 'b', '2030-09-24T00:00', '2030-09-25T00:00');
    layout = withSpan(layout, 'c', '2030-09-26T00:00', '2030-09-28T00:00');
    const lanes = Object.fromEntries(
      bandsIn(layout, WEEK).bands.map((band) => [band.edition.id, band.lane]),
    );
    expect(lanes).toEqual({ a: 0, b: 1, c: 1 });
  });
});

describe('a drag across days makes an edition of whole days', () => {
  it('runs from the first day’s midnight to the midnight after the last, either way round', () => {
    const forwards = withEditionAcross(SHIPPED, '2030-09-24', '2030-09-26');
    const backwards = withEditionAcross(SHIPPED, '2030-09-26', '2030-09-24');
    for (const made of [forwards, backwards]) {
      const edition = made.layout.editions.find((held) => held.id === made.id)!;
      expect(edition).toMatchObject({ from: '2030-09-24T00:00', until: '2030-09-27T00:00' });
      expect(made.id).toBe('edition-2030-09-24');
      expect(made.at).toBe(edition.start);
    }
  });

  it('makes one day of a single day, which is what Enter makes of a day not widened', () => {
    const made = withEditionAcross(SHIPPED, '2030-09-24', '2030-09-24');
    expect(made.layout.editions.at(-1)).toMatchObject({
      from: '2030-09-24T00:00',
      until: '2030-09-25T00:00',
    });
  });

  it('writes wall-clock midnights across the October change, and the span is an hour longer', () => {
    // The last Sunday of October 2030 is the 27th: the clocks go back at 03:00.
    const made = withEditionAcross(SHIPPED, '2030-10-26', '2030-10-27');
    const edition = made.layout.editions.at(-1)!;
    expect(edition).toMatchObject({ from: '2030-10-26T00:00', until: '2030-10-28T00:00' });
    expect((edition.end - edition.start) / 3_600_000).toBe(49);
  });

  it('writes wall-clock midnights across the March change, and the span is an hour shorter', () => {
    // The last Sunday of March 2031 is the 30th: the clocks go forward at 02:00.
    const made = withEditionAcross(SHIPPED, '2031-03-30', '2031-03-29');
    const edition = made.layout.editions.at(-1)!;
    expect(edition).toMatchObject({ from: '2031-03-29T00:00', until: '2031-03-31T00:00' });
    expect((edition.end - edition.start) / 3_600_000).toBe(47);
  });

  it('may be wider than a narrower edition inside it, and edits land on it outside that one', () => {
    const night = withSpan(SHIPPED, 'wahlabend', '2030-09-29T00:00', '2030-09-30T02:00');
    const made = withEditionAcross(night, '2030-09-29', '2030-09-30');
    expect(made.id).not.toBeNull();
    // At its own start the election night is narrower and wins, so the playhead goes to
    // where the night has ended.
    expect(made.at).toBe(berlinInstant('2030-09-30', 2 * 60));
    expect(targetAt(made.layout, made.at!).edition?.id).toBe(made.id);
  });

  it('is refused where narrower editions already cover every minute of it', () => {
    const one = withSpan(SHIPPED, 'eins', '2030-09-24T00:00', '2030-09-25T00:00');
    const both = withSpan(one, 'zwei', '2030-09-25T00:00', '2030-09-26T00:00');
    const refused = withEditionAcross(both, '2030-09-24', '2030-09-25');
    expect(refused).toEqual({ layout: both, id: null, at: null });
  });

  it('is refused where the same days are already one edition', () => {
    const held = withEditionAcross(SHIPPED, '2030-09-24', '2030-09-25');
    expect(withEditionAcross(held.layout, '2030-09-25', '2030-09-24')).toEqual({
      layout: held.layout,
      id: null,
      at: null,
    });
  });

  it('finds no editable minute for an id the document does not have', () => {
    expect(editableFrom(SHIPPED, 'nirgends')).toBeNull();
  });
});

describe('the keyboard’s twin of the drag', () => {
  const at = (day: string) => ({ anchor: day, focus: day });

  it('moves the playhead a day with an arrow, and a week up or down', () => {
    expect(chooseByKey(at('2030-09-25'), 'ArrowRight', false, WEEK)).toEqual({
      choice: at('2030-09-26'),
      move: true,
    });
    expect(chooseByKey(at('2030-09-25'), 'ArrowUp', false, WEEK)!.choice).toEqual(at('2030-09-18'));
    expect(chooseByKey(at('2030-09-25'), 'Home', false, WEEK)!.choice).toEqual(at('2030-09-23'));
    expect(chooseByKey(at('2030-09-25'), 'Tab', false, WEEK)).toBeNull();
  });

  it('walks off the edge into the next week without Shift', () => {
    expect(chooseByKey(at('2030-09-29'), 'ArrowRight', false, WEEK)!.choice).toEqual(
      at('2030-09-30'),
    );
  });

  it('widens with Shift, leaves the playhead, and stops at the edge', () => {
    let choice = at('2030-09-27');
    for (const key of ['ArrowRight', 'ArrowRight', 'ArrowRight']) {
      const next = chooseByKey(choice, key, true, WEEK)!;
      expect(next.move).toBe(false);
      choice = next.choice;
    }
    expect(choice).toEqual({ anchor: '2030-09-27', focus: '2030-09-29' });
  });

  it('makes with Enter the same edition a drag over the same days makes', () => {
    let choice = at('2030-09-26');
    choice = chooseByKey(choice, 'ArrowLeft', true, WEEK)!.choice;
    choice = chooseByKey(choice, 'ArrowLeft', true, WEEK)!.choice;
    const [first, last] = chosenDays(choice);
    const keyed = withEditionAcross(SHIPPED, first, last);
    const dragged = withEditionAcross(SHIPPED, '2030-09-26', '2030-09-24');
    expect(keyed).toEqual(dragged);
    expect(keyed.layout.editions.at(-1)).toMatchObject({
      from: '2030-09-24T00:00',
      until: '2030-09-27T00:00',
    });
  });
});

describe('the zoom in the address', () => {
  const VIEW = VIEWS.preview;
  const read = (hash: string): PreviewState => fromAddress(parseAddress(hash, VIEW));
  const write = (state: PreviewState): string => {
    const { head, rest } = toAddress(state);
    return writeAddress({ head, rest, tool: null, full: false }, VIEW);
  };

  it('round-trips the week and the month', () => {
    for (const span of ['week', 'month'] as const) {
      const state: PreviewState = { ...INITIAL, span, time: '2030-09-29T18:30' };
      expect(write(state)).toContain(`zm=${span}`);
      expect(read(write(state))).toEqual(state);
    }
  });

  it('writes nothing for the day, so a link from before the zooms reads the same', () => {
    expect(write(INITIAL)).not.toContain('zm=');
    expect(read('#/?tm=18:30').span).toBe('day');
  });

  it('reads junk as the day', () => {
    expect(read('#/?zm=jahr').span).toBe('day');
  });
});
