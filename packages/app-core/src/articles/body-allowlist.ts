import serialize from 'dom-serializer';
import type { AnyNode, Element } from 'domhandler';
import { textContent } from 'domutils';
import { Text } from 'domhandler';
import { parseDocument } from 'htmlparser2';

import {
  EMBED_FALLBACK_CLASS,
  EMBED_FRAME_CLASS,
  embedElementAttributes,
  embedFallbackLink,
  type EmbedFallbackWords,
} from './embeds';

/**
 * What an article body may hold in the reader: one table of tags and of the
 * attributes each keeps, applied to a parsed tree.
 *
 * Two callers and one table. `extract/dom.ts` cleans a scraped page with it, and
 * `buildReaderHtml` runs every body through `gateReaderBody` below whatever
 * produced it: a cleaner, the article cache, the offline bundle. That second call
 * is the security boundary of the reader
 * ([ADR 0065](../../../../adr/0065-embeds-inline-from-a-short-list-and-a-link-for-the-rest.md) §7).
 * It was a regular-expression denylist until 2026-09-24, and a re-check of the
 * same day found two bodies it let through: a `<meta>` left unterminated at the
 * very end of the body, which the builder's own `</div>` then closed, and an
 * `<area>` inside a `<map>`, which nobody had listed. A list of what is forbidden
 * is finished when nobody finds the next entry; a list of what is allowed, over a
 * tree, is finished when it is written.
 *
 * What the gate emits is the serialisation of a tree it built: tags from the table
 * with attributes from the table, every attribute value quoted and escaped, every
 * `<` in text escaped. A browser re-parsing that can rearrange the allowed tags
 * (a `<p>` inside a `<p>`, text in a table), and it cannot find a tag that is not
 * there. That is the property `test/reader-gate.test.ts` asserts over every body
 * the reviews tried.
 *
 * It needs the parser, which is why the core's parser boundary
 * (`test/boundary.test.ts`) names this file beside `extract/dom.ts`: a host that
 * builds the reader document now carries htmlparser2. The one host does already,
 * for the DOM extractor.
 */

/** The tags that survive, each with the attributes it keeps. Everything else goes. */
const KEEP: Record<string, readonly string[]> = {
  p: [],
  h2: [],
  h3: [],
  h4: [],
  h5: [],
  ul: [],
  ol: [],
  li: [],
  blockquote: [],
  figure: [],
  figcaption: [],
  img: ['src', 'alt', 'width', 'height'],
  a: ['href'],
  strong: [],
  em: [],
  b: [],
  i: [],
  u: [],
  br: [],
  hr: [],
  // An accordion as `blocks.ts` writes it.
  details: [],
  summary: [],
  // Two of 300 posts carried a table on 2026-09-24; unwrapped, one reads as a run of
  // words with no columns, which is worse than no table.
  table: [],
  caption: [],
  thead: [],
  tbody: [],
  tr: [],
  th: [],
  td: [],
};

/**
 * Removed together with what they hold. Everything else that is not kept is
 * unwrapped and keeps its text, which is right for a `<div>` or a `<span>` and
 * wrong for these: a script's source, a form's controls, a picture drawn in SVG,
 * a player, or a region of the page that is not the article.
 */
const DROP = new Set([
  'script',
  'style',
  'noscript',
  'template',
  'title',
  'textarea',
  'xmp',
  'noembed',
  'noframes',
  'plaintext',
  'iframe',
  'frame',
  'frameset',
  'object',
  'embed',
  'applet',
  'portal',
  'svg',
  'math',
  'map',
  'canvas',
  'form',
  'button',
  'input',
  'select',
  'video',
  'audio',
  'head',
  'ins',
  'aside',
  'nav',
  'header',
  'footer',
]);

/** Parts of a table, which keep their place even empty: a cell is a column. */
const TABLE_PARTS = new Set(['table', 'caption', 'thead', 'tbody', 'tr', 'th', 'td']);

/** What a relative address in a body means: the reader's base. */
const BASE = 'https://correctiv.org/';

const PIXELS = /^\d{1,4}$/;

export interface AllowlistOptions {
  /**
   * Drop a kept element with neither text nor media in it. The extractor wants
   * that, because a scraped page is full of empty paragraphs; the gate does not
   * judge layout and leaves it off.
   */
  dropEmpty: boolean;
  /**
   * The words and the article address to turn every fallback marker into the link
   * a person reads. The gate passes them; the extractor has neither, and leaves
   * the markers as they are for the gate to fill later.
   */
  fallbacks?: { words: EmbedFallbackWords; articleUrl: string };
}

/**
 * The body, gated for the reader: parsed, held to the table, every fallback
 * marker turned into its link, serialised.
 */
