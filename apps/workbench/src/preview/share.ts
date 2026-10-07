/**
 * A draft that travels in the link, so somebody else can look at it before anybody
 * submits anything ([ADR 0076](../../../../adr/0076-a-draft-travels-in-the-fragment.md)).
 *
 * **The fragment, and never the search.** The browser does not put a fragment in a
 * request, and this site has no server to put one in: the workbench holds no power and
 * performs no authorised write ([ADR 0058](../../../../adr/0058-the-workbench-holds-no-power-and-github-is-who-you-are.md)
 * §1), so everything it offers leaves by navigation to somewhere that already knows who
 * the person is. A search would be the other half of that page's address, and a search
 * does get sent.
 *
 * **Length is the limit and not secrecy.** What a draft carries is what a submission puts
 * into a public GitHub issue anyway, so hiding it in the link would buy nothing and cost
 * a person the ability to look at it. The bound below is about whether a link is still a
 * link once it is pasted somewhere.
 *
 * **Pure.** No `window`, no `virtual:` module and no React: the tool that builds a link,
 * the page that opens one and this file's own test are three callers, and the test is
 * Node. The address grammar it writes is `shell/address.ts`'s, the frame's half of it is
 * `state.ts`'s, and the envelope the draft travels in is `submission.ts`'s — the same
 * `{ target, document }` an issue carries, so the two ends cannot spell it differently.
 */

import { parseAddress, writeAddress } from '../shell/address';
import type { SectionId } from '../shell/views';
import { VIEWS } from '../shell/views';
import { EXAMPLE_LAYOUT } from '@correctiv/app-core/data/layouts/registry';
import { fromAddress, toAddress } from './state';
import { layoutPayload } from './submission';

/**
 * The hash parameter the draft travels in.
 *
 * `draft`, and not the `d` the plan named: `d` has been the device since the address had
 * five parameters (`#/?d=ipad-mini`), and a second meaning for a letter every link
 * already carries would make one of them wrong rather than longer.
 */
export const SHARE_PARAMETER = 'draft';

/**
 * The longest address this tool will hand over. Past it there is no link, and the tool
 * says so and points at the submission instead.
 *
 * **Not the browser, which was measured and is a thousand times higher.** Chrome 153
 * opened an address of 2,097,120 characters (a fragment of 2,097,064) with the whole of it
 * intact, and lost the load at 2,097,154 — 2 MiB for the whole address, measured on
 * 2026-10-02 by driving the browser over CDP the way `scripts/renders.mjs` does. A limit
 * anywhere near that would be a limit on nothing: the browser would carry what the tool
 * refused to build.
 *
 * **So the limit is where a link stops being a link.** It is measured in the other
 * direction, against the documents this tool actually holds:
 *
 * | the document | characters | the address it packs into |
 * |---|---|---|
 * | Home as it ships (`SHIPPED`, one block off) | 1,117 | 554 |
 * | 150 `teaser-grid` blocks added | 9,707 | 1,125 |
 * | 40 `article-hero` blocks, each with a pinned article | 6,214 | 971 |
 * | the shipped document with 1,000 characters that do not compress | 2,117 | 1,702 |
 * | the shipped document with 2,000 characters that do not compress | 3,117 | 2,723, refused |
 *
 * So 2,000 is roughly a paragraph of text that will not compress, and every way of
 * arranging the day that was measured fits under 1,200 characters of address. It is half
 * the issue-address ceiling ADR 0061 §6 measured — a share link is read by a person and
 * pasted into a chat, a mail or a ticket, and half that ceiling is where pasting stops
 * being the obvious thing to do. The number is judgement on top of those two
 * measurements, and it is in ADR 0076 §2 as such.
 */
export const SHARE_ADDRESS_LIMIT = 2000;

/**
 * How far a packed draft may inflate before it is refused, in characters.
 *
 * **A bound on the inflate, not on the link**, because the two are not the same thing and
 * the gap between them is the whole risk: a fragment of 2000 characters is a deflate
 * stream that says how much it wants to produce, and nothing stops it from saying a lot.
 * ADR 0061 §6 refused to compress an issue for a version of this reason — a bounded
 * inflate in CI would have been needed — and here it is bounded rather than not done.
 *
 * 256 KiB is `HOME_LAYOUT_MAX_CHARS`, the bound the app's own parser refuses a document
 * over (ADR 0061 §2). A larger one is not a document this repository can hold either way.
 */
