/**
 * The one text fetch in this codebase.
 *
 * There used to be one per app, differing in timeout mechanism and user agent —
 * and the difference was not a decision, it was two people solving the same problem
 * in two runtimes. It is a capability check now, not a host check: `AbortController`
 * where the runtime has one, `Promise.race` where it does not. Keeping the fallback
 * costs four lines and is what lets the core run anywhere, which is the point of the
 * core.
 */

const DEFAULT_TIMEOUT_MS = 8000;

/**
 * WordPress and the CDN in front of it answer a plain script user agent with a
 * bot challenge, so this claims to be a mobile browser. Measured on
 * correctiv.org: with the old `CorrectivAppPrototype/0.1` agent the feed request
 * intermittently came back as an interstitial rather than XML.
 */
const DEFAULT_HEADERS: Record<string, string> = {
  'User-Agent':
    'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Mobile Safari/537.36',
  Accept: 'application/rss+xml, application/atom+xml, application/xml, text/html;q=0.9, */*;q=0.8',
};

export interface FetchTextOptions {
  timeoutMs?: number;
  headers?: Record<string, string>;
  /**
   * Send the browser user agent above. Defaults to true.
   *
   * **Turn it off for a JSON API, and the reason is CORS.** Browsers refuse to let
   * a page override `User-Agent`, so on the web target this header is at best
   * dropped. At worst it is honoured: a non-safelisted request header makes the
   * browser send a preflight, and correctiv.org answers `OPTIONS` with
   * `Access-Control-Allow-Headers: Authorization, X-WP-Nonce, Content-Disposition,
   * Content-MD5, Content-Type` — no `User-Agent` in the list, so that preflight
   * fails and the request never happens. A header that cannot help and might block
   * has no business on a request that does not need it.
   *
   * Measured 2026-09-01 with a plain `CorrectivApp/1.0` agent: `wp/v2/posts`,
   * `wp/v2/newspack_nl_cpt`, `tube.funfacts.de/api/v1/videos` and Icecast's
   * `status-json.xsl` all answer 200. The bot challenge is on the HTML and RSS
   * paths, and those keep the header.
   */
  browserAgent?: boolean;
}

/** True when the runtime can cancel a request rather than merely stop waiting. */
function canAbort(): boolean {
  return typeof AbortController !== 'undefined';
}

/** A body and the response headers it came with, for a caller that needs one of them. */
export interface TextResponse {
  body: string;
  /** A response header by name, or null. Case-insensitive, as `Headers.get` is. */
  header(name: string): string | null;
}

/**
 * GET a text resource with a timeout. Throws on a non-2xx status, so every caller
 * can treat a resolved promise as a body.
 *
 * The timer is cleared in `finally`. Without that it outlives the request it
 * guards by up to `timeoutMs`: `Promise.race` ignores the late rejection, so
 * nothing looks wrong, but the timer keeps the event loop busy — it surfaced as
 * jest refusing to exit after a suite that fetched once.
 */
export async function fetchText(url: string, options: FetchTextOptions = {}): Promise<string> {
  return (await fetchTextResponse(url, options)).body;
}

/**
 * The same fetch, with the headers kept.
 *
 * One caller wants a header today: the home document is judged by its
 * `last-modified` (`stores/homeLayout.ts`). A browser lets a page read that one across
 * origins without the server naming it, because it is on the CORS-safelisted list of
 * response headers, which is what makes it usable on the web target at all.
 */
export async function fetchTextResponse(
  url: string,
  options: FetchTextOptions = {},
): Promise<TextResponse> {
  const { timeoutMs = DEFAULT_TIMEOUT_MS, headers, browserAgent = true } = options;
  const merged = browserAgent
    ? { ...DEFAULT_HEADERS, ...headers }
    : { Accept: DEFAULT_HEADERS.Accept, ...headers };

  const read = async (res: Response): Promise<TextResponse> => {
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
    const body = await res.text();
    return { body, header: (name) => res.headers?.get?.(name) ?? null };
  };

  if (canAbort()) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await read(await fetch(url, { headers: merged, signal: controller.signal }));
    } finally {
      clearTimeout(timer);
    }
  }

  let timer: ReturnType<typeof setTimeout> | undefined;
  const request = fetch(url, { headers: merged }).then(read);
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`Timeout after ${timeoutMs} ms: ${url}`)), timeoutMs);
  });
  try {
    return await Promise.race([request, timeout]);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * The same fetch, parsed.
 *
 * Three callers wanted this before it existed: `peertube.service.ts` kept a
 * private wrapper, `search.service.ts` inlined `JSON.parse(await fetchText(...))`
 * and `wp.service.ts` would have been the third. A JSON API answering with an
 * HTML error page is the failure this centralises: `JSON.parse` then throws
 * `Unexpected token '<'`, which says nothing about which URL produced it.
 */
export async function fetchJson<T>(url: string, options: FetchTextOptions = {}): Promise<T> {
  const body = await fetchText(url, {
    browserAgent: false,
    ...options,
    headers: { Accept: 'application/json', ...options.headers },
  });
  try {
    return JSON.parse(body) as T;
  } catch {
    throw new Error(`Not JSON from ${url}: ${body.slice(0, 80)}`);
  }
}
