import { act, create } from 'react-test-renderer';

/**
 * Natively the fonts are embedded by the `expo-font` config plugin, so the splash
 * gate must not wait on a load. The double answers "still loading" for ever: the
 * old `useFonts(fontAssets)` implementation therefore returned `[false, null]` on
 * first render and failed this test, and the new one never asks.
 */
const mockUseFonts = jest.fn((..._args: unknown[]) => [false, null]);
jest.mock('expo-font', () => ({ useFonts: (...args: unknown[]) => mockUseFonts(...args) }));

import { useAppFonts } from '@/lib/env/fonts';

describe('useAppFonts on a native platform', () => {
  it('is ready on the first render and loads nothing', () => {
    const seen: [boolean, Error | null][] = [];
    function Probe() {
      seen.push(useAppFonts());
      return null;
    }
    act(() => {
      create(<Probe />);
    });
    expect(seen[0]).toEqual([true, null]);
    expect(mockUseFonts).not.toHaveBeenCalled();
  });
});
