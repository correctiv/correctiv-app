import {
  closeOf,
  decodeEntities,
  escapeHtml,
  pairedTags,
  stripTags,
  tags,
  type ElementSpan,
  type Tag,
} from '../lib/html';

/**
 * The blocks in a correctiv.org article body that are not article text, and what
 * the reader does with each one.
 *
 * One table, read by two interpreters. A body reaches the reader three ways, the
 * REST API's `content.rendered` and the page through either extractor, and they
 * were cleaned by a denylist (two of them) or an allowlist (the third), neither of
 * which knew what a block was. So an ad came through as article paragraphs on the page path, the
 * theme's own header printed the title a second time on the REST path, and an
 * accordion's title was dropped on all three, because it sits inside a `<button>`
 * and every cleaner removes buttons with their contents. Measured over the 300 most
 * recent posts and two full pages on 2026-09-24.
 *
 * A rule names the block by a marker the markup already carries (a class token or
 * an attribute) and says what happens: `drop` removes it with everything inside,
 * `unwrap` keeps its contents and loses the element, `details` rebuilds it as an
 * HTML disclosure. `applyBlockRules` below does that over a string, for the REST
 * body and for `extract/string.ts`; `extract/dom.ts` walks its parsed tree with the
 * same table. `test/articles.test.ts` holds both to the same pages.
 *
 * What is not in the table is kept and left to the cleaner behind it. Order
 * matters: the first rule a tag matches decides, so a rule that only catches what
 * an earlier one could not use comes after it.
 */

/** How a block is recognised: a token of its `class`, or an attribute it carries. */
export type BlockMarker = { class: string } | { attribute: string };

export type BlockRule =
  | { block: string; marker: BlockMarker; action: 'drop' }
  | { block: string; marker: BlockMarker; action: 'unwrap' }
  | {
      block: string;
      marker: BlockMarker;
      action: 'details';
      /** The element whose text becomes the `<summary>`. */
      summary: BlockMarker;
      /** The element whose contents become the rest of the `<details>`. */
      panel: BlockMarker;
    };

/**
 * The prefix this site gave Advanced Ads, which the plugin writes in front of
 * every class it prints (`corre-entity-placement`, `corre-target`).
 *
 * It is a setting, not the plugin's name, so a page is asked first: the plugin
 * puts `aa-prefix-<prefix>` on `<body>`. A REST body has no `<body>`, and this is
 * what the site had on 2026-09-24.
 */
export const DEFAULT_AD_PREFIX = 'corre-';

/** The Advanced Ads prefix a whole page declares, or the default. */
export function adPrefixOf(page: string): string {
  const bodyClass = /<body\b[^>]*\bclass=["']([^"']*)["']/i.exec(page)?.[1] ?? '';
  return /(?:^|\s)aa-prefix-(\S+)/.exec(bodyClass)?.[1] ?? DEFAULT_AD_PREFIX;
}

