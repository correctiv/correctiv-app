import { describe, expect, it } from 'vitest';

import { extractArticleFromDom } from '../src/articles/extract/dom';
import { extractArticleFromString } from '../src/articles/extract/string';
import { buildReaderHtml, type ReaderCopy } from '../src/articles/reader-html';
import type { Article } from '../src/articles/types';
import { toArticle } from '../src/services/wp.service';

/**
 * The last gate between an article body and the reader, `buildReaderHtml`, is an
 * ALLOWLIST over a parsed tree (ADR 0065 §7). It replaced a regular-expression
 * denylist on 2026-09-24, after a re-check found two classes of body that the
 * denylist let through and that no amount of adding to it would have closed: a tag
 * left unterminated at the end of the body, which the builder's own `</div>` then
 * closed, and an element nobody had thought to list, `<area>` inside `<map>`.
 *
 * So what is asserted here is not a list of known attacks but the property: after
 * the gate, the body holds no tag and no attribute outside one table, and every
 * address in it is one the reader routes. The corpus is every body the reviews of
 * #269 tried, and each is fed through all four ways a body reaches the builder:
 * directly (the article cache and the offline bundle), the REST API, and a scraped
 * page through either extractor.
 */

const ARTICLE_URL = 'https://correctiv.org/aktuelles/2026/09/24/ein-artikel/';

const COPY: ReaderCopy = {
  factcheckBadge: 'Fact check',
  readingTime: '5 min read',
  support: 'Thanks.',
  embedFallback: (host) => `Open content from ${host} in the browser`,
  embedArticle: 'Read the embedded article',
};

function reader(bodyHtml: string): string {
  const article: Article = {
    url: ARTICLE_URL,
    title: 'T',
    authors: [],
    publishedAt: '',
    readingMinutes: 5,
    bodyHtml,
  };
  return buildReaderHtml(article, COPY, { locale: 'en' });
}

type Post = Parameters<typeof toArticle>[0];

function page(fragment: string): string {
  return `<html><body><h1>T</h1><div class="detail__content">${fragment}</div></body></html>`;
}

const PATHS: [string, (fragment: string) => string][] = [
  ['cache', (fragment) => fragment],
  ['REST API', (fragment) => toArticle({ content: { rendered: fragment } } as Post).bodyHtml],
  ['string extractor', (fragment) => extractArticleFromString(page(fragment)).bodyHtml],
  ['DOM extractor', (fragment) => extractArticleFromDom(page(fragment)).bodyHtml],
];

/** What the document holds between the body's opening tag and the footer. */
function bodyOf(html: string): string {
  const start = html.indexOf('<div class="reader-body">') + '<div class="reader-body">'.length;
  const end = html.indexOf('</div>\n<footer class="reader-footer">');
  return html.slice(start, end);
}

/**
 * The table, typed out here rather than imported, so that widening it is a
 * change to this file too and not only to the module it tests.
 */
const TAGS: Record<string, readonly string[]> = {
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
  a: ['href', 'class'],
  strong: [],
  em: [],
  b: [],
  i: [],
  u: [],
  br: [],
  hr: [],
  details: [],
  summary: [],
  table: [],
  caption: [],
  thead: [],
  tbody: [],
  tr: [],
  th: [],
  td: [],
  iframe: ['class', 'src', 'sandbox', 'title', 'name', 'height', 'loading'],
};

/** Every address the body may still carry: absolute http(s), or a mail address. */
const ADDRESS = /^(?:https?:\/\/|mailto:)/;

/**
 * Every tag in `body`, read with a pattern and not a parser, because the browser
 * is the parser that matters and a pattern cannot be talked out of a `<`.
 */
