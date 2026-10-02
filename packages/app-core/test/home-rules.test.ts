import { describe, expect, it, vi } from 'vitest';

vi.mock('../src/services/wp.service', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../src/services/wp.service')>()),
  fetchWpFeed: vi.fn(),
  fetchWpPostById: vi.fn(),
}));

import { HOME_PINS } from '../src/data/home-pins';
import {
  fetchRuleItems,
  leadItem,
  loadPinnedPost,
  pinPostId,
  postIdOf,
  ruleOf,
  ruleOptions,
} from '../src/lib/home-rules';
import type { CategorySetting, TagSetting } from '../src/lib/home-settings';
import { feedQuery, fetchWpFeed, fetchWpPostById } from '../src/services/wp.service';
import type { FeedItem } from '../src/types/models';

const FACT_CATEGORY: CategorySetting = { key: 'category', kind: 'category', fallback: 5 };
const NO_CATEGORY: CategorySetting = { key: 'category', kind: 'category', fallback: null };
const TAG: TagSetting = { key: 'tag', kind: 'tag', fallback: null };

const item = (id: string, url = `https://correctiv.org/${id}/`): FeedItem => ({
  id,
  feed: 'recherchen',
  title: id,
  url,
  teaser: '',
  publishedAt: '2026-09-01T00:00:00.000Z',
  categories: [],
  imageUrl: null,
});

describe('a block’s rule, defaults and changes', () => {
  it('reproduces today’s request while nothing is set', () => {
    const rule = ruleOf(undefined, { category: FACT_CATEGORY });
    expect(rule.changed).toBe(false);
    expect(ruleOptions(rule)).toEqual({ categoryId: 5 });
    expect(ruleOf({}, { category: NO_CATEGORY, tag: TAG }).changed).toBe(false);
  });

  it('turns a held category into the categories query, and a tag into the tags query', () => {
    const rule = ruleOf({ category: 172, tag: 2699 }, { category: NO_CATEGORY, tag: TAG });
    expect(rule.changed).toBe(true);
    const query = feedQuery({ ...ruleOptions(rule), perPage: 20 });
    expect(query.get('categories')).toBe('172');
    expect(query.get('tags')).toBe('2699');
  });

  it('asks for no category at all when a held null removes the default one', () => {
    const rule = ruleOf({ category: null }, { category: FACT_CATEGORY });
    expect(rule.changed).toBe(true);
    expect(feedQuery(ruleOptions(rule)).has('categories')).toBe(false);
  });

  it('leaves the plain feed query untouched when no term is asked for', () => {
    const query = feedQuery({ page: 2, perPage: 10 });
    expect(query.has('categories')).toBe(false);
    expect(query.has('tags')).toBe(false);
    expect(query.get('page')).toBe('2');
  });

  it('answers null, not a throw or an empty list, when WordPress fails or has nothing', async () => {
    const rule = ruleOf({ category: 172 }, { category: NO_CATEGORY });
    vi.mocked(fetchWpFeed).mockRejectedValueOnce(new Error('offline'));
    expect(await fetchRuleItems('recherchen', rule)).toBeNull();
    vi.mocked(fetchWpFeed).mockResolvedValueOnce({ items: [], hasMore: false });
    expect(await fetchRuleItems('recherchen', rule)).toBeNull();
    vi.mocked(fetchWpFeed).mockResolvedValueOnce({ items: [item('a')], hasMore: false });
    expect(await fetchRuleItems('recherchen', rule)).toHaveLength(1);
    expect(vi.mocked(fetchWpFeed)).toHaveBeenLastCalledWith('recherchen', { categoryId: 172 });
  });
});

describe('a pin and its fallback to the rule', () => {
  it('tells a live pin (a post id) from a sample pin (an address)', () => {
    expect(pinPostId('287673')).toBe(287673);
    expect(pinPostId(HOME_PINS[0]!.url)).toBeNull();
    expect(pinPostId('0')).toBeNull();
    expect(postIdOf(item('wp-12'))).toBe(12);
    expect(postIdOf(item('https://correctiv.org/?p=1'))).toBeNull();
  });

  const ruled = [item('wp-1'), item('wp-2')];

  it('leads with the rule’s first item when nothing is pinned', () => {
    expect(leadItem(null, ruled, undefined)?.id).toBe('wp-1');
  });

  it('leads with the live post a pin names', () => {
    expect(leadItem('99', ruled, item('wp-99'))?.id).toBe('wp-99');
  });

  it('prefers the feed’s own copy of a pinned post', () => {
    expect(leadItem('2', ruled, item('wp-2', 'stale'))?.id).toBe('wp-2');
    expect(leadItem('2', ruled, item('wp-2', 'stale'))?.url).toBe('https://correctiv.org/wp-2/');
  });

  it('falls back to the rule when the post is gone or not yet found', () => {
    expect(leadItem('99', ruled, null)?.id).toBe('wp-1');
    expect(leadItem('99', ruled, undefined)?.id).toBe('wp-1');
  });

  it('still draws a sample pin by its address', () => {
    expect(leadItem(HOME_PINS[0]!.url, ruled, null)?.url).toBe(HOME_PINS[0]!.url);
  });

  it('is empty rather than throwing when there is neither pin nor rule', () => {
    expect(leadItem('99', undefined, null)).toBeUndefined();
  });

  it('reads a missing post (fetch failed or 404) as null, once per id', async () => {
    vi.mocked(fetchWpPostById).mockResolvedValue(null);
    expect(await loadPinnedPost('4242')).toBeNull();
    expect(await loadPinnedPost('4242')).toBeNull();
    expect(vi.mocked(fetchWpPostById)).toHaveBeenCalledTimes(1);
    expect(await loadPinnedPost(HOME_PINS[0]!.url)).toBeNull();
    expect(vi.mocked(fetchWpPostById)).toHaveBeenCalledTimes(1);
  });
});
