import {
  dataCeiling,
  effectiveState,
  FEATURES,
  limitReason,
  type Feature,
  type FeatureGroup,
  type FeatureOverride,
  type FeatureRegistry,
  type FeatureState,
  type LimitReason,
  type Provenance,
} from '@correctiv/app-core/features/features';
import { DATA_SOURCES } from '@correctiv/app-core/features/sources';

import { wbMessage, type WorkbenchMessage } from '../../i18n/messages';

/**
 * The feature page's model: pure functions over the core's registry, with no React and no
 * `window`, because the submission workflow (`scripts/submission-features.ts`) loads this
 * file in Node.
 *
 * **Which states are valid is the core's.** `effectiveState` is the least of the declared
 * state, the data, the group and what a feature requires (ADR 0072 §4), and this file never
 * recomputes that: it asks the core for it, and adds only what an editor needs on top, which
 * is what may be chosen and what a release would write.
 *
 * The draft is a `FeatureOverride`, the very shape the app reads from `workbench:features`
 * (ADR 0072 §6), so "try it out" writes the draft as it is and nothing is converted.
 */

export const STATES: readonly FeatureState[] = ['aus', 'vorschau', 'an'];

const RANK: Record<FeatureState, number> = { aus: 0, vorschau: 1, an: 2 };

const least = (...states: FeatureState[]): FeatureState =>
  states.reduce((low, next) => (RANK[next] < RANK[low] ? next : low));

/** The release file as the app ships it, which is also what Discard returns to. */
export const SHIPPED_FEATURES: FeatureRegistry = FEATURES;

export const NO_DRAFT: FeatureOverride = {};

export function groupOf(registry: FeatureRegistry, feature: Feature): FeatureGroup {
  return registry.groups.find((group) => group.id === feature.group)!;
}

export function membersOf(registry: FeatureRegistry, group: FeatureGroup): readonly Feature[] {
  return registry.features.filter((feature) => feature.group === group.id);
}

/** The state a group is declared at, in the draft or in the file. A locked group has no draft. */
export function declaredGroup(draft: FeatureOverride, group: FeatureGroup): FeatureState {
  return group.locked ? group.state : (draft.groups?.[group.id] ?? group.state);
}

export function declaredFeature(
  registry: FeatureRegistry,
  draft: FeatureOverride,
  feature: Feature,
): FeatureState {
  return groupOf(registry, feature).locked
    ? feature.state
    : (draft.features?.[feature.id] ?? feature.state);
}

export interface SourceRow {
  readonly id: string;
  readonly provenance: Provenance;
}

/** The sources a feature reads, each with whether it is live or a stand-in. */
export function sourcesOf(feature: Feature): readonly SourceRow[] {
  return (feature.sources ?? []).map((id) => ({ id, provenance: DATA_SOURCES[id].provenance }));
}

/** A feature whose every source is a sample: `vorschau` at most, and the page says why. */
export function sampleOnly(feature: Feature): boolean {
  return dataCeiling(feature) === 'vorschau';
}

/**
 * Whether the page lets a state be chosen. `an` is not selectable for a feature the data
 * cannot carry, nor inside a group that is not `an` (the group is the ceiling), and a locked
 * group is not switchable at all.
 */
export function selectable(
  registry: FeatureRegistry,
  draft: FeatureOverride,
  feature: Feature,
  state: FeatureState,
): boolean {
  const group = groupOf(registry, feature);
  if (group.locked) return false;
  if (state !== 'an') return true;
  return dataCeiling(feature) === 'an' && declaredGroup(draft, group) === 'an';
}

/** What the page shows for a feature: the core's effective state under the draft. */
export function shownState(
  registry: FeatureRegistry,
  draft: FeatureOverride,
  feature: Feature,
): FeatureState {
  return effectiveState(registry, feature.id, draft);
}

function withKey(
  record: Readonly<Record<string, FeatureState>> | undefined,
  id: string,
  state: FeatureState,
  shipped: FeatureState,
): Record<string, FeatureState> | undefined {
  const next = { ...record };
  if (state === shipped) delete next[id];
  else next[id] = state;
  return Object.keys(next).length === 0 ? undefined : next;
}

function assemble(
  groups: Record<string, FeatureState> | undefined,
  features: Record<string, FeatureState> | undefined,
): FeatureOverride {
  return { ...(groups ? { groups } : {}), ...(features ? { features } : {}) };
}

/** A group set to a state. A state equal to the file is no entry, as an unchanged value is no edit. */
export function withGroup(
  registry: FeatureRegistry,
  draft: FeatureOverride,
  id: string,
  state: FeatureState,
): FeatureOverride {
  const group = registry.groups.find((g) => g.id === id);
  if (!group || group.locked) return draft;
  return assemble(withKey(draft.groups, id, state, group.state), draft.features);
}

export function withFeature(
  registry: FeatureRegistry,
  draft: FeatureOverride,
  id: string,
  state: FeatureState,
): FeatureOverride {
  const feature = registry.features.find((f) => f.id === id);
  if (!feature || groupOf(registry, feature).locked) return draft;
  return assemble(draft.groups, withKey(draft.features, id, state, feature.state));
}

/** What a release would write: the states that differ from the file, clamped as the file's own test requires. */
export interface ReleaseStates {
  readonly groups: Readonly<Record<string, FeatureState>>;
  readonly features: Readonly<Record<string, FeatureState>>;
}

/**
 * The states a submission carries.
 *
 * A member is written no higher than its data and its group, because the committed file
 * holds that as a test (`packages/app-core/test/features.test.ts`): the draft may say `an`
 * for a member of a group that is `vorschau`, and the file may not.
 */