/** The rules for one page, with the ad markers under the prefix it declares. */
export function articleBlockRules(adPrefix: string = DEFAULT_AD_PREFIX): readonly BlockRule[] {
  return [
    /**
     * An Advanced Ads placement: `<div class="<prefix><slug> <prefix>entity-placement">`
     * around the ad itself. Four on the measured page (a petition, a box of related
     * articles, a book, the fundraiser), and their text read as the article's own
     * paragraphs.
     *
     * The REST body carries them too, and how often depends on who asks. Fetched
     * with curl, one post of 300 had one in `content.rendered`. Fetched with a
     * browser's User-Agent the same day, post 287636 had two, where curl saw none:
     * the site switches ads off for bots (`aa-disabled-bots` on `<body>`), and a
     * sample taken by a script is taken as one. The app is not a script, so this
     * rule is for most articles on the REST path and not for the odd one.
     */
    { block: 'ad placement', marker: { class: `${adPrefix}entity-placement` }, action: 'drop' },
    /**
     * `cvui/header-post`, the theme's article header written INTO the body: the
     * topline, an `<h1>`, the excerpt, the byline and the date, all of which the
     * reader prints above the body already, and in its `full-width` variant a video
     * that `heroVideoOf` carries out as the hero. One post of 300.
     */
    { block: 'cvui/header-post', marker: { class: 'wp-block-cvui-header-post' }, action: 'drop' },
    /**
     * `cvui/interactive-list`, one accordion item: the title is the text of a
     * `<button>` inside an `<h3>` and the contents are a sibling panel. Rebuilt as
     * `<details>`, which opens without a script, and the reader document has none.
     * 15 posts of 300.
     */
    {
      block: 'cvui/interactive-list item',
      marker: { attribute: 'data-cvui-interactive-list-item' },
      action: 'details',
      summary: { attribute: 'data-cvui-interactive-list-toggle' },
      panel: { attribute: 'data-cvui-interactive-list-panel' },
    },
    /**
     * A toggle the rule above did not use, because its item had no panel or could
     * not be balanced. Unwrapped so the title survives as the heading's text,
     * which is less than a disclosure and more than the empty `<h3>` a cleaner
     * leaves when it drops the button.
     */
    {
      block: 'cvui/interactive-list toggle',
      marker: { attribute: 'data-cvui-interactive-list-toggle' },
      action: 'unwrap',
    },
    /**
     * `cvui/infobox`: the box is clipped to 100 px by an inline style and a button
     * lifts it. The text worth keeping is all in the panel, which is unwrapped so its
     * clipping style goes with it. The button says nothing but "Mehr anzeigen" to a
     * screen reader, in all 7 infoboxes of 300 posts, and has no rule: every cleaner
     * behind this table drops a `<button>` with its contents, which is the very
     * habit the accordion rule above exists to get ahead of.
     */
    {
      block: 'cvui/infobox panel',
      marker: { attribute: 'data-cvui-infobox-panel' },
      action: 'unwrap',
    },
  ];
}

/**
 * Whether an element carries the marker, from its attributes as a parser gives
 * them. The one test both interpreters make, so they cannot disagree about what a
 * block is: `extract/dom.ts` hands it an element's `attribs`, and this file the
 * attributes `tags` read, unquoted values and a `>` inside quotes included.
 */
export function carries(attrs: Record<string, string>, marker: BlockMarker): boolean {
  if ('attribute' in marker) return Object.prototype.hasOwnProperty.call(attrs, marker.attribute);
  return (attrs.class ?? '').split(/\s+/).includes(marker.class);
}

/**
 * Apply the rules to a body as a string.
 *
 * The same outcome as `extract/dom.ts` for every block in the table, which is what
 * lets both backends promise the same reader. One walk over the tags, with every
 * element's end found in the same pass (`pairedTags`), so a block that nests
 * `<div>`s is cut whole and the time grows with the body and not with its square.
 * The first rule a tag matches decides, and an element is decided before what is
 * inside it, as in the DOM interpreter. An element whose end is not in the markup
 * is left alone rather than given a guessed one, and the walk goes on past its
 * opening tag, so one broken placement does not let the next one through.
 */
export function applyBlockRules(body: string, rules: readonly BlockRule[]): string {
  const { list, close } = pairedTags(body);
  /** Closing tags of unwrapped elements, left out when the walk reaches them. */
  const unwrapped = new Set<Tag>();
  let out = '';
  let cursor = 0; // everything before this is already in `out`, or deliberately not
  for (const tag of list) {
    if (tag.start < cursor) continue;
    if (tag.closing) {
      if (unwrapped.has(tag)) {
        out += body.slice(cursor, tag.start);
        cursor = tag.end;
      }
      continue;
    }
    const rule = rules.find((r) => carries(tag.attrs, r.marker));
    const end = rule ? close.get(tag) : undefined;
    if (!rule || !end) continue;
    if (rule.action === 'unwrap') {
      out += body.slice(cursor, tag.start);
      cursor = tag.end;
      unwrapped.add(end);
      continue;
    }
    const replacement =
      rule.action === 'drop' ? '' : details(body.slice(tag.end, end.start), rule, rules);
    if (replacement === null) continue; // not rebuilt; what is inside gets its own rules
    out += body.slice(cursor, tag.start) + replacement;
    cursor = end.end;
  }
  return out + body.slice(cursor);
}

