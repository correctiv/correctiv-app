/**
 * What in a string of HTML could run script, or take the page somewhere else.
 *
 * The site puts two kinds of build-time HTML into the page with
 * `dangerouslySetInnerHTML`: the repository's documents, rendered by
 * `markdown.ts`, and the doc comments of the reference, rendered by
 * `scripts/api.mjs`. Both come from `marked`, which passes raw HTML through
 * untouched, and neither is sanitised, because the input is this repository's own
 * text. This is what holds that argument to something: the policy in `policy.ts`
 * stops script from running in the browser, and this stops script-bearing HTML
 * from reaching the build at all, where a reviewer of prose would not see it.
 *
 * **What it reads.** Every tag in the string, with quoted attribute values kept
 * whole, because `<img title=">" onerror=…>` ends at the second `>` for a browser
 * and at the first for a pattern that ignores quotes. Text between tags is never
 * read: `marked` escapes a `<` in prose and in code, so `` `<iframe>` `` in a
 * document arrives as `&lt;iframe&gt;` and is words about an iframe, not one.
 *
 * **What it refuses**, each for what it can do:
 *
 *  - an element that runs or loads a document, or rewrites how the page is read:
 *    `script`, `iframe`, `object`, `embed`, `form`, `meta`, `base`;
 *  - any attribute named `on…`, which is an event handler whatever the element;
 *  - `srcdoc`, which is a whole document in an attribute;
 *  - a `javascript:`, `vbscript:` or `data:text/html` URL in ANY attribute, read
 *    after character references are decoded and whitespace is taken out, because
 *    `jav&#x61;script:` and `java script:` are both the same URL to a browser.
 *
 * **What it does not do.** It is a scanner, not a parser, so it is written to
 * over-refuse: an attribute called `one` is an event handler to it. It says
 * nothing about CSS, which cannot run script, and nothing about a link to a
 * hostile page, which is an ordinary link.
 */

const ELEMENTS = new Set(['script', 'iframe', 'object', 'embed', 'form', 'meta', 'base']);

/** A tag, from `<name` to its `>`, with quoted values kept whole. */
const TAG = /<([a-zA-Z][^\s/>]*)((?:"[^"]*"|'[^']*'|[^'">])*)>?/g;

/** One attribute inside a tag: a name, and a value in any of the three spellings. */
const ATTRIBUTE = /([^\s"'>/=]+)(?:\s*=\s*("[^"]*"|'[^']*'|[^\s"'=<>`]+))?/g;

const SCRIPT_URL = /^(?:javascript|vbscript):|^data:text\/html/;

const NAMED: Record<string, string> = {
  colon: ':',
  tab: '\t',
  newline: '\n',
  amp: '&',
  quot: '"',
  apos: "'",
  lt: '<',
  gt: '>',
};

/** An attribute value as the browser reads it, for the URL test only. */
function asUrl(raw: string): string {
  const decoded = raw
    .replace(/^["']|["']$/g, '')
    .replace(/&#x([0-9a-f]+);?/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);?/g, (_, dec) => String.fromCodePoint(Number(dec)))
    .replace(/&([a-z]+);/gi, (whole, name) => NAMED[name.toLowerCase()] ?? whole);
  // Space and every control character out, which a browser ignores inside a scheme.
  return [...decoded]
    .filter((char) => (char.codePointAt(0) ?? 0) > 0x20)
    .join('')
    .toLowerCase();
}

/** Every script-bearing construct in `html`, one line each, in the order met. */
export function scriptBearing(html: string): string[] {
  const found: string[] = [];
  for (const [, rawName, rest] of html.matchAll(TAG)) {
    const name = rawName.toLowerCase();
    if (ELEMENTS.has(name)) found.push(`<${name}> element`);
    for (const [, rawAttribute, value] of rest.matchAll(ATTRIBUTE)) {
      const attribute = rawAttribute.toLowerCase();
      if (attribute.startsWith('on')) found.push(`<${name} ${attribute}=…> event handler`);
      if (attribute === 'srcdoc') found.push(`<${name} srcdoc=…> inline document`);
      if (value !== undefined && SCRIPT_URL.test(asUrl(value))) {
        found.push(`<${name} ${attribute}="${asUrl(value).split(':')[0]}:…"> script URL`);
      }
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

/** How many tags and attributes `html` has, so a check can say it read something. */
export function tagsAndAttributes(html: string): { tags: number; attributes: number } {
  let tags = 0;
  let attributes = 0;
  for (const [, , rest] of html.matchAll(TAG)) {
    tags += 1;
    attributes += [...rest.matchAll(ATTRIBUTE)].length;
  }
  return { tags, attributes };
}
