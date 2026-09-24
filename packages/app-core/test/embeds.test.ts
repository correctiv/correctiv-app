import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { extractArticleFromDom } from '../src/articles/extract/dom';
import { extractArticleFromString } from '../src/articles/extract/string';
import { buildReaderHtml, type ReaderCopy } from '../src/articles/reader-html';
import type { Article } from '../src/articles/types';
import { decodeEntities, stripActiveMarkup } from '../src/lib/html';
import { toArticle } from '../src/services/wp.service';

/**
 * What an embed becomes on its way from a correctiv.org post to the reader
 * (ADR 0065). Every fixture is a fragment of a real post, trimmed, with the post
 * named in its first line.
 *
 * Each one goes through all three ways a body reaches the reader: the REST API's
 * `content.rendered`, and a scraped page through either extractor. They used to
 * agree by all dropping `<iframe>` and `<script>` without a trace, which is the
 * behaviour these assertions replace, so each of them fails against the tree
 * before this change. What they read is the finished reader document, so the
 * words and the address a person gets are what is asserted, not a marker.
 */

function fixture(name: string): string {
  return readFileSync(
    fileURLToPath(new URL(`./__fixtures__/articles/embeds/${name}.html`, import.meta.url)),
    'utf8',
  );
}

const ARTICLE_URL = 'https://correctiv.org/aktuelles/2026/09/24/ein-artikel/';

/** The body, the way each of the three paths leaves it. */
const PATHS: [string, (fragment: string) => string][] = [
  ['REST API', (fragment) => toArticle({ content: { rendered: fragment } } as Post).bodyHtml],
  ['string extractor', (fragment) => extractArticleFromString(page(fragment)).bodyHtml],
  ['DOM extractor', (fragment) => extractArticleFromDom(page(fragment)).bodyHtml],
];

type Post = Parameters<typeof toArticle>[0];

function page(fragment: string): string {
  return `<html><body><h1>T</h1><div class="detail__content">${fragment}</div></body></html>`;
}

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

/** What the document holds between the body's opening tag and the footer. */
function bodyOf(html: string): string {
  const start = html.indexOf('<div class="reader-body">') + '<div class="reader-body">'.length;
  return html.slice(start, html.indexOf('</div>\n<footer class="reader-footer">'));
}

/** The frames the document renders, as src plus the attributes that size them. */
function frames(html: string): { src: string; height?: string; name?: string }[] {
  return [...html.matchAll(/<iframe\b([^>]*)>/g)].map(([, attrs]) => ({
    src: decodeEntities(/\bsrc="([^"]*)"/.exec(attrs)?.[1] ?? ''),
    height: /\bheight="([^"]*)"/.exec(attrs)?.[1],
    name: /\bname="([^"]*)"/.exec(attrs)?.[1],
  }));
}

