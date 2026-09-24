import { describe, expect, it } from 'vitest';

import { onboardingBack } from '../src/lib/back';

describe('onboardingBack', () => {
  it('steps back a page from any page after the first', () => {
    expect(onboardingBack(2, false)).toEqual({ kind: 'step', to: 1 });
    expect(onboardingBack(1, true)).toEqual({ kind: 'step', to: 0 });
  });

  it('lets the navigator pop the first page when there is a screen under it', () => {
    expect(onboardingBack(0, true)).toEqual({ kind: 'leave' });
  });

  // The first launch: the onboarding was reached with `replace`, so the navigator
  // would have left the app. Skipping is the answer, not staying and not leaving.
  it('skips out of the first page when nothing is under it', () => {
    expect(onboardingBack(0, false)).toEqual({ kind: 'skip' });
  });
});
