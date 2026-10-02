import { describe, expect, it } from 'vitest';

import {
  dataCeiling,
  effectiveState,
  FEATURES,
  FEATURES_PROBLEMS,
  featureState,
  isReachable,
  limitReason,
  parseFeatureOverride,
  parseFeatures,
  type FeatureRegistry,
  type FeaturesState,
} from '../src/features/features';
import { createAppStore } from '../src/stores/store';
import { searchProjectHits } from '../src/stores/search';
import { searchSamples } from '../src/data/search-samples';

const RANK = { aus: 0, vorschau: 1, an: 2 } as const;

/** A registry small enough to read: one open group, one locked, a sample-only feature. */
const REGISTRY: FeatureRegistry = {
  groups: [
    { id: 'core', state: 'an', locked: true },
    { id: 'open', state: 'an' },
    { id: 'held', state: 'vorschau' },
  ],
  features: [
    { id: 'reader', group: 'core', state: 'an', sources: ['articles'] },
    { id: 'live', group: 'open', state: 'an', sources: ['articles', 'projects'] },
    { id: 'sampled', group: 'open', state: 'an', sources: ['callouts', 'claims'] },
    { id: 'in-held', group: 'held', state: 'an', sources: ['articles'] },
    {
      id: 'needs-sampled',
      group: 'open',
      state: 'an',
      sources: ['articles'],
      requires: ['sampled'],
    },
    { id: 'off', group: 'open', state: 'aus' },
  ],
};

const stateIn = (
  channel: FeaturesState['channel'],
  override: FeaturesState['override'] = null,
) => ({
  features: { channel, override },
});

describe('the bundled release file', () => {
  it('parses without a single problem', () => {
    expect(FEATURES_PROBLEMS).toEqual([]);
    expect(FEATURES.features.length).toBeGreaterThan(0);
  });

  it('never commits an `an` the data cannot carry', () => {
    const faulty = FEATURES.features.filter(
      (feature) => dataCeiling(feature) === 'vorschau' && feature.state === 'an',
    );
    expect(faulty.map((feature) => feature.id)).toEqual([]);
  });

  it('never has a member above its group', () => {
    const above = FEATURES.features.filter((feature) => {
      const group = FEATURES.groups.find((g) => g.id === feature.group)!;
      return RANK[feature.state] > RANK[group.state];
    });
    expect(above.map((feature) => feature.id)).toEqual([]);
  });

  it('in the release channel reaches exactly the features that are `an`, and none that is not', () => {
    const state = stateIn('release');
    const reached = FEATURES.features.filter((f) => isReachable(state, f.id));
    expect(reached.map((f) => f.id)).toEqual(
      FEATURES.features.filter((f) => featureState(state, f.id) === 'an').map((f) => f.id),
    );
    expect(reached.filter((f) => f.state !== 'an')).toEqual([]);
  });

  it('in the preview channel reaches `an` and `vorschau` and never `aus`', () => {
    const state = stateIn('preview');
    const reached = FEATURES.features.filter((f) => isReachable(state, f.id));
    expect(reached.map((f) => f.id)).toEqual(
      FEATURES.features.filter((f) => featureState(state, f.id) !== 'aus').map((f) => f.id),
    );
  });
});

describe('the data ceiling', () => {
  it('is `vorschau` only for a feature that reads sources and every one is a sample', () => {
    expect(dataCeiling({ sources: ['callouts', 'claims'] })).toBe('vorschau');
    expect(dataCeiling({ sources: ['callouts', 'articles'] })).toBe('an');
    expect(dataCeiling({ sources: [] })).toBe('an');
    expect(dataCeiling({})).toBe('an');
  });

  it('is derived, so a source turning live lifts every feature that reads it', () => {
    expect(FEATURES.features.filter((f) => dataCeiling(f) === 'vorschau').map((f) => f.id)).toEqual(
      [
        'callouts',
        'faktenforum',
        'abriss-atlas',
        'early-access',
        'diary',
        'bonus-audio',
        'events',
        'quarterly-report',
      ],
    );
  });
});

describe('the effective state', () => {
  it('is the declared state when nothing lowers it', () => {
    expect(effectiveState(REGISTRY, 'live')).toBe('an');
    expect(effectiveState(REGISTRY, 'off')).toBe('aus');
  });

  it('is capped at vorschau by sample-only data', () => {
    expect(effectiveState(REGISTRY, 'sampled')).toBe('vorschau');
  });

  it('is capped by the group', () => {
    expect(effectiveState(REGISTRY, 'in-held')).toBe('vorschau');
  });

  it('is no higher than what the feature requires', () => {
    expect(effectiveState(REGISTRY, 'needs-sampled')).toBe('vorschau');
  });

  it('is aus for an id nobody declared, which is fail-closed', () => {
    expect(effectiveState(REGISTRY, 'nobody')).toBe('aus');
  });

  it('applies an override, but not above the data, the group or the requirements', () => {
    const override = { features: { 'in-held': 'an', sampled: 'an', off: 'vorschau' } } as const;
    expect(effectiveState(REGISTRY, 'sampled', override)).toBe('vorschau');
    expect(effectiveState(REGISTRY, 'in-held', override)).toBe('vorschau');
    expect(effectiveState(REGISTRY, 'off', override)).toBe('vorschau');
  });

  it('cannot move a locked group or what is in it', () => {
    const override = { groups: { core: 'aus' }, features: { reader: 'aus' } } as const;
    expect(effectiveState(REGISTRY, 'reader', override)).toBe('an');
  });
});

