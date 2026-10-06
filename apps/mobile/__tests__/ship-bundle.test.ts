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

import { screenLayout } from '@/lib/home/layout';
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
  it.each(CONFIGURABLE_SCREENS)(
    'has nothing to draw on %s, and says nothing about it',
    (screen) => {
      expect(screenLayout(screen).sections).toEqual([]);
      expect(reports).toEqual([]);
    },
  );
});
