/**
 * The layout kind: every document of `data/layout/` except Home's, which is the home kind.
 *
 * The payload is `{ target, document }`, where `target` is a screen id or `navigation`.
 * The target decides the path (ADR 0061 §2), never the issue's text, and the document is
 * judged by the core's own parser and printed again, as the home kind does. ADR 0071 §1
 * and §4.
 *
 * **A screen the newsroom made is a file this kind may create and delete** (ADR 0075 §7).
 * The path is still not the issue's: it is `screens/<id>.json` for an `id` that passes the
 * core's own `customScreenIdFault`, which admits no slash, no dot and no upper case, so the
 * set of paths is closed by the id's grammar rather than by a list. A `document` of `null`
 * deletes the file, and only a custom screen's: a declared screen has a bundled document
 * the app cannot do without.
 */
import { parseHomeLayout } from '@correctiv/app-core/lib/home-layout';
import {
  CONFIGURABLE_SCREENS,
  customScreenIdFault,
  isDeclaredScreen,
} from '@correctiv/app-core/lib/screen-layout';

import {
  LAYOUT_DIR,
  layoutFile,
  NAVIGATION_FILE,
  NAVIGATION_TARGET,
} from '../src/preview/home/names.ts';
import { formatLayoutDocument } from '../src/preview/home/document.ts';
import { VIA_LINK, type Via } from '../src/preview/submission.ts';
import { checkNavigation, formatNavigationDocument } from '../src/preview/navigation/document.ts';
import type { Repo } from './submission-strings.ts';
import { Refusal, RENDERABLE, shown, withProvenance } from './submission.ts';

/** The screens this kind writes: all of them but Home. */
const SCREENS = CONFIGURABLE_SCREENS.filter((screen) => screen !== 'home');

/** Whether a target is a screen the newsroom made, which may be created and deleted. */
function isCustomTarget(target: string): boolean {
  return customScreenIdFault(target) === null;
}

/** The path a target writes, or null for a target there is none for. */
export function fileOf(target: string): string | null {
  if (target === NAVIGATION_TARGET) return NAVIGATION_FILE;
  return (SCREENS as readonly string[]).includes(target) || isCustomTarget(target)
    ? layoutFile(target)
    : null;
}

/** Whether a path is one this kind may write at all. */
export function mayWriteLayout(path: string): boolean {
  if (path === NAVIGATION_FILE) return true;
  const prefix = `${LAYOUT_DIR}/screens/`;
  const suffix = '.json';
  if (!path.startsWith(prefix) || !path.endsWith(suffix)) return false;
  const id = path.slice(prefix.length, path.length - suffix.length);
  return isDeclaredScreen(id) ? id !== 'home' : isCustomTarget(id);
}

function readEnvelope(payload: string): {
  target: string;
  document: unknown;
  via: Via | undefined;
} {
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
    Object.keys(record).length !== (Object.hasOwn(record, 'via') ? 3 : 2)
  )
    throw new Refusal('layout-target');
  // The one provenance there is (ADR 0076 §3). Anything else is refused and never printed.
  if (Object.hasOwn(record, 'via') && record['via'] !== VIA_LINK) throw new Refusal('provenance');
  if (fileOf(record['target']) === null) throw new Refusal('layout-target', record['target']);
  // Only a custom screen is deleted, and `navigation` and the declared screens are not.
  if (record['document'] === null && !isCustomTarget(record['target']))
    throw new Refusal('layout-target', record['target']);
  return {
    target: record['target'],
    document: record['document'],
    via: Object.hasOwn(record, 'via') ? VIA_LINK : undefined,
  };
}

/** Whether the payload deletes its target's file rather than writing it. */
export function deletes(payload: string): boolean {
  return readEnvelope(payload).document === null;
}

/** The file a payload targets: what the proof holds the changed path to. */
export function targetFile(payload: string): string {
  return fileOf(readEnvelope(payload).target)!;
}

export interface AppliedLayout {
  file: string;
  /** The file's new content, or null when the file is to be deleted. */
  content: string | null;
  summary: string;
}

/** A file as `main` has it, or null where there is none: the case of a new screen. */
function readOrNull(repo: Repo, file: string): string | null {
  try {
    return repo.read(file);
  } catch {
    return null;
  }
}

export function applyLayout(payload: string, repo: Repo): AppliedLayout {
  const applied = applyEnvelope(payload, repo);
  return { ...applied, summary: withProvenance(applied.summary, readEnvelope(payload).via) };
}

function applyEnvelope(payload: string, repo: Repo): AppliedLayout {
  const { target, document } = readEnvelope(payload);
  const file = fileOf(target)!;

  if (document === null) {
    const was = readOrNull(repo, file);
    if (was === null) throw new Refusal('unchanged');
    return {
      file,
      content: null,
      summary: [
        `### Der Bildschirm ${shown(target)} wird gelöscht`,
        '',
        `- Die Datei \`screens/${shown(target)}.json\` entfällt, und mit ihr die Adresse \`/s/${shown(target)}\`.`,
        '- Eine Verknüpfung, die auf diesen Bildschirm zeigt, wird nicht mehr gezeichnet.',
      ].join('\n'),
    };
  }

  const found = readOrNull(repo, file);
  // A navigation and a declared screen exist; a missing one is the repository's fault and
  // not the person's, so it stays the throw it was.
  const current = found ?? (isCustomTarget(target) ? '' : repo.read(file));

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
  const { layout, problems } = parseHomeLayout(document, RENDERABLE);
  // A screen the newsroom made may hold no block: a screen that is only a heading is a
  // screen (ADR 0075 §7), and the deploy's check says the same.
  const empty = layout !== null && layout.sections.length === 0 && !isCustomTarget(target);
  if (!layout || empty || problems.length > 0) {
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
  if (found === null) {
    // Held to the same bar as the deploy's check, which would refuse a screen with no name:
    // `parseHomeLayout` keeps one (ADR 0036 §7) and a new file is the last place to let it by.
    if (!layout.words)
      throw new Refusal('refused', 'Der neue Bildschirm hat keinen Titel (title-german-missing)');
    return {
      file,
      content,
      summary: [
        `### Neuer Bildschirm ${shown(screen)}`,
        '',
        `- Titel: ${shown(layout.words.title.de ?? '')}`,
        `- Adresse in der App: \`/s/${shown(screen)}\``,
        `- ${after.length} Blöcke, ${shown(after.join(', '))}`,
      ].join('\n'),
    };
  }
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