export const SHARE_CEILING = 262_144;

/** What a shared link carries: whose document, and the file's own text. */
export interface Draft {
  /** The screen the document belongs to, by the store's name for it. */
  readonly screen: string;
  /** The document as `formatLayoutDocument` writes it. */
  readonly document: string;
  /**
   * The layout the screen is of (ADR 0080). A link made before layouts has none, and means
   * `demo`, the one layout the tool could edit then, so `unpack` says so.
   */
  readonly layout?: string;
}

/**
 * What the arrival said.
 *
 * `damaged` is one answer for a fragment that is not a draft as well as for one whose
 * bytes would not open, because the person cannot act on the difference and the tool has
 * nothing to repair: the link is either a draft or it is not, and one sentence says which.
 */
export type Arrival = { readonly draft: Draft } | { readonly damaged: true } | null;

/**
 * The draft parameter of an address, or null where it carries none.
 *
 * Read out of the raw string rather than through `parseAddress`, because the shell's
 * grammar hands the rest through and this file is the one that has to know what a rest
 * may contain. Junk under this name is a draft that will not open, not an address to
 * refuse: a link somebody edited by hand should still show the tool.
 */
export function packedIn(hash: string): string | null {
  const cut = hash.indexOf('?');
  if (cut === -1) return null;
  const packed = new URLSearchParams(hash.slice(cut + 1)).get(SHARE_PARAMETER);
  return packed !== null && packed !== '' ? packed : null;
}

/**
 * A document into the characters that carry it: deflated, then base64url.
 *
 * **The submission payload's own text, so what travels is JSON.** `layoutPayload` prints
 * the document into an envelope raw, and that text parses into the `{ target, document }`
 * an issue's body holds — which is what `unpack` reads back. The two ends therefore cannot
 * spell the envelope differently, and nothing here has to know what is inside a document
 * in order to carry one.
 *
 * Both halves are chosen for the fragment. `deflate-raw` rather than gzip, because the
 * two of them are the same compressor with 18 bytes of header and a checksum between
 * them, and neither the browser nor `DecompressionStream` is asked to care about a
 * checksum it did not write. base64url rather than base64, because `+`, `/` and `=`
 * mean something to `URLSearchParams` and to half the programs a link passes through on
 * its way to a person.
 */
export async function pack(draft: Draft): Promise<string> {
  const bytes = new TextEncoder().encode(
    layoutPayload(draft.screen, draft.document, undefined, draft.layout),
  );
  const stream = streamOf(bytes).pipeThrough(new CompressionStream('deflate-raw'));
  return toBase64Url(await drained(stream));
}

/**
 * The characters back into a document, or null where they are not one.
 *
 * **Every failure is null.** Not base64, not a deflate stream, not the envelope, not a
 * document this editor can open: four different faults and one answer, because the caller
 * has one sentence and the person reading it can do nothing with which of the four it was.
 * A thrown error would be caught by the boundary around the whole view and reported as
 * "this view did not render", which is a claim about the site rather than about a link.
 *
 * The document comes back printed rather than as it travelled, because what travelled is a
 * JSON value and a value has no formatting of its own: two spaces and a newline are the
 * printer's, not the document's. Nothing depends on it — `formatLayoutDocument` prints the
 * parsed document again on the way out, and the parser reads either form.
 */
export async function unpack(packed: string): Promise<Arrival> {
  if (packed.length > SHARE_ADDRESS_LIMIT * 2) return { damaged: true };
  const bytes = fromBase64Url(packed);
  if (bytes === null) return { damaged: true };
  const text = await inflate(bytes);
  if (text === null) return { damaged: true };
  try {
    const envelope = JSON.parse(text) as { layout?: unknown; target?: unknown; document?: unknown };
    if (typeof envelope.target !== 'string' || typeof envelope.document !== 'object') {
      return { damaged: true };
    }
    if (envelope.document === null) return { damaged: true };
    return {
      draft: {
        screen: envelope.target,
        document: JSON.stringify(envelope.document),
        layout: typeof envelope.layout === 'string' ? envelope.layout : EXAMPLE_LAYOUT,
      },
    };
  } catch {
    return { damaged: true };
  }
}

