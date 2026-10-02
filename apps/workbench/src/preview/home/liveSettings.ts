import { useEffect, useState } from 'react';

import { FEED_PRIORITY } from '@correctiv/app-core/data/feeds.config';
import {
  fetchWpPostById,
  fetchWpTerms,
  searchWpPosts,
  type WpTerm,
} from '@correctiv/app-core/services/wp.service';
import { postIdOf } from '@correctiv/app-core/lib/home-rules';
import type { FeedItem } from '@correctiv/app-core/types/models';

/**
 * What the settings panel asks WordPress, as hooks.
 *
 * ADR 0071 §7: a pin is chosen from a live search and stores the post's id, and a rule's
 * category or tag is chosen from the live taxonomy. Each answer is `null` while it is being
 * asked and `[]` when it failed, so the panel can keep showing the sample pins and the
 * rule's default when the network is not there.
 */

/** A search is only sent after the typing has paused. */
const PAUSE_MS = 300;

function useDebounced(value: string): string {
  const [held, setHeld] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setHeld(value), PAUSE_MS);
    return () => clearTimeout(timer);
  }, [value]);
  return held;
}

/** Live posts matching a query, newest relevance first; `null` while asking. */
export function useLivePosts(query: string): readonly FeedItem[] | null {
  const asked = useDebounced(query.trim());
  const [found, setFound] = useState<{ query: string; items: FeedItem[] } | null>(null);

  useEffect(() => {
    if (asked.length < 2) return;
    let live = true;
    searchWpPosts(asked, 8, FEED_PRIORITY).then(
      (items) => live && setFound({ query: asked, items }),
      () => live && setFound({ query: asked, items: [] }),
    );
    return () => {
      live = false;
    };
  }, [asked]);

  if (asked.length < 2) return [];
  return found?.query === asked ? found.items : null;
}

/** The title of a stored live pin, which is only an id in the document. */
export function useLivePostTitle(pin: unknown): string | null {
  const id = typeof pin === 'string' && /^[1-9]\d+$/.test(pin) ? Number(pin) : null;
  const [item, setItem] = useState<{ id: number; item: FeedItem | null } | null>(null);

  useEffect(() => {
    if (id === null) return;
    let live = true;
    void fetchWpPostById(id).then((found) => live && setItem({ id, item: found }));
    return () => {
      live = false;
    };
  }, [id]);

  return item?.id === id && item.item && postIdOf(item.item) === id ? item.item.title : null;
}

/** Categories or tags, most used first; `search` is WordPress's own. `null` while asking. */
export function useTerms(taxonomy: 'categories' | 'tags', query: string): readonly WpTerm[] | null {
  const asked = useDebounced(query.trim());
  const [found, setFound] = useState<{ key: string; terms: WpTerm[] } | null>(null);
  const key = `${taxonomy}:${asked}`;

  useEffect(() => {
    let live = true;
    fetchWpTerms(taxonomy, { search: asked || undefined }).then(
      (terms) => live && setFound({ key, terms }),
      () => live && setFound({ key, terms: [] }),
    );
    return () => {
      live = false;
    };
  }, [taxonomy, asked, key]);

  return found?.key === key ? found.terms : null;
}
