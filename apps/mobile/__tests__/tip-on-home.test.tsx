/**
 * The WhatsApp tip line is on Home as well as on Mitmachen, because Mitmachen stays out
 * of the release channel until beabee is live and the tip line needs no beabee.
 *
 * Its own file because the channel is fixed when the store is built: this one builds it
 * as `release`, which the rest of the suite (`__DEV__` is true under jest) never does.
 */
jest.mock('@/lib/channel', () => ({
  ...jest.requireActual<typeof import('@/lib/channel')>('@/lib/channel'),
  CHANNEL: 'release',
}));

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn() },
  useLocalSearchParams: jest.fn(() => ({})),
}));

jest.mock('@/lib/feeds/useFeed', () => ({
  useFeed: () => ({
    data: [],
    loading: false,
    offline: false,
    reload: jest.fn(),
  }),
  useInvestigations: () => [],
}));

jest.mock('@/lib/store/core', () => ({
  ...jest.requireActual<typeof import('@/lib/store/core')>('@/lib/store/core'),
  useSpotlight: () => ({ issues: [], status: 'idle', recent: [] }),
  useVideoChannel: () => ({ videos: [], status: 'idle', error: null }),
}));

import { SCREEN_DOCUMENTS } from '@correctiv/app-core/lib/screen-layout';
import { parseHomeLayout } from '@correctiv/app-core/lib/home-layout';

// First, so the cycle through the screen route is entered from the module map's side.
import '@/app/(tabs)/s/[id].web';
import { ScreenBlocks } from '@/lib/home/ScreenBlocks';
import { placeTestID } from '@/lib/home/modules';
import { TAB_FEATURES, tabReachable } from '@/lib/features';
import { useReachable } from '@/lib/store/core';

import { render, renderedText, walkHostNodes } from './support/rendering';

function places(tree: ReturnType<typeof render>): string[] {
  const ids: string[] = [];
  walkHostNodes(tree, {
    onEnter: (node) => {
      const testID = node.props.testID;
      if (typeof testID === 'string' && testID.startsWith(placeTestID(''))) {
        ids.push(testID.slice(placeTestID('').length));
      }
    },
  });
  return ids;
}

describe('the tip line in the release channel', () => {
  const home = parseHomeLayout(SCREEN_DOCUMENTS.home);

  it('is a clean placement on Home, near the end', () => {
    expect(home.problems).toEqual([]);
    const ids = home.layout!.sections.map((section) => section.id);
    expect(ids).toContain('tip');
    expect(ids.indexOf('tip')).toBeGreaterThan(ids.indexOf('latest-research'));
  });

  it('is drawn on Home', () => {
    const tree = render(<ScreenBlocks screen="home" layout={home.layout!} />);
    expect(places(tree)).toContain('tip');
    expect(renderedText(tree)).toContain('WhatsApp');
  });

  it('leaves the Mitmachen tab out, as before', () => {
    let reachable: (feature: string) => boolean = () => true;
    function Probe() {
      const check = useReachable();
      reachable = check;
      return null;
    }
    render(<Probe />);
    expect(tabReachable('mitmachen', reachable)).toBe(false);
    expect(Object.keys(TAB_FEATURES)).toContain('mitmachen');
  });
});