export function gateReaderBody(
  html: string,
  words: EmbedFallbackWords,
  articleUrl: string,
): string {
  const nodes = allowlistNodes(parseDocument(html).children, {
    dropEmpty: false,
    fallbacks: { words, articleUrl },
  });
  return serialize(nodes, { encodeEntities: 'utf8' });
}

/** Recursively: drop, unwrap, or keep with the table's attributes. */
export function allowlistNodes(children: AnyNode[], options: AllowlistOptions): AnyNode[] {
  const out: AnyNode[] = [];
  for (const node of children) {
    if (node.type === 'text') {
      out.push(node);
      continue;
    }
    if (!isElement(node)) continue; // comments, CDATA, directives
    const tag = node.name.toLowerCase();
    const embed = embedElementAttributes(tag, node.attribs ?? {});
    if (embed && tag === 'iframe') {
      node.attribs = embed;
      node.children = [];
      out.push(node);
      continue;
    }
    if (embed && options.fallbacks) {
      const link = embedFallbackLink(embed, options.fallbacks.words, options.fallbacks.articleUrl);
      if (link) {
        node.attribs = { class: link.className, href: link.href };
        node.children = [new Text(link.text)];
        out.push(node);
      }
      continue;
    }
    if (embed) {
      node.attribs = markerAttributes(embed);
      node.children = [];
      out.push(node);
      continue;
    }
    if (DROP.has(tag)) continue;

    const cleaned = allowlistNodes(node.children ?? [], options);
    const allowed = KEEP[tag];
    if (!allowed) {
      out.push(...cleaned);
      continue;
    }

    node.children = cleaned;
    node.attribs = keptAttributes(node.attribs ?? {}, allowed);
    if (!options.dropEmpty || TABLE_PARTS.has(tag) || hasContent(node)) out.push(node);
  }
  return out;
}

function keptAttributes(
  attribs: Record<string, string>,
  allowed: readonly string[],
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const name of allowed) {
    const value = attribs[name];
    if (value === undefined) continue;
    const kept =
      name === 'href'
        ? linkAddress(value)
        : name === 'src'
          ? imageAddress(value)
          : name === 'width' || name === 'height'
            ? PIXELS.test(value)
              ? value
              : undefined
            : value;
    if (kept !== undefined) out[name] = kept;
  }
  return out;
}

/**
 * A fallback marker the extractor keeps for the gate to fill: its class reduced to
 * the one the gate recognises, and its address held to http(s).
 */
function markerAttributes(attribs: Record<string, string>): Record<string, string> {
  const href = attribs.href === undefined ? undefined : linkAddress(attribs.href);
  return {
    class: EMBED_FALLBACK_CLASS,
    ...(href && /^https?:/.test(href) ? { href } : {}),
    ...(attribs['data-embed-host'] ? { 'data-embed-host': attribs['data-embed-host'] } : {}),
    ...(attribs['data-embed-kind'] ? { 'data-embed-kind': attribs['data-embed-kind'] } : {}),
  };
}

/**
 * Where a link may point: https, http or a mail address, with a relative one
 * resolved against correctiv.org as the native reader's base does. On the web a
 * relative address would resolve against the APP's origin instead, and a link that
 * navigates the reader frame to a page there is how the reviews reached the app's
 * storage; written out absolute, it is a link to correctiv.org on both.
 */
function linkAddress(value: string): string | undefined {
  const url = parse(value);
  return url && ['https:', 'http:', 'mailto:'].includes(url.protocol) ? url.toString() : undefined;
}

function imageAddress(value: string): string | undefined {
  const url = parse(value);
  return url && ['https:', 'http:'].includes(url.protocol) ? url.toString() : undefined;
}

function parse(value: string): URL | undefined {
  try {
    return new URL(value.trim(), BASE);
  } catch {
    return undefined;
  }
}

function isElement(node: AnyNode): node is Element {
  return node.type === 'tag' || node.type === 'script' || node.type === 'style';
}

/** Text, or media: an image, a rule, a break, or an embed somewhere inside. */
function hasContent(node: Element): boolean {
  if (['img', 'br', 'hr'].includes(node.name)) return true;
  if (textContent(node).trim().length > 0) return true;
  return node.children.some((child) => isElement(child) && (isMedia(child) || hasContent(child)));
}

function isMedia(node: Element): boolean {
  const classes = (node.attribs.class ?? '').split(/\s+/);
  return (
    node.name === 'img' ||
    (node.name === 'iframe' && classes.includes(EMBED_FRAME_CLASS)) ||
    (node.name === 'a' && classes.includes(EMBED_FALLBACK_CLASS))
  );
}
