import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { FEATURES } from '@correctiv/app-core/features/features';
import { projectGroups } from '@correctiv/app-core/data/projects';
import { searchSamples } from '@correctiv/app-core/data/search-samples';
import { filesUnder, floorFaults, withoutComments } from '@correctiv/prose-and-code';

import { CHANNEL, PREVIEW_OPT_IN, channelFor } from '../src/lib/channel';
import { MODULE_FEATURES, ROUTE_FEATURES, TAB_FEATURES, tabReachable } from '../src/lib/features';
import { MODULE_SCREENS } from '../src/lib/home/screens';

/**
 * ADR 0072 §5's cost, as a test: a gated thing declares its feature, and the declaration
 * has to be a feature that exists, in BOTH directions. A thing naming an id that is not in
 * `features.json` would be `aus` for ever; a feature nothing names gates nothing and is a
 * switch wired to nothing.
 */
const SRC = resolve(__dirname, '../src');
const IDS = new Set(FEATURES.features.map((feature) => feature.id));

/** `reachable('x')` in a screen, which is how a section declares its own feature. */
const SECTION_GATE = /reachable\(\s*'([a-z0-9-]+)'\s*\)/g;

function sectionFeatures(): Set<string> {
  const found = new Set<string>();
  const files = filesUnder(SRC, /\.tsx?$/);
  expect(floorFaults({ 'source files': { found: files.length, atLeast: 50 } })).toEqual([]);
  for (const file of files) {
    const text = withoutComments(readFileSync(file, 'utf8'));
    for (const match of text.matchAll(SECTION_GATE)) found.add(match[1]!);
  }
  return found;
}

function declared(): Set<string> {
  return new Set([
    ...Object.values(MODULE_FEATURES).map((gate) => gate.feature),
    ...ROUTE_FEATURES.map((gate) => gate.feature),
    ...Object.values(TAB_FEATURES).flat(),
    ...searchSamples.flatMap((sample) => (sample.feature ? [sample.feature] : [])),
    ...projectGroups.flatMap((group) =>
      group.projects.flatMap((p) => (p.feature ? [p.feature] : [])),
    ),
    ...sectionFeatures(),
  ]);
}

describe('feature declarations', () => {
  it('only name features that exist', () => {
    expect([...declared()].filter((id) => !IDS.has(id))).toEqual([]);
  });

  it('leave no feature unnamed', () => {
    const named = declared();
    expect([...IDS].filter((id) => !named.has(id))).toEqual([]);
  });

  it('give every Home block a feature, and name no block that is not one', () => {
    const blocks = Object.keys(MODULE_SCREENS);
    expect(blocks.filter((block) => !(block in MODULE_FEATURES))).toEqual([]);
    expect(Object.keys(MODULE_FEATURES).filter((block) => !blocks.includes(block))).toEqual([]);
  });

  it('name every gated route once', () => {
    const routes = ROUTE_FEATURES.map((gate) => gate.route);
    expect(new Set(routes).size).toBe(routes.length);
  });
});

describe('tabs', () => {
  it('drop a tab with no reachable content and keep one with some', () => {
    expect(tabReachable('mitmachen', () => false)).toBe(false);
    expect(tabReachable('mitmachen', (id) => id === 'faktenforum')).toBe(true);
    expect(tabReachable('index', () => false)).toBe(true);
    expect(tabReachable('profil', () => false)).toBe(true);
  });
});