/**
 * The address to hand over: this page, the given tool open, and the draft in the
 * fragment.
 *
 * `base` is where this page lives and `hash` is the address it is at, and neither is
 * known here — the first is the deployment and the second belongs to the frame's state,
 * which is why the frame's half of the link (`d`, `tm`, `sc`, …) is read out of `hash`
 * and written back through `toAddress` rather than copied through. That also drops
 * anything in the address this preview does not know, so a link built out of a link that
 * already carried a draft carries one draft, not two.
 *
 * `link` is null where the address came out longer than `SHARE_ADDRESS_LIMIT`, and
 * `length` is how long it came out either way — the one sentence the caller says for a
 * refused draft names both numbers, because a person who is told only the limit cannot
 * tell whether their draft missed it by ten characters or by ten thousand. The caller then
 * points at the submission, which has no bound the newsroom notices (ADR 0061 §6).
 */
export async function shareLink(
  tool: SectionId,
  draft: Draft,
  at: { base: string; hash: string },
): Promise<{ link: string | null; length: number }> {
  const address = parseAddress(at.hash, VIEWS.preview);
  const { head, rest } = toAddress(fromAddress(address));
  rest.set(SHARE_PARAMETER, await pack(draft));
  const link = `${at.base.replace(/\/$/, '')}${writeAddress({ ...address, head, rest, tool }, VIEWS.preview)}`;
  return { link: link.length <= SHARE_ADDRESS_LIMIT ? link : null, length: link.length };
}

/**
 * One bounded inflate.
 *
 * The chunks are counted rather than `Response.arrayBuffer()`'d in one go, which would take
 * whatever the stream says it is. A deflate stream can expand a kilobyte into gigabytes, and
 * a link is text anybody can send.
 *
 * `Uint8Array<ArrayBuffer>` rather than the plain `Uint8Array`, and that is the type and
 * not the bytes: `Response` will not take a buffer that might be a `SharedArrayBuffer`, and
 * the default parameter type is the one that admits one.
 */
async function inflate(bytes: Uint8Array<ArrayBuffer>): Promise<string | null> {
  try {
    const reader = streamOf(bytes).pipeThrough(new DecompressionStream('deflate-raw')).getReader();
    const decoder = new TextDecoder();
    let text = '';
    for (;;) {
      // oxlint-disable-next-line no-await-in-loop -- a stream is read chunk by chunk in order
      const { done, value } = await reader.read();
      if (done) return text;
      if (text.length + value.length > SHARE_CEILING) {
        void reader.cancel();
        return null;
      }
      text += decoder.decode(value, { stream: true });
    }
  } catch {
    return null;
  }
}

/**
 * Bytes as a stream, by way of `Response` rather than of a `Blob`.
 *
 * `Blob.prototype.stream()` is the obvious spelling and it is missing from Safari before
 * 17 — a browser the newsroom reads links on. `new Response(bytes).body` has been there as
 * long as `fetch` has, which is what `test/preview/arrive.test.ts` runs the whole arrival
 * path against, jsdom being a third `Blob` that has no `stream()` at all.
 *
 * `BufferSource` rather than `Uint8Array` because that is what a `CompressionStream` says
 * its writable takes, and the two streams here have to fit through the same `pipeThrough`.
 */
function streamOf(bytes: Uint8Array<ArrayBuffer>): ReadableStream<BufferSource> {
  return new Response(bytes).body as ReadableStream<BufferSource>;
}

/** The whole of a stream, which `pack` wants and nothing else reads. */
async function drained(stream: ReadableStream<Uint8Array<ArrayBufferLike>>): Promise<Uint8Array> {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  for (;;) {
    // oxlint-disable-next-line no-await-in-loop -- a stream is read chunk by chunk in order
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    length += value.length;
  }
  const all = new Uint8Array(length);
  let at = 0;
  for (const chunk of chunks) {
    all.set(chunk, at);
    at += chunk.length;
  }
  return all;
}

/** Base64url, because the fragment is read by `URLSearchParams` and by people. */
function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}

/** Bytes or null: `atob` throws on anything that is not base64, which is half the faults. */
function fromBase64Url(packed: string): Uint8Array<ArrayBuffer> | null {
  try {
    const base64 = packed.replaceAll('-', '+').replaceAll('_', '/');
    const binary = atob(base64 + '='.repeat((4 - (base64.length % 4)) % 4));
    return Uint8Array.from(binary, (character) => character.charCodeAt(0));
  } catch {
    return null;
  }
}