/** An accordion item as `<details>`, or null when it lacks a title or a panel. */
function details(
  inner: string,
  rule: Extract<BlockRule, { action: 'details' }>,
  rules: readonly BlockRule[],
): string | null {
  const summary = markedElement(inner, rule.summary);
  const panel = markedElement(inner, rule.panel);
  if (!summary || !panel) return null;
  const title = stripTags(inner.slice(summary.innerStart, summary.innerEnd));
  const contents = applyBlockRules(inner.slice(panel.innerStart, panel.innerEnd), rules);
  return `<details><summary>${escapeHtml(title)}</summary>${contents}</details>`;
}

/** The first balanced element in `html` that carries the marker. */
function markedElement(html: string, marker: BlockMarker): ElementSpan | null {
  for (const tag of tags(html)) {
    if (tag.closing || !carries(tag.attrs, marker)) continue;
    const el = closeOf(html, tag);
    if (!('unbalanced' in el)) return el;
  }
  return null;
}

const HEADER_POST: BlockMarker = { class: 'wp-block-cvui-header-post' };

/** What a `cvui/header-post` block carries that the reader keeps. */
export interface HeaderPost {
  /** The looping video of its `full-width` variant, http or https only. */
  videoUrl?: string;
  /** Every author it names, in its order. Empty without the block. */
  authors: string[];
}

/**
 * What the reader keeps of a `cvui/header-post` block before the rules drop it.
 *
 * The video: the block renders one `<video src>` in its `full-width` variant and
 * nothing else that moves, no poster and no second format (`render.php` in the
 * theme's component system). The address is resolved against correctiv.org and
 * kept only if it is http or https, because it goes into the reader document as a
 * `src` and a `javascript:` there is the page's to run.
 *
 * The authors: the block's byline is the links to `/team/<person>/` in it, all of
 * them. The REST API's `yoast_head_json.author` names one person, so the reader
 * printed "von Silvia Stöber" over post 287636, which is by Alexej Hock and Silvia
 * Stöber; and a page with this block has no `detail__authors` at all. Measured on
 * 2026-09-24.
 */
export function headerPostOf(html: string): HeaderPost {
  for (const tag of tags(html)) {
    if (tag.closing || !carries(tag.attrs, HEADER_POST)) continue;
    const el = closeOf(html, tag);
    return readHeaderPost(html, tag.end, 'unbalanced' in el ? html.length : el.innerEnd);
  }
  return { authors: [] };
}

/** `headerPostOf(html).videoUrl`. */
export function heroVideoOf(html: string): string | undefined {
  return headerPostOf(html).videoUrl;
}

function readHeaderPost(html: string, from: number, to: number): HeaderPost {
  let videoUrl: string | undefined;
  const authors: string[] = [];
  let authorStart = -1;
  for (const tag of tags(html, from)) {
    if (tag.start >= to) break;
    if (!tag.closing && (tag.name === 'video' || tag.name === 'source') && !videoUrl) {
      videoUrl = tag.attrs.src ? safeVideoUrl(tag.attrs.src) : undefined;
    } else if (!tag.closing && tag.name === 'a' && /\/team\/[^/]/.test(tag.attrs.href ?? '')) {
      authorStart = tag.end;
    } else if (tag.closing && tag.name === 'a' && authorStart >= 0) {
      const name = stripTags(html.slice(authorStart, tag.start));
      if (name && !authors.includes(name)) authors.push(name);
      authorStart = -1;
    }
  }
  return { videoUrl, authors };
}

function safeVideoUrl(raw: string): string | undefined {
  let url: URL;
  try {
    url = new URL(decodeEntities(raw).trim(), 'https://correctiv.org/');
  } catch {
    return undefined;
  }
  return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : undefined;
}
