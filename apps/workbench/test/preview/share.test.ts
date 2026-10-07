import { describe, expect, it } from 'vitest';

import { formatLayoutDocument, SHIPPED, withHidden } from '../../src/preview/home/document';
import { restorable } from '../../src/preview/home/write';
import {
  pack,
  packedIn,
  SHARE_ADDRESS_LIMIT,
  SHARE_CEILING,
  shareLink,
  unpack,
} from '../../src/preview/share';

/**
 * A draft that travels in the link (ADR 0076 §2).
 *
 * The payload in every round trip is the document this repository actually ships with one
 * block changed, because the two failure modes that matter here are both about real text:
 * a real document is what makes the compressor earn its keep, and a document nobody has
 * checked in is not what anybody is going to share.
 */
const AT = {
  base: 'https://correctiv.github.io/correctiv-app/preview',
  hash: '#/home?d=ipad-mini&tm=18:30',
};
const EDITED = withHidden(SHIPPED, null, 'hero', true);
const DRAFT = { screen: 'home', document: formatLayoutDocument(EDITED), layout: 'demo' };

/** The fragment of an address, which is where the draft and the frame both live. */
const hashOf = (link: string | null): string => (link ?? '').slice((link ?? '').indexOf('#'));

/** What a link carries, or null where the tool would hand over none. */
async function draftIn(link: string | null) {
  const arrival = await unpack(packedIn(hashOf(link)) ?? '');
  return arrival === null || 'damaged' in arrival ? null : arrival.draft;
}

/**
 * Two documents are the same when the tool would write the same file for both.
 *
 * Compared that way rather than character for character because what travels is a JSON
 * value: two spaces and a newline are the printer's, not the document's, and `restorable`
 * is the parser the arrival goes through anyway.
 */
const sameDocument = (text: string, wanted: string): boolean => {
  const parsed = restorable(JSON.parse(text));
  return parsed !== null && formatLayoutDocument(parsed) === wanted;
};

/**
 * Text that does not compress, because a repeated word compresses to almost nothing and a
 * limit measured against one is a limit measured against nothing.
 *
 * A xorshift over the base64url alphabet, and seeded from its own length so that the same
 * filler comes back on every run: the tests below compare lengths, and a filler that
 * changed between two calls would be two different documents.
 */
function noise(length: number): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
  let seed = (length * 2654435761) | 0 || 1;
  let out = '';
  for (let at = 0; at < length; at += 1) {
    seed ^= seed << 13;
    seed ^= seed >>> 17;
    seed ^= seed << 5;
    out += alphabet[Math.abs(seed) % alphabet.length];
  }
  return out;
}

/** The draft with `length` characters of noise pinned onto the hero, which is a real edit. */
const pinned = (length: number) => ({
  ...DRAFT,
  document: DRAFT.document.replace(
    '"id": "hero", "module": "article-hero"',
    `"id": "hero", "module": "article-hero", "settings": { "pin": { "post": "${noise(length)}" } }`,
  ),
});

describe('a draft through a link and back (ADR 0076 §2)', () => {
  it('comes back as the document it left as', async () => {
    const { link, length } = await shareLink('home', DRAFT, AT);
    expect(link).not.toBeNull();
    expect(length).toBe((link ?? '').length);
    expect(length).toBeLessThanOrEqual(SHARE_ADDRESS_LIMIT);
    const draft = await draftIn(link);
    expect(draft?.screen).toBe('home');
    /*
     * Compared as the tool would write it rather than character for character: what
     * travels is a JSON value, and a value has no formatting of its own, so the two
     * printers' newline habits are not a fact about the document.
     */
    expect(sameDocument(draft?.document ?? '', DRAFT.document)).toBe(true);
  });

  it('opens on this page with the home tool and the frame the reader will be looking at', async () => {
    const { link } = await shareLink('home', DRAFT, AT);
    const url = new URL(link ?? 'https://example.invalid');
    expect(`${url.origin}${url.pathname}`).toBe(AT.base);
    expect(url.hash.startsWith('#/home?')).toBe(true);
    expect(url.hash).toContain('d=ipad-mini');
    expect(url.hash).toContain('tm=18%3A30');
  });

  it('keeps the layout the draft is of, `ship` included, which is not the default of a link', async () => {
    const { link } = await shareLink('home', { ...DRAFT, layout: 'ship' }, AT);
    expect((await draftIn(link))?.layout).toBe('ship');
  });

  /*
   * One draft, not two. A link built out of a link is how somebody shares the second edit
   * of a draft somebody else already sent, and two of the same parameter in one address
   * is a document nobody can say which of the two they are looking at.
   */
  it('carries one draft when it is built out of a link that already carries one', async () => {
    const first = await shareLink('home', DRAFT, AT);
    const again = await shareLink('home', DRAFT, { base: AT.base, hash: hashOf(first.link) });
    expect(hashOf(again.link).match(/draft=/g)).toHaveLength(1);
    expect(await draftIn(again.link)).toEqual(await draftIn(first.link));
  });

  /*
   * What the packing is for, in one number: the document as it ships is 1,117 characters
   * and the address carrying it is 560, of which 476 is the draft and 84 the page and the
   * frame's own parameters. Without the compression the limit would be about a fifth of
   * what it is, and a document with ten blocks on it would be over it.
   */
  it('is shorter than the document it carries', async () => {
    expect((await pack(DRAFT)).length).toBeLessThan(DRAFT.document.length / 2);
  });
});

