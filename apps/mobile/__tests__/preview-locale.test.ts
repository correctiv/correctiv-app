import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { PREVIEW_LOCALE_KEY, previewLocale, SHIPPED_LOCALE } from '@/lib/locale';

/**
 * The seam that lets the workbench say which language the app is built in.
 *
 * [ADR 0049](../../../adr/0049-the-catalogue-is-a-package.md) §4 puts the locale in
 * the host's hands and names the workbench as the second user of that seam. This is
 * the app's end of it: one key in `localStorage`, read once while the store is being
 * constructed, and `apps/workbench/src/preview/frame/locale.ts` is the writer.
 *
 * **What is worth a test here is exactly what a reader of the code cannot check.**
 * That a valid code moves the language is the half anybody can see by opening
 * `/preview`. The other half is that everything else leaves the app in the language
 * it ships, and it would be a defect nobody notices: a code with no catalogue does
 * not fail, it hands `IntlProvider` an `undefined` and renders every string's
 * English `defaultMessage` under a `lang` attribute claiming otherwise — a screen
 * that works and reads wrong.
 *
 * It is a file of its own because it installs a `localStorage` on `window`, which
 * the React Native test environment has not got, and takes it away again. On a real
 * phone there is none at all, which is the first case below.
 */

const APP = resolve(__dirname, '..');

/** The smallest `localStorage` the guard will accept, as `home-simulated-clock.test.tsx` builds one. */
const store = new Map<string, string>();

function installStorage(value?: Partial<Storage>): void {
  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    value: value ?? {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, next: string) => void store.set(key, next),
      removeItem: (key: string) => void store.delete(key),
    },
  });
}

/** Back to the phone: no `localStorage` on `window` at all. */
function removeStorage(): void {
  Object.defineProperty(window, 'localStorage', { configurable: true, value: undefined });
}

beforeEach(() => {
  store.clear();
  installStorage();
});

afterEach(() => {
  removeStorage();
});

describe('the language the preview asks for', () => {
  it('is nobody asking on a phone, where there is no storage to hold a key', () => {
    /*
     * `window` is NOT what makes this true and the guard would be a hole if it were:
     * React Native defines one (`react-native/Libraries/Core/setUpGlobals.js` sets
     * `global.window = global`), so the `typeof window === 'undefined'` half passes
     * on a device and it is `!window.localStorage` that answers. The same sentence is
     * written in `lib/home/clock.ts` about the same door.
     */
    removeStorage();
    expect(typeof window).not.toBe('undefined');
    expect(previewLocale()).toBeNull();
  });

  it('is nobody asking when the key is not there', () => {
    expect(previewLocale()).toBeNull();
  });

  it('answers a code the app has a catalogue for', () => {
    store.set(PREVIEW_LOCALE_KEY, 'en');
    expect(previewLocale()).toBe('en');

    store.set(PREVIEW_LOCALE_KEY, SHIPPED_LOCALE);
    expect(previewLocale()).toBe(SHIPPED_LOCALE);
  });

  /**
   * Every one of these is a value somebody could leave in the key by hand, by a
   * half-written tool or by an address written against a language this app does not
   * have, and the answer to all of them is the same: nobody has named a language, so
   * the one the app ships stands.
   */
  it.each([['fr'], ['EN'], ['de-DE'], [''], ['de,en'], ['null'], ['[object Object]']])(
    'ignores %p and leaves the shipped language standing',
    (junk) => {
      store.set(PREVIEW_LOCALE_KEY, junk);
      expect(previewLocale()).toBeNull();
    },
  );

  it('answers nobody asking when the accessor itself throws', () => {
    // Two different browsers and one answer. Reading the PROPERTY throws inside a
    // sandboxed iframe; calling the method throws with site data switched off. The
    // guard has to survive both, because the alternative is not a setting that fails
    // to apply, it is a store that cannot be constructed and an app that never boots.
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      get() {
        throw new Error('site data is off');
      },
    });
    expect(previewLocale()).toBeNull();

    installStorage({
      getItem() {
        throw new Error('site data is off');
      },
    } as Partial<Storage>);
    expect(previewLocale()).toBeNull();
  });
});

describe('the store is what reads it', () => {
  /**
   * The key existing and nothing reading it is the silent failure this pair has: the
   * select would move, the address would carry `lg=en`, and the frame would go on
   * rendering German with nothing anywhere saying why. Read as source because there
   * is one store and it is constructed when the module is imported, so a test cannot
   * build a second one from this file without the key already set.
   */
  it('is built with the override where there is one, and the shipped language otherwise', () => {
    const binding = readFileSync(join(APP, 'src', 'lib', 'store', 'core.ts'), 'utf8');
    expect(binding).toContain('locale: previewLocale() ?? SHIPPED_LOCALE,');
  });

  it('is spelled under the prefix that says who writes it', () => {
    // Issue #112: a screen that quietly differs from the repository is worse than one
    // that says who changed it. The other end of the string is held to this one by
    // `apps/workbench/test/preview/locale.test.ts`.
    expect(PREVIEW_LOCALE_KEY).toBe('workbench:locale');
  });
});