/** The links standing in for embeds, as a person gets them: address and words. */
function fallbacks(html: string): { href: string; text: string }[] {
  return [...html.matchAll(/<a class="embed-fallback[^"]*" href="([^"]*)">([^<]*)<\/a>/g)].map(
    ([, href, text]) => ({ href: decodeEntities(href), text: decodeEntities(text) }),
  );
}

describe.each(PATHS)('embeds through the %s', (_name, clean) => {
  const render = (name: string) => reader(clean(fixture(name)));

  it('renders a Datawrapper chart from a core/html block, at the height it was published at', () => {
    const html = render('datawrapper-html');
    expect(frames(html)).toEqual([
      { src: 'https://datawrapper.dwcdn.net/YBoom/7/', height: '505', name: undefined },
    ]);
    expect(fallbacks(html)).toEqual([]);
  });

  it('renders a Datawrapper chart from an embed block', () => {
    const html = render('datawrapper-figure');
    expect(frames(html)).toEqual([
      {
        src: 'https://datawrapper.dwcdn.net/ucMnH/4/#?secret=UuwinnGIfD',
        height: '516',
        name: undefined,
      },
    ]);
  });

  it("renders CORRECTIV's own app, keeping the name it reads its view from", () => {
    const html = render('correctiv-cdn');
    expect(frames(html)).toEqual([
      {
        src: 'https://cdn.correctiv.org/deployed-apps/CE_2026_bathing_sites/',
        height: undefined,
        name: 'de#5.5/51.21/10.27',
      },
    ]);
    expect(html).not.toContain('#bathing-sites-map');
  });

  /**
   * A frame nested inside an embed that loads a page on the app's own origin
   * reaches the app's storage through `top`, measured 2026-09-24 (ADR 0065 §7).
   * An embed that works without its own origin is given none, so nothing inside
   * it has one. CORRECTIV's own apps and 23degrees draw nothing that way.
   */
  it('gives the frames that work without an origin a sandbox of their own', () => {
    const sandbox = (name: string) =>
      [...render(name).matchAll(/<iframe\b[^>]*>/g)].map(
        ([tag]) => /\bsandbox="([^"]*)"/.exec(tag)?.[1],
      );
    const opaque = 'allow-scripts allow-popups allow-popups-to-escape-sandbox';
    expect(sandbox('datawrapper-html')).toEqual([opaque]);
    expect(sandbox('datawrapper-figure')).toEqual([opaque]);
    expect(sandbox('flourish')).toEqual([opaque]);
    expect(sandbox('correctiv-cdn')).toEqual([undefined]);
    expect(sandbox('documentcloud')).toEqual([undefined]);
  });

  it('renders a DocumentCloud document', () => {
    expect(frames(render('documentcloud')).map((f) => f.src)).toEqual([
      'https://embed.documentcloud.org/documents/28408410/pages/1/?embed=1&embed=1#?secret=U61dgC2AKD',
    ]);
  });

  it("turns Flourish's script embed into Flourish's own frame", () => {
    const html = render('flourish');
    expect(frames(html).map((f) => f.src)).toEqual(['https://flo.uri.sh/story/3759922/embed']);
    expect(html).not.toMatch(/<noscript|public\.flourish\.studio/);
  });

  it('links to YouTube rather than loading it, on either of its hosts', () => {
    const html = render('youtube');
    expect(frames(html)).toEqual([]);
    expect(fallbacks(html)).toEqual([
      {
        href: 'https://www.youtube-nocookie.com/embed/V8BxgDJlgec?si=90tWwcqSJDjKe5g5',
        text: 'Open content from youtube-nocookie.com in the browser',
      },
      {
        href: 'https://www.youtube.com/embed/fAEldoY68tc?feature=oembed',
        text: 'Open content from youtube.com in the browser',
      },
    ]);
    // The sentence introducing the video is still there to be read.
    expect(decodeEntities(html)).toContain('Das vollständige Interview');
  });

  it('links to an Instagram post by its permalink, and drops the placeholder around it', () => {
    const html = render('instagram');
    expect(fallbacks(html)).toEqual([
      {
        href: 'https://www.instagram.com/reel/DZb9VB7IBkT/?utm_source=ig_embed&utm_campaign=loading',
        text: 'Open content from instagram.com in the browser',
      },
    ]);
    expect(html).not.toMatch(/instagram-media|Ein Beitrag geteilt von/);
  });

  it('links to LinkedIn rather than loading it', () => {
    expect(fallbacks(render('linkedin'))).toEqual([
      {
        href: 'https://www.linkedin.com/embed/feed/update/urn:li:ugcPost:7495104262541156353?compact=1',
        text: 'Open content from linkedin.com in the browser',
      },
    ]);
  });

  it('links a correctiv.org post embedded in another to the article itself', () => {
    const html = render('correctiv-post');
    expect(frames(html)).toEqual([]);
    const article =
      'https://correctiv.org/faktencheck/hintergrund/2026/06/04/ein-leak-enthuellt-wie-kreml-geheimdienst-und-private-firmen-zusammenarbeiten/';
    expect(fallbacks(html)).toEqual([{ href: article, text: 'Read the embedded article' }]);
  });

  it('leaves no script anywhere in the body', () => {
    for (const name of ['datawrapper-html', 'flourish', 'instagram', 'correctiv-cdn']) {
      expect(clean(fixture(name))).not.toMatch(/<script|<noscript|<style/i);
    }
  });

  it('does not take a frame for an inline one because it wears the class', () => {
    const html = reader(
      clean('<p><iframe class="reader-embed" src="https://evil.example/x"></iframe></p>'),
    );
    expect(frames(html)).toEqual([]);
    expect(fallbacks(html)).toEqual([
      { href: 'https://evil.example/x', text: 'Open content from evil.example in the browser' },
    ]);
  });

  /**
   * A tag split by another the cleaner removes is put back together by the removal.
   * The frame this makes carries the reader's own class and a `srcdoc`, which is a
   * whole document of the author's choosing inside the reader.
   */
  it('does not let a removal reassemble a frame', () => {
    const body = clean(
      '<p><ifr<script></script>ame class="reader-embed" srcdoc="<p>x</p>"></iframe></p>' +
        '<p><ifr<script></script>ame src="https://evil.example/"></iframe></p>',
    );
    // A parser leaves the attempt as inert text, which is why the second pattern
    // asks for an attribute inside a tag and not for the word.
    expect(body).not.toMatch(/<iframe/i);
    expect(body).not.toMatch(/<[^>]*\bsrcdoc=/i);
  });

  it('drops markup that acts without a script: a refresh, a base, a stylesheet, a plug-in', () => {
    const body = clean(
      '<p>Text</p><META HTTP-EQUIV="refresh" content="0;url=https://example.com/">' +
        '<meta\nhttp-equiv=refresh content="1;url=/other.html"><base href="https://evil.example/">' +
        '<link rel="stylesheet" href="https://evil.example/x.css"><object data="x"></object>' +
        '<embed src="x"><portal src="https://evil.example/"></portal><frameset><frame src="x"></frameset>' +
        '<me<meta>ta http-equiv="refresh" content="0;url=https://example.com/">',
    );
    expect(body).not.toMatch(/<(meta|base|link|object|embed|portal|frame|frameset)\b/i);
    expect(body).toContain('<p>Text</p>');
  });

  it('never turns a frame address into a script address', () => {
    const html = reader(clean('<p><iframe src="javascript:alert(1)"></iframe></p>'));
    expect(html).not.toContain('javascript:');
    // With no address of its own worth following, it points at the article.
    expect(fallbacks(html).map((f) => f.href)).toEqual([ARTICLE_URL]);
  });
});

