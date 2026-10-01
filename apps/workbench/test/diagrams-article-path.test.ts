import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { CONTENT_FEEDS, PODCAST_CHANNELS } from '@correctiv/app-core/data/feeds.config';
import { CACHE_LIMITS } from '@correctiv/app-core/services/cache.service';

import { OFFLINE_ARTICLES, OFFLINE_FEEDS } from '@/lib/articles/offlineBundle.generated';
import { OFFLINE_COVERS } from '@/lib/articles/offlineCovers.generated';
import { OFFLINE_PODCASTS } from '@/lib/podcasts/offlineBundle.generated';

import { ROOT } from '../plugin/collect.ts';
import { RUNGS } from '../src/diagrams/ArticlePath';
import {
  CORE,
  constantValue,
  drawn,
  drawnText,
  functionBody,
  functionParameters,
  interfaceMembers,
  NUMBER_WORDS,
  parse,
  pathsDrawn,
  says,
  spelledNumber,
} from './drawn.ts';

const DRAWING = 'ArticlePath.tsx';
const LOAD = join(CORE, 'articles/load.ts');
const PORTS = join(CORE, 'ports/index.ts');
const CACHE = join(CORE, 'services/cache.service.ts');
const WP = join(CORE, 'services/wp.service.ts');
const READER_HTML = join(CORE, 'articles/reader-html.ts');
const READER_FONTS = join(ROOT, 'apps/mobile/src/lib/theme/readerFonts.generated.ts');

/**
 * The sixth drawing prints a dozen numbers, and every one of them is a figure
 * measured against this repository.
 *
 * Which is the case AGENTS.md calls the faster of the two ways a figure goes
 * quiet: nothing about a wrong one looks wrong. The three cache bounds were argued
 * from measurements and could be re-argued tomorrow; the bundle's counts move the
 * moment somebody regenerates it; the two timeouts were chosen against each other
 * and one of them is already a compromise. So each is read from the file that
 * decides it rather than typed twice.
 *
 * **What is checked how, because the drawing is built two ways.** Everything
 * written as literal JSX inside the `<svg>` is checked through `drawnText`, which
 * reads the picture and not the prose around it. The five rungs are labels out of
 * an array, and an array is invisible to that reading — correctly, it reads the
 * file rather than the render — so `ArticlePath.tsx` exports `RUNGS` and the order
 * is compared against the order of calls in `loadArticle` itself.
 *
 * **One figure is a pointer rather than a reading**, and it is called out where it
 * is asserted: "ten times the bytes" for the page HTML against the extracted
 * article. Nothing enforces that ratio, nothing re-takes it, and the nearest
 * reading available is the sentence in `articles/load.ts` it came from.
 */

/** A limit as the drawing spells it, which is how `cache.service.ts` argues it. */
function asUnits(count: number): string {
  if (count >= 1024 * 1024) return `${count / 1024 / 1024} MiB`;
  return `${count / 1024} KiB`;
}

