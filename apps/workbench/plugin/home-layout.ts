import { writeFileSync } from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { join } from 'node:path';

import type { ViteDevServer } from 'vite';

import { ROOT } from './collect.ts';
import { HOME_LAYOUT_ENDPOINT, HOME_LAYOUT_FILE } from '../src/preview/home/names.ts';

/**
 * The one thing the workbench writes back into the repository, and only in development.
 *
 * ADR 0036 §15 says the configurator opens a pull request. This is not that, and it is
 * deliberately the step before it: the same document, written to the same path, by a
 * person who can already write the file with an editor. What it buys over an editor is
 * that the app in the frame is showing the result, and that what lands on disk is what
 * `parseHomeLayout` accepted rather than what somebody typed.
 *
 * **It exists in development and nowhere else, structurally.** A Vite plugin's
 * `configureServer` is not called by `vite build`, so there is no flag to get wrong and
 * no code path to audit in the published bundle: the middleware is not in it. The
 * browser half asks `import.meta.env.DEV` before it offers the button, so the published
 * site says what it cannot do instead of failing when pressed.
 *
 * ## Why the parser and the printer arrive at request time
 *
 * Both live in modules that reach the core, and the core's layout module imports
 * `data/home.layout.json`. Vite loads `vite.config.ts` with **Node**, and Node refuses a
 * JSON import without `with { type: 'json' }` — so a static import of either from here
 * is a site that does not start, with the error thrown while the config loads and
 * nothing on screen about the home screen at all. `ssrLoadModule` is the dev server's
 * own pipeline, which resolves and transforms exactly the way the browser build does, so
 * the endpoint validates with the same function the app parses with. That is ADR 0036
 * §12's one validator, kept at the cost of one await.
 *
 * ## What it refuses, and why each one
 *
 * - **Anything not from loopback.** `vite --host` puts the dev server on the network,
 *   and the first person to run that on a conference wifi should not be handing the
 *   repository to the room. `req.socket.remoteAddress` is the connection's own peer,
 *   which no header can forge, and there is no proxy in front of this to make it lie.
 * - **Anything but POST.** A GET that wrote a file would be reachable from an `<img>`.
 * - **A body over 64 KiB.** The shipped document is under a kilobyte and the grammar has
 *   no way to grow that fast; the limit is about a socket that never ends.
 * - **A document `parseHomeLayout` cannot read, and one it can only half read.** ADR
 *   0036 §9 asks both ends to validate — and the app's half is the looser one on
 *   purpose, because it draws past a section it does not understand rather than losing
 *   the screen. The writer's half has no such excuse: a problem here means a document
 *   nobody has looked at yet, so every problem is fatal, and the codes go back in the
 *   response for the interface to print.
 *
 * What it does **not** do is decide what a good layout is. An editor may switch every
 * section off and save an empty home screen; that is a document somebody meant, and a
 * reviewer sees it in the diff.
 */

const FILE = HOME_LAYOUT_FILE;

/** 64 KiB. Sixty times the shipped document, and a bound on a socket that never ends. */
const LIMIT = 64 * 1024;

/**
 * Whether the connection came from this machine.
 *
 * Node writes an IPv4 peer on a dual-stack socket as `::ffff:127.0.0.1`, which is why
 * this is not an equality test against two strings.
 */
function fromLoopback(req: IncomingMessage): boolean {
  const address = req.socket.remoteAddress ?? '';
  return address === '::1' || /^(::ffff:)?127\./.test(address);
}

function answer(res: ServerResponse, status: number, body: Record<string, unknown>): void {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json');
  res.end(JSON.stringify(body));
}

/** The request body, or null if it ran past the limit. */
async function read(req: IncomingMessage): Promise<string | null> {
  let text = '';
  for await (const chunk of req) {
    text += chunk;
    if (text.length > LIMIT) return null;
  }
  return text;
}

type Parse = typeof import('@correctiv/app-core/lib/home-layout');
type Document = typeof import('../src/preview/home/document.ts');

export function homeLayoutEndpoint(server: ViteDevServer) {
  return async function middleware(
    req: IncomingMessage,
    res: ServerResponse,
    next: () => void,
  ): Promise<void> {
    // The query string is not this endpoint's to read, and `req.url` may carry one.
    if ((req.url ?? '').split('?')[0] !== HOME_LAYOUT_ENDPOINT) return next();

    if (!fromLoopback(req)) {
      return answer(res, 403, { error: 'This endpoint answers the machine it runs on only.' });
    }
    if (req.method !== 'POST') {
      res.setHeader('allow', 'POST');
      return answer(res, 405, { error: `${req.method ?? 'That'} is not how a document is sent.` });
    }

    const body = await read(req);
    if (body === null) return answer(res, 413, { error: 'The document is larger than 64 KiB.' });

    let input: unknown;
    try {
      input = JSON.parse(body);
    } catch (error) {
      return answer(res, 400, {
        error: `That is not JSON: ${error instanceof Error ? error.message : String(error)}`,
      });
    }

    const { parseHomeLayout } = (await server.ssrLoadModule(
      '@correctiv/app-core/lib/home-layout',
    )) as Parse;
    const { formatLayoutDocument } = (await server.ssrLoadModule(
      '/src/preview/home/document.ts',
    )) as Document;

    const { layout, problems } = parseHomeLayout(input);
    if (!layout || problems.length > 0) {
      return answer(res, 400, {
        error: 'The core refused the document.',
        problems: problems.map((problem) => ({ code: problem.code, context: problem.context })),
      });
    }

    // Printed from the parse rather than written as it arrived, so the file on disk is
    // formatted whatever reached the socket, and `npm run check` has nothing to say
    // about a document this endpoint wrote.
    writeFileSync(join(ROOT, FILE), formatLayoutDocument(layout), 'utf8');
    return answer(res, 200, { path: FILE });
  };
}
