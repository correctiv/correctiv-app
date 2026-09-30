import { columnGutter } from '../src/components/ui/ContentColumn';
import { sizes, spacingPx } from '../src/lib/theme';

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