describe('the fallback link in the reader document', () => {
  it('is rebuilt from the marker, whatever else the marker carried', () => {
    const html = reader(
      '<a class="embed-fallback extra" href="https://youtube.com/x" onclick="alert(2)" ' +
        'data-embed-host="&quot;&gt;&lt;script&gt;alert(3)&lt;/script&gt;">old words</a>',
    );
    expect(html).not.toMatch(/onclick|<script|old words|extra/);
    expect(fallbacks(html)).toEqual([
      {
        href: 'https://youtube.com/x',
        text: 'Open content from "><script>alert(3)</script> in the browser',
      },
    ]);
  });

  /**
   * A marker whose address is not http(s) is no marker to the gate, so it stays a
   * plain link, and the gate takes its address away. Inert, and the words the body
   * carried are all that is left of it.
   */
  it('stops being a marker when its address is not one', () => {
    const html = reader('<a class="embed-fallback" href="javascript:alert(1)">old words</a>');
    expect(html).not.toMatch(/javascript:|embed-fallback"/);
    expect(bodyOf(html)).toBe('<a>old words</a>');
  });

  it('names the host of its own address when the marker names none', () => {
    expect(
      fallbacks(reader('<a class="embed-fallback" href="https://www.example.org/x"></a>')),
    ).toEqual([
      { href: 'https://www.example.org/x', text: 'Open content from example.org in the browser' },
    ]);
  });

  it('takes its words from the copy, so they follow the language', () => {
    const german: ReaderCopy = {
      ...COPY,
      embedFallback: (host) => `Inhalt von ${host} im Browser öffnen`,
    };
    const html = buildReaderHtml(
      {
        url: ARTICLE_URL,
        title: 'T',
        authors: [],
        publishedAt: '',
        readingMinutes: 1,
        bodyHtml:
          '<a class="embed-fallback" href="https://youtube.com/x" data-embed-host="youtube.com"></a>',
      },
      german,
      { locale: 'de' },
    );
    expect(fallbacks(html)[0].text).toBe('Inhalt von youtube.com im Browser öffnen');
  });
});

/**
 * The document forbids script to itself, which is what the web host's frame now
 * relies on instead of withholding `allow-scripts` (ADR 0065 §5). A policy in a
 * `<meta>` only covers what the parser meets after it, so its place is asserted
 * as well as its words.
 */
/**
 * The last gate: `buildReaderHtml` does not trust the body it is handed. A body
 * also comes out of the article cache and the offline bundle, written by whatever
 * cleaner was current then, so what acts from the body without a script is taken
 * out here as well as in the cleaners. On the web, the frame's `allow-scripts`
 * lifts the sandbox's block on a refresh, which the Content Security Policy does
 * not cover; on the phone, a refresh is a navigation the reader hands to the
 * system browser without anybody having tapped.
 */
describe('a body handed to the reader directly', () => {
  const PAGE_AFTER_CSP = (html: string) => html.slice(html.indexOf('<body>'));

  it('loses every refresh, base, link and plug-in, however it is spelled', () => {
    const html = reader(
      '<p>Text</p><meta http-equiv="refresh" content="1;url=https://example.com/">' +
        '<MeTa\thttp-equiv="Refresh" content="0;url=/same-origin.html">' +
        '<me<meta>ta http-equiv="refresh" content="0;url=https://example.com/">' +
        '<base href="https://evil.example/"><link rel="stylesheet" href="https://evil.example/x.css">' +
        '<object data="x"></object><embed src="x"><portal src="x"></portal>' +
        '<frameset><frame src="x"></frameset><applet code="x"></applet>',
    );
    const body = PAGE_AFTER_CSP(html);
    expect(body).not.toMatch(/<(meta|base|link|object|embed|portal|frame|frameset|applet)\b/i);
    // What a reassembly leaves is escaped text; what matters is that no tag holds it.
    expect(body).not.toMatch(/<[^>]*http-equiv/i);
    expect(body).toContain('<p>Text</p>');
  });

  /** On its own, because it is exported and a caller need not loop around it. */
  it('is stripped to a fixpoint by the function the gate is built on', () => {
    expect(
      stripActiveMarkup('<me<meta>ta http-equiv="refresh" content="0;url=/x.html"><p>Text</p>'),
    ).toBe('<p>Text</p>');
  });

  it('keeps a frame only as the canonical one, and only from a listed host', () => {
    const html = reader(
      '<iframe class="reader-embed" src="https://evil.example/x" loading="lazy"></iframe>' +
        '<iframe class="reader-embed" src="https://datawrapper.dwcdn.net/a/1/" srcdoc="x" ' +
        'height="400" onload="x()"></iframe>' +
        '<iframe srcdoc="<meta http-equiv=refresh content=0;url=/x.html>"></iframe>',
    );
    expect(frames(html)).toEqual([
      { src: 'https://datawrapper.dwcdn.net/a/1/', height: '400', name: undefined },
    ]);
    expect(html).not.toMatch(/srcdoc|onload|evil\.example/);
  });
});

describe("the reader document's Content Security Policy", () => {
  const html = reader('<p>Text</p>');
  const policy = /<meta http-equiv="Content-Security-Policy" content="([^"]*)">/.exec(html)?.[1];

  /** Whole, so that a directive taken out is a failure rather than a shorter string. */
  it('runs no script, takes no base or plug-in, and frames only the listed hosts', () => {
    expect(policy?.split('; ')).toEqual([
      "script-src 'none'",
      "object-src 'none'",
      "base-uri 'none'",
      "form-action 'none'",
      'frame-src https://datawrapper.dwcdn.net https://cdn.correctiv.org https://app.23degrees.io https://embed.documentcloud.org https://flo.uri.sh',
    ]);
  });

  it('comes before anything in the head that could load', () => {
    const head = /<head>([\s\S]*?)<\/head>/.exec(html)?.[1] ?? '';
    const first = /<(?!meta charset)\w+[^>]*>/.exec(head)?.[0] ?? '';
    expect(first).toContain('Content-Security-Policy');
  });
});
