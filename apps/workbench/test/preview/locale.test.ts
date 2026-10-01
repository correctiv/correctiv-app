import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { ROOT } from '../../plugin/collect.ts';
import { apply, isLocale, LOCALES, PREVIEW_LOCALE_KEY } from '../../src/preview/frame/locale';

/**
 * The two ends of the language seam, which nothing but this file holds together.
 *
 * `apps/mobile/src/lib/locale.ts` reads the key while the app's store is being
 * constructed; `src/preview/frame/locale.ts` writes it. The shell may not import from
 * `apps/mobile` ([ADR 0040](../../../../adr/0040-the-app-does-not-depend-on-the-workbench.md)),
 * so the string is spelled twice and the app is read here as source text — the same
 * arrangement `home-document.test.ts` keeps for the layout and the clock, and for the
 * same reason: the failure is silent. The select would move, the address would carry
 * `lg=en`, the frame would go on rendering German, and nothing anywhere would say why.
 */

/** The shell may not import from `apps/mobile`, so the app is read as source text. */
function source(path: string): string {
  return readFileSync(join(ROOT, path), 'utf8');
}

describe('the two ends of the language seam', () => {
  it('spells the storage key the way the app reads it', () => {
    expect(source('apps/mobile/src/lib/locale.ts')).toContain(
      `export const PREVIEW_LOCALE_KEY = '${PREVIEW_LOCALE_KEY}';`,
    );
  });

  it('writes under the prefix that says who changed the screen', () => {
    // Issue #112's rule: a screen that quietly differs from the repository is worse
    // than one that says who changed it. Every key this tool owns carries the prefix.
    expect(PREVIEW_LOCALE_KEY.startsWith('workbench:')).toBe(true);
  });

  /**
   * The app reads this key once, when its store is built, so the shell has to boot the
   * frame again to change the language — `packages/app-core/src/stores/settings.ts`
   * has no `setLocale` and deliberately wants none. The assertion is that the language
   * is in the effect that owns booting, beside the storage fixture, rather than in an
   * effect of its own that would race it.
   *
   * **And that the effect waits for the address.** `built.current` is `undefined`
   * until the first boot, and that only means "until the link has been read" while
   * this effect cannot run before `start()` has: a pass on the first render sees
   * `INITIAL`, so it takes `lg=en` for no language, clears the key, points the frame
   * at the app, and the pass after it reads the same `en` as a language somebody has
   * just changed and boots a second time. Measured that way on 2026-09-18 before the
   * gate went in. The gate is the one `pages/Preview.tsx` already puts on the write
   * in the other direction, which is why it is spelled the same.
   */
  it('applies the language in the effect that boots the frame, and reloads on a change', () => {
    const preview = source('apps/workbench/src/preview/Preview.tsx');
    expect(preview).toContain('applyLocale(state.lang);');
    expect(preview).toContain(
      'const relanguage = built.current !== undefined && built.current !== state.lang;',
    );
    expect(preview).toContain(
      'if (!reseed && !relanguage && driveRoute(frame.contentWindow, state.route)) return;',
    );
    expect(preview).toContain('}, [started, shape, state.route, state.seed, state.lang, loaded]);');
  });

  it('does not boot the frame before the store has read the address', () => {
    // Both ends of the gate: the guard and the dependency that re-runs the effect
    // once it opens. Without the second, the frame waits for the next change of
    // route or shape and the link shows nothing.
    const preview = source('apps/workbench/src/preview/Preview.tsx');
    expect(preview).toContain('if (!started) return;');
    expect(preview).toContain('}, [started, shape, state.route, state.seed, state.lang, loaded]);');

    // And the page's own write, which is where this spelling comes from.
    expect(source('apps/workbench/src/pages/Preview.tsx')).toContain(
      'if (!preview.started) return;',
    );
  });

  /**
   * And the two exits, which are two events and not one.
   *
   * `home/clock.ts` argues them at length for the simulated hour and they are the same
   * two here: React taking the view down, and the document going away, which an unmount
   * is not. The second is what matters most for a language — `onRaw` opens `<site>/app/`
   * in a tab of its own on this origin, so a key left behind puts the published demo in
   * the wrong language for that browser for ever.
   */
  it('clears the key when the view goes away and when the page does', () => {
    const preview = source('apps/workbench/src/preview/Preview.tsx');
    expect(preview).toContain('useEffect(() => () => applyLocale(null), []);');
    expect(preview).toContain("window.addEventListener('pagehide', hide)");
    expect(preview).toContain("window.addEventListener('pageshow', show)");

    const locale = source('apps/workbench/src/preview/frame/locale.ts');
    expect(locale).toContain('window.localStorage.removeItem(PREVIEW_LOCALE_KEY)');
  });
});

describe('the codes this site offers', () => {
  it('offers every language the app has, and only those', () => {
    // Derived from a table keyed by `Locale`, so a third language in the core is a
    // type error in `frame/locale.ts` rather than an option that quietly goes missing.
    expect([...LOCALES].sort()).toEqual(['de', 'en']);
  });

  it('accepts a code and refuses everything else', () => {
    for (const code of LOCALES) expect(isLocale(code)).toBe(true);
    for (const junk of ['fr', 'EN', 'de-DE', '', 'de,en', null]) expect(isLocale(junk)).toBe(false);
  });
});

/** A `window` with the smallest storage the writer uses, since the tests run in node. */
function withStorage(): Map<string, string> {
  const store = new Map<string, string>();
  vi.stubGlobal('window', {
    localStorage: {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => void store.set(key, value),
      removeItem: (key: string) => void store.delete(key),
    },
  });
  return store;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('writing the language the frame boots in', () => {
  it('puts a chosen language where the app will find it', () => {
    const store = withStorage();
    apply('en');
    expect(store.get(PREVIEW_LOCALE_KEY)).toBe('en');
  });

  it('takes the key away rather than writing the one the app ships', () => {
    // A key written once and then agreeing for a while is a state nobody can see and
    // nobody clears — and it would pin the app to German on the day `SHIPPED_LOCALE`
    // stops being German.
    const store = withStorage();
    apply('de');
    apply(null);
    expect(store.has(PREVIEW_LOCALE_KEY)).toBe(false);
  });

  it('does not throw in a browser with site data switched off', () => {
    // Nothing can be previewed there and nothing may take the page down with it, which
    // is the same guard `home/clock.ts` and `i18n/language.ts` both keep.
    vi.stubGlobal('window', {
      localStorage: {
        setItem() {
          throw new DOMException('site data is off', 'SecurityError');
        },
        removeItem() {
          throw new DOMException('site data is off', 'SecurityError');
        },
      },
    });
    expect(() => apply('en')).not.toThrow();
    expect(() => apply(null)).not.toThrow();
  });
});