describe('the cascade drawing, against the cascade', () => {
  /**
   * The order, which is the whole argument of the picture.
   *
   * Read out of `loadArticle` with `readFromNetwork` spliced in where it is
   * called, because rungs 3 and 4 live inside that function and a reader of the
   * drawing has no reason to care. Swap rung 1 and rung 2 in the code — which is
   * the change somebody would make to "fix" an app that shows stale content — and
   * this fails.
   */
  it('draws the five rungs in the order the code tries them', () => {
    /** Each rung as the code writes it, and as a reader of the picture reads it. */
    const CASCADE = [
      { inCode: 'content.article(', drawn: 'content.article' },
      { inCode: 'getCached<', drawn: 'getCached' },
      { inCode: 'fetchWpArticle(', drawn: 'fetchWpArticle' },
      { inCode: 'fetchText(', drawn: 'fetchText' },
      { inCode: 'getStale<', drawn: 'getStale' },
    ];

    const source = parse(LOAD);
    const spliced = functionBody(source, 'loadArticle').replace(
      /readFromNetwork\([^)]*\)/,
      functionBody(source, 'readFromNetwork'),
    );

    const at = CASCADE.map((rung) => spliced.indexOf(rung.inCode));
    expect(at.filter((index) => index === -1)).toEqual([]);
    expect(at).toEqual([...at].sort((a, b) => a - b));

    expect(RUNGS).toHaveLength(CASCADE.length);
    const mislabelled = CASCADE.filter((rung, i) => !RUNGS[i].call.includes(rung.drawn)).map(
      (rung) => `rung ${CASCADE.indexOf(rung) + 1} is drawn as something other than ${rung.drawn}`,
    );
    expect(mislabelled).toEqual([]);
  });

  /**
   * One figure in this drawing is a pointer rather than a reading, and this is it.
   *
   * "ten times the bytes" for the page HTML against the extracted article comes
   * from a measurement in `articles/load.ts` that nothing re-takes; it is a reason
   * for caching one and not the other, not a bound anything enforces. So it is
   * held to the one place it is stated instead of being typed twice, which is the
   * weaker arrangement AGENTS.md describes: a pointer stops two copies parting and
   * does nothing about the one copy going stale.
   */
  it('quotes the ratio from the file that measured it', () => {
    expect(readFileSync(LOAD, 'utf8')).toContain('a tenth of the bytes');
    expect(says(drawnText(DRAWING), 'ten times the bytes')).toBe(true);
  });

  it('gives each rung the namespace, window and budget the code gives it', () => {
    const source = parse(LOAD);
    const drawnRungs = RUNGS.map((rung) => rung.call).join(' / ');
    const asides = RUNGS.map((rung) => `${rung.aside ?? ''} ${rung.timeout ?? ''}`).join(' / ');

    // The cache namespace, which rungs 2 and 5 both address.
    expect(drawnRungs).toContain(`'${constantValue(source, 'CACHE_NS')}'`);

    // The window rung 2 reads inside, written in hours because a reader reads
    // hours and `load.ts` writes `24 * 60 * 60 * 1000`.
    const ttl = constantValue(source, 'TTL_MS') as number;
    expect(drawnRungs).toContain(`${ttl / 3_600_000} h`);

    // The two budgets, and the drawing puts the shorter one on the earlier rung
    // because that is the decision `load.ts` explains at length.
    const api = constantValue(source, 'API_TIMEOUT_MS') as number;
    const page = constantValue(source, 'PAGE_TIMEOUT_MS') as number;
    expect(api).toBeLessThan(page);
    expect(asides).toContain(`${api / 1000} s`);
    expect(asides).toContain(`${page / 1000} s`);
  });

  /**
   * The one host the drawing names, held to the host the code actually asks.
   *
   * Off the REST base in `wp.service.ts` rather than off the source manifest: the
   * manifest records the endpoints as prose (`wp/v2/posts, by category id`) and
   * has no host field to compare against, so the code is the nearer reading.
   */
  it('names the host rungs 3 and 4 reach', () => {
    const api = constantValue(parse(WP), 'API') as string;
    const host = new URL(api).hostname;
    const asides = RUNGS.map((rung) => rung.aside).filter(Boolean) as string[];

    expect(asides.length).toBe(2);
    expect(new Set(asides)).toEqual(new Set([host]));
  });
});

describe('the cascade drawing, against the bundle', () => {
  it('names every method of the port, in the order the port declares them', () => {
    const methods = interfaceMembers(parse(PORTS), 'ContentBundle');
    // One assertion for both directions and the order: a method added, removed or
    // moved breaks the line as drawn.
    expect(drawnText(DRAWING)).toContain(methods.join(', '));
  });

  it('spells how many methods it has, twice, and both times correctly', () => {
    const methods = interfaceMembers(parse(PORTS), 'ContentBundle');
    const spelled = spelledNumber(methods.length);
    const text = drawnText(DRAWING);

    expect(says(text, `${spelled} methods`)).toBe(true);
    expect(says(text, `to all ${spelled}`)).toBe(true);
  });

  /**
   * The drawing says the empty bundle answers null to every method, which is what
   * makes the first rung a no-op on every host but this one. Read off the function
   * rather than believed: a method added to the interface and forgotten here would
   * be a `TypeError` at the first rung, not a null.
   */
  it('is right that the empty bundle answers null to all of them', () => {
    const source = parse(PORTS);
    const methods = interfaceMembers(source, 'ContentBundle');
    const body = functionBody(source, 'createEmptyContentBundle');

    const answering = methods.filter((method) =>
      new RegExp(`${method}:\\s*\\(\\)\\s*=>\\s*null`).test(body),
    );
    expect(answering).toEqual(methods);
    expect([...body.matchAll(/=>\s*null/g)]).toHaveLength(methods.length);
  });

  /**
   * The four counts, each against the thing that decides it.
   *
   * Two of them are decided twice over, which is the point: the feed and podcast
   * counts come out of the core's own configuration AND out of the generated file,
   * so a feed added to `feeds.config.ts` without regenerating the bundle fails
   * here rather than showing up as a screen that is quietly empty offline.
   *
   * The article and cover counts have one source each, the generated modules, and
   * they are stable because the script picks a fixed number per feed. They move
   * when somebody changes that, which is exactly when the drawing should fail.
   */
  it('counts what the bundle holds', () => {
    const text = drawnText(DRAWING);

    expect(Object.keys(OFFLINE_FEEDS)).toHaveLength(CONTENT_FEEDS.length);
    expect(Object.keys(OFFLINE_PODCASTS)).toHaveLength(PODCAST_CHANNELS.length);
    expect(Object.keys(OFFLINE_COVERS)).toHaveLength(Object.keys(OFFLINE_ARTICLES).length);

    expect(says(text, `${Object.keys(OFFLINE_ARTICLES).length} articles`)).toBe(true);
    expect(says(text, `${Object.keys(OFFLINE_COVERS).length} cover images`)).toBe(true);
    expect(says(text, `${CONTENT_FEEDS.length} feed snapshots`)).toBe(true);
    expect(says(text, `${PODCAST_CHANNELS.length} podcast shows`)).toBe(true);
  });

  it('names the generated modules it is counting', () => {
    const text = drawnText(DRAWING);
    const wanted = ['OFFLINE_ARTICLES', 'OFFLINE_COVERS', 'OFFLINE_FEEDS', 'OFFLINE_PODCASTS'];
    expect(wanted.filter((name) => !drawn(text, name))).toEqual([]);
  });
});

