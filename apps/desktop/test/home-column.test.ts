/**
 * What the host has to do for main's home document and reading column, as text.
 *
 * Same footing as `root-layout.test.ts`: there is no GTK and no renderer in
 * `npm run check`, so these read the files. They hold the wiring that fails SILENTLY —
 * a missing persistence line draws the bundled home forever, a missing stamp fetches
 * nothing, a missing clamp is a window-wide column — and say nothing about whether any
 * of it renders; the captures in the README do.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const read = (...parts: string[]): string =>
  readFileSync(resolve(__dirname, '..', ...parts), 'utf8');

describe('the home document', () => {
  const layout = read('src', 'app', '_layout.tsx');

  it('persists the kept copy and refreshes it, as the phone’s root layout does', () => {
    expect(layout).toMatch(/persisted<HomeLayoutState>\('homeLayout'/);
    expect(layout).toMatch(/useHomeLayoutRefresh\(storeReady\)/);
    const phone = readFileSync(
      resolve(__dirname, '..', '..', 'mobile', 'src', 'app', '_layout.tsx'),
      'utf8',
    );
    expect(phone).toMatch(/persisted<HomeLayoutState>\('homeLayout'/);
    expect(phone).toMatch(/useHomeLayoutRefresh\(storeReady\)/);
  });

  it('stamps the build and answers it as expo-constants does', () => {
    expect(read('gjsify.config.mjs')).toMatch(/__BUILT_AT__:/);
    expect(read('src', 'shims', 'expo-constants.ts')).toMatch(/extra: \{ builtAt: __BUILT_AT__ \}/);
  });

  it('answers AppState from the windows rather than the layer’s refusing export', () => {
    expect(read('src', 'shims', 'react-native.tsx')).toMatch(
      /export \{ appState as AppState \} from '..\/platform\/foreground\.js'/,
    );
  });
});

describe('the reading column', () => {
  it('is an Adw.Clamp around a View that states a maxWidth', () => {
    const shim = read('src', 'shims', 'react-native.tsx');
    expect(shim).toMatch(/'adw-clamp'/);
    expect(shim).toMatch(/maximumSize: column/);
  });

  it('has a gutter that does not subtract a rail, redirected by file', () => {
    const override = read('src', 'overrides', 'ContentColumn.tsx').replace(/^\s*\/\/.*$/gm, '');
    expect(override).not.toMatch(/railWidth|railBreakpoint/);
    expect(override).toMatch(/columnGutter\(width\)/);
    expect(read('gjsify.config.mjs')).toMatch(/src\/overrides\/ContentColumn\.tsx/);
  });
});
