/**
 * What a build may let a reader reach, and the one place that decides it.
 *
 * [ADR 0072](../../../../adr/0072-features-are-released-by-a-commit-and-never-by-a-fetch.md):
 * `features.json` holds the release decision, changes only by a commit, is bundled and is
 * **never fetched**, so a store build contains a known answer to "what can a reader reach".
 * The layout documents of ADR 0071 arrange blocks; this file says which of them may be
 * drawn at all.
 *
 * ## The effective state
 *
 * The least of four things (ADR 0072 §4): the declared state, the ceiling from the data
 * (a feature whose sources are all `sample` is `vorschau` at most), the ceiling from its
 * group, and the effective state of every feature it requires. `isReachable` then reads
 * that against the build's channel: `release` reaches only `an`, `preview` reaches `an`
 * and `vorschau`.
 *
 * ## Why this parses by hand
 *
 * Like `parseHomeLayout`: no schema library, nothing throws, and an entry carrying a key
 * nobody here knows is dropped with a report rather than half-read. Unlike the home
 * document this file is never somebody else's, so a test asserts the bundled one parses
 * with no problems at all.
 *
 * ## Provenance
 *
 * A feature names the data sources it reads (`sources`, ids from `./sources.ts`), and each
 * source declares `live` or `sample` once. The data ceiling is derived from that, never
 * typed per feature: see `dataCeiling`.
 */

import featuresDocument from './features.json';
import { DATA_SOURCES, isDataSourceId, type DataSourceId, type Provenance } from './sources';

export type { Provenance };

export type FeatureState = 'aus' | 'vorschau' | 'an';
export type Channel = 'release' | 'preview';

export interface FeatureGroup {
  readonly id: string;
  readonly state: FeatureState;
  /** A group that cannot be switched off or down: not by a commit's mistake and not by an override. */
  readonly locked?: boolean;
}

export interface Feature {
  readonly id: string;
  readonly group: string;
  readonly state: FeatureState;
  /** The data sources it reads. None means it reads no data, and the data caps nothing. */
  readonly sources?: readonly DataSourceId[];
  /** Features this one is no more reachable than. */
  readonly requires?: readonly string[];
}

export interface FeatureRegistry {
  readonly groups: readonly FeatureGroup[];
  readonly features: readonly Feature[];
}

/** The workbench's override, for a person trying things in the frame. */
export interface FeatureOverride {
  readonly groups?: Readonly<Record<string, FeatureState>>;
  readonly features?: Readonly<Record<string, FeatureState>>;
}

export type FeatureProblemCode =
  | 'document-not-an-object'
  | 'groups-not-an-array'
  | 'features-not-an-array'
  | 'unknown-key'
  | 'entry-not-an-object'
  | 'id-invalid'
  | 'id-duplicate'
  | 'state-invalid'
  | 'locked-invalid'
  | 'locked-not-an'
  | 'group-unknown'
  | 'sources-invalid'
  | 'sources-unknown'
  | 'requires-invalid'
  | 'requires-unknown'
  | 'requires-cycle';

export interface FeatureProblem {
  readonly code: FeatureProblemCode;
  readonly context: Record<string, string | number | boolean | null>;
}

export interface FeaturesParse {
  readonly registry: FeatureRegistry | null;
  readonly problems: readonly FeatureProblem[];
}

const STATES: readonly FeatureState[] = ['aus', 'vorschau', 'an'];

const GROUP_KEYS: Record<keyof FeatureGroup, true> = { id: true, state: true, locked: true };
const FEATURE_KEYS: Record<keyof Feature, true> = {
  id: true,
  group: true,
  state: true,
  sources: true,
  requires: true,
};

const RANK: Record<FeatureState, number> = { aus: 0, vorschau: 1, an: 2 };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isFeatureState(value: unknown): value is FeatureState {
  return typeof value === 'string' && (STATES as readonly string[]).includes(value);
}

/**
 * What the data lets a feature be: `vorschau` when it reads sources and every one is
 * `sample`, otherwise `an`. A feature with no sources reads nothing a sample could stand in
 * for, so the data caps nothing there.
 */
export function dataCeiling(feature: Pick<Feature, 'sources'>): FeatureState {
  const sources = feature.sources ?? [];
  return sources.length > 0 && sources.every((id) => DATA_SOURCES[id].provenance === 'sample')
    ? 'vorschau'
    : 'an';
}

function leastOf(...states: FeatureState[]): FeatureState {
  return states.reduce((low, next) => (RANK[next] < RANK[low] ? next : low));
}

