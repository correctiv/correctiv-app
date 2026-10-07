/**
 * @vitest-environment jsdom
 */
import { describe, expect, it } from 'vitest';

import { HOME_LAYOUT_MAX_CHARS } from '@correctiv/app-core/stores/homeLayout';

import { formatLayoutDocument, SHIPPED } from '../../src/preview/home/document';
import { shippedNavigationOf } from '../../src/preview/home/screens';
import {
  joinedLength,
  readSize,
  SIZE_WARNING_AT,
  SIZE_WARNING_FRACTION,
} from '../../src/preview/home/size';
import { formatNavigationDocument } from '../../src/preview/navigation/document';
import { noticesOf } from '../../src/preview/home/notices';
import { drawnNotices } from './drawn-notices';

/**
 * The warning before the joined document reaches the size the app refuses (ADR 0075 §7).
 *
 * What is held: the threshold is a fraction of `HOME_LAYOUT_MAX_CHARS` and not a second
 * number, the length is the deploy's own (the joined document, minified, with the newline
 * `join-screen-layouts.ts` writes), and the sentence is drawn from the threshold on and
 * not before.
 */
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const SHIPPED_TEXT = formatLayoutDocument(SHIPPED);
const NAVIGATION_TEXT = formatNavigationDocument(shippedNavigationOf('demo'));

function drawn(length: number): string {
  return drawnNotices({ layout: 'demo', size: readSize(length) });
}

describe('the threshold', () => {
  it('is derived from the limit, so changing the limit moves it', () => {
    expect(SIZE_WARNING_AT).toBe(Math.floor(HOME_LAYOUT_MAX_CHARS * SIZE_WARNING_FRACTION));
    expect(SIZE_WARNING_AT).toBeLessThan(HOME_LAYOUT_MAX_CHARS);
  });

  it('warns at the threshold and not one character before', () => {
    expect(readSize(SIZE_WARNING_AT - 1).near).toBe(false);
    expect(readSize(SIZE_WARNING_AT).near).toBe(true);
  });

  it('calls a document over the limit over, and one at the limit not', () => {
    expect(readSize(HOME_LAYOUT_MAX_CHARS).over).toBe(false);
    expect(readSize(HOME_LAYOUT_MAX_CHARS + 1).over).toBe(true);
  });
});

describe('joinedLength', () => {
  it('counts the minified joined document with its closing newline', () => {
    const joined = JSON.stringify({
      version: 1,
      screens: { home: JSON.parse(SHIPPED_TEXT) },
      navigation: JSON.parse(NAVIGATION_TEXT),
    });
    expect(joinedLength({ home: SHIPPED_TEXT }, NAVIGATION_TEXT)).toBe(joined.length + 1);
  });

  it('grows with every screen it is given', () => {
    const one = joinedLength({ home: SHIPPED_TEXT }, NAVIGATION_TEXT);
    const two = joinedLength({ home: SHIPPED_TEXT, extra: SHIPPED_TEXT }, NAVIGATION_TEXT);
    expect(two).toBeGreaterThan(one);
  });
});

describe('the notice', () => {
  it('is not drawn below the threshold', () => {
    expect(drawn(SIZE_WARNING_AT - 1)).toBe('');
  });

  it('names the share and both numbers from the threshold on', () => {
    const text = drawn(SIZE_WARNING_AT);
    expect(text).toContain('80%');
    expect(text).toContain(HOME_LAYOUT_MAX_CHARS.toLocaleString('en'));
  });

  it('says the app ignores it once it is over', () => {
    expect(drawn(HOME_LAYOUT_MAX_CHARS + 1)).toContain('over what the app reads');
  });

  it('is a warning short of the limit and an error past it', () => {
    const level = (length: number) =>
      noticesOf({ layout: 'demo', size: readSize(length) }).map((notice) => notice.level);
    expect(level(SIZE_WARNING_AT)).toEqual(['warning']);
    expect(level(HOME_LAYOUT_MAX_CHARS + 1)).toEqual(['error']);
  });
});
