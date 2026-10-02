import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { parseFeatureOverride } from '@correctiv/app-core/features/features';

import { ROOT } from '../../plugin/collect.ts';
import { applyIssue, mayWrite } from '../../scripts/submission-kinds.ts';
import { Refusal } from '../../scripts/submission.ts';
import { FEATURES_FILE, FEATURES_KEY, CHANNEL_KEY } from '../../src/preview/home/names';
import {
  featuresDiffer,
  formatDraft,
  formatReleasePayload,
  markOf,
  NO_DRAFT,
  releaseStates,
  SHIPPED_FEATURES,
  selectable,
  withFeature,
  withGroup,
} from '../../src/preview/features/document';
import { issueFor, SUBMISSION_KINDS } from '../../src/preview/submission';

const read = (path: string) => readFileSync(join(ROOT, path), 'utf8');
const repo = { read, list: () => [] as string[] };
const feature = (id: string) => SHIPPED_FEATURES.features.find((f) => f.id === id)!;

describe('the feature switch', () => {
  it('does not offer `an` for a feature that reads sample data only', () => {
    expect(selectable(SHIPPED_FEATURES, NO_DRAFT, feature('callouts'), 'an')).toBe(false);
    expect(selectable(SHIPPED_FEATURES, NO_DRAFT, feature('callouts'), 'vorschau')).toBe(true);
    expect(selectable(SHIPPED_FEATURES, NO_DRAFT, feature('podcasts'), 'an')).toBe(true);
  });

  it('does not offer `an` inside a group that is not on, and never switches the core', () => {
    const held = withGroup(SHIPPED_FEATURES, NO_DRAFT, 'mediathek', 'vorschau');
    expect(selectable(SHIPPED_FEATURES, held, feature('podcasts'), 'an')).toBe(false);
    expect(selectable(SHIPPED_FEATURES, NO_DRAFT, feature('reader'), 'aus')).toBe(false);
    expect(withGroup(SHIPPED_FEATURES, NO_DRAFT, 'core', 'aus')).toBe(NO_DRAFT);
    expect(withFeature(SHIPPED_FEATURES, NO_DRAFT, 'reader', 'aus')).toBe(NO_DRAFT);
  });
});

describe('the override', () => {
  it('round-trips through the key the app reads, and a state equal to the file is no entry', () => {
    const draft = withFeature(SHIPPED_FEATURES, NO_DRAFT, 'podcasts', 'vorschau');
    expect(parseFeatureOverride(JSON.parse(formatDraft(draft)!))).toEqual(draft);
    expect(formatDraft(withFeature(SHIPPED_FEATURES, draft, 'podcasts', 'an'))).toBeNull();
  });

  it('is spelled the same on both sides of the seam', () => {
    const channel = read('apps/mobile/src/lib/channel.ts');
    expect(channel).toContain(`'${FEATURES_KEY}'`);
    expect(channel).toContain(`'${CHANNEL_KEY}'`);
  });
});

describe('the release submission', () => {
  it('writes the one fixed path and nothing else', () => {
    expect(SUBMISSION_KINDS.features.file).toBe(FEATURES_FILE);
    expect(mayWrite('features', FEATURES_FILE)).toBe(true);
    expect(mayWrite('features', 'packages/app-core/src/data/layout/navigation.json')).toBe(false);
  });

  it('changes only the states asked for, and clamps to the ceilings', () => {
    const draft = withFeature(SHIPPED_FEATURES, NO_DRAFT, 'podcasts', 'vorschau');
    const payload = formatReleasePayload(SHIPPED_FEATURES, draft);
    expect(JSON.parse(payload)).toEqual({ features: { podcasts: 'vorschau' } });
    const issue = issueFor('features', payload, { heading: 'x', lead: 'y' });
    const applied = applyIssue(issue.title, issue.body, repo);
    expect(applied.files.map((f) => f.path)).toEqual([FEATURES_FILE]);
    const content = applied.files[0]!.content;
    expect(content.split('\n').length).toBe(read(FEATURES_FILE).split('\n').length);
    expect(content).toContain('"id": "podcasts", "group": "mediathek", "state": "vorschau"');
    // a draft claiming `an` for a sample-only feature is never written as `an`
    const greedy = { features: { callouts: 'an' as const } };
    expect(releaseStates(SHIPPED_FEATURES, greedy).features).toEqual({});
    expect(featuresDiffer(SHIPPED_FEATURES, greedy)).toBe(false);
  });

  it('refuses what the ceilings or the file do not allow', () => {
    const run = (payload: string) => {
      const issue = issueFor('features', payload, { heading: 'x', lead: 'y' });
      try {
        applyIssue(issue.title, issue.body, repo);
      } catch (error) {
        if (error instanceof Refusal) return error.code;
        throw error;
      }
      return 'applied';
    };
    expect(run('{"features":{"callouts":"an"}}')).toBe('features-refused');
    expect(run('{"features":{"nobody":"an"}}')).toBe('features-refused');
    expect(run('{"groups":{"core":"aus"}}')).toBe('features-refused');
    expect(run('{"features":{"podcasts":"an"}}')).toBe('unchanged');
    expect(run('{"other":1}')).toBe('features-payload');
    expect(run('{}')).toBe('features-payload');
  });
});

describe('the marks', () => {
  it('say what holds a feature back, and say nothing for one that ships', () => {
    expect(markOf('podcasts')).toBeNull();
    expect(markOf('callouts')?.state).toBe('vorschau');
    expect(markOf('callouts')?.reason).toBe('data');
    expect(markOf('feed-europe')?.reason).toBe('declared');
    expect(markOf('nobody')).toMatchObject({ state: 'aus', reason: 'unknown' });
  });
});