/** Never throws; every fault costs the one entry it is in. */
export function parseFeatures(document: unknown): FeaturesParse {
  const problems: FeatureProblem[] = [];
  if (!isRecord(document)) {
    return { registry: null, problems: [{ code: 'document-not-an-object', context: {} }] };
  }
  for (const key of Object.keys(document)) {
    if (key !== 'groups' && key !== 'features') {
      problems.push({ code: 'unknown-key', context: { where: 'document', key } });
    }
  }

  const groups: FeatureGroup[] = [];
  const groupIds = new Set<string>();
  if (!Array.isArray(document.groups)) {
    problems.push({ code: 'groups-not-an-array', context: {} });
  } else {
    document.groups.forEach((raw: unknown, index: number) => {
      if (!isRecord(raw)) {
        problems.push({ code: 'entry-not-an-object', context: { where: 'group', index } });
        return;
      }
      const unknown = Object.keys(raw).filter((key) => !Object.hasOwn(GROUP_KEYS, key));
      if (unknown.length > 0) {
        problems.push({
          code: 'unknown-key',
          context: { where: 'group', index, key: unknown[0]! },
        });
        return;
      }
      if (typeof raw.id !== 'string' || raw.id === '') {
        problems.push({ code: 'id-invalid', context: { where: 'group', index } });
        return;
      }
      if (groupIds.has(raw.id)) {
        problems.push({ code: 'id-duplicate', context: { where: 'group', id: raw.id } });
        return;
      }
      if (!isFeatureState(raw.state)) {
        problems.push({ code: 'state-invalid', context: { where: 'group', id: raw.id } });
        return;
      }
      if (raw.locked !== undefined && typeof raw.locked !== 'boolean') {
        problems.push({ code: 'locked-invalid', context: { id: raw.id } });
        return;
      }
      if (raw.locked === true && raw.state !== 'an') {
        problems.push({ code: 'locked-not-an', context: { id: raw.id } });
        return;
      }
      groupIds.add(raw.id);
      groups.push({
        id: raw.id,
        state: raw.state,
        ...(raw.locked === undefined ? {} : { locked: raw.locked }),
      });
    });
  }

  const features: Feature[] = [];
  const featureIds = new Set<string>();
  if (!Array.isArray(document.features)) {
    problems.push({ code: 'features-not-an-array', context: {} });
  } else {
    document.features.forEach((raw: unknown, index: number) => {
      if (!isRecord(raw)) {
        problems.push({ code: 'entry-not-an-object', context: { where: 'feature', index } });
        return;
      }
      const unknown = Object.keys(raw).filter((key) => !Object.hasOwn(FEATURE_KEYS, key));
      if (unknown.length > 0) {
        problems.push({
          code: 'unknown-key',
          context: { where: 'feature', index, key: unknown[0]! },
        });
        return;
      }
      if (typeof raw.id !== 'string' || raw.id === '') {
        problems.push({ code: 'id-invalid', context: { where: 'feature', index } });
        return;
      }
      if (featureIds.has(raw.id)) {
        problems.push({ code: 'id-duplicate', context: { where: 'feature', id: raw.id } });
        return;
      }
      if (typeof raw.group !== 'string' || !groupIds.has(raw.group)) {
        problems.push({ code: 'group-unknown', context: { id: raw.id } });
        return;
      }
      if (!isFeatureState(raw.state)) {
        problems.push({ code: 'state-invalid', context: { where: 'feature', id: raw.id } });
        return;
      }
      let sources: DataSourceId[] | undefined;
      if (raw.sources !== undefined) {
        if (!Array.isArray(raw.sources) || raw.sources.some((r) => typeof r !== 'string')) {
          problems.push({ code: 'sources-invalid', context: { id: raw.id } });
          return;
        }
        const unknownSource = (raw.sources as string[]).find((r) => !isDataSourceId(r));
        if (unknownSource !== undefined) {
          problems.push({
            code: 'sources-unknown',
            context: { id: raw.id, source: unknownSource },
          });
          return;
        }
        sources = raw.sources as DataSourceId[];
      }
      let requires: string[] | undefined;
      if (raw.requires !== undefined) {
        if (!Array.isArray(raw.requires) || raw.requires.some((r) => typeof r !== 'string')) {
          problems.push({ code: 'requires-invalid', context: { id: raw.id } });
          return;
        }
        requires = raw.requires as string[];
      }
      featureIds.add(raw.id);
      features.push({
        id: raw.id,
        group: raw.group,
        state: raw.state,
        ...(sources === undefined ? {} : { sources }),
        ...(requires === undefined ? {} : { requires }),
      });
    });
  }

  // What a feature requires is checked after all of them are known, in a fixed point:
  // dropping one can orphan another's requirement.
  let kept = features;
  for (let changed = true; changed;) {
    changed = false;
    const ids = new Set(kept.map((feature) => feature.id));
    const next = kept.filter((feature) => {
      const missing = feature.requires?.find((r) => !ids.has(r));
      if (missing === undefined) return true;
      problems.push({ code: 'requires-unknown', context: { id: feature.id, requires: missing } });
      changed = true;
      return false;
    });
    kept = next;
  }
  const byId = new Map(kept.map((feature) => [feature.id, feature]));
  const cyclic = new Set<string>();
  for (const feature of kept) {
    const seen = new Set<string>();
    const walk = (id: string): boolean => {
      if (id === feature.id && seen.size > 0) return true;
      if (seen.has(id)) return false;
      seen.add(id);
      return (byId.get(id)?.requires ?? []).some(walk);
    };
    if ((feature.requires ?? []).some(walk)) cyclic.add(feature.id);
  }
  for (const id of cyclic) problems.push({ code: 'requires-cycle', context: { id } });

  return {
    registry: { groups, features: kept.filter((feature) => !cyclic.has(feature.id)) },
    problems,
  };
}

