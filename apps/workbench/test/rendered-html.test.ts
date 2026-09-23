import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { excusesWithoutReason, floorFaults, ratchet } from '@correctiv/prose-and-code';
import { describe, expect, it } from 'vitest';

import { collectDocs, ROOT } from '../plugin/collect';
import { renderDoc } from '../plugin/markdown';
import { CONTENT_SECURITY_POLICY } from '../plugin/policy';
import { referenceHtml, scriptBearing, tagsAndAttributes } from '../plugin/script-bearing';
import { split } from '../src/pages/document-parts';

/**
 * No document and no doc comment renders to HTML that can run script.
 *
 * The site puts both into the page with `dangerouslySetInnerHTML`, and neither is
 * sanitised, because the input is this repository's own text. That was the whole
 * argument, and it holds only as long as nobody writes `<img onerror=…>` into a
 * `.md` file: a change to a document is reviewed as prose, and an attribute in
 * the middle of a paragraph is what a prose review reads past. The policy in
 * `plugin/policy.ts` stops such a thing from running on the published site; this
 * stops it from being merged, where somebody can still ask what it was for.
 *
 * **Measured on 2026-09-23, before this was written:** no document in the
 * repository contains a raw HTML tag at all. Every `<iframe>`, `<div>` and `<img>`
 * in the Markdown is inside backticks, which `marked` escapes into words. The one
 * raw tag the site renders is `<br>`, written by `plugin/provenance.ts` into the
 * table cells of the page it generates, and a line break is not script. So the
 * excuse list below starts empty, and an entry in it has to say why a document
 * needs what the rule refuses.
 */

const { module } = collectDocs();
const { docs } = module;

/**
 * Keyed by the document's file and the fault, e.g.
 * `README.md: <iframe> element`. By the file rather than by the line, because a
 * document is prose many people edit and a line number would fail this on
 * somebody else's paragraph. The value is the reason, which is required.
 */
const EXCUSED: Record<string, string> = {};

/*
 * Piece by piece, cut the way `Document.tsx` cuts it, because each piece is
 * assigned to `innerHTML` on its own and that is what a browser parses.
 */
const pieces = docs.flatMap((doc) => split(doc.html).map((part) => ({ doc, html: part.html })));
const found = pieces.flatMap(({ doc, html }) =>
  scriptBearing(html).map((fault) => ({ key: `${doc.file}: ${fault}` })),
);
const read = pieces.map(({ html }) => tagsAndAttributes(html));

describe('the rendered documents', () => {
  it('reads every document, and the markup in them', () => {
    expect(
      floorFaults({
        'documents rendered': { found: docs.length, atLeast: 40 },
        'pieces the page assigns': { found: pieces.length, atLeast: 100 },
        'tags read in them': { found: read.reduce((n, r) => n + r.tags, 0), atLeast: 5000 },
        'attributes read in them': {
          found: read.reduce((n, r) => n + r.attributes, 0),
          atLeast: 500,
        },
      }),
    ).toEqual([]);
  });

  it('carry no script-bearing HTML beyond what is excused', () => {
    expect(ratchet(found, EXCUSED).arrivals).toEqual([]);
  });

  it('excuse nothing that is gone', () => {
    expect(ratchet(found, EXCUSED).stale).toEqual([]);
  });

  it('excuse nothing without a reason', () => {
    expect(excusesWithoutReason(EXCUSED)).toEqual([]);
  });
});

describe('the reference', () => {
  /*
   * `api.generated.json` is not committed and `npm run check` does not build it,
   * so in the `check` job there is nothing here to read. That is not the gap it
   * looks like: `scripts/api.mjs` refuses the same faults before it writes the
   * file, and the build runs it first, so a doc comment that fails this fails the
   * build. Where the file exists — any machine that has built the site — it is
   * read here too.
   */
  const API = join(ROOT, 'apps/workbench/content/api.generated.json');

  it('carries no script-bearing HTML in a doc comment', () => {
    if (!existsSync(API)) {
      console.log('skipped: content/api.generated.json is not built');
      return;
    }
    const html = referenceHtml(JSON.parse(readFileSync(API, 'utf8')));
    expect(
      floorFaults({
        'doc comments read': { found: html.length, atLeast: 100 },
        'tags read in them': {
          found: html.reduce((n, h) => n + tagsAndAttributes(h.html).tags, 0),
          atLeast: 500,
        },
      }),
    ).toEqual([]);
    const faults = html.flatMap(({ where, html }) =>
      scriptBearing(html).map((f) => `${where}: ${f}`),
    );
    expect(faults).toEqual([]);
  });
});

