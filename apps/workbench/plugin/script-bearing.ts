/**
 * What in a string of HTML could run script, or take the page somewhere else.
 *
 * The site puts two kinds of build-time HTML into the page with
 * `dangerouslySetInnerHTML`: the repository's documents, rendered by
 * `markdown.ts`, and the doc comments of the reference, rendered by
 * `scripts/api.mjs`. Both come from `marked`, which passes raw HTML through
 * untouched, and neither is sanitised, because the input is this repository's own
 * text. This is what holds that argument to something: the policy in `policy.ts`
 * stops inline script from running in the browser, and this stops script-bearing
 * HTML from being merged, where a reviewer of prose would not see it.
 *
 * **It parses, with parse5, and does not match.** The first version matched tags
 * with regular expressions, and a cold review broke it four ways in an afternoon:
 * a stray quote that ended the scan while the browser read on, a quote the
 * pattern thought was open that hid the elements after it, a no-break space the
 * pattern counted as whitespace and the browser does not, and a `</style>` inside
 * an attribute that the browser honours. Each one is a place where the pattern
 * and the HTML tokenizer disagree, and the tokenizer is what the page gets. parse5
 * IS that tokenizer, written to the specification, so what this reads is the tree
 * `innerHTML` builds: element names and decoded attribute values, with nothing to
 * disagree about. The fragment is parsed in a `<div>`, which is what every caller
 * assigns `innerHTML` to.
 *
 * **Parse what the page is given, piece by piece.** `Document.tsx` cuts a document
 * into several pieces and assigns each separately, so a caller parses each piece
 * (`src/pages/document-parts.ts` has the cut) rather than the whole string: a
 * quote left open at the end of one piece would swallow the next into an
 * attribute value in the whole string, and in the page it is parsed fresh.
 *
 * **What it refuses**, each for what it can do:
 *
 *  - an element that runs script, loads a document or a plugin, submits, or
 *    rewrites how the page is read: `script`, `iframe`, `frame`, `frameset`,
 *    `object`, `embed`, `form`, `meta`, `base`, `link`. `meta` is the one the
 *    policy cannot back up: `http-equiv="refresh"` navigates the page and no
 *    directive governs it;
 *  - `svg` and `math`, whole. Foreign content brings attributes that become URLs
 *    indirectly, `<animate attributeName="href" values="…">` among them, which no
 *    reading of one attribute at a time can follow. No document uses either; a
 *    drawing is an `<img>`, or one of the site's own components;
 *  - every attribute whose name begins `on`, which in the parsed tree is exactly
 *    the set of event handlers and a few harmless names nobody writes;
 *  - `srcdoc`, which is a whole document in an attribute;
 *  - `javascript:`, `vbscript:` or `data:text/html` ANYWHERE in any attribute
 *    value, not only at its start, with whitespace and control characters taken
 *    out first, because a browser ignores them inside a scheme. Anywhere, because
 *    a value can be a list, and over-refusing a `title` that names the scheme is
 *    the cheap direction.
 *
 * **What it does not do.** It says nothing about CSS, which cannot run script,
 * and nothing about a link to a hostile page, which is an ordinary link.
 */
import { parseFragment } from 'parse5';
import type { DefaultTreeAdapterMap } from 'parse5';

type Node = DefaultTreeAdapterMap['node'];
type Element = DefaultTreeAdapterMap['element'];

const ELEMENTS = new Set([
  'script',
  'iframe',
  'frame',
  'frameset',
  'object',
  'embed',
  'form',
  'meta',
  'base',
  'link',
  'svg',
  'math',
]);

const SCRIPT_URL = /(?:javascript|vbscript):|data:text\/html/;

/** The element `innerHTML` is assigned to on every page that uses this HTML. */
const CONTEXT = parseFragment('<div></div>').childNodes[0] as Element;

function isElement(node: Node): node is Element {
  return 'tagName' in node;
}

/** Every element in a parsed fragment, a `<template>`'s content included. */
function elements(html: string): Element[] {
  const out: Element[] = [];
  const visit = (nodes: Node[]): void => {
    for (const node of nodes) {
      if (!isElement(node)) continue;
      out.push(node);
      visit(node.childNodes);
      if ('content' in node && node.content) visit(node.content.childNodes as Node[]);
    }
  };
  // `scriptingEnabled` is parse5's default and a browser's: `<noscript>` is raw
  // text, as it is in the page. Stated because a parser run the other way would
  // read noscript content as elements and disagree with the browser.
  visit(parseFragment(CONTEXT, html, { scriptingEnabled: true }).childNodes as Node[]);
  return out;
}

/** A value as a browser compares a scheme: no whitespace, no control characters. */
function asUrl(value: string): string {
  return [...value]
    .filter((char) => (char.codePointAt(0) ?? 0) > 0x20)
    .join('')
    .toLowerCase();
}

/** Every script-bearing construct in `html`, one line each, in document order. */
export function scriptBearing(html: string): string[] {
  const found: string[] = [];
  for (const element of elements(html)) {
    const name = element.tagName;
    if (ELEMENTS.has(name)) found.push(`<${name}> element`);
    for (const { name: attribute, value } of element.attrs) {
      if (attribute.startsWith('on')) found.push(`<${name} ${attribute}=…> event handler`);
      if (attribute === 'srcdoc') found.push(`<${name} srcdoc=…> inline document`);
      const scheme = SCRIPT_URL.exec(asUrl(value));
      if (scheme) found.push(`<${name} ${attribute}="…${scheme[0]}…"> script URL`);
    }
  }
  return found;
}

/**
 * The keys of `api.generated.json` whose value the site puts in as HTML.
 *
 * `doc` and `propsDoc` are `marked` output and go through `dangerouslySetInnerHTML`
 * on `/reference` and on a component's page. Every other string in the file — a
 * `summary`, a `signature`, a type — is rendered as text, which is why a summary
 * reading "Every `<meta>` on the page" is harmless there and is not read here.
 */
const HTML_KEYS = new Set(['doc', 'propsDoc']);

/** Every HTML string in the reference, with where it sits, for a report that can be acted on. */
export function referenceHtml(value: unknown, where = ''): { where: string; html: string }[] {
  if (Array.isArray(value))
    return value.flatMap((item, i) => referenceHtml(item, `${where}[${i}]`));
  if (value === null || typeof value !== 'object') return [];
  const found: { where: string; html: string }[] = [];
  // A symbol has a `name`, a module a `subpath`; either makes the report findable.
  const record = value as Record<string, unknown>;
  const label = record.name ?? record.subpath;
  const named = typeof label === 'string' ? label : null;
  const here = named ? `${where}(${named})` : where;
  for (const [key, child] of Object.entries(value)) {
    if (HTML_KEYS.has(key) && typeof child === 'string')
      found.push({ where: `${here}.${key}`, html: child });
    else found.push(...referenceHtml(child, `${here}.${key}`));
  }
  return found;
}

/** How many elements and attributes the parse found, so a check can say it read something. */
export function tagsAndAttributes(html: string): { tags: number; attributes: number } {
  const all = elements(html);
  return { tags: all.length, attributes: all.reduce((n, e) => n + e.attrs.length, 0) };
}