describe('a draft too long to share (ADR 0076 §2)', () => {
  /*
   * **Noise, and deliberately so.** Measured on 2026-10-02: every way of arranging the
   * shipped home document came in under 1,200 characters of address — 150 blocks added to
   * it, forty pinned articles, and the document as it ships at 554. So the limit
   * is a backstop against a document nothing in this repository produces, and the only
   * honest way to reach it is text no editor would write: a thousand characters that do not
   * compress. A repeated word compresses to nothing and would have made this describe a
   * document half a kilobyte of.
   */
  const long = pinned(2000);

  it('hands over no link, and says how long the address came out', async () => {
    const { link, length } = await shareLink('home', long, AT);
    expect(link).toBeNull();
    expect(length).toBeGreaterThan(SHARE_ADDRESS_LIMIT);
  });

  /*
   * The address is refused and not the draft. A link that cannot be built is a thing the
   * person is told about; a draft that cannot be shared is one they submit, and it has to
   * survive the refusal to be of any use. So what comes back out of the packed draft is
   * that draft, down to the pinned id that made it too long.
   */
  it('leaves the draft itself openable, and whole', async () => {
    const arrival = await unpack(await pack(long));
    const document = arrival !== null && 'draft' in arrival ? arrival.draft.document : '';
    expect(document).toContain(noise(2000));
    expect(sameDocument(DRAFT.document, long.document)).toBe(false);
  });

  it('fits right up to the limit, and not one character past it', async () => {
    /*
     * Searched rather than guessed, because the length of an address is not linear in the
     * size of the draft: the compressor's own ratio moves as more of the document is text
     * it has already seen. The invariant the search keeps is what the test is about — the
     * last length that fits and the first that does not, one character of noise apart.
     */
    let below = 0;
    let above = 4000;
    while (above - below > 1) {
      const middle = Math.floor((below + above) / 2);
      const { link } = await shareLink('home', pinned(middle), AT);
      if (link === null) above = middle;
      else below = middle;
    }
    expect((await shareLink('home', pinned(below), AT)).link).not.toBeNull();
    expect((await shareLink('home', pinned(above), AT)).link).toBeNull();
    expect(above - below).toBe(1);
  });
});

describe('a fragment that is not a draft (ADR 0076 §3)', () => {
  /** Every fault collapses into one answer, so every fault is asked for in one place. */
  const damaged = async (packed: string) => await unpack(packed);

  /** `btoa` and a deflate stream, the two halves of what `pack` builds. */
  const deflated = async (text: string): Promise<string> => {
    const bytes = new TextEncoder().encode(text);
    const stream = new Response(bytes).body!.pipeThrough(new CompressionStream('deflate-raw'));
    const reader = stream.getReader();
    let packed = '';
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      packed += String.fromCharCode(...value);
    }
    return btoa(packed);
  };

  it('is one answer for characters that are not base64', async () => {
    expect(await damaged('not base64 at all!!')).toEqual({ damaged: true });
  });

  it('is one answer for base64 that is not a deflate stream', async () => {
    expect(await damaged(btoa('nothing compressed here'))).toEqual({ damaged: true });
  });

  it('is one answer for a stream that decodes to something else', async () => {
    expect(await damaged(await deflated('no envelope in here'))).toEqual({ damaged: true });
  });

  it('is one answer for an envelope that is missing half of itself', async () => {
    expect(await damaged(await deflated(JSON.stringify({ target: 'home' })))).toEqual({
      damaged: true,
    });
    expect(await damaged(await deflated(JSON.stringify({ document: { version: 4 } })))).toEqual({
      damaged: true,
    });
  });

  /*
   * A deflate stream is a statement about how much there will be when it is finished, and
   * nothing keeps that statement honest. This one is 786 KB of one character in about 500
   * characters of link, which is the shape of the thing the ceiling is there for: a small
   * address asking for a large answer.
   */
  it('is one answer for a small link that would inflate past the ceiling', async () => {
    const bomb = JSON.stringify({
      target: 'home',
      document: { filler: 'x'.repeat(SHARE_CEILING * 3) },
    });
    const packed = await deflated(bomb);
    expect(packed.length).toBeLessThan(SHARE_ADDRESS_LIMIT * 2);
    await damaged(packed);
  });

  it('is one answer for a parameter that is not a draft', () => {
    expect(packedIn('#/home?d=ipad-mini')).toBeNull();
    expect(packedIn('#/home?draft=')).toBeNull();
    expect(packedIn('#/home')).toBeNull();
  });
});

describe('the address a draft is read out of', () => {
  /*
   * The one thing the whole mechanism rests on, asked where it can be seen to be true: the
   * parameter is in the fragment, and a fragment is not in the request. The same parameter
   * in the search is therefore not read — which is why the tool never puts one there.
   */
  it('is read out of the fragment and not out of the search', () => {
    expect(packedIn('#/home?draft=abc')).toBe('abc');
    /*
     * The address a search-parameter version of that link would have, read the one way the
     * tool reads: the fragment, which is empty. A draft in the search is not read, and the
     * tool never writes one — which is the whole of why it uses the fragment.
     */
    const searched = new URL('https://example.invalid/home?draft=abc');
    expect(searched.search).toBe('?draft=abc');
    expect(packedIn(searched.hash)).toBeNull();
  });

  it('carries base64url, so no character of it means anything to the address', async () => {
    /* `+`, `/` and `=` are the three, and the last is stripped rather than escaped. */
    const packed = await pack(DRAFT);
    expect(packed).toMatch(/^[A-Za-z0-9_-]+$/);
  });
});
