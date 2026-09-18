import { Command } from 'cmdk';
import { Component, FileText, Hash, LayoutGrid, Braces } from 'lucide-react';
import { useMemo } from 'react';
import { defineMessages } from 'react-intl';

import api from 'virtual:api';
import docsModule from 'virtual:docs';
import { useWorkbenchIntl } from '../i18n/Localisation';
import { navigate } from '../router';
import { PAGE_TITLES, pageTitleText, symbolId } from '../nav';
import type { WorkbenchMessage } from '../i18n/messages';

/**
 * What the palette says about itself, in ENGLISH; the German that ships is
 * `src/i18n/catalogue/de/shell.ts`.
 *
 * The furniture only. Every ROW in here is something the repository wrote — a
 * document's title, a heading inside it, a symbol the core exports, a component's
 * name and its summary — and ADR 0050 §2 leaves all of that in the language it was
 * written in. What is translated is the frame around it: what to type, what to do
 * when nothing matches, and what the five groups are called.
 *
 * `kind` is the one mixed column. `Page` and `Document` are this site classifying
 * a row and are here; `ADR 0050`, a symbol's kind and a component's folder are the
 * repository's own words and are not.
 */
const COPY = defineMessages({
  dialog: {
    id: 'shell.search.dialog',
    defaultMessage: 'Search the workbench',
    description:
      'The accessible name of the palette itself. shell.header.search is the button that opens it, which is named the same and is a different element.',
  },
  placeholder: {
    id: 'shell.search.placeholder',
    defaultMessage: 'Search documents, sections, the core’s API and the components',
    description:
      'In the empty field at the top of the palette, naming the five things it searches at once.',
  },
  empty: {
    id: 'shell.search.empty',
    defaultMessage: 'Nothing matches that.',
    description: 'Stands in for the list while what has been typed matches no row.',
  },
  page: {
    id: 'shell.search.kind.page',
    defaultMessage: 'Page',
    description:
      'Drawn at the right of a row for a page this site answers itself, as against a document rendered from the repository’s Markdown.',
  },
  document: {
    id: 'shell.search.kind.document',
    defaultMessage: 'Document',
    description:
      'Drawn at the right of a row for a Markdown document that is not a decision record. A record says ADR and its number instead, which is not translated.',
  },
});

/**
 * What each group of results is called, keyed by the group itself.
 *
 * A `Record` named for its domain rather than folded into `COPY`, which is the
 * convention for a table of labels over a type's values. The KEY stays English and
 * is never drawn: it is what `ICONS` and `Entry.group` are keyed by, and a
 * translated key would be a lookup that misses.
 */
const GROUP_LABELS = defineMessages({
  Pages: { id: 'shell.search.group.pages', defaultMessage: 'Pages' },
  Documents: { id: 'shell.search.group.documents', defaultMessage: 'Documents' },
  Sections: {
    id: 'shell.search.group.sections',
    defaultMessage: 'Sections',
    description:
      'The group of headings found inside documents. shell.activity.label is the rail down the left edge, which is named the same and holds the sections of the SITE rather than of a document.',
  },
  Reference: {
    id: 'shell.search.group.reference',
    defaultMessage: 'Reference',
    description:
      'The group of symbols the core exports. shell.activity.reference is the rail entry that opens that page and reads the same in English.',
  },
  Components: {
    id: 'shell.search.group.components',
    defaultMessage: 'Components',
    description:
      'The group of the app’s own components. shell.activity.components is the rail entry that opens that page and reads the same in English.',
  },
});

interface Entry {
  route: string;
  title: string;
  kind: string;
  hint: string;
  group: keyof typeof GROUP_LABELS;
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
function buildIndex(format: (message: WorkbenchMessage) => string): Entry[] {
  const entries: Entry[] = [];
  const page = format(COPY.page);
  const document = format(COPY.document);

  // A page's name follows the language setting and a document's does not, which
  // is what `pageTitleText` resolves; everything below this loop is the
  // repository's own words and is indexed as written.
  for (const [route, title] of Object.entries(PAGE_TITLES)) {
    entries.push({
      route,
      title: pageTitleText(title, format),
      kind: page,
      hint: '',
      group: 'Pages',
    });
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
      kind: record ? `ADR ${record}` : document,
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
  const intl = useWorkbenchIntl();
  const index = useMemo(() => buildIndex((message) => intl.formatMessage(message)), [intl]);
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
      label={intl.formatMessage(COPY.dialog)}
      overlayClassName="fixed inset-0 z-50 bg-black/50 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0"
      contentClassName="fixed left-1/2 top-[12vh] z-50 w-[min(40rem,92vw)] -translate-x-1/2 overflow-hidden rounded-lg border border-stroke bg-canvas shadow-2xl duration-150 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 data-[state=open]:slide-in-from-top-2 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95"
    >
      <Command.Input
        autoFocus
        placeholder={intl.formatMessage(COPY.placeholder)}
        className="w-full border-b border-stroke bg-transparent px-sm py-s text-m text-on-canvas outline-none placeholder:text-on-canvas-muted"
      />
      <Command.List className="max-h-[min(24rem,60vh)] overflow-y-auto p-xs">
        <Command.Empty className="px-s py-m text-center text-m text-on-canvas-muted">
          {intl.formatMessage(COPY.empty)}
        </Command.Empty>

        {groups.map(({ group, entries }) => {
          const Icon = ICONS[group];
          return (
            <Command.Group
              key={group}
              heading={intl.formatMessage(GROUP_LABELS[group])}
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