export function releaseStates(registry: FeatureRegistry, draft: FeatureOverride): ReleaseStates {
  const groups: Record<string, FeatureState> = {};
  const features: Record<string, FeatureState> = {};
  for (const group of registry.groups) {
    if (group.locked) continue;
    const state = declaredGroup(draft, group);
    if (state !== group.state) groups[group.id] = state;
    for (const feature of membersOf(registry, group)) {
      const written = least(declaredFeature(registry, draft, feature), dataCeiling(feature), state);
      if (written !== feature.state) features[feature.id] = written;
    }
  }
  return { groups, features };
}

/** Whether the draft would change the file. */
export function featuresDiffer(registry: FeatureRegistry, draft: FeatureOverride): boolean {
  const { groups, features } = releaseStates(registry, draft);
  return Object.keys(groups).length + Object.keys(features).length > 0;
}

/** The payload of a submission, on one line: only the states that change, by id. */
export function formatReleasePayload(registry: FeatureRegistry, draft: FeatureOverride): string {
  const { groups, features } = releaseStates(registry, draft);
  return JSON.stringify({
    ...(Object.keys(groups).length > 0 ? { groups } : {}),
    ...(Object.keys(features).length > 0 ? { features } : {}),
  });
}

/** The draft as the frame reads it, or null when it says nothing. */
export function formatDraft(draft: FeatureOverride): string | null {
  return draft.groups || draft.features ? JSON.stringify(draft) : null;
}

/**
 * Why a feature is marked, in the tools' own words (ADR 0072 §5): shown and labelled and
 * never hidden. The state says what a release build does, the reason says what holds it.
 */
export const MARK_STATE: Readonly<Record<'vorschau' | 'aus', WorkbenchMessage>> = {
  vorschau: wbMessage({
    id: 'features.mark.vorschau',
    defaultMessage: 'Preview only: a release build does not draw it.',
    description:
      'The mark on a block or a component whose feature is `vorschau`: the preview channel reaches it and a store build does not. features.mark.reason.* is read right after it and says what holds it back.',
  }),
  aus: wbMessage({
    id: 'features.mark.aus',
    defaultMessage: 'Off: no build draws it.',
    description:
      'The mark on a block or a component whose feature is `aus`, which is reachable nowhere. features.mark.reason.* is read right after it and says what holds it back.',
  }),
};

export const MARK_REASON: Readonly<Record<LimitReason, WorkbenchMessage>> = {
  declared: wbMessage({
    id: 'features.mark.reason.declared',
    defaultMessage: 'The release file holds it back.',
    description:
      'The reason after a mark: features.json itself says `vorschau` or `aus` for this feature.',
  }),
  data: wbMessage({
    id: 'features.mark.reason.data',
    defaultMessage: 'It reads sample data only.',
    description:
      'The reason after a mark: every data source of the feature is a stand-in file, which caps it at `vorschau` (ADR 0072 §4).',
  }),
  group: wbMessage({
    id: 'features.mark.reason.group',
    defaultMessage: 'Its group is held back.',
    description:
      'The reason after a mark: the feature’s group is lower than the feature, and a group is the ceiling of its members.',
  }),
  requires: wbMessage({
    id: 'features.mark.reason.requires',
    defaultMessage: 'A feature it needs is held back.',
    description: 'The reason after a mark: another feature this one requires is lower than it is.',
  }),
  unknown: wbMessage({
    id: 'features.mark.reason.unknown',
    defaultMessage: 'No feature of this name is declared.',
    description:
      'The reason after a mark: the id is not in features.json, so it is reachable nowhere.',
  }),
};

export interface Mark {
  readonly state: 'vorschau' | 'aus';
  readonly reason: LimitReason;
  readonly state_words: WorkbenchMessage;
  readonly reason_words: WorkbenchMessage;
}

/**
 * The same two marks in one word each, for a place with no room for the sentence.
 *
 * `MARK_STATE` above says what a release build does and `MARK_REASON` says what holds it
 * back, and between them they are a line of prose. That is right where a mark has a row to
 * itself — the feature page, a component's own card, the palette's tiles — and wrong on a
 * chip the width of the word „Vorschau", where the sentence wrapped to three lines and made
 * its tile taller than its neighbours.
 *
 * **The chip carries no reason and does not paraphrase one.** `features.mark.vorschau` is
 * „Nur Vorschau: Ein Release-Build zeigt es nicht." and the chip says „Vorschau", which is the
 * same claim with the sentence dropped rather than a second claim. The reason stays where it
 * was read — the chip's `title` and its accessible description carry the whole of it, which
 * is `FeatureChip`'s job in `Mark.tsx`.
 */
export const MARK_CHIP: Readonly<Record<'vorschau' | 'aus', WorkbenchMessage>> = {
  vorschau: wbMessage({
    id: 'features.mark.chip.vorschau',
    defaultMessage: 'Preview',
    description:
      'The chip that says a feature is `vorschau`: a release build does not draw it, and the preview channel does. The sentence behind it is features.mark.vorschau, which the chip’s tooltip carries.',
  }),
  aus: wbMessage({
    id: 'features.mark.chip.aus',
    defaultMessage: 'Off',
    description:
      'The chip that says a feature is `aus`: no build draws it. The sentence behind it is features.mark.aus, which the chip’s tooltip carries.',
  }),
};

/**
 * The mark a feature carries in a release build, or null for one that ships.
 *
 * Read against the file and no draft: the mark answers what a store build does today, and a
 * feature somebody is only trying out is not yet one that ships.
 */
export function markOf(id: string, registry: FeatureRegistry = SHIPPED_FEATURES): Mark | null {
  const state = effectiveState(registry, id);
  if (state === 'an') return null;
  const reason = limitReason(registry, id) ?? 'declared';
  return { state, reason, state_words: MARK_STATE[state], reason_words: MARK_REASON[reason] };
}
