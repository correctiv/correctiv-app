import { STRINGS_ENDPOINT } from './names';
import type { WordingProblem } from './validate';

/**
 * The dev server's save, as an answer the panel can word in the reader's language.
 *
 * The endpoint's `error` is English and meant for a terminal; the panel speaks German to
 * a newsroom. So what comes back here is the endpoint's `code`, which the panel maps to a
 * descriptor, and never its sentence. An answer that is not JSON at all, a proxy's error
 * page or a dev server that has gone, is an outcome of its own rather than a throw.
 */

export type RefusedId = { id: string; problems: (WordingProblem | { code: 'unknown-id' })[] };

export type SaveOutcome =
  | { kind: 'saved'; paths: string[]; table: boolean }
  | { kind: 'refused'; ids: RefusedId[] }
  | { kind: 'rejected'; code: string | null; status: number }
  | { kind: 'unreachable'; detail: string };

/** Reads an answer the endpoint sent, whatever it turned out to be. */
export function readAnswer(status: number, text: string): SaveOutcome {
  type Body = { code?: unknown; paths?: unknown; table?: unknown; refused?: unknown };
  let body: Body | null = null;
  try {
    const parsed: unknown = JSON.parse(text);
    if (typeof parsed === 'object' && parsed !== null) body = parsed as Body;
  } catch {
    body = null;
  }
  if (status >= 200 && status < 300 && body && Array.isArray(body.paths)) {
    return {
      kind: 'saved',
      paths: body.paths.filter((path): path is string => typeof path === 'string'),
      table: body.table !== false,
    };
  }
  if (body?.code === 'refused' && Array.isArray(body.refused)) {
    return { kind: 'refused', ids: body.refused as RefusedId[] };
  }
  return { kind: 'rejected', code: typeof body?.code === 'string' ? body.code : null, status };
}

export async function saveWordings(
  wordings: Readonly<Record<string, string>>,
  send: typeof fetch = fetch,
): Promise<SaveOutcome> {
  try {
    const response = await send(STRINGS_ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(wordings),
    });
    return readAnswer(response.status, await response.text());
  } catch (error) {
    return { kind: 'unreachable', detail: error instanceof Error ? error.message : String(error) };
  }
}
