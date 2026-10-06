/**
 * The layout kind: every document of `data/layouts/<layout>/`, Home's among them.
 *
 * The payload is `{ layout, target, document }`, where `layout` is the folder (ADR 0078 §6),
 * and `target` is a screen id or `navigation`. A submission is about exactly one layout.
 * The layout and the target decide the path (ADR 0061 §2), never the issue's text, and the
 * document is judged by the core's own parser and printed again, as the home kind does.
 * ADR 0071 §1 and §4.
 *
 * **Every screen is the same kind of file** (ADR 0078 §4): one this kind may create, write
 * and delete, built-in name or not. The path is still not the issue's: it is
 * `<layout>/screens/<id>.json` for a `layout` that passes the core's `layoutIdFault` and an
 * `id` that passes its `screenIdFault`, which admit no slash, no dot and no upper case, so
 * the set of paths is closed by the grammar rather than by a list. A `document` of `null`
 * deletes the file. A layout is a folder somebody committed, with its navigation: this kind
 * does not create one.
 */
import { parseHomeLayout } from '@correctiv/app-core/lib/home-layout';
import { isLayoutId, isScreenId, layoutIdFault } from '@correctiv/app-core/lib/screen-layout';

import {
  layoutFile,
  LAYOUTS_DIR,
  NAVIGATION_TARGET,
  navigationFile,
} from '../src/preview/home/names.ts';
import { formatLayoutDocument } from '../src/preview/home/document.ts';
import { VIA_LINK, type Via } from '../src/preview/submission.ts';
import { checkNavigation, formatNavigationDocument } from '../src/preview/navigation/document.ts';
import type { Repo } from './submission-strings.ts';
import { Refusal, RENDERABLE, shown, withProvenance } from './submission.ts';

/** The path a layout's target writes, or null for a target or a layout there is none for. */
export function fileOf(layout: string, target: string): string | null {
  if (!isLayoutId(layout)) return null;
  if (target === NAVIGATION_TARGET) return navigationFile(layout);
  return isScreenId(target) ? layoutFile(target, layout) : null;
}

/** Whether a path is one this kind may write at all. */
export function mayWriteLayout(path: string): boolean {
  const prefix = `${LAYOUTS_DIR}/`;
  if (!path.startsWith(prefix)) return false;
  const [layout, first, name, ...more] = path.slice(prefix.length).split('/');
  if (!isLayoutId(layout) || more.length > 0) return false;
  if (name === undefined) return first === 'navigation.json';
  const suffix = '.json';
  return first === 'screens' && name.endsWith(suffix) && isScreenId(name.slice(0, -suffix.length));
}

function readEnvelope(payload: string): {
  layout: string;
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
    typeof record['layout'] !== 'string' ||
    typeof record['target'] !== 'string' ||
    !Object.hasOwn(record, 'document') ||
    Object.keys(record).length !== (Object.hasOwn(record, 'via') ? 4 : 3)
  )
    throw new Refusal('layout-target');
  // The one provenance there is (ADR 0076 §3). Anything else is refused and never printed.
  if (Object.hasOwn(record, 'via') && record['via'] !== VIA_LINK) throw new Refusal('provenance');
  const layout = record['layout'];
  if (layoutIdFault(layout) !== null) throw new Refusal('layout-id', layout);
  if (fileOf(layout, record['target']) === null)
    throw new Refusal('layout-target', record['target']);
  // The navigation is the one document that is never deleted: a layout is not without one.
  if (record['document'] === null && record['target'] === NAVIGATION_TARGET)
    throw new Refusal('layout-target', record['target']);
  return {
    layout,
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
  const { layout, target } = readEnvelope(payload);
  return fileOf(layout, target)!;
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
  const { layout: layoutId, target, document } = readEnvelope(payload);
  const file = fileOf(layoutId, target)!;
  // A layout is a folder somebody committed, with its navigation beside the screens. A
  // path into one that is not there would be a layout the deploy cannot join.
  if (readOrNull(repo, navigationFile(layoutId)) === null)
    throw new Refusal('layout-unknown', layoutId);

  if (document === null) {
    const was = readOrNull(repo, file);
    if (was === null) throw new Refusal('unchanged');
    return {
      file,
      content: null,
      summary: [
        `### Der Bildschirm ${shown(target)} wird gelöscht (Layout ${shown(layoutId)})`,
        '',
        `- Die Datei \`screens/${shown(target)}.json\` entfällt, und mit ihr die Adresse \`/s/${shown(target)}\`.`,
        '- Eine Verknüpfung, die auf diesen Bildschirm zeigt, wird nicht mehr gezeichnet.',
      ].join('\n'),
    };
  }

  const found = readOrNull(repo, file);
  // The navigation exists, for the layout was checked above; any other screen may be new.
  const current = found ?? '';

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
        `### Was sich an der Navigation ändert (Layout ${shown(layoutId)})`,
        '',
        `- Vorher: Home, ${shown(before)}`,
        `- Nachher: Home, ${shown(navigation.tabs.join(', '))} (höchstens ${navigation.maxTabs} Tabs, „Mehr“ eingerechnet)`,
      ].join('\n'),
    };
  }

  const screen = target;
  const { layout, problems } = parseHomeLayout(document, RENDERABLE);
  // A screen may hold no block: a screen that is only a heading is a screen (ADR 0075 §7,
  // ADR 0078 §4), and the deploy's check says the same.
  if (!layout || problems.length > 0) {
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
        `### Neuer Bildschirm ${shown(screen)} (Layout ${shown(layoutId)})`,
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
      `### Was sich am Bildschirm ${shown(screen)} ändert (Layout ${shown(layoutId)})`,
      '',
      `- Vorher: ${before.length} Blöcke, ${shown(before.join(', '))}`,
      `- Nachher: ${after.length} Blöcke, ${shown(after.join(', '))}`,
    ].join('\n'),
  };
}
