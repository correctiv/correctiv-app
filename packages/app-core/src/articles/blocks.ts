import { balancedBlock, balancedElement, decodeEntities, escapeHtml, stripTags } from '../lib/html';

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
 * matters: the string interpreter runs one rule over the whole body before the
 * next, so a rule that only catches what an earlier one could not use comes after.
 */

/** How a block is recognised: a token of its `class`, or an attribute it carries. */
export type BlockMarker = { class: string } | { attribute: string };

export type BlockRule = { block: string; marker: BlockMarker } & (
  | { action: 'drop' | 'unwrap' }
  | {
      action: 'details';
      /** The element whose text becomes the `<summary>`. */
      summary: BlockMarker;
      /** The element whose contents become the rest of the `<details>`. */
      panel: BlockMarker;
    }
);

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
     * lifts it. The button says nothing but "Mehr anzeigen" to a screen reader, in
     * all 7 infoboxes of 300 posts; the text worth keeping is all in the panel,
     * which is unwrapped so its clipping style goes with it.
     */
    {
      block: 'cvui/infobox toggle',
      marker: { attribute: 'data-cvui-infobox-toggle' },
      action: 'drop',
    },
    {
      block: 'cvui/infobox panel',
      marker: { attribute: 'data-cvui-infobox-panel' },
      action: 'unwrap',
    },
  ];
}

/** The regex source for "a token in this attribute's value", or the attribute itself. */
function markerSource(marker: BlockMarker): string {
  if ('class' in marker) {
    return `\\sclass\\s*=\\s*["'](?:[^"']*\\s)?${escapeRegExp(marker.class)}(?=[\\s"'])`;
  }
  return `\\s${escapeRegExp(marker.attribute)}(?=[\\s=/>])`;
}

/** An opening tag carrying the marker, attributes in any order and over any number of lines. */
function openingTag(marker: BlockMarker): RegExp {
  return new RegExp(`<[a-z][a-z0-9]*(?=[^>]*${markerSource(marker)})[^>]*>`, 'gi');
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Apply the rules to a body as a string.
 *
 * The same outcome as `extract/dom.ts` for every block in the table, which is what
 * lets both backends promise the same reader: the elements are found with
 * `balancedElement`, so a block that nests `<div>`s is cut whole. Where it cannot
 * balance an element it leaves that element alone rather than guess its end.
 */
export function applyBlockRules(body: string, rules: readonly BlockRule[]): string {
  let out = body;
  for (const rule of rules) {
    const tag = openingTag(rule.marker);
    let from = 0;
    for (;;) {
      const el = balancedElement(out, tag, from);
      if (!el) break;
      const replacement = replace(out, el, rule);
      if (replacement === null) {
        from = el.innerStart; // not ours to change; look past its opening tag
        continue;
      }
      out = out.slice(0, el.start) + replacement + out.slice(el.end);
      from = el.start;
    }
  }
  return out;
}

function replace(
  html: string,
  el: { innerStart: number; innerEnd: number },
  rule: BlockRule,
): string | null {
  const inner = html.slice(el.innerStart, el.innerEnd);
  switch (rule.action) {
    case 'drop':
      return '';
    case 'unwrap':
      return inner;
    case 'details': {
      const summary = balancedBlock(inner, openingTag(rule.summary));
      const panel = balancedBlock(inner, openingTag(rule.panel));
      if (summary === null || panel === null) return null;
      return `<details><summary>${escapeHtml(stripTags(summary))}</summary>${panel}</details>`;
    }
  }
}

/**
 * The video of a `cvui/header-post` block, if the markup carries one.
 *
 * The block renders one `<video src>` in its `full-width` variant and nothing else
 * that moves: no poster, no second format (`render.php` in the theme's component
 * system). Read before the rules drop the block, from the page or from a REST body.
 */
export function heroVideoOf(html: string): string | undefined {
  const block = balancedBlock(html, openingTag({ class: 'wp-block-cvui-header-post' }));
  const src = block ? /<video\b[^>]*\ssrc=["']([^"']+)["']/i.exec(block)?.[1] : undefined;
  return src ? decodeEntities(src) : undefined;
}
