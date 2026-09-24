import { cpSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable } from 'node:stream';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ROOT } from '../../plugin/collect.ts';
import { read } from '../../plugin/home-layout.ts';
import { docsPlugin } from '../../plugin/index.ts';
import { stringsEndpoint } from '../../plugin/strings.ts';
import { HOME_LAYOUT_ENDPOINT } from '../../src/preview/home/names.ts';
import {
  ENGLISH_EXTRACTION,
  GERMAN_CATALOGUE_DIR,
  STRINGS_ENDPOINT,
} from '../../src/preview/strings/names.ts';

/**
 * The two dev endpoints, driven the way the dev server drives them: a request stream
 * and a response, with nothing between them and the middleware.
 *
 * The strings endpoint writes into a COPY of the catalogue, handed to it as `root`, so
 * nothing here can touch the repository's own German. The refusals are asserted for
 * both endpoints because they are one function, and the hole the cold review of #259
 * found was in both.
 */

interface Sent {
  status: number;
  headers: Record<string, string>;
  body: Record<string, unknown>;
}

function request(
  url: string,
  {
    method = 'POST',
    headers = { 'content-type': 'application/json', host: 'localhost:5173' } as Record<
      string,
      string
    >,
    body = [] as (string | Buffer)[],
    peer = '127.0.0.1',
  } = {},
): IncomingMessage {
  const stream = Readable.from(
    body.map((chunk) => (typeof chunk === 'string' ? Buffer.from(chunk) : chunk)),
  );
  return Object.assign(stream, {
    url,
    method,
    headers,
    socket: { remoteAddress: peer },
  }) as unknown as IncomingMessage;
}

function call(
  middleware: (req: IncomingMessage, res: ServerResponse, next: () => void) => Promise<void> | void,
  req: IncomingMessage,
): Promise<Sent | 'next'> {
  return new Promise((resolve) => {
    const headers: Record<string, string> = {};
    const res = {
      statusCode: 200,
      setHeader: (name: string, value: string) => void (headers[name.toLowerCase()] = value),
      end: (text: string) =>
        resolve({
          status: res.statusCode,
          headers,
          body: JSON.parse(text) as Record<string, unknown>,
        }),
    };
    void middleware(req, res as unknown as ServerResponse, () => resolve('next'));
  });
}

const json = { 'content-type': 'application/json', host: 'localhost:5173' };

describe('the refusals both endpoints share', () => {
  const endpoints = [
    ['strings', STRINGS_ENDPOINT],
    ['home layout', HOME_LAYOUT_ENDPOINT],
  ] as const;

  /** Both, as the dev server mounts them. */
  function mounted(): ((req: IncomingMessage, res: ServerResponse, next: () => void) => void)[] {
    const used: ((req: IncomingMessage, res: ServerResponse, next: () => void) => void)[] = [];
    const plugin = docsPlugin() as { configureServer: (server: unknown) => void };
    plugin.configureServer({
      middlewares: { use: (fn: never) => used.push(fn) },
      watcher: { add: () => {} },
    });
    return used;
  }

  /** The first mounted middleware that answers, the way connect walks them. */
  async function through(req: IncomingMessage): Promise<Sent | 'next'> {
    for (const middleware of mounted()) {
      const sent = await call(middleware, req);
      if (sent !== 'next') return sent;
    }
    return 'next';
  }

  it.each(endpoints)('mounts the %s endpoint on the dev server', async (_, url) => {
    const sent = await through(request(url, { method: 'GET' }));
    expect(sent).not.toBe('next');
    expect((sent as Sent).status).toBe(405);
  });

  it.each(endpoints)('refuses a GET to the %s endpoint', async (_, url) => {
    const sent = (await through(request(url, { method: 'GET' }))) as Sent;
    expect(sent.status).toBe(405);
    expect(sent.headers.allow).toBe('POST');
    expect(sent.body.code).toBe('method');
  });

  it.each(endpoints)('refuses the %s endpoint to another machine', async (_, url) => {
    const sent = (await through(request(url, { peer: '10.0.0.7' }))) as Sent;
    expect([sent.status, sent.body.code]).toEqual([403, 'not-loopback']);
  });

  it.each(endpoints)('refuses the %s endpoint to another site’s page', async (_, url) => {
    const foreign = (await through(
      request(url, { headers: { ...json, origin: 'https://evil.example' } }),
    )) as Sent;
    expect([foreign.status, foreign.body.code]).toEqual([403, 'cross-site']);

    const marked = (await through(
      request(url, { headers: { ...json, 'sec-fetch-site': 'cross-site' } }),
    )) as Sent;
    expect([marked.status, marked.body.code]).toEqual([403, 'cross-site']);

    const opaque = (await through(request(url, { headers: { ...json, origin: 'null' } }))) as Sent;
    expect([opaque.status, opaque.body.code]).toEqual([403, 'cross-site']);
  });

  it.each(endpoints)(
    'refuses a body to the %s endpoint that is not declared JSON',
    async (_, url) => {
      // `text/plain` is what a page may send across origins without a preflight, which is
      // how the cold review's no-cors POST reached the file.
      const sent = (await through(
        request(url, { headers: { 'content-type': 'text/plain', host: 'localhost:5173' } }),
      )) as Sent;
      expect([sent.status, sent.body.code]).toEqual([415, 'content-type']);
    },
  );

  it('lets the site’s own page through, and a terminal without an Origin', async () => {
    const own = request(STRINGS_ENDPOINT, {
      headers: { ...json, origin: 'http://localhost:5173', 'sec-fetch-site': 'same-origin' },
      body: ['not json'],
    });
    expect(((await through(own)) as Sent).body.code).toBe('not-json');
    const terminal = request(STRINGS_ENDPOINT, { body: ['not json'] });
    expect(((await through(terminal)) as Sent).body.code).toBe('not-json');
  });
});

