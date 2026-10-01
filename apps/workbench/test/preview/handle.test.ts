import { describe, expect, it, vi } from 'vitest';

import { BASE, driveRoute, keepFramePath } from '../../src/preview/frame/handle';

/**
 * The two halves of driving the framed app by property access.
 *
 * Only their conditions are worth a test, and one of them cost an afternoon:
 * `keepFramePath` rewriting the address of a frame the app is not running in put the
 * shell in a deadlock it could not leave, because `frameRoute` then reported a route
 * the app had never been sent to and the effect that navigates found nothing to do.
 * A fake window is enough for both, since neither reads anything only a browser can
 * answer.
 */
function fakeWindow(pathname: string, withHandle: boolean) {
  const replaceState = vi.fn();
  const navigate = vi.fn();
  const handle = { store: { getState: () => ({}) }, router: { navigate } };
  const win = {
    location: { pathname, search: '', hash: '' },
    history: { replaceState },
    __correctiv: withHandle ? handle : undefined,
  };
  return { win: win as unknown as Window, replaceState, navigate };
}

describe('keepFramePath', () => {
  it('puts the base back on an address the app has just written without it', () => {
    const { win, replaceState } = fakeWindow('/gespeichert', true);
    keepFramePath(win);
    expect(replaceState).toHaveBeenCalledWith(null, '', `${BASE}/gespeichert`);
  });

  it('leaves an address that already carries the base alone, so the poll may call it', () => {
    const { win, replaceState } = fakeWindow(`${BASE}/gespeichert`, true);
    keepFramePath(win);
    expect(replaceState).not.toHaveBeenCalled();
  });

  it('does not touch a frame the app is not running in', () => {
    // The deadlock: an address written into an empty frame makes `frameRoute` report
    // a route the app was never sent to, and nothing sends it anywhere after that.
    const { win, replaceState } = fakeWindow('/blank', false);
    keepFramePath(win);
    expect(replaceState).not.toHaveBeenCalled();
  });
});

describe('driveRoute', () => {
  it("asks the app's own router, and says it found one", () => {
    const { win, navigate } = fakeWindow(`${BASE}/`, true);
    expect(driveRoute(win, '/einstellungen')).toBe(true);
    expect(navigate).toHaveBeenCalledWith('/einstellungen');
  });

  it('says no when there is no handle, which is the published export', () => {
    const { win } = fakeWindow(`${BASE}/`, false);
    expect(driveRoute(win, '/einstellungen')).toBe(false);
  });
});
