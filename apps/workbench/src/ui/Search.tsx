import { Command } from 'cmdk';
import { Component, FileText, Hash, LayoutGrid, Braces } from 'lucide-react';
import { useMemo } from 'react';

import api from 'virtual:api';
import docsModule from 'virtual:docs';
import { navigate } from '../router';
import { PAGE_TITLES, symbolId } from '../nav';

interface Entry {
  route: string;
  title: string;
  kind: string;
  hint: string;
  group: 'Pages' | 'Documents' | 'Sections' | 'Reference' | 'Components';
}

interface Props {
  open: boolean;
  onClose: () => void;
}

/**
 * One palette over everything the site holds.
 *
 * Documents, every heading inside them, the pages, every symbol the core
 * exports and every component the app is built from. The last two are the
 * reason it is one palette rather than three: looking something up should not
 * require first knowing whether it is prose, a library or a screen's vocabulary.
 * They stay separate GROUPS, though, because `Button` is a component and no
 * amount of searching makes it importable from the core.
 */
function buildIndex(): Entry[] {
  const entries: Entry[] = [];

  for (const [route, title] of Object.entries(PAGE_TITLES)) {
    entries.push({ route, title, kind: 'Page', hint: '', group: 'Pages' });
  }

  for (const module of api.core.modules) {
    for (const symbol of module.symbols) {
      entries.push({
        route: `/reference#${symbolId(module.subpath, symbol.name)}`,
        title: symbol.name,
        kind: `${symbol.kind} · ${module.subpath}`,
        hint: symbol.summary,
        group: 'Reference',
      });
    }
  }

  for (const group of api.components.groups) {
    for (const component of group.components) {
      entries.push({
        // The component's own page, not an anchor on the overview: there is one
        // per component now, and it is where the props and both renderings are.
        route: `/components/${group.name}/${component.name}`,
        title: component.name,
        // The folder, and the platform where the folder holds a split: two rows
        // called `VideoFrame` are otherwise one row typed twice.
        kind: `${group.name}${component.platform ? ` · ${component.platform}` : ''}`,
        hint: component.summary,
        group: 'Components',
      });
    }
  }

  for (const doc of docsModule.docs) {
    const record = doc.route.startsWith('/decisions/') ? doc.route.slice(11) : null;
    entries.push({
      route: doc.route,
      title: doc.title,
      kind: record ? `ADR ${record}` : 'Document',
      hint: doc.blurb,
      group: 'Documents',
    });
    for (const heading of doc.headings) {
      if (heading.depth < 2 || heading.depth > 3) continue;
      entries.push({
        route: `${doc.route}#${heading.id}`,
        title: heading.text,
        kind: record ? `ADR ${record}` : doc.title,
        hint: '',
        group: 'Sections',
      });
    }
  }

  return entries;
}

const ICONS = {
  Pages: LayoutGrid,
  Documents: FileText,
  Sections: Hash,
  Reference: Braces,
  Components: Component,
} as const;

export function Search({ open, onClose }: Props) {
  const index = useMemo(buildIndex, []);
  const groups = useMemo(
    () =>
      (['Pages', 'Documents', 'Reference', 'Components', 'Sections'] as const).map((group) => ({
        group,
        entries: index.filter((entry) => entry.group === group),
      })),
    [index],
  );

  /*
   * Three class names, three elements, and they are not interchangeable.
   *
   * `Command.Dialog` portals the backdrop and the panel as SIBLINGS on `body`,
   * then puts the command root inside the panel. So the backdrop and the panel
   * each need their own `fixed` and their own place, and `className`, which lands
   * on the root, must carry no layout at all. It carried the backdrop's before:
   * a `fixed inset-0` root escaped the panel it was inside, which collapsed the
   * panel to two pixels and left the list standing on the page with no ground
   * under it.
   */
  return (
    <Command.Dialog
      loop
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      label="Search the workbench"
      overlayClassName="fixed inset-0 z-50 bg-black/50 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0"
      contentClassName="fixed left-1/2 top-[12vh] z-50 w-[min(40rem,92vw)] -translate-x-1/2 overflow-hidden rounded-lg border border-stroke bg-canvas shadow-2xl duration-150 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 data-[state=open]:slide-in-from-top-2 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95"
    >
      <Command.Input
        autoFocus
        placeholder="Search documents, sections, the core's API and the components"
        className="w-full border-b border-stroke bg-transparent px-sm py-s text-m text-on-canvas outline-none placeholder:text-on-canvas-muted"
      />
      <Command.List className="max-h-[min(24rem,60vh)] overflow-y-auto p-xs">
        <Command.Empty className="px-s py-m text-center text-m text-on-canvas-muted">
          Nothing matches that.
        </Command.Empty>

        {groups.map(({ group, entries }) => {
          const Icon = ICONS[group];
          return (
            <Command.Group
              key={group}
              heading={group}
              className="[&_[cmdk-group-heading]]:px-xs [&_[cmdk-group-heading]]:py-2xs [&_[cmdk-group-heading]]:text-s [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:text-on-canvas-muted"
            >
              {entries.map((entry) => (
                <Command.Item
                  key={entry.route}
                  value={`${entry.title} ${entry.kind} ${entry.hint}`}
                  onSelect={() => go(entry.route, onClose)}
                  className="flex cursor-pointer items-center gap-xs rounded-md px-xs py-2xs text-m text-on-canvas data-[selected=true]:bg-surface"
                >
                  <Icon
                    aria-hidden="true"
                    className="size-[0.875rem] shrink-0 text-on-canvas-muted"
                  />
                  <span className="truncate font-medium">{entry.title}</span>
                  <span className="ml-auto truncate pl-s font-mono text-s text-on-canvas-muted">
                    {entry.kind}
                  </span>
                </Command.Item>
              ))}
            </Command.Group>
          );
        })}
      </Command.List>
    </Command.Dialog>
  );
}

function go(route: string, onClose: () => void): void {
  const [path, hash] = route.split('#');
  onClose();
  navigate(path);
  if (hash) {
    requestAnimationFrame(() => {
      const target = document.getElementById(hash);
      // A symbol's prose lives in a closed disclosure, so landing on a shut one
      // looks like the search found a heading and nothing else.
      if (target instanceof HTMLDetailsElement) target.open = true;
      target?.scrollIntoView({ block: 'center' });
    });
  }
}