describe('the scanner', () => {
  /*
   * Each of these is a way the rule has to bite. The second group is the cold
   * review of 2026-09-23, which broke the first, pattern-matching version with
   * every one of them while a browser ran the handler: they are the places where
   * a regular expression and the HTML tokenizer disagree, and they are kept so
   * that nobody puts a pattern back.
   */
  const refused: [string, string][] = [
    ['<script>alert(1)</script>', 'element'],
    ['<img src="x" onerror="alert(1)">', 'event handler'],
    ['<svg/onload=alert(1)>', 'event handler'],
    ['<img title=">" onerror=alert(1)>', 'event handler'],
    ['<a href="javascript:alert(1)">x</a>', 'script URL'],
    ['<a href="jav&#x61;script:alert(1)">x</a>', 'script URL'],
    ['<a href=" java\tscript:alert(1)">x</a>', 'script URL'],
    ['<a href="data:text/html,<script>alert(1)</script>">x</a>', 'script URL'],
    ['<iframe src="https://example.org"></iframe>', 'element'],
    ['<p srcdoc="<p>x</p>">', 'inline document'],
    ['<object data="x"></object>', 'element'],
    ['<embed src="x">', 'element'],
    ['<form action="https://example.org"></form>', 'element'],
    ['<meta http-equiv="refresh" content="0;url=https://example.org">', 'element'],
    ['<base href="https://example.org/">', 'element'],

    // A stray quote, which ended the old scan while the browser read on.
    ["<div>\n<img src=x a' onerror=alert(1)>\n</div>", 'event handler'],
    ["<div>\n<img src=x x=a'b onerror=alert(1)>\n</div>", 'event handler'],
    // A quote the old scan thought was open, hiding the elements behind it.
    [
      '<div>\n<p a"b>\n<meta http-equiv=refresh content=0;url=https://evil.example>\n<p c">\n</div>',
      '<meta> element',
    ],
    ['<div>\n<p a"b>\n<iframe src=https://evil.example>\n<p c">\n</div>', '<iframe> element'],
    ["<div>\n<p a'b>\n<embed src=https://evil.example>\n<p c'>\n</div>", '<embed> element'],
    // A no-break space and a byte-order mark, which JavaScript's `\s` counts as
    // whitespace and HTML does not, so ` "a` is an unquoted value to a browser.
    ['<div>\n<img x= "a onerror=alert(1) b" src=y>\n</div>', 'event handler'],
    ['<div>\n<img x=﻿"a onerror=alert(1) b" src=y>\n</div>', 'event handler'],
    // A raw-text element, whose end tag inside an attribute a browser honours.
    [
      '<div>\n<style><img title="</style><img src=x onerror=alert(1)>"></style>\n</div>',
      'event handler',
    ],
    [
      '<div>\n<textarea><img title="</textarea><img src=x onerror=alert(1)>"></textarea>\n</div>',
      'event handler',
    ],
    [
      '<div>\n<noscript><img title="</noscript><img src=x onerror=alert(1)>"></noscript>\n</div>',
      'event handler',
    ],
    // A scheme that is not at the start of the value.
    [
      '<svg><a><animate attributeName=href values="https://a;javascript:alert(1)"/></a></svg>',
      'script URL',
    ],
  ];

  it.each(refused)('refuses %s', (html, kind) => {
    expect(scriptBearing(html).join('\n')).toContain(kind);
  });

  it('reads a character reference past the last code point as a finding-free value, not a crash', () => {
    // The pattern version decoded references itself and threw a RangeError here.
    expect(() => scriptBearing('<a href="&#x110000;">x</a>')).not.toThrow();
    expect(scriptBearing('<a href="&#x110000;">x</a>')).toEqual([]);
  });

  it('leaves the markup this site writes, and words about markup, alone', () => {
    const clean = [
      '<a href="https://github.com/correctiv/correctiv-app" target="_blank" rel="noreferrer noopener" data-external="true">x</a>',
      '<img src="https://example.org/a.png" alt="" loading="lazy" />',
      '<div data-diagram="core-host"></div>',
      '<p><code>&lt;iframe onload="x"&gt;</code> and <code>javascript:</code> are words here.</p>',
      '<table><tbody><tr><td>one<br>two</td></tr></tbody></table>',
    ];
    expect(clean.flatMap((html) => scriptBearing(html))).toEqual([]);
  });

  it('sees what marked passes through from a document', () => {
    // Through the real renderer, because the question is what reaches the page,
    // and `marked` is what decides which of a document's `<` survive as markup.
    const doc = renderDoc(
      { id: 'probe', file: 'PROBE.md', route: '/probe', nav: 'Probe', blurb: '' },
      '# Probe\n\nText <img src=x onerror="alert(1)"> and [a link](javascript:alert(1)).\n',
      new Map(),
      'https://github.com/correctiv/correctiv-app/blob/main',
      '/',
    );
    expect(scriptBearing(doc.html)).toEqual([
      '<img onerror=…> event handler',
      '<a href="…javascript:…"> script URL',
    ]);
  });
});

describe('the policy', () => {
  it('lets no script run that the build did not write', () => {
    // The one directive the protection rests on, spelled out so that widening it
    // is a change to this line and not only to the list it is checked against.
    const script = CONTENT_SECURITY_POLICY.find((d) => d.startsWith('script-src '));
    expect(script).toBe("script-src 'self'");
    expect(CONTENT_SECURITY_POLICY).toContain("object-src 'none'");
    expect(CONTENT_SECURITY_POLICY).toContain("base-uri 'self'");
  });

  it('frames this origin and the one embed host the app draws, and nothing else', () => {
    // An iframe is the one thing a document could smuggle in that the policy
    // would otherwise render: a full-page overlay from any https host.
    expect(CONTENT_SECURITY_POLICY).toContain("frame-src 'self' https://www.youtube-nocookie.com");
  });

  it('writes no directive a meta element is not allowed to carry', () => {
    // Ignored by the browser in a `<meta>`, so present here they would only be
    // protection on paper.
    const ignored = CONTENT_SECURITY_POLICY.filter((d) =>
      /^(frame-ancestors|report-uri|report-to|sandbox)\b/.test(d),
    );
    expect(ignored).toEqual([]);
  });
});
