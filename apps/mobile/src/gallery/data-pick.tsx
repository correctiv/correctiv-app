/**
 * Which data a gallery entry is drawn with: its own specimens, a sample variant, or the
 * current fetch.
 *
 * Two groups, because they answer different questions. A **sample** variant is a named
 * specimen from `data/samples/` and the same one every time; **live** is whatever the
 * source returns right now, so it is the one that can surprise (ADR 0072 §4). Each option
 * carries the provenance its source declares, read from `DATA_SOURCES` and from the sample
 * domain rather than decided here, so a source turning live changes the badge with it.
 *
 * The choice travels as one query value, `live` or `<domain>/<variant>`, and an entry with
 * no `pick` simply has no choice. With no value the entry's own `specimens` are drawn,
 * which is what keeps the default view of every entry exactly as it was before this file.
 */
import { useEffect, type ReactNode } from 'react';

import { SAMPLE_DOMAINS } from '@correctiv/app-core/data/samples/domains';
import {
  DATA_SOURCES,
  type DataSourceId,
  type Provenance,
} from '@correctiv/app-core/features/sources';
import type { FeedItem } from '@correctiv/app-core/types/models';

import { Typo } from '@/components/ui';
import { useAppSelector, useCoreActions } from '@/lib/store/core';

import type { Entry, Specimen } from './catalogue';

export interface DataPick {
  /** The sample domain whose variants can be drawn here. */
  domain: string;
  /** The component, given one variant's data. */
  render(data: unknown): ReactNode;
  /** Present only where the core has a current fetch of this model to read. */
  live?: { source: DataSourceId; node: ReactNode };
}

/** A pick for a domain, typed at the one place the payload is known. */
export function pick<T>(domain: string, render: (data: T) => ReactNode): DataPick {
  // The registry's variants are `unknown` by design (a list of different models has no
  // one `T`); the cast is the same boundary `SampleDomainSummary.find` documents.
  return { domain, render: (data) => render(data as T) };
}

/** A pick for articles, which are the one model the feed store can answer live. */
export function pickArticle(render: (item: FeedItem) => ReactNode): DataPick {
  return {
    ...pick<FeedItem>('articles', render),
    live: { source: 'articles', node: <LiveArticle render={render} /> },
  };
}

/**
 * The newest item of the main feed, fetched when this mounts.
 *
 * Self-fetching so the same node works in the gallery and inside the workbench's
 * `AppHost`, where nothing else would load it.
 */
function LiveArticle({ render }: { render: (item: FeedItem) => ReactNode }) {
  const item = useAppSelector((s) => s.feeds.byKey.recherchen.items[0]);
  const status = useAppSelector((s) => s.feeds.byKey.recherchen.status);
  const actions = useCoreActions();
  useEffect(() => {
    void actions.feeds.fetch('recherchen');
  }, [actions]);
  if (item) return <>{render(item)}</>;
  return (
    <Typo variant="text-s" color="on-canvas-muted">
      {status === 'error' || status === 'offline'
        ? 'The feed did not answer.'
        : 'Loading the current feed…'}
    </Typo>
  );
}

export interface DataOption {
  /** What the query carries. */
  value: string;
  kind: 'live' | 'sample';
  /** The variant's name; for live, the source's id. */
  name: string;
  /** The variant's one-line note. Absent for live. */
  note?: string;
  provenance: Provenance;
}

/** The options of an entry, or nothing where it has no choice to offer. */
export function dataOptions(entry: Pick<Entry, 'pick'>): DataOption[] | null {
  const { pick: p } = entry;
  if (!p) return null;
  const options: DataOption[] = [];
  if (p.live) {
    options.push({
      value: 'live',
      kind: 'live',
      name: p.live.source,
      provenance: DATA_SOURCES[p.live.source].provenance,
    });
  }
  const domain = SAMPLE_DOMAINS.find((d) => d.id === p.domain);
  for (const variant of domain?.variants ?? []) {
    options.push({
      value: `${p.domain}/${variant.name}`,
      kind: 'sample',
      name: variant.name,
      note: variant.note,
      provenance: domain?.provenance ?? 'sample',
    });
  }
  return options;
}

/**
 * What to draw for the asked-for value. An unknown or absent value is the entry's own
 * specimens, so a stale link degrades to the page it was before there was a picker.
 */
export function specimensFor(
  entry: Pick<Entry, 'specimens' | 'pick'>,
  asked: string | undefined,
): readonly Specimen[] {
  const { pick: p } = entry;
  if (!p || !asked) return entry.specimens;
  if (asked === 'live') {
    return p.live ? [{ label: 'current fetch', node: p.live.node }] : entry.specimens;
  }
  const [domain, name] = asked.split('/');
  if (domain !== p.domain) return entry.specimens;
  const variant = SAMPLE_DOMAINS.find((d) => d.id === domain)?.find(name);
  return variant ? [{ label: asked, node: p.render(variant.data) }] : entry.specimens;
}

/** The asked-for value if this entry offers it, else nothing. */
export function validChoice(entry: Pick<Entry, 'pick'>, asked: string | undefined) {
  return dataOptions(entry)?.some((o) => o.value === asked) ? asked : undefined;
}