function tagsIn(body: string): { name: string; attributes: [string, string][] }[] {
  const found: { name: string; attributes: [string, string][] }[] = [];
  for (const [, name, rest] of body.matchAll(/<\/?([^\s/>]+)([^>]*)>?/g)) {
    const attributes = [...rest.matchAll(/([^\s"'=/>]+)(?:="([^"]*)")?/g)].map(
      ([, key, value]) => [key, value ?? ''] as [string, string],
    );
    found.push({ name, attributes });
  }
  return found;
}

function violations(body: string): string[] {
  const out: string[] = [];
  if (/<[!?]/.test(body)) out.push('a comment, directive or processing instruction');
  for (const { name, attributes } of tagsIn(body)) {
    const allowed = TAGS[name];
    if (!allowed) {
      out.push(`tag <${name}>`);
      continue;
    }
    for (const [key, value] of attributes) {
      if (!allowed.includes(key)) out.push(`attribute ${key} on <${name}>`);
      if ((key === 'href' || key === 'src') && !ADDRESS.test(value)) {
        out.push(`${key}="${value}" on <${name}>`);
      }
      if (
        key === 'class' &&
        !/^(?:embed-fallback(?: embed-fallback--article)?|reader-embed)$/.test(value)
      ) {
        out.push(`class="${value}" on <${name}>`);
      }
    }
  }
  return out;
}

/** The two bodies the re-check of 224f5453 reproduced in Chrome. */
const REPRODUCED = {
  unterminatedMeta: '<p>x</p><meta http-equiv=refresh content="0;url=/steal" ',
  imageMap:
    '<p><img src="https://correctiv.org/a.jpg" usemap="#m"></p><map name=m><area shape=default href="/x"></map>',
  svgLink: '<svg><a xlink:href="/x"><text y="20">tap</text></a></svg>',
};

const CORPUS: string[] = [
  ...Object.values(REPRODUCED),
  // Refreshes, bases and links, however spelled.
  '<meta http-equiv="refresh" content="0;url=https://example.com/">',
  '<META HTTP-EQUIV="Refresh" CONTENT="0;url=/x">',
  '<meta\nhttp-equiv=refresh content="0;url=/x">',
  '<meta/http-equiv=refresh/content="0;url=/x">',
  '<me<meta>ta http-equiv="refresh" content="0;url=/x">',
  '<base href="https://evil.example/"><a href="x">x</a>',
  '<link rel="stylesheet" href="https://evil.example/x.css"><link rel=prerender href=/x>',
  // Reassembly across a removed tag.
  '<ifr<script></script>ame class="reader-embed" srcdoc="<p>x</p>"></iframe>',
  '<scr<script>x</script>ipt>alert(1)</script>',
  // Unterminated at the end, in more shapes than one.
  '<p>x</p><a href="/x" ',
  '<p>x</p><img src=x onerror=alert(1) ',
  '<p>x</p><iframe src="https://evil.example/" ',
  '<p>x</p><',
  '<p>x</p><!--',
  // Foreign content.
  '<svg><script>alert(1)</script><foreignObject><a href="/x">x</a></foreignObject></svg>',
  '<math><maction actiontype="statusline" xlink:href="/x">x</maction><mi xlink:href="/x">y</mi></math>',
  '<svg><animate attributeName="href" to="/x"/><a><text>x</text></a></svg>',
  // Plug-ins and frames of every kind.
  '<object data="/x"><param name=src value=/x></object><embed src="/x"><applet code=x></applet>',
  '<portal src="/x"></portal><frameset><frame src="/x"></frameset>',
  '<iframe srcdoc="<script>parent.x=1</script>"></iframe>',
  '<iframe class="reader-embed" src="https://evil.example/x"></iframe>',
  '<iframe class="reader-embed" src="https://datawrapper.dwcdn.net/a/1/" srcdoc="x" onload="x()"></iframe>',
  // Addresses a person taps.
  '<a href="javascript:alert(1)">x</a><a href=" java\tscript:alert(1)">y</a>',
  '<a href="data:text/html,<script>alert(1)</script>">x</a><a href="vbscript:x">y</a>',
  '<a href="/relative/path">x</a><a href="//evil.example/x">y</a><a href="#top">z</a>',
  '<a href="https://example.org/" target="_top" ping="https://evil.example/" onclick="x()">x</a>',
  '<img src="javascript:alert(1)"><img src="/wp-content/a.jpg" srcset="/x 1x" onerror="x()">',
  // Forms and the elements the parser reads as raw text.
  '<form action="/x"><input name=a><button formaction="/y">b</button><textarea>t</textarea></form>',
  '<title><img src=x onerror=alert(1)></title><xmp><img src=x></xmp><noembed><img src=x></noembed>',
  '<noscript><p title="</noscript><img src=x onerror=alert(1)>"></noscript>',
  '<style><img src=x onerror=alert(1)></style><template><img src=x></template>',
  '<plaintext><a href="/x">x</a>',
  // Comments, CDATA and directives.
  '<!--><img src=x onerror=alert(1)>--><![CDATA[<script>x</script>]]><?xml version="1.0"?><!doctype html>',
  // Attributes a kept tag must not keep.
  '<p style="background:url(javascript:x)" onclick="x()" class="x" id="y">x</p>',
  '<details open ontoggle="x()"><summary onclick="x()">s</summary>x</details>',
  '<table><a href="/x">x</a><tr><td background="/x">y</td></tr></table>',
  '<video src="/x" autoplay></video><audio src="/x"></audio><picture><source srcset="/x"></picture>',
  '<a href="https://example.org/" title="a > b" data-x="<meta http-equiv=refresh>">x</a>',
];

describe.each(PATHS)('what reaches the reader through the %s', (_name, clean) => {
  const body = (fragment: string) => bodyOf(reader(clean(fragment)));

  it('carries no refresh from a tag left open at the end of the body', () => {
    expect(body(REPRODUCED.unterminatedMeta)).not.toMatch(/<meta|http-equiv/i);
  });

  it('carries no image map, and no link inside an SVG', () => {
    expect(body(REPRODUCED.imageMap)).not.toMatch(/<(?:map|area)\b|usemap/i);
    expect(body(REPRODUCED.svgLink)).not.toMatch(/<svg|xlink:href/i);
  });

  it.each(CORPUS.map((fragment, index) => [index, fragment]))(
    'holds nothing outside the table, corpus entry %i',
    (_index, fragment) => {
      expect(violations(body(fragment as string))).toEqual([]);
    },
  );
});

describe('the gate', () => {
  it('keeps the words of what it takes out', () => {
    const body = bodyOf(reader('<div class="x"><span>Ein</span> <mark>Text</mark></div>'));
    expect(body).toBe('Ein Text');
  });

  it('resolves a relative address against correctiv.org, the reader base', () => {
    const body = bodyOf(
      reader('<p><a href="/faktencheck/x/">x</a><img src="/wp-content/a.jpg"></p>'),
    );
    expect(body).toBe(
      '<p><a href="https://correctiv.org/faktencheck/x/">x</a><img src="https://correctiv.org/wp-content/a.jpg"></p>',
    );
  });

  it('leaves a link with an address it does not route without one', () => {
    expect(bodyOf(reader('<p><a href="javascript:alert(1)">x</a></p>'))).toBe('<p><a>x</a></p>');
  });

  it('keeps what the reader shows, byte for byte where it can', () => {
    const kept =
      '<h2>Titel</h2><p>Ein <strong>Absatz</strong> mit <a href="https://correctiv.org/x/">Link</a> &amp; Umlauten: äöü „…“</p>' +
      '<figure><img src="https://correctiv.org/a.jpg" alt="Ein Bild"><figcaption>Bild: x</figcaption></figure>' +
      '<details><summary>Frage</summary><p>Antwort</p></details>';
    expect(bodyOf(reader(kept))).toBe(kept);
  });
});
