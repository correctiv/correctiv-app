import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { collectDocs, ROOT } from '../plugin/collect.ts';
import { DIAGRAMS } from '../src/diagrams';
import {
  PAGE_ROUTES,
  resolveView,
  SECTION_TITLES,
  VIEWS,
  type ViewDeclaration,
  type ViewKind,
} from '../src/shell/views.ts';

const PAGES = join(ROOT, 'apps/workbench/src/pages');
const { module } = collectDocs();
const DOCUMENT_ROUTES = module.docs.map((d) => d.route);
const isDocument = (route: string) => DOCUMENT_ROUTES.includes(route);

/**
 * Which page serves which view, which is the one thing this contract cannot
 * infer.
 *
 * `shell/views.ts` says what a route offers and `App.tsx` chooses the component,
 * so the join between them lives in exactly one place each and this list is the
 * third. It is here rather than in `src/` because it exists for the assertion
 * below: a page with a `Slot` the table has no place for, or a declared section
 * nobody fills, is a right sidebar with an empty box in it and nothing in the
 * build would say so.
 */
const SERVES: Record<string, ViewKind[]> = {
  'Landing.tsx': ['landing'],
  'Handbook.tsx': ['handbook'],
  'DiagramIndex.tsx': ['diagrams'],
  'DiagramView.tsx': ['diagram'],
  'Document.tsx': ['document'],
  'Reference.tsx': ['reference'],
  'Strings.tsx': ['strings'],
  'Sources.tsx': ['sources'],
  'Decisions.tsx': ['decisions'],
  'Design.tsx': ['design'],
  'Components.tsx': ['components'],
  'ComponentDetail.tsx': ['component'],
  'Preview.tsx': ['preview'],
};

/** Every slot a declaration offers: the bodies, their optional marks, the two others. */
function allowed(view: ViewDeclaration): Set<string> {
  const ids = new Set<string>();
  for (const section of view.sections) {
    ids.add(section);
    ids.add(`${section}:mark`);
  }
  if (view.contextBar) ids.add('context-bar');
  if (view.statusBar) ids.add('status');
  return ids;
}

/** Every `<Slot id="…">` in a page, read as text so no React is imported. */
function slotsIn(file: string): string[] {
  const source = readFileSync(join(PAGES, file), 'utf8');
  return [...source.matchAll(/<Slot id="([^"]+)"/g)].map((hit) => hit[1]);
}

describe('the shell’s contract with its pages', () => {
  it('resolves every route the site publishes to a declaration', () => {
    const routes = [
      ...PAGE_ROUTES,
      ...DOCUMENT_ROUTES,
      ...DIAGRAMS.map((diagram) => `/diagrams/${diagram.id}`),
      '/components/ui/Card',
      '/components/media/VideoFrame',
    ];

    const unresolved = routes.filter(
      (route) => resolveView(route, isDocument(route)).view.kind === 'not-found',
    );

    expect(unresolved).toEqual([]);
  });

  it('answers an address it publishes nothing at with the not-found view', () => {
    expect(resolveView('/nowhere', false).view.kind).toBe('not-found');
    // Two segments under `/components` is a component; one or three is not.
    expect(resolveView('/components/ui', false).view.kind).toBe('not-found');
    expect(resolveView('/components/ui/Card/props', false).view.kind).toBe('not-found');
  });

  it('reads the component route’s two segments', () => {
    expect(resolveView('/components/ui/Card', false).params).toEqual({
      group: 'ui',
      name: 'Card',
    });
  });

  /**
   * A declaration nothing can fill is four empty boxes, and only the route knows.
   *
   * `/components/ui/NotAThing` matched the component view on its shape alone, so
   * the shell opened a panel with `Rendering`, `Device`, `Props` and `Source` in
   * it and a blank status line, while the page returned early with a sentence.
   * The assertion above about pages and slots cannot see that: the slots are in
   * the file, and the render never reached them.
   */
  it('answers a component the app has not got with the not-found view', () => {
    const has = (group: string, name: string) => `${group}/${name}` === 'ui/Card';

    expect(resolveView('/components/ui/Card', false, has).view.kind).toBe('component');
    expect(resolveView('/components/ui/NotAThing', false, has).view.kind).toBe('not-found');
  });

  /**
   * The collision this pair exists for.
   *
   * `/sources` is a board built from the manifest and `SOURCES.md` is the record
   * it is built from; both wanted the same address, and a router that prefers its
   * own pages simply stopped publishing the document — no error, no warning, a
   * page that renders and a document that has left the site. `/design` and
   * `/design/plugin` are the same shape and are now a real pair, so they are held
   * here by name.
   */
  it('never lets a page shadow a document', () => {
    const shadowed = PAGE_ROUTES.filter((route) => isDocument(route));
    expect(shadowed).toEqual([]);
  });

  it('publishes the plugin document under the design page without shadowing it', () => {
    expect(isDocument('/design/plugin')).toBe(true);
    expect(resolveView('/design', false).view.kind).toBe('design');
    expect(resolveView('/design/plugin', true).view.kind).toBe('document');
  });

  it('keeps the table and the pages in step', () => {
    const wrong: string[] = [];

    for (const [file, kinds] of Object.entries(SERVES)) {
      const filled = new Set(slotsIn(file));
      for (const kind of kinds) {
        const view = VIEWS[kind];
        const offered = allowed(view);

        for (const id of filled) {
          if (!offered.has(id)) wrong.push(`${file} fills "${id}", which ${kind} does not declare`);
        }
        for (const section of view.sections) {
          if (!filled.has(section)) wrong.push(`${file} leaves "${section}" empty on ${kind}`);
        }
        if (view.contextBar && !filled.has('context-bar')) {
          wrong.push(`${file} declares a context bar on ${kind} and fills none`);
        }
        if (view.statusBar && !filled.has('status')) {
          wrong.push(`${file} owns the status line on ${kind} and fills none`);
        }
      }
    }

    expect(wrong).toEqual([]);
  });

  it('gives a page for every kind and a kind for every page', () => {
    const served = new Set(Object.values(SERVES).flat());
    const kinds = Object.keys(VIEWS) as ViewKind[];
    // `not-found` is the shell's own body, not a page file.
    expect(kinds.filter((kind) => kind !== 'not-found' && !served.has(kind))).toEqual([]);
  });

  it('names a panel exactly when it has one, and lists each tool once', () => {
    const wrong: string[] = [];
    for (const view of Object.values(VIEWS)) {
      if ((view.panelTitle === null) !== (view.sections.length === 0)) {
        wrong.push(`${view.kind}: a panel title and a panel have to arrive together`);
      }
      // The rail draws one button per entry and the address names one of them,
      // so a repeat would be two buttons that cannot be told apart in a link.
      if (new Set(view.sections).size !== view.sections.length) {
        wrong.push(`${view.kind} lists a tool twice`);
      }
      if (view.fullWhenNarrow && !view.canGoFull) {
        wrong.push(`${view.kind} arrives full on a small screen and cannot go full`);
      }
    }
    expect(wrong).toEqual([]);
  });

  it('names every section it can put in the URL', () => {
    const declared = new Set(Object.values(VIEWS).flatMap((view) => view.sections));
    expect([...declared].filter((id) => !SECTION_TITLES[id])).toEqual([]);
  });
});
