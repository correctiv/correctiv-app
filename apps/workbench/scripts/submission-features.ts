/**
 * The features kind: the release file, `features.json`, and nothing else
 * ([ADR 0072](../../../adr/0072-features-are-released-by-a-commit-and-never-by-a-fetch.md) §6, §7).
 *
 * The payload is `{ groups?, features? }`, each an object of id to state, and only ids the file
 * already holds. The path is fixed (`FEATURES_FILE`), never taken from the issue. The file is
 * edited as text, one `"state"` value at a time, so the formatting a reviewer sees in the diff
 * is the file's own and the change is exactly the states. The result is judged by the core's
 * parser and by the two ceilings the committed file must hold: no member above its data and
 * none above its group.
 */
import {
  dataCeiling,
  isFeatureState,
  parseFeatures,
  type FeatureRegistry,
  type FeatureState,
} from '@correctiv/app-core/features/features';

import { FEATURES_FILE } from '../src/preview/home/names.ts';
import type { Repo } from './submission-strings.ts';
import { Refusal, shown } from './submission.ts';

export interface ReleasePayload {
  groups: Record<string, FeatureState>;
  features: Record<string, FeatureState>;
}

const RANK: Record<FeatureState, number> = { aus: 0, vorschau: 1, an: 2 };

/** Whether a path is the one this kind may write. */
export function mayWriteFeatures(path: string): boolean {
  return path === FEATURES_FILE;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** The payload, or a refusal: an object with `groups` and/or `features`, each id to a state. */
export function readRelease(payload: string): ReleasePayload {
  let parsed: unknown;
  try {
    parsed = JSON.parse(payload);
  } catch (error) {
    throw new Refusal('not-json', error instanceof Error ? error.message : String(error));
  }
  if (
    !isRecord(parsed) ||
    Object.keys(parsed).some((key) => key !== 'groups' && key !== 'features')
  )
    throw new Refusal('features-payload');
  const out: ReleasePayload = { groups: {}, features: {} };
  for (const part of ['groups', 'features'] as const) {
    const entries = parsed[part];
    if (entries === undefined) continue;
    if (!isRecord(entries)) throw new Refusal('features-payload');
    for (const [id, state] of Object.entries(entries)) {
      if (!isFeatureState(state)) throw new Refusal('features-payload', id);
      out[part][id] = state;
    }
  }
  if (Object.keys(out.groups).length + Object.keys(out.features).length === 0)
    throw new Refusal('features-payload');
  return out;
}

/** `"state": "x"` of the entry with this id, replaced in the text. Entries run id, group, state. */
function restate(text: string, id: string, state: FeatureState): string {
  const at = text.indexOf(`"id": ${JSON.stringify(id)}`);
  if (at === -1) throw new Refusal('features-refused', `unknown id ${shown(id)}`);
  const pattern = /"state": "(?:aus|vorschau|an)"/g;
  pattern.lastIndex = at;
  const found = pattern.exec(text);
  if (!found) throw new Refusal('features-refused', `no state for ${shown(id)}`);
  return `${text.slice(0, found.index)}"state": "${state}"${text.slice(found.index + found[0].length)}`;
}

function registryOf(text: string): FeatureRegistry {
  let document: unknown;
  try {
    document = JSON.parse(text);
  } catch {
    throw new Refusal('features-refused', 'features.json is not readable');
  }
  const { registry, problems } = parseFeatures(document);
  if (!registry || problems.length > 0)
    throw new Refusal(
      'features-refused',
      [...new Set(problems.map((problem) => problem.code))].join(', '),
    );
  return registry;
}

export interface AppliedFeatures {
  file: string;
  content: string;
  summary: string;
}

export function applyFeatures(payload: string, repo: Repo): AppliedFeatures {
  const release = readRelease(payload);
  const current = repo.read(FEATURES_FILE);
  const before = registryOf(current);

  const items: string[] = [];
  let content = current;
  const lines: string[] = [];
  for (const [id, state] of Object.entries(release.groups)) {
    const group = before.groups.find((g) => g.id === id);
    if (!group || group.locked) {
      items.push(`Gruppe ${shown(id)}: ${group ? 'ist festgelegt' : 'gibt es nicht'}`);
      continue;
    }
    if (group.state !== state) lines.push(`- Gruppe ${shown(id)}: ${group.state} → ${state}`);
    content = restate(content, id, state);
  }
  for (const [id, state] of Object.entries(release.features)) {
    const feature = before.features.find((f) => f.id === id);
    const locked = feature && before.groups.find((g) => g.id === feature.group)?.locked;
    if (!feature || locked) {
      items.push(
        `Feature ${shown(id)}: ${feature ? 'gehört zu einer festgelegten Gruppe' : 'gibt es nicht'}`,
      );
      continue;
    }
    if (feature.state !== state) lines.push(`- Feature ${shown(id)}: ${feature.state} → ${state}`);
    content = restate(content, id, state);
  }
  if (items.length > 0) throw new Refusal('features-refused', '', items);

  const after = registryOf(content);
  for (const feature of after.features) {
    const group = after.groups.find((g) => g.id === feature.group)!;
    if (RANK[feature.state] > RANK[dataCeiling(feature)])
      items.push(
        `Feature ${shown(feature.id)}: ${feature.state} geht nicht, die Daten sind nur Beispiele`,
      );
    else if (RANK[feature.state] > RANK[group.state])
      items.push(
        `Feature ${shown(feature.id)}: ${feature.state} geht nicht über der Gruppe ${shown(group.id)}`,
      );
  }
  if (items.length > 0) throw new Refusal('features-refused', '', items);
  if (content === current) throw new Refusal('unchanged');

  return {
    file: FEATURES_FILE,
    content,
    summary: ['### Was sich an der Freigabe ändert', '', ...lines].join('\n'),
  };
}