describe('the cascade drawing, against the cache', () => {
  it('prints the three bounds the cache enforces', () => {
    const text = drawnText(DRAWING);
    expect(text).toContain(asUnits(CACHE_LIMITS.maxEntryBytes));
    expect(text).toContain(asUnits(CACHE_LIMITS.maxTotalBytes));
    expect(says(text, `${CACHE_LIMITS.maxEntries} entries`)).toBe(true);
  });

  /**
   * The drawing's strongest claim about the cache, and the one worth a check of
   * its own: an eviction here cannot reach a saved article or a setting, because
   * this file writes through the blob port and touches the key-value one nowhere.
   *
   * Asked of the file rather than of the host's two storage instances, because the
   * separation the drawing draws is the core's. The host doubling it with two MMKV
   * stores is a second guarantee and not this one.
   */
  it('is right that the cache never reaches the key-value store', () => {
    const text = readFileSync(CACHE, 'utf8');
    const code = text
      .split('\n')
      .filter((line) => !/^\s*(\/\/|\*|\/\*)/.test(line))
      .join('\n');

    expect(code).toMatch(/platform\(\)\.blobs\./);
    expect(code).not.toMatch(/\bkeyValue\b/);
  });

  /**
   * And the unit, which the caption names and the constants do not.
   *
   * `MAX_ENTRY_BYTES` counts `payload.length` on a JavaScript string, so it counts
   * UTF-16 code units. The drawing prints KiB and MiB, which read as bytes, and
   * the caption says so; this holds the caption to the code rather than to a
   * reviewer remembering.
   */
  it('measures what the cache measures, which is a string length', () => {
    const text = readFileSync(CACHE, 'utf8');
    expect(text).toMatch(/payload\.length\s*>\s*MAX_ENTRY_BYTES/);

    const file = readFileSync(join(ROOT, 'apps/workbench/src/diagrams', DRAWING), 'utf8');
    expect(file).toContain('UTF-16 code unit');
  });
});

describe('the cascade drawing, against the document it ends on', () => {
  /**
   * The builder's signature, which the drawing prints as a label.
   *
   * It printed `buildReaderHtml(article, copy)` and the function takes three
   * parameters. The third is optional, so nothing about the two-argument spelling
   * was a lie about how it may be called — and it was the one that mattered, since
   * the drawing has a whole box for what the host puts into the document and that
   * box IS the third parameter. A picture that draws a thing and omits it from the
   * signature beside it has two halves that disagree.
   *
   * The parameters are read off the declaration rather than spelled here, so a
   * fourth arriving, or `options` being renamed, takes the label with it.
   */
  it('prints the builder with every parameter the builder declares', () => {
    const parameters = functionParameters(parse(READER_HTML), 'buildReaderHtml');
    expect(parameters.length).toBeGreaterThan(2);
    expect(drawnText(DRAWING)).toContain(`buildReaderHtml(${parameters.join(', ')})`);
  });

  /**
   * "The two fonts", which is two families and four faces.
   *
   * Both numbers are true of the same file and they are answers to different
   * questions, so the drawing has to say which it means. It said "the two fonts"
   * beside a sentence about bytes, where a reader counts `@font-face` rules and
   * gets four. The generated stylesheet is the only thing that knows, and it is
   * regenerated by a script, so this counts rather than asserting a literal.
   */
  it('counts the font families and the faces the reader stylesheet carries', () => {
    const css = readFileSync(READER_FONTS, 'utf8');
    const faces = [...css.matchAll(/@font-face/g)].length;
    const families = new Set([...css.matchAll(/font-family:\s*'([^']+)'/g)].map((m) => m[1]));
    expect(faces).toBeGreaterThan(families.size);

    const text = drawnText(DRAWING);
    expect(says(text, `${NUMBER_WORDS[families.size]} families`)).toBe(true);
    expect(says(text, `${NUMBER_WORDS[faces]} faces`)).toBe(true);
  });
});

describe('the cascade drawing, against the tree', () => {
  it('names no file that is not there', () => {
    const { named, missing } = pathsDrawn(drawnText(DRAWING));
    expect(named.length).toBeGreaterThan(1);
    expect(missing).toEqual([]);
  });
});
