/**
 * The layout kind: every document of `data/layout/` except Home's, which is the home kind.
 *
 * The payload is `{ target, document }`, where `target` is a screen id or `navigation`.
 * The target decides the path from a fixed list (ADR 0061 §2), never from the issue's text,
 * and the document is judged by the core's own parser and printed again, as the home kind
 * does. ADR 0071 §1 and §4.
 */
import { parseHomeLayout } from '@correctiv/app-core/lib/home-layout';
import { CONFIGURABLE_SCREENS } from '@correctiv/app-core/lib/screen-layout';

import { layoutFile, NAVIGATION_FILE } from '../src/preview/home/names.ts';
import { formatLayoutDocument } from '../src/preview/home/document.ts';
import { checkNavigation, formatNavigationDocument } from '../src/preview/navigation/document.ts';
import type { Repo } from './submission-strings.ts';
import { Refusal, RENDERABLE, shown } from './submission.ts';

export const NAVIGATION_TARGET = 'navigation';

/** The screens this kind writes: all of them but Home. */
const SCREENS = CONFIGURABLE_SCREENS.filter((screen) => screen !== 'home');

/** The path a target writes, or null for a target there is none for. */
export function fileOf(target: string): string | null {
  if (target === NAVIGATION_TARGET) return NAVIGATION_FILE;
  return (SCREENS as readonly string[]).includes(target) ? layoutFile(target) : null;
}

/** Whether a path is one this kind may write at all. */
export function mayWriteLayout(path: string): boolean {
  return path === NAVIGATION_FILE || SCREENS.some((screen) => layoutFile(screen) === path);
}

function readEnvelope(payload: string): { target: string; document: unknown } {
  let envelope: unknown;
  try {
    envelope = JSON.parse(payload);
  } catch (error) {
    throw new Refusal('not-json', error instanceof Error ? error.message : String(error));
  }
  const record = envelope as Record<string, unknown> | null;
  if (
    typeof record !== 'object' ||
    record === null ||
    Array.isArray(record) ||
    typeof record['target'] !== 'string' ||
    !Object.hasOwn(record, 'document') ||
    Object.keys(record).length !== 2
  )
    throw new Refusal('layout-target');
  if (fileOf(record['target']) === null) throw new Refusal('layout-target', record['target']);
  return { target: record['target'], document: record['document'] };
}

/** The file a payload targets: what the proof holds the changed path to. */
export function targetFile(payload: string): string {
  return fileOf(readEnvelope(payload).target)!;
}

export interface AppliedLayout {
  file: string;
  content: string;
  summary: string;
}

export function applyLayout(payload: string, repo: Repo): AppliedLayout {
  const { target, document } = readEnvelope(payload);
  const file = fileOf(target)!;
  const current = repo.read(file);

  if (target === NAVIGATION_TARGET) {
    const { navigation, problems } = checkNavigation(document);
    if (!navigation) {
      const codes = [...new Set(problems.map((problem) => problem.code))].join(', ');
      throw new Refusal('refused', codes);
    }
    const content = formatNavigationDocument(navigation);
    if (content === current) throw new Refusal('unchanged');
    let before = '';
    try {
      const was = JSON.parse(current) as { tabs?: string[]; maxTabs?: number };
      before = `${(was.tabs ?? []).join(', ')} (höchstens ${was.maxTabs ?? '?'} Tabs)`;
    } catch {
      before = 'nicht lesbar';
    }
    return {
      file,
      content,
      summary: [
        '### Was sich an der Navigation ändert',
        '',
        `- Vorher: Home, ${shown(before)}`,
        `- Nachher: Home, ${shown(navigation.tabs.join(', '))} (höchstens ${navigation.maxTabs} Tabs, „Mehr“ eingerechnet)`,
      ].join('\n'),
    };
  }

  const screen = target as (typeof SCREENS)[number];
  const { layout, problems } = parseHomeLayout(document, RENDERABLE, screen);
  if (!layout || layout.sections.length === 0 || problems.length > 0) {
    const codes = [...new Set(problems.map((problem) => problem.code))].join(', ');
    throw new Refusal('refused', codes || 'kein Dokument mit Blöcken');
  }
  const content = formatLayoutDocument(layout);
  if (content === current) throw new Refusal('unchanged');
  let before: string[] = [];
  try {
    before =
      (JSON.parse(current) as { sections?: { id: string }[] }).sections?.map((s) => s.id) ?? [];
  } catch {
    // The summary then reads as a document written from nothing.
  }
  const after = layout.sections.map((section) => section.id);
  return {
    file,
    content,
    summary: [
      `### Was sich am Bildschirm ${shown(screen)} ändert`,
      '',
      `- Vorher: ${before.length} Blöcke, ${shown(before.join(', '))}`,
      `- Nachher: ${after.length} Blöcke, ${shown(after.join(', '))}`,
    ].join('\n'),
  };
}
