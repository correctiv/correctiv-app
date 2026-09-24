import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { join } from 'node:path';

import { findWording, replaceWording } from './catalogue.ts';
import { ROOT } from './collect.ts';
import { answer, read, refused as refusedEarly } from './home-layout.ts';
import {
  ENGLISH_EXTRACTION,
  GERMAN_CATALOGUE_DIR,
  STRINGS_ENDPOINT,
} from '../src/preview/strings/names.ts';
import { checkWording, type WordingProblem } from '../src/preview/strings/validate.ts';

/**
 * The second thing the workbench writes back into the repository, and only in development.
 *
 * [ADR 0056](../../../adr/0056-a-string-is-picked-where-it-renders.md) §8, beside
 * `./home-layout.ts` and on its conditions, through the same `refused()`, for the reasons
 * that file gives and which are not repeated here: loopback only, POST only, no request
 * another site's page sent, a JSON body and a bounded one, and absent from the production
 * bundle because `configureServer` is not called by `vite build`. It is not an
 * exception to [ADR 0058](../../../adr/0058-the-workbench-holds-no-power-and-github-is-who-you-are.md)
 * §1 for the reason ADR 0061 §1 gives the home layout's Save: the person running it can
 * already write the file with an editor, and what it buys is that the file receives what
 * the validator passed. The published site's way out is ADR 0061's submission, whose
 * strings kind is named there and is not built yet.
 *
 * The body is `{ "<id>": "<German>" }`. **All or nothing**: an id the German catalogue
 * does not carry, which is ADR 0056 §7's limit, or a wording `checkWording` refuses, and
 * nothing is written, so a save cannot land half of what somebody meant. The refusal
 * names each id and what was wrong with it.
 *
 * The write replaces the literal and nothing else (`./catalogue.ts`), then runs the
 * repository's own formatter over the files it touched, because a longer wording can
 * cross the print width and oxfmt is what decides where that line breaks, and last
 * rebuilds the table the picker reads (`regenerateTable`).
 */

interface Refused {
  id: string;
  problems: (WordingProblem | { code: 'unknown-id' })[];
}

function catalogueFiles(root: string): string[] {
  return readdirSync(join(root, GERMAN_CATALOGUE_DIR))
    .filter((name) => name.endsWith('.ts') && name !== 'index.ts')
    .map((name) => `${GERMAN_CATALOGUE_DIR}/${name}`);
}

function isWordings(value: unknown): value is Record<string, string> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    Object.values(value).every((wording) => typeof wording === 'string')
  );
}

/**
 * The files the wordings would produce, or the refusals that stop them.
 *
 * Exported for the test, which runs it over copies of the real catalogue: the middleware
 * around it is the home layout's, and what is new is this.
 */
export function applyWordings(
  wordings: Record<string, string>,
  english: Readonly<Record<string, { defaultMessage?: string }>>,
  sources: ReadonlyMap<string, string>,
): { written: Map<string, string>; refused: Refused[] } {
  const next = new Map(sources);
  const touched = new Set<string>();
  const refused: Refused[] = [];

  for (const [id, wording] of Object.entries(wordings)) {
    const path = [...next.keys()].find((file) => findWording(next.get(file)!, id) !== null);
    const source = english[id]?.defaultMessage;
    if (path === undefined || source === undefined) {
      refused.push({ id, problems: [{ code: 'unknown-id' }] });
      continue;
    }
    const problems = checkWording(source, wording);
    if (problems.length > 0) {
      refused.push({ id, problems });
      continue;
    }
    next.set(path, replaceWording(next.get(path)!, id, wording)!);
    touched.add(path);
  }

  const written = new Map<string, string>();
  if (refused.length === 0) for (const path of touched) written.set(path, next.get(path)!);
  return { written, refused };
}

/** What the endpoint does after writing, handed in so a test can run it over a copy. */
export interface StringsEndpointOptions {
  /** The repository the catalogue is read from and written to. */
  root?: string;
  /** Formats the written files, repository-relative. The repository's own oxfmt by default. */
  format?: (paths: string[]) => void;
  /** Rebuilds the table the picker reads. `npm run strings` by default. */
  regenerate?: () => void;
}

function oxfmt(paths: string[]): void {
  execFileSync(join(ROOT, 'node_modules/.bin/oxfmt'), paths, { cwd: ROOT, stdio: 'pipe' });
}

/**
 * `strings.generated.json` again, from the files just written.
 *
 * The picker reads `virtual:strings`, which is that file, and only `npm run strings`
 * writes it. Without this a save followed by a reload left the table a build behind the
 * catalogue, so the text just saved matched no id and the panel said "no id" about a
 * string, which is the answer ADR 0056 §5 says must never be false. The plugin already
 * watches the file (`addWatchFile`), so writing it is what reloads the page's table.
 * A separate process, because the script imports the catalogue fresh and this server's
 * module cache holds the old one.
 */
function regenerateTable(): void {
  execFileSync(join(ROOT, 'node_modules/.bin/tsx'), ['apps/workbench/scripts/strings.mjs'], {
    cwd: ROOT,
    stdio: 'pipe',
  });
}

export function stringsEndpoint({
  root = ROOT,
  format = oxfmt,
  regenerate = regenerateTable,
}: StringsEndpointOptions = {}) {
  return async function middleware(
    req: IncomingMessage,
    res: ServerResponse,
    next: () => void,
  ): Promise<void> {
    if ((req.url ?? '').split('?')[0] !== STRINGS_ENDPOINT) return next();
    if (refusedEarly(req, res)) return;

    const body = await read(req);
    if (body === null) {
      return answer(res, 413, { code: 'too-large', error: 'The wordings are larger than 64 KiB.' });
    }

    let input: unknown;
    try {
      input = JSON.parse(body);
    } catch (error) {
      return answer(res, 400, {
        code: 'not-json',
        error: `That is not JSON: ${error instanceof Error ? error.message : String(error)}`,
      });
    }
    if (!isWordings(input) || Object.keys(input).length === 0) {
      return answer(res, 400, {
        code: 'shape',
        error: 'Expected an object of id to German, with one entry at least.',
      });
    }

    const english = JSON.parse(readFileSync(join(root, ENGLISH_EXTRACTION), 'utf8')) as Record<
      string,
      { defaultMessage?: string }
    >;
    const sources = new Map(
      catalogueFiles(root).map((path) => [path, readFileSync(join(root, path), 'utf8')] as const),
    );

    const { written, refused } = applyWordings(input, english, sources);
    if (refused.length > 0) {
      return answer(res, 400, { code: 'refused', error: 'Nothing was written.', refused });
    }

    for (const [path, text] of written) writeFileSync(join(root, path), text, 'utf8');
    const paths = [...written.keys()];
    try {
      format(paths);
    } catch {
      // The literal is written and correct; a formatter that did not run leaves a line
      // `npm run check` will name, which is a smaller failure than a save that says no.
    }
    let table = true;
    try {
      regenerate();
    } catch {
      // The files are right and the table is stale; the answer says so rather than
      // pretending, and `npm run workbench:strings` is the way out.
      table = false;
    }
    return answer(res, 200, { paths, table });
  };
}
