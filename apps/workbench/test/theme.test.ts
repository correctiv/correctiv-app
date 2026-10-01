import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { ROOT } from '../plugin/collect.ts';

import { APPEARANCE_KEY, rememberAppearance, storedAppearance } from '../src/theme';

const THEME = readFileSync(join(ROOT, 'apps/workbench/src/theme.ts'), 'utf8');

/**
 * A top-level function's source, which ends at the first `}` in column zero.
 *
 * It throws rather than returning nothing when the function is not there, because
 * an assertion over an empty string passes and would leave this file guarding a
 * name that has since been renamed.
 */
function bodyOf(name: string): string {
  const start = THEME.indexOf(`export function ${name}`);
  if (start === -1) throw new Error(`theme.ts exports no ${name}`);
  return THEME.slice(start, THEME.indexOf('\n}', start));
}

/** The effect `useAppearance` runs on mount and on every change of the setting. */
function onMount(): string {
  const hook = bodyOf('useAppearance');
  const start = hook.indexOf('useEffect(');
  const end = hook.indexOf('}, [appearance]);', start);
  if (start === -1 || end === -1) throw new Error('useAppearance no longer has an effect');
  return hook.slice(start, end);
}

/** `Object.keys()` over it lists the stored keys, as it does over the real one. */
class FakeStorage {
  getItem(key: string): string | null {
    return Object.hasOwn(this, key) ? (this as unknown as Record<string, string>)[key] : null;
  }
  setItem(key: string, value: string): void {
    (this as unknown as Record<string, string>)[key] = String(value);
  }
  removeItem(key: string): void {
    delete (this as unknown as Record<string, string>)[key];
  }
}

const fake = () => new FakeStorage() as unknown as Storage;

/** The browser that answers every storage call by refusing it. */
const blocked = {
  getItem(): string {
    throw new DOMException('site data is off', 'SecurityError');
  },
  setItem(): void {
    throw new DOMException('site data is off', 'SecurityError');
  },
  removeItem(): void {
    throw new DOMException('site data is off', 'SecurityError');
  },
} as unknown as Storage;

/**
 * Issue #131: the setting was gone after a reload, and nothing had chosen "System".
 *
 * It was this site deleting it. The mount effect used to carry the storage write
 * as well as the class, so every document of the workbench wrote its own reading of
 * the setting back to the shared key as it came up — and since "system" is the key
 * being ABSENT, a document that had read "system" wrote it by calling `removeItem`
 * on somebody's choice. That is harmless while the site has one document and it is
 * not a site with one document: `preview/AppFrame.tsx` frames `<base>/app<route>`
 * on the same origin, and a static host answers every path the app's export does
 * not contain with the site's own `404.html`, which is a second copy of this
 * application. Measured in Chrome on 2026-09-15 against a workbench-only `dist`: the
 * framed document at `/app/` ran this hook and both wrote and removed this key.
 *
 * So the guarantee to keep is that **reading is not writing**. A document may read
 * the setting as it starts; only a click may write it. Everything below is that one
 * sentence, from both ends: the mount path may not reach the store, and the store
 * has exactly one writer.
 */
describe('the appearance the reader chose', () => {
  it('is not deleted by a page that was only opened', () => {
    expect(onMount()).not.toMatch(/setItem|removeItem|rememberAppearance|APPEARANCE_KEY/);
  });

  it('is written by a choice and by nothing else in this file', () => {
    expect(THEME.match(/\.setItem\(/g) ?? []).toHaveLength(1);
    expect(THEME.match(/\.removeItem\(/g) ?? []).toHaveLength(1);
    expect(bodyOf('rememberAppearance')).toMatch(/\.setItem\(/);
    expect(bodyOf('rememberAppearance')).toMatch(/\.removeItem\(/);
  });

  it('comes back from the store the way it was put there', () => {
    const store = fake();
    rememberAppearance('dark', store);
    expect(store.getItem(APPEARANCE_KEY)).toBe('dark');
    expect(storedAppearance(store)).toBe('dark');
  });

  it('is still there after a second document of the site has read it', () => {
    const store = fake();
    rememberAppearance('light', store);
    expect(storedAppearance(store)).toBe('light');
    expect(store.getItem(APPEARANCE_KEY)).toBe('light');
  });

  it('says "follow the device" by leaving the key off, not by storing a third word', () => {
    const store = fake();
    rememberAppearance('dark', store);
    rememberAppearance('system', store);
    expect(store.getItem(APPEARANCE_KEY)).toBeNull();
    expect(storedAppearance(store)).toBe('system');
  });

  it('falls back to the device rather than trusting a value nobody here wrote', () => {
    const store = fake();
    store.setItem(APPEARANCE_KEY, 'Dark');
    expect(storedAppearance(store)).toBe('system');
  });

  it('lets the page render in a browser with site data switched off', () => {
    expect(() => rememberAppearance('dark', blocked)).not.toThrow();
    expect(storedAppearance(blocked)).toBe('system');
    expect(storedAppearance(null)).toBe('system');
  });
});
