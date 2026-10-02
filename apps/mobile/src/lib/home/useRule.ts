import { useEffect, useState } from 'react';

import { fetchRuleItems, loadPinnedPost, type Rule } from '@correctiv/app-core/lib/home-rules';
import type { FeedItem, FeedKey } from '@correctiv/app-core/types/models';

/**
 * What a block's rule selects when the document changed it, else the feed the block always
 * read. `undefined` while a changed rule is still being asked, and the plain feed's answer
 * when WordPress has none, so a wrong category never leaves a hole (ADR 0036 §8).
 */
export function useRuleItems(
  feed: FeedKey,
  rule: Rule,
  plain: readonly FeedItem[] | undefined,
): readonly FeedItem[] | undefined {
  const [asked, setAsked] = useState<{ key: string; items: FeedItem[] | null } | null>(null);
  const key = `${feed}:${rule.categoryId}:${rule.tagId}`;

  useEffect(() => {
    if (!rule.changed) return;
    let live = true;
    void fetchRuleItems(feed, rule).then((items) => {
      if (live) setAsked({ key, items });
    });
    return () => {
      live = false;
    };
    // `rule` is rebuilt every render; its two ids are what `key` carries.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [feed, key, rule.changed]);

  if (!rule.changed) return plain;
  if (asked?.key !== key) return undefined;
  return asked.items ?? plain;
}

/** A live pin's post: `undefined` while asked, `null` when gone or when the pin is an address. */
export function useLivePin(pin: string | null): FeedItem | null | undefined {
  const [found, setFound] = useState<{ pin: string; item: FeedItem | null } | null>(null);

  useEffect(() => {
    if (pin === null) return;
    let live = true;
    void loadPinnedPost(pin).then((item) => {
      if (live) setFound({ pin, item });
    });
    return () => {
      live = false;
    };
  }, [pin]);

  if (pin === null) return null;
  return found?.pin === pin ? found.item : undefined;
}
