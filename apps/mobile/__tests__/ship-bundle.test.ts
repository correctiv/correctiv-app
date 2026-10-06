/**
 * What the app draws from its own bundle, which is the `ship` layout (ADR 0078 §3) and is
 * empty. The setup file swaps in `demo` for every other suite, so this one puts it back.
 */
jest.unmock('@correctiv/app-core/data/layouts/ship/bundle');

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn() },
  useLocalSearchParams: jest.fn(() => ({})),
}));

import {
  configurePlatform,
  createMemoryPlatform,
  resetPlatform,
  type ErrorReport,
} from '@correctiv/app-core';

import { screenIds, screenLayout } from '@/lib/home/layout';
import { decideTabBar } from '@/lib/navigation/tabBar';
import { CONFIGURABLE_SCREENS } from '@correctiv/app-core/lib/screen-layout';

const reports: ErrorReport[] = [];

beforeAll(() => {
  configurePlatform({
    ...createMemoryPlatform(),
    errors: { report: (report) => reports.push(report) },
  });
});
afterAll(resetPlatform);

describe('the bundled layout', () => {
  it.each(CONFIGURABLE_SCREENS)('has no screen called %s, and says nothing about it', (screen) => {
    expect(screenLayout(screen)).toBeNull();
    expect(reports).toEqual([]);
  });

  it('carries no screen at all, so the bar is the empty state and not a bar', () => {
    expect(screenIds()).toEqual([]);
    expect(decideTabBar().bar).toEqual({
      kind: 'empty',
      start: null,
      entries: [],
      tabs: [],
      more: [],
    });
    expect(reports).toEqual([]);
  });
});
