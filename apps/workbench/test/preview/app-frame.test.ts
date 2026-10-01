import { describe, expect, it } from 'vitest';

import { loadedTheAddress, tookTheRoute } from '../../src/preview/AppFrame';

/**
 * The two readings of a frame's address, and both of them shipped wrong once.
 *
 * A frame on `/components` is pointed at an address and then handed its route
 * through the app's own router, because in a development build the address alone
 * lands on the app's 404. Which of those has happened cannot be asked of the
 * address in the obvious way, and the obvious way is what failed:
 *
 * - "the document is complete" is true of `about:blank`, which is the document a
 *   frame starts with, so it says nothing on its own. The address has to agree,
 *   and it is read from `document.URL` — the document's own address rather than
 *   the browsing context's.
 * - "the app took the route" is not a path being right but the base path being
 *   *gone*, because a development bundle does not put it back on a navigation.
 *   And `about:blank`'s path is the bare string "blank", which carries no base
 *   either: without the protocol test, a frame that has been nowhere reads as a
 *   frame the app has taken over.
 *
 * Fake windows rather than a browser, because both functions are one line about a
 * pair of strings, and the strings are what was wrong.
 */
function win(document: { URL: string; readyState?: string }, location?: Partial<Location>) {
  return {
    document,
    location: {
      protocol: 'http:',
      pathname: new URL(document.URL, 'http://x').pathname,
      ...location,
    },
  } as unknown as Window;
}

describe('reading a frame’s address', () => {
  it('says the route was taken once the base path has gone', () => {
    expect(tookTheRoute(win({ URL: 'http://x/gallery?c=ui/Button' }))).toBe(true);
  });

  it('says it was not while the address still carries the base', () => {
    expect(tookTheRoute(win({ URL: 'http://x/app/gallery?c=ui/Button' }))).toBe(false);
  });

  it('says nothing about a frame that has not been anywhere', () => {
    const blank = {
      document: { URL: 'about:blank' },
      location: { protocol: 'about:', pathname: 'blank' },
    };
    expect(tookTheRoute(blank as unknown as Window)).toBe(false);
    expect(tookTheRoute(null)).toBe(false);
  });

  it('does not call an empty document loaded', () => {
    // `about:blank` is "complete" from the first tick, so `readyState` alone
    // called a frame that had loaded nothing done, stopped the poll, and left the
    // app's 404 on screen.
    const blank = {
      document: { URL: 'about:blank', readyState: 'complete' },
      location: { protocol: 'about:', pathname: 'blank' },
    };
    expect(loadedTheAddress(blank as unknown as Window)).toBe(false);
    expect(loadedTheAddress(null)).toBe(false);
  });

  it('reads the document’s own address and not the browsing context’s', () => {
    // The two agree in every browser measured, and this pins which one is asked:
    // `document.URL` cannot be a pending address, and a reading built on
    // `location` would go wrong silently in a browser where it can be.
    const disagreeing = {
      document: { URL: 'about:blank', readyState: 'complete' },
      location: { protocol: 'http:', pathname: '/app/gallery' },
    };
    expect(loadedTheAddress(disagreeing as unknown as Window)).toBe(false);
  });

  it('is loaded when the document at the address is', () => {
    expect(
      loadedTheAddress(win({ URL: 'http://x/app/gallery?c=ui/Button', readyState: 'complete' })),
    ).toBe(true);
    expect(
      loadedTheAddress(win({ URL: 'http://x/app/gallery?c=ui/Button', readyState: 'loading' })),
    ).toBe(false);
  });
});
