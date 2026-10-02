import { pinnedArticle } from '../data/home-pins';
import { fetchWpFeed, fetchWpPostById, type FetchWpFeedOptions } from '../services/wp.service';
import type { FeedItem, FeedKey } from '../types/models';
import { termOf, type CategorySetting, type TagSetting } from './home-settings';

/**
 * What a block's rule asks WordPress for, and how a pin finds its post
 * ([ADR 0057](../../../../adr/0057-the-structure-comes-from-the-workbench-the-selection-from-wordpress.md)
 * §2, [ADR 0071](../../../../adr/0071-screens-become-documents-and-the-tab-bar-becomes-one-too.md) §7).
 *
 * The rule is the part that runs unattended, so its default has to be today's output to the
 * letter. `changed` is how a module knows: while it is false the module reads the feed it
 * always read, with the cache and the offline cascade, and this file asks nothing.
 */

/** The category and tag a block's rule reads, as the document holds them or the module defaults. */
export interface Rule {
  readonly categoryId: number | null;
  readonly tagId: number | null;
  /** Whether either differs from what the module draws when nobody has chosen. */
  readonly changed: boolean;
}

type Held = Readonly<Record<string, unknown>> | undefined;

export function ruleOf(
  settings: Held,
  specs: { readonly category?: CategorySetting; readonly tag?: TagSetting },
): Rule {
  const categoryId = specs.category ? termOf(settings, specs.category) : null;
  const tagId = specs.tag ? termOf(settings, specs.tag) : null;
  return {
    categoryId,
    tagId,
    changed:
      categoryId !== (specs.category?.fallback ?? null) || tagId !== (specs.tag?.fallback ?? null),
  };
}

/** The request a rule makes, for `feedQuery` and `fetchWpFeed`. */
export function ruleOptions(rule: Rule): FetchWpFeedOptions {
  return {
    ...(rule.categoryId === null ? {} : { categoryId: rule.categoryId }),
    ...(rule.tagId === null ? {} : { tagId: rule.tagId }),
  };
}

/**
 * The items a changed rule selects, or `null` when WordPress cannot answer or has none.
 *
 * `null` and never a throw or an empty list, so a module falls back to the feed it always
 * had: a wrong category costs the setting, not a hole in the screen (ADR 0036 §8).
 */
export async function fetchRuleItems(feed: FeedKey, rule: Rule): Promise<FeedItem[] | null> {
  try {
    const { items } = await fetchWpFeed(feed, ruleOptions(rule));
    return items.length > 0 ? items : null;
  } catch {
    return null;
  }
}

/**
 * The WordPress id a pin holds, or `null` for a pin that is an address.
 *
 * A live pin is the post's numeric id and nothing else (ADR 0071 §7), so the document
 * names a handle and no content. The sample pins are addresses and keep working.
 */
export function pinPostId(pin: string): number | null {
  return /^[1-9]\d*$/.test(pin) ? Number(pin) : null;
}

/** The id behind a card `toFeedItem` made (`wp-<id>`), which is what a live pin stores. */
export function postIdOf(item: FeedItem): number | null {
  const match = /^wp-(\d+)$/.exec(item.id);
  return match ? Number(match[1]) : null;
}

const fetched = new Map<number, Promise<FeedItem | null>>();

/** A live pin's post, or `null` when it is gone. Asked once per id per session. */
export function loadPinnedPost(pin: string): Promise<FeedItem | null> {
  const id = pinPostId(pin);
  if (id === null) return Promise.resolve(null);
  let held = fetched.get(id);
  if (!held) {
    held = fetchWpPostById(id);
    fetched.set(id, held);
  }
  return held;
}

/**
 * The lead article: the pinned one if it can be found, otherwise the rule's first.
 *
 * `ruled` is what the module's rule selected, `live` what `loadPinnedPost` found (`undefined`
 * while it is still being asked, `null` once it is known to be gone). A pin that nothing
 * answers for falls back to the rule, which is what stops an unpublished article leaving a
 * hole where the lead belongs.
 */
export function leadItem(
  pin: string | null,
  ruled: readonly FeedItem[] | undefined,
  live: FeedItem | null | undefined,
): FeedItem | undefined {
  if (pin !== null) {
    const id = pinPostId(pin);
    const found =
      ruled?.find((item) => item.url === pin || (id !== null && postIdOf(item) === id)) ??
      pinnedArticle(pin) ??
      live;
    if (found) return found;
  }
  return ruled?.[0];
}