describe('the body is read as bytes', () => {
  it('decodes a character split across two chunks', async () => {
    const bytes = Buffer.from('{"x":"Größe"}');
    const cut = bytes.indexOf(0xc3) + 1; // inside the two bytes of "ö"
    const text = await read(Readable.from([bytes.subarray(0, cut), bytes.subarray(cut)]));
    expect(text).toBe('{"x":"Größe"}');
  });

  it('counts the limit in bytes', async () => {
    const umlauts = 'ä'.repeat(10); // twenty bytes, ten characters
    expect(await read(Readable.from([Buffer.from(umlauts)]), 19)).toBeNull();
    expect(await read(Readable.from([Buffer.from(umlauts)]), 20)).toBe(umlauts);
  });
});

describe('a save, into a copy of the catalogue', () => {
  let root: string;
  const regenerate = vi.fn();

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'strings-endpoint-'));
    cpSync(join(ROOT, GERMAN_CATALOGUE_DIR), join(root, GERMAN_CATALOGUE_DIR), { recursive: true });
    cpSync(join(ROOT, ENGLISH_EXTRACTION), join(root, ENGLISH_EXTRACTION));
    regenerate.mockReset();
  });

  afterEach(() => rmSync(root, { recursive: true, force: true }));

  const endpoint = () => stringsEndpoint({ root, format: () => {}, regenerate });
  const home = () => readFileSync(join(root, GERMAN_CATALOGUE_DIR, 'home.ts'), 'utf8');

  it('writes the German, split across chunks, and rebuilds the table', async () => {
    const body = Buffer.from(JSON.stringify({ 'home.viewAll': 'Alle Größen' }));
    const cut = body.indexOf(0xc3) + 1;
    const sent = (await call(
      endpoint(),
      request(STRINGS_ENDPOINT, { body: [body.subarray(0, cut), body.subarray(cut)] }),
    )) as Sent;
    expect(sent.status).toBe(200);
    expect(sent.body).toEqual({ paths: [`${GERMAN_CATALOGUE_DIR}/home.ts`], table: true });
    expect(home()).toContain("'home.viewAll': 'Alle Größen',");
    expect(regenerate).toHaveBeenCalledTimes(1);
  });

  it('says so when the table could not be rebuilt, and keeps the files', async () => {
    regenerate.mockImplementation(() => {
      throw new Error('no tsx');
    });
    const sent = (await call(
      endpoint(),
      request(STRINGS_ENDPOINT, { body: [JSON.stringify({ 'home.viewAll': 'Alle zeigen' })] }),
    )) as Sent;
    expect(sent.body.table).toBe(false);
    expect(home()).toContain("'home.viewAll': 'Alle zeigen',");
  });

  it('writes nothing and rebuilds nothing when one id is refused', async () => {
    const before = home();
    const sent = (await call(
      endpoint(),
      request(STRINGS_ENDPOINT, {
        body: [JSON.stringify({ 'home.viewAll': 'Alle zeigen', 'home.invented': 'Neu' })],
      }),
    )) as Sent;
    expect([sent.status, sent.body.code]).toEqual([400, 'refused']);
    expect(home()).toBe(before);
    expect(regenerate).not.toHaveBeenCalled();
  });

  it('refuses an empty object and anything that is not id to German', async () => {
    for (const body of ['{}', '[]', '{"home.viewAll":3}']) {
      const sent = (await call(endpoint(), request(STRINGS_ENDPOINT, { body: [body] }))) as Sent;
      expect([sent.status, sent.body.code]).toEqual([400, 'shape']);
    }
  });
});