/** The override as a person typed it, read leniently: whatever is not a state is not an answer. */
export function parseFeatureOverride(document: unknown): FeatureOverride | null {
  if (!isRecord(document)) return null;
  const pick = (value: unknown): Record<string, FeatureState> | undefined => {
    if (!isRecord(value)) return undefined;
    const out: Record<string, FeatureState> = {};
    for (const [id, state] of Object.entries(value)) {
      if (isFeatureState(state)) out[id] = state;
    }
    return out;
  };
  const groups = pick(document.groups);
  const features = pick(document.features);
  return { ...(groups ? { groups } : {}), ...(features ? { features } : {}) };
}

const parsed = parseFeatures(featuresDocument);

/** The bundled release file. A test holds that it parses without a single problem. */
export const FEATURES: FeatureRegistry = parsed.registry ?? { groups: [], features: [] };
export const FEATURES_PROBLEMS: readonly FeatureProblem[] = parsed.problems;

/**
 * What a feature is, once everything that can lower it has.
 *
 * An id the registry does not hold is `aus`: a thing that names a feature nobody declared
 * is reachable nowhere, which is the fail-closed answer, and a test holds that nothing
 * does.
 */
export function effectiveState(
  registry: FeatureRegistry,
  id: string,
  override: FeatureOverride | null = null,
  visiting: ReadonlySet<string> = new Set(),
): FeatureState {
  const feature = registry.features.find((f) => f.id === id);
  if (!feature || visiting.has(id)) return 'aus';
  const group = registry.groups.find((g) => g.id === feature.group);
  if (!group) return 'aus';

  const groupState = group.locked ? group.state : (override?.groups?.[group.id] ?? group.state);
  const declared = group.locked ? feature.state : (override?.features?.[id] ?? feature.state);
  const data = dataCeiling(feature);
  const seen = new Set(visiting).add(id);
  const required = (feature.requires ?? []).map((r) => effectiveState(registry, r, override, seen));
  return leastOf(declared, data, groupState, ...required);
}

export type LimitReason = 'declared' | 'data' | 'group' | 'requires' | 'unknown';

/**
 * What holds a feature below `an`, or null when nothing does. The tools label a feature
 * with it (ADR 0072 §5), so the reason is told once and from the same minimum
 * `effectiveState` takes: the first of data, group, declared, requires that is lowest.
 */
export function limitReason(
  registry: FeatureRegistry,
  id: string,
  override: FeatureOverride | null = null,
): LimitReason | null {
  const feature = registry.features.find((f) => f.id === id);
  const group = feature && registry.groups.find((g) => g.id === feature.group);
  if (!feature || !group) return 'unknown';
  const effective = effectiveState(registry, id, override);
  if (effective === 'an') return null;
  const groupState = group.locked ? group.state : (override?.groups?.[group.id] ?? group.state);
  const declared = group.locked ? feature.state : (override?.features?.[id] ?? feature.state);
  // On a tie the cause that cannot be fixed by editing the file wins: sample data first.
  if (RANK[dataCeiling(feature)] === RANK[effective]) return 'data';
  if (RANK[groupState] === RANK[effective]) return 'group';
  if (RANK[declared] === RANK[effective]) return 'declared';
  return 'requires';
}

export function reachableIn(channel: Channel, state: FeatureState): boolean {
  return state === 'an' || (state === 'vorschau' && channel === 'preview');
}

/** The slice's shape: both are construction state, handed in by the host and never dispatched. */
export interface FeaturesState {
  readonly channel: Channel;
  readonly override: FeatureOverride | null;
}

export function featureState(
  state: { features: FeaturesState },
  id: string,
  registry: FeatureRegistry = FEATURES,
): FeatureState {
  return effectiveState(registry, id, state.features.override);
}

export function isReachable(
  state: { features: FeaturesState },
  id: string,
  registry: FeatureRegistry = FEATURES,
): boolean {
  return reachableIn(state.features.channel, featureState(state, id, registry));
}

/** The channel the store was built for. */
export const channel = (state: { features: FeaturesState }): Channel => state.features.channel;

export const featuresInitialState: FeaturesState = { channel: 'release', override: null };

/**
 * Construction state with no action: the host says the channel once, and a reset puts it
 * back (`stores/store.ts`). The default is `release`, so a store built without being told
 * reaches only what is `an`.
 */
export function featuresReducer(state: FeaturesState = featuresInitialState): FeaturesState {
  return state;
}
