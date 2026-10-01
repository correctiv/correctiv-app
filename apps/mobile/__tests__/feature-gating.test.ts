import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { FEATURES } from '@correctiv/app-core/features/features';
import { projectGroups } from '@correctiv/app-core/data/projects';
import { searchSamples } from '@correctiv/app-core/data/search-samples';
import { filesUnder, floorFaults, withoutComments } from '@correctiv/prose-and-code';

import { CHANNEL, channelFor } from '../src/lib/channel';
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
  it('is release for a native build without __DEV__, which is the fail-closed default', () => {
    expect(channelFor(false, 'ios')).toBe('release');
    expect(channelFor(false, 'android')).toBe('release');
  });

  it('is preview only for the dev server and the web export', () => {
    expect(channelFor(true, 'ios')).toBe('preview');
    expect(channelFor(false, 'web')).toBe('preview');
  });

  it('is what this run says, and jest runs with __DEV__', () => {
    expect(CHANNEL).toBe('preview');
  });
});