describe('the store', () => {
  it('is a release unless the host says otherwise', () => {
    expect(createAppStore().getState().features.channel).toBe('release');
  });

  it('keeps the channel it was built with through a reset', () => {
    const store = createAppStore({ channel: 'preview' });
    store.dispatch({ type: 'app/reset' });
    expect(store.getState().features.channel).toBe('preview');
  });

  it('drops an override in a release, where it could only ship something', () => {
    const store = createAppStore({ featureOverride: { features: { callouts: 'an' } } });
    expect(store.getState().features.override).toBeNull();
    const preview = createAppStore({
      channel: 'preview',
      featureOverride: { features: { callouts: 'aus' } },
    });
    expect(isReachable(preview.getState(), 'callouts')).toBe(false);
  });
});

describe('parseFeatures', () => {
  const doc = (extra: Record<string, unknown> = {}) => ({
    groups: [{ id: 'g', state: 'an' }],
    features: [{ id: 'f', group: 'g', state: 'an', sources: ['articles'], ...extra }],
  });

  it('reads a well-formed document', () => {
    const { registry, problems } = parseFeatures(doc());
    expect(problems).toEqual([]);
    expect(registry?.features.map((f) => f.id)).toEqual(['f']);
  });

  it('refuses a key it does not know, and loses only that entry', () => {
    const { registry, problems } = parseFeatures(doc({ colour: 'red' }));
    expect(problems.map((p) => p.code)).toEqual(['unknown-key']);
    expect(registry?.features).toEqual([]);
    expect(registry?.groups).toHaveLength(1);
  });

  it('refuses an unknown top-level key, a bad state and an unknown group', () => {
    expect(parseFeatures({ ...doc(), extra: 1 }).problems.map((p) => p.code)).toContain(
      'unknown-key',
    );
    expect(parseFeatures(doc({ state: 'maybe' })).problems.map((p) => p.code)).toEqual([
      'state-invalid',
    ]);
    expect(parseFeatures(doc({ group: 'x' })).problems.map((p) => p.code)).toEqual([
      'group-unknown',
    ]);
  });

  it('refuses a locked group that is not `an`, a duplicate id and a bad source list', () => {
    const locked = parseFeatures({
      groups: [{ id: 'g', state: 'vorschau', locked: true }],
      features: [],
    });
    expect(locked.problems.map((p) => p.code)).toEqual(['locked-not-an']);
    expect(
      parseFeatures({
        ...doc(),
        groups: [
          { id: 'g', state: 'an' },
          { id: 'g', state: 'an' },
        ],
      }).problems.map((p) => p.code),
    ).toEqual(['id-duplicate']);
    expect(parseFeatures(doc({ sources: 'articles' })).problems.map((p) => p.code)).toEqual([
      'sources-invalid',
    ]);
    expect(parseFeatures(doc({ sources: ['nowhere'] })).problems.map((p) => p.code)).toEqual([
      'sources-unknown',
    ]);
  });

  it('refuses a requirement that does not exist, and a cycle', () => {
    expect(parseFeatures(doc({ requires: ['ghost'] })).problems.map((p) => p.code)).toEqual([
      'requires-unknown',
    ]);
    const cyclic = parseFeatures({
      groups: [{ id: 'g', state: 'an' }],
      features: [
        { id: 'a', group: 'g', state: 'an', requires: ['b'] },
        { id: 'b', group: 'g', state: 'an', requires: ['a'] },
      ],
    });
    expect(cyclic.problems.map((p) => p.code)).toEqual(['requires-cycle', 'requires-cycle']);
    expect(cyclic.registry?.features).toEqual([]);
  });

  it('answers null for something that is not a document', () => {
    expect(parseFeatures([]).registry).toBeNull();
  });
});

describe('parseFeatureOverride', () => {
  it('keeps states and drops what is not one', () => {
    expect(parseFeatureOverride({ features: { a: 'an', b: 'sure' }, groups: 3 })).toEqual({
      features: { a: 'an' },
    });
    expect(parseFeatureOverride('x')).toBeNull();
  });
});

describe('search entries', () => {
  it('names a real feature on every gated sample', () => {
    const ids = new Set(FEATURES.features.map((f) => f.id));
    const unknown = searchSamples.filter((s) => s.feature !== undefined && !ids.has(s.feature));
    expect(unknown.map((s) => s.id)).toEqual([]);
  });

  it('filters out a hit whose feature is not reachable', () => {
    const release = stateIn('release');
    const hits = searchProjectHits('Deeptalk', (id) => isReachable(release, id));
    expect(hits.map((h) => h.id)).toEqual(['ss-deeptalk']);
    const callouts = searchProjectHits('Zukunft', (id) => isReachable(release, id));
    expect(callouts).toEqual([]);
    expect(searchProjectHits('Zukunft').map((h) => h.id)).toEqual(['ss-zukunft']);
  });
});

describe('limitReason', () => {
  it('names what holds a feature below `an`, and nothing for one that is `an`', () => {
    expect(limitReason(REGISTRY, 'live')).toBeNull();
    expect(limitReason(REGISTRY, 'off')).toBe('declared');
    expect(limitReason(REGISTRY, 'sampled')).toBe('data');
    expect(limitReason(REGISTRY, 'in-held')).toBe('group');
    expect(limitReason(REGISTRY, 'needs-sampled')).toBe('requires');
    expect(limitReason(REGISTRY, 'nobody')).toBe('unknown');
  });
});
