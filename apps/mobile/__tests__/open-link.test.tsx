import { spotlightIssues } from '@correctiv/app-core/data/spotlight';

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn() },
  useLocalSearchParams: jest.fn(() => ({})),
  Stack: { Screen: () => null },
}));

/**
 * `useSpotlight` lazy-loads on first use, and a thunk that lands after the test body
 * is an update outside `act`; the issues are the bundled seed.
 */
jest.mock('@/lib/store/core', () => ({
  ...jest.requireActual<typeof import('@/lib/store/core')>('@/lib/store/core'),
  useSpotlight: () => ({
    issues: jest.requireActual('@correctiv/app-core/data/spotlight').spotlightIssues,
    recent: jest.requireActual('@correctiv/app-core/data/spotlight').spotlightIssues.slice(0, 3),
    status: 'idle',
  }),
}));

import { router } from 'expo-router';

import { SpotlightBriefing } from '@/components/home/SpotlightBriefing';
import SpotlightScreen from '@/app/spotlight';
import { openExternal } from '@/lib/openExternal';
import { openLink } from '@/lib/openLink';

import { press, render } from './support/rendering';

const push = router.push as jest.Mock;
const openExternalMock = openExternal as jest.Mock;

const ISSUE = spotlightIssues[0];

beforeEach(() => {
  push.mockClear();
  openExternalMock.mockClear();
});

/**
 * A tap on a Spotlight issue opened a browser tab (`window.open`, on the web) for a
 * page the reader shows. The destination was an `openExternal(issue.url)` at each
 * call site, and only the reader asked `isInternalArticleUrl` first.
 */
describe('openLink', () => {
  it.each([
    ISSUE.url,
    'https://correctiv.org/faktencheck/2026/08/04/video-zeigt-feiernde-fussballfans/',
  ])('opens %s in the reader', (url) => {
    openLink(url);
    expect(push).toHaveBeenCalledWith({ pathname: '/artikel', params: { url } });
    expect(openExternalMock).not.toHaveBeenCalled();
  });

  it.each([
    'https://correctiv.org/impressum/',
    'https://correctiv.org/sunlight',
    'https://shop.correctiv.org',
    'https://wa.me/4915142647500',
    'mailto:hinweise@correctiv.org',
  ])('sends %s to the system', (url) => {
    openLink(url);
    expect(openExternalMock).toHaveBeenCalledWith(url);
    expect(push).not.toHaveBeenCalled();
  });
});

describe('a Spotlight issue', () => {
  it('opens in the reader from the archive', () => {
    const tree = render(<SpotlightScreen />);
    press(tree, ISSUE.subject);
    expect(push).toHaveBeenCalledWith({ pathname: '/artikel', params: { url: ISSUE.url } });
    expect(openExternalMock).not.toHaveBeenCalled();
  });

  it('opens in the reader from the briefing on Home', () => {
    const tree = render(<SpotlightBriefing onOpenArchive={() => {}} />);
    press(tree, ISSUE.subject);
    expect(push).toHaveBeenCalledWith({ pathname: '/artikel', params: { url: ISSUE.url } });
    expect(openExternalMock).not.toHaveBeenCalled();
  });
});