describe('the channel', () => {
  /**
   * The Android release workflow, read for the two things that make a manual run a
   * tester build rather than a release: the input, and the variable it inlines.
   *
   * Nothing else in this repository could see either. `channel.ts` is the code that
   * reads the variable, and a workflow that stopped setting it would leave the app
   * compiling, testing green and quietly handing testers a `release` build — the
   * shape ADR 0031's mechanism-4 obligation is about. So the spelling is held here,
   * once, next to the code that reads it.
   */
  const workflow = readFileSync(
    resolve(__dirname, '../../../.github/workflows/release-android.yml'),
    'utf8',
  );

  it('offers the input as an opt-in that is off by default', () => {
    // `default: false` is the whole of "never the default" (ADR 0072 §2). A
    // required input, or one defaulting to true, would put a preview build on a
    // release path the next time somebody edits it.
    expect(workflow).toMatch(/preview:\n\s+description:[^\n]*\n\s+type: boolean/);
    expect(workflow).toMatch(/type: boolean\n\s+required: false\n\s+default: false/);
  });

  it('inlines the variable channel.ts reads, on the step that bundles', () => {
    // The bundle is built by Gradle, not by `expo export`, so the variable has to
    // be in the ENVIRONMENT OF THAT STEP; set anywhere else it is inlined into
    // nothing.
    expect(workflow).toMatch(
      /name: Build release APK\n(?:[^\n]*\n)*?\s+env:\n\s+EXPO_PUBLIC_CORRECTIV_CHANNEL: [^\n]*\n\s+run: \.\/gradlew assembleRelease/,
    );
    // And the value is the one opt-in the app reads, not a truthy flag.
    expect(workflow).toMatch(
      /EXPO_PUBLIC_CORRECTIV_CHANNEL: \$\{\{ inputs\.preview && 'preview' \|\| 'release' \}\}/,
    );
  });

  it('refuses a preview build on a tag, and keeps it out of the release job', () => {
    // A tagged run is attached to a GitHub Release, so a preview APK would be
    // published on a release page. The guard is a step that fails rather than a
    // condition on the attach, because an artifact named `preview-android` that
    // the release job then downloaded would be a store track by another route.
    expect(workflow).toMatch(
      /Refuse a preview build on a tag[\s\S]*?if: startsWith\(github\.ref, 'refs\/tags\/'\) && inputs\.preview/,
    );
    expect(workflow).toMatch(
      /name: \${{ inputs\.preview && 'preview-android' \|\| 'release-android' }}/,
    );
    // The download names its artifact rather than taking every artifact in the run.
    expect(workflow).toMatch(/actions\/download-artifact@v4\n\s+with:\n\s+name: release-android/);
  });

  it('is release for a native build without __DEV__, which is the fail-closed default', () => {
    expect(channelFor(false, 'ios')).toBe('release');
    expect(channelFor(false, 'android')).toBe('release');
  });

  it('is preview only for the dev server, the web export and the tester APK', () => {
    expect(channelFor(true, 'ios')).toBe('preview');
    expect(channelFor(false, 'web')).toBe('preview');
    expect(channelFor(false, 'android', true)).toBe('preview');
  });

  /**
   * The build-time opt-in, which is what makes a tester APK a `preview` build
   * (ADR 0072 §2's manual input) and the reason iOS stays `release` with nothing
   * configured: only the Android workflow sets the variable.
   *
   * Every value but the exact one is `release`. A boolean flag, a truthy string
   * or a differently spelled name would all reach `vorschau` features in a store
   * build, which is the failure the whole mechanism exists to make impossible —
   * and the third argument is read from `process.env` by default, so this is the
   * same code path the bundle takes.
   */
  it.each([
    [undefined, 'release'],
    ['', 'release'],
    ['preview', 'preview'],
    ['PREVIEW', 'release'],
    ['release', 'release'],
    ['1', 'release'],
    ['true', 'release'],
    ['0', 'release'],
    ['false', 'release'],
    [' preview', 'release'],
    ['preview ', 'release'],
    [' preview ', 'release'],
    ['preview,release', 'release'],
  ])('reads the build environment: %p is %s', (value, channel) => {
    if (value === undefined) delete process.env[PREVIEW_OPT_IN];
    else process.env[PREVIEW_OPT_IN] = value;
    try {
      expect(channelFor(false, 'android')).toBe(channel);
      // The env var is an EXPO_PUBLIC_ one, so Metro inlines it as a string
      // constant. An empty value inlines as `""`, not as a missing key.
      process.env[PREVIEW_OPT_IN] = value ?? '';
      expect(channelFor(false, 'android')).toBe(channel);
      // And it never turns a release build into something else.
      expect(channelFor(false, 'ios')).toBe(channel);
    } finally {
      delete process.env[PREVIEW_OPT_IN];
    }
  });

  it('is what this run says, and jest runs with __DEV__', () => {
    expect(CHANNEL).toBe('preview');
  });
});
