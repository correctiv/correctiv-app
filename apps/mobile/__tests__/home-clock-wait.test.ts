import { berlinInstant } from '@correctiv/app-core/lib/berlin-time';
import { parseHomeLayout } from '@correctiv/app-core/lib/home-layout';

import { LONGEST_WAIT_MS, msUntilNextChange } from '@/lib/home/clock';

/**
 * How long Home's one timer waits, held to what `setTimeout` can hold.
 *
 * A cold review of #247 measured the failure: a document with no moments of the day and an
 * edition on Christmas Eve, asked on 2026-09-23, gave a wait of 7,974,000,000 ms. The web's
 * `setTimeout` takes at most 2^31 − 1 ms and fires at once past that, so the screen
 * re-rendered in a loop. Measured through the function the hook calls, because a render
 * loop in a test environment is a hang rather than a message.
 */
const TIMER_MAX = 2 ** 31 - 1;

const christmas = parseHomeLayout({
  version: 3,
  sections: [{ id: 'header', module: 'home-header' }],
  editions: [{ id: 'weihnachten', from: '2026-12-24T00:00', until: '2026-12-27T00:00' }],
}).layout!;

describe('the wait until Home next changes', () => {
  it('stays inside what a timer can hold, for an edition months away', () => {
    const now = berlinInstant('2026-09-23', 12 * 60)!;
    const wait = msUntilNextChange(christmas, now)!;
    expect(wait).toBeLessThan(TIMER_MAX);
    expect(wait).toBeLessThanOrEqual(LONGEST_WAIT_MS);
    // The next wake-up is tonight's Berlin midnight, where the answer is asked again.
    expect(now + wait).toBe(berlinInstant('2026-09-24', 0));
  });

  it('is never longer than a day, whatever the core answers', () => {
    expect(LONGEST_WAIT_MS).toBeLessThan(TIMER_MAX);
    // The day the clocks go back is 25 hours long, so from just after its midnight the next
    // one is more than a day away, and the cap is what answers.
    const now = berlinInstant('2026-10-25', 0)! + 1000;
    expect(msUntilNextChange(christmas, now)).toBe(LONGEST_WAIT_MS);
  });
});
