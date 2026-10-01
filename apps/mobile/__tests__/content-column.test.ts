import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { columnGutter } from '../src/components/ui/ContentColumn';
import { sizes, spacingPx } from '../src/lib/theme';

const APP = join(__dirname, '..', 'src', 'app');

function screenFiles(dir: string = APP): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return screenFiles(path);
    return entry.name.endsWith('.tsx') ? [path] : [];
  });
}

describe('the column gutter a rail bleeds by', () => {
  it('is the screen padding wherever the column fills the window', () => {
    for (const width of [320, 390, 402, sizes.contentColumn + 2 * spacingPx.m]) {
      expect(columnGutter(width)).toBe(spacingPx.m);
    }
  });

  it('puts the column edge where the centred column starts on a wide window', () => {
    for (const width of [744, 834, 1194]) {
      expect(2 * columnGutter(width) + sizes.contentColumn).toBe(width);
    }
  });
});

describe('a screen that owns its scroller', () => {
  // The reading column is invisible in a test tree: a cap is a number in a style, and
  // no assertion on a rendered tree can tell a 620-wide column from a full-bleed one.
  // So this reads the source instead, which is also the only place the omission can
  // be made: sixteen screens wrapped one by one, each a separate decision, and a
  // screen added later with no column at all.
  //
  // Two spellings, because two containers: `ContentColumn` around the content, or the
  // cap on the scroller's own `contentContainerStyle` — wrapping a `FlatList` in a
  // `View` would take the height away from the list, and the list is what scrolls.
  const screens = screenFiles().map((path) => ({ path, source: readFileSync(path, 'utf-8') }));
  const withScroller = screens.filter(({ source }) => /<(ScrollView|FlatList)\b/.test(source));

  it('is a list of more than half the screens, so the walk is not vacuous', () => {
    expect(withScroller.length).toBeGreaterThan(screens.length / 2);
  });

  it('caps its content at the column', () => {
    const uncapped = withScroller
      .filter(({ source }) => !/ContentColumn|contentColumn/.test(source))
      .map(({ path }) => path.replace(`${APP}/`, ''));
    expect(uncapped.sort()).toEqual([]);
  });

  it('states the cap in the content container of a list', () => {
    // A screen that names `ContentColumn` may also own a scroller the column does not
    // reach — a list of sections, a carousel. The cap on such a container is the only
    // thing that holds it to the reading width.
    const lists = withScroller.filter(({ source }) => /<FlatList\b/.test(source));
    const uncapped = lists
      .filter(({ source }) => !/contentContainerStyle/.test(source))
      .map(({ path }) => path.replace(`${APP}/`, ''));
    expect(uncapped.sort()).toEqual([]);
  });
});
