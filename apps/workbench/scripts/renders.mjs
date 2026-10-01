/**
 * Opens the workbench in a browser and fails if it did not render.
 *
 *     node apps/workbench/scripts/renders.mjs dev    # the Vite dev server, started here
 *     node apps/workbench/scripts/renders.mjs dist   # apps/workbench/dist, served statically
 *
 * **Why a browser, when six source-reading tests are cheaper.** ADR 0031's four
 * mechanisms are about a thing somebody forgot to do, and nobody forgot anything
 * here: the work was done, it was correct, and it did not run. No type, no generator
 * and no reading of a file can see that, which is the argument ADR 0035 makes at
 * length. Issue #160 is the case. `apps/mobile/src/i18n/polyfills.ts` calls
 * `require()` inside a runtime condition; the production build hoisted that to a
 * namespace import and warned, and the dev server hoisted it to a DEFAULT import of
 * a module that exports nothing, which is a link-time `SyntaxError` and takes the
 * whole graph down before a line of it runs. Same source, same config, two answers.
 * Typecheck, oxlint, oxfmt and 400 tests were green throughout,
 * `npm run build:workbench` was green, CI was green, and `npm run workbench` — the one
 * a person uses to look at their work — had served an empty page for long enough
 * that two agents built themselves ways around it instead of reporting it.
 *
 * **Both paths, because the difference between them is where this lives.** The
 * production build is the one CI had; the dev server is the one nobody had. A check
 * that covered only the second would be the same mistake mirrored.
 *
 * **Three assertions, not one, because the first one alone can be green on a page
 * that says nothing but "This view did not render".** `App.tsx` wraps its error
 * boundary around the main area only, on purpose: a route that throws leaves the
 * header, the rail and the status line standing, so the reader has a way out. For
 * this check that is a `#root` full of elements and a body full of words, every one
 * of them the boundary's apology. So:
 *
 * 1. `#root` has children and the body has words in it — the graph evaluated and
 *    something mounted.
 * 2. Nothing on the page carries `data-view-failed` — what mounted is the workbench
 *    and not the boundary standing in for it. The attribute and not the heading
 *    above it, because a heading is prose somebody will reword and this would go
 *    quietly green; `test/renders.test.ts` holds the two ends together.
 * 3. The browser logged no error. It already collected them for the failure report,
 *    and throwing them away on success is how a page that mounted and then broke in
 *    an effect reads as fine. Measured on both modes: zero on a healthy workbench, in
 *    development as well, so this is a threshold the site meets rather than one it
 *    is being asked to climb to.
 *
 *    **One class of error is not a fault, and it is the dev server talking.**
 *    Vite re-optimises its dependency graph when a module pulls in a package it
 *    has not seen, and the request already in flight comes back `504 (Outdated
 *    Optimize Dep)`. The correct response is to reload, which is what the browser
 *    does on its own; collecting it as a fault made this check fail a page that
 *    had rendered correctly, and it did so on a pull request whose only real
 *    change was a stylesheet, because a new import is exactly what triggers the
 *    re-optimise. The re-run passed on the same commit, which is what makes this
 *    a flake with a cause rather than a mystery — see `isReloadNotice()`.
 *
 * **What it cannot see.** That the page is *right*: every colour and layout defect
 * passes, which is what `/preview` and a pair of eyes are for. It opens one
 * address, `/`, which is enough only because this is a single-page application whose
 * router imports every page — the module that broke it is reached from the landing
 * page like any other. A lazily imported route would need its own line here, and
 * nothing makes that fail.
 *
 * Not part of `npm run check`: it wants a browser, and that loop wants nothing but
 * Node. ADR 0035 carries what the two modes cost, measured, with the date they were
 * measured on. CI runs both in the job that already builds the workbench.
 */
import { execFileSync, spawn } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync, statSync } from 'node:fs';
import { connect, createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { isReloadNotice } from './reload-notice.mjs';

const WORKBENCH = dirname(fileURLToPath(new URL('.', import.meta.url)));
const ROOT = join(WORKBENCH, '../..');

/** Where the page is judged to have mounted, and how long it is given to. */
const READY_MS = 60_000;
const POLL_MS = 250;

/** How long a server started here gets to accept a connection. */
const LISTEN_MS = 10_000;

/**
 * The browsers this accepts, in the order it tries them.
 *
 * It **fails** rather than skipping when none is there. A check that quietly
 * passes on a machine without Chrome is a check that passes everywhere somebody
 * needs it to (ADR 0031: a check that cannot fail is deleted). `CHROME_PATH`
 * is the escape hatch for a browser installed somewhere else, and it is what CI
 * passes: `browser-actions/setup-chrome` installs one and reports where, rather
 * than the workflow assuming the runner image still carries it.
 */
const BROWSERS = [
  'google-chrome',
  'google-chrome-stable',
  'chromium',
  'chromium-browser',
  'chrome',
];

const mode = process.argv[2] ?? 'dev';
if (mode !== 'dev' && mode !== 'dist') {
  console.error(`usage: node apps/workbench/scripts/renders.mjs [dev|dist] — got "${mode}"`);
  process.exit(2);
}

/**
 * A failure this script has already explained.
 *
 * Thrown rather than `process.exit`ed, so that the servers and the browser this
 * started are shut down on the way out. A `process.exit` inside `browser()` is
 * what left a `serve-clean.mjs` holding a port after a run that could not find
 * Chrome.
 */
class Reported extends Error {}

/** Everything started here, in the order to undo it. */
const started = [];
async function unwind() {
  while (started.length > 0) {
    try {
      await started.pop()();
    } catch {
      // Shutting down is best-effort: a browser that already exited must not
      // turn a green run red, or hide the message of a red one.
    }
  }
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** A free port, asked of the operating system rather than guessed. */
async function freePort() {
  return await new Promise((resolve, reject) => {
    const probe = createServer();
    probe.on('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const { port } = probe.address();
      probe.close(() => resolve(port));
    });
  });
}

/**
 * The dev server, started the way `npm run workbench` starts it.
 *
 * `createServer` from this package's own Vite and this package's own config, with
 * the working directory it expects — `vite.app.mjs` joins the app's stylesheet
 * onto `process.cwd()` for Uniwind, so a run from the repository root would build
 * a differently themed site from the one a person sees.
 */
async function devServer() {
  process.chdir(WORKBENCH);
  const { createServer } = await import('vite');
  const server = await createServer({
    root: WORKBENCH,
    server: { port: await freePort(), strictPort: true },
    logLevel: 'warn',
  });
  started.push(() => server.close());
  await server.listen();
  return { url: server.resolvedUrls.local[0] };
}

/**
 * The built site, served the way GitHub Pages serves it.
 *
 * `serve-clean.mjs` and not a plain static server, for the reason its own header
 * gives: a server that maps no clean URLs makes a working site look broken.
 *
 * Waited for rather than assumed. A spawned process has not yet bound a port, and
 * this script used to navigate as soon as the call returned. Losing that race
 * costs the full sixty seconds of polling an empty page and then reports a blank
 * workbench — about a server that was merely slower than the browser, which is a
 * red with nothing in it to act on. Its output is kept for the same reason: under
 * `stdio: 'ignore'` a server that refused to start had nothing to say about why.
 */
async function distServer() {
  const dist = join(WORKBENCH, 'dist');
  if (!existsSync(join(dist, 'index.html'))) {
    throw new Reported(
      'apps/workbench/dist/index.html is missing — run `npm run build:workbench` first.',
    );
  }
  refuseStaleDist(dist);

  const port = await freePort();
  const child = spawn('node', [join(ROOT, 'screens/tools/serve-clean.mjs'), dist, String(port)], {
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  started.push(() => child.kill('SIGKILL'));
  let said = '';
  for (const stream of [child.stdout, child.stderr]) stream.on('data', (chunk) => (said += chunk));

  const deadline = Date.now() + LISTEN_MS;
  while (!(await accepts(port))) {
    if (child.exitCode !== null) {
      throw new Reported(
        `serve-clean.mjs exited with ${child.exitCode} before it listened.\n${said}`,
      );
    }
    if (Date.now() > deadline) {
      throw new Reported(
        `serve-clean.mjs did not listen on ${port} within ${LISTEN_MS / 1000}s.\n${said}`,
      );
    }
    await sleep(25);
  }
  return { url: `http://localhost:${port}/` };
}

/** Whether anything is listening there yet. */
function accepts(port) {
  return new Promise((resolve) => {
    const socket = connect({ port, host: '127.0.0.1' });
    socket.once('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.once('error', () => {
      socket.destroy();
      resolve(false);
    });
  });
}

/**
 * Refuses to judge a `dist` older than the sources it was built from.
 *
 * This mode reads a directory rather than building one, so on its own it says
 * nothing about the working tree: with yesterday's `dist` on disk it reports
 * yesterday's site as today's, green, while the branch under it is broken. That is
 * #160's shape exactly — an agent looking at their own artefact rather than at the
 * thing — and the one this script exists to make impossible. CI never meets it,
 * because the job builds the site immediately before; a person running the two
 * commands in the other order meets it every time.
 *
 * Asked of git rather than of a list of input directories. The build reads the
 * repository's own Markdown, `apps/mobile/src`, the design tokens and this
 * package, so any list naming them would be most of the repository and would rot
 * on the first document that moves. Tracked files plus untracked ones git is not
 * ignoring is the same set without the list, and the cost of having no list is that
 * an edit anywhere reds this, including an edit to this file. That is the safe
 * direction, and the remedy is `npm run build:workbench` and five seconds. Without
 * git — a tarball, a vendored copy — it says so and judges what is there, because a
 * missing tool is not evidence of a stale build.
 */
function refuseStaleDist(dist) {
  const built = statSync(join(dist, 'index.html')).mtimeMs;
  let files;
  try {
    files = execFileSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard'], {
      cwd: ROOT,
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
    }).split('\0');
  } catch {
    console.warn('dist: no git here, so nothing checked whether this build is current.');
    return;
  }

  let newest = { file: '', at: 0 };
  for (const file of files) {
    if (file === '' || file.startsWith('apps/workbench/dist/')) continue;
    let at;
    try {
      at = statSync(join(ROOT, file)).mtimeMs;
    } catch {
      continue; // Listed by git and gone from disk: a deletion not yet committed.
    }
    if (at > newest.at) newest = { file, at };
  }

  if (newest.at > built) {
    const age = Math.round((newest.at - built) / 1000);
    throw new Reported(
      `apps/workbench/dist is ${age}s older than ${newest.file}, so this would have judged ` +
        `a site nobody is looking at.\nRun \`npm run build:workbench\` and try again.`,
    );
  }
}

/** Headless Chrome, and a socket to drive it over. No dependency: the protocol is JSON. */
async function browser() {
  const profile = mkdtempSync(join(tmpdir(), 'workbench-renders-'));
  started.push(() => rmSync(profile, { recursive: true, force: true }));
  const candidates = [process.env.CHROME_PATH, ...BROWSERS].filter(Boolean);
  let child;
  let endpoint;
  for (const binary of candidates) {
    child = spawn(
      binary,
      [
        '--headless',
        '--disable-gpu',
        '--no-sandbox',
        '--remote-debugging-port=0',
        `--user-data-dir=${profile}`,
        'about:blank',
      ],
      { stdio: ['ignore', 'ignore', 'pipe'] },
    );
    endpoint = await new Promise((resolve) => {
      let stderr = '';
      const done = (value) => resolve(value);
      child.once('error', () => done(undefined));
      child.once('exit', () => done(undefined));
      const timer = setTimeout(() => done(undefined), 20_000);
      child.stderr.on('data', (chunk) => {
        stderr += chunk;
        const found = stderr.match(/ws:\/\/\S+/);
        if (found) {
          clearTimeout(timer);
          done(found[0]);
        }
      });
    });
    if (endpoint) break;
    child.kill('SIGKILL');
  }
  if (!endpoint) {
    throw new Reported(
      `No browser to look with. Tried ${candidates.join(', ')}.\n` +
        `Install Chrome or Chromium, or point CHROME_PATH at one. This check does not skip:\n` +
        `a machine with no browser is a machine that cannot tell whether the workbench renders.`,
    );
  }
  started.push(() => child.kill('SIGKILL'));
  return endpoint;
}

/**
 * The five protocol calls this needs, over the socket Chrome printed.
 *
 * `WebSocket` is the global, which Node has carried without a flag since 22.4.
 * The repository's `engines` floor is the current LTS and every workflow pins it,
 * so there is nothing here to guard against; the floor is the guard.
 */
async function attach(endpoint) {
  const socket = new WebSocket(endpoint);
  started.push(() => socket.close());
  await new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true });
    socket.addEventListener('error', reject, { once: true });
  });
  let last = 0;
  const waiting = new Map();
  const faults = [];
  /** Vite's reload notices, kept apart so the report can name them if they persist. */
  const notices = [];
  const record = (text) => {
    if (isReloadNotice(text)) notices.push(text);
    else faults.push(text);
  };
  socket.addEventListener('message', (event) => {
    const message = JSON.parse(event.data);
    if (message.id && waiting.has(message.id)) {
      waiting.get(message.id)(message.result ?? {});
      waiting.delete(message.id);
      return;
    }
    if (message.method === 'Runtime.exceptionThrown') {
      const detail = message.params.exceptionDetails;
      record(detail.exception?.description ?? detail.text);
    }
    if (message.method === 'Runtime.consoleAPICalled' && message.params.type === 'error') {
      // React logs a format string and its substitutions as separate arguments,
      // and the browser is what normally joins them. Printed raw, the report
      // opens with a line reading `%o %s %s`, so the placeholder argument is
      // dropped and the values it was standing in for are kept.
      const args = message.params.args
        .map((a) => String(a.description ?? a.value ?? ''))
        .filter((text) => text.replaceAll(/%[a-zA-Z]/g, '').trim() !== '');
      record(args.join(' '));
    }
    // The browser's own log, which is where a request that never arrived shows
    // up. Without it a bundle served under a name nothing points at reads as "no
    // error at all", and the one fact that explains the blank page — a 404 on the
    // entry script — is the fact the report is missing.
    if (message.method === 'Log.entryAdded' && message.params.entry.level === 'error') {
      const { text, url } = message.params.entry;
      record(url ? `${text} — ${url}` : text);
    }
  });
  const call = (method, params = {}, sessionId) =>
    new Promise((resolve) => {
      const id = ++last;
      waiting.set(id, resolve);
      socket.send(JSON.stringify({ id, method, params, sessionId }));
    });
  return { call, faults, notices };
}

const BLANK = { mounted: false, title: '', words: '', failed: null };

/**
 * One console error, short enough to read.
 *
 * React's own logs arrive as a format string and its substitutions, and a stack
 * out of a dev server is thirty frames of `node_modules/.vite`. The first lines
 * carry the message and the file it came from, which is the whole of what this
 * report is for; the rest is in the browser for anyone who wants it.
 */
function brief(fault) {
  const lines = String(fault)
    .split('\n')
    .map((line) => line.trimEnd())
    .filter((line, index, all) => line !== '' || all[index - 1] !== '');
  const kept = lines.slice(0, 6);
  if (lines.length > kept.length) kept.push(`… ${lines.length - kept.length} more lines`);
  return kept.map((line) => `  ${line}`).join('\n');
}

async function main() {
  const server = mode === 'dev' ? await devServer() : await distServer();
  const endpoint = await browser();
  const { call, faults, notices } = await attach(endpoint);

  let verdict = BLANK;
  const { targetId } = await call('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await call('Target.attachToTarget', { targetId, flatten: true });
  await call('Runtime.enable', {}, sessionId);
  await call('Log.enable', {}, sessionId);
  await call('Page.enable', {}, sessionId);
  await call('Page.navigate', { url: server.url }, sessionId);

  const look = async () => {
    const { result } = await call(
      'Runtime.evaluate',
      {
        // `innerText` and not `textContent`, so a mounted-but-invisible shell
        // reads as empty rather than as a page.
        expression: `JSON.stringify({
          mounted: (document.getElementById('root')?.childElementCount ?? 0) > 0,
          title: document.title,
          words: (document.body?.innerText ?? '').replace(/\\s+/g, ' ').trim().slice(0, 120),
          failed: document.querySelector('[data-view-failed]')?.getAttribute('data-view-failed') ?? null,
        })`,
        returnByValue: true,
      },
      sessionId,
    );
    return JSON.parse(result?.value ?? JSON.stringify(BLANK));
  };

  const deadline = Date.now() + READY_MS;
  while (Date.now() < deadline) {
    verdict = await look();
    if (verdict.mounted && verdict.words.length > 0) break;
    await sleep(POLL_MS);
  }
  // One more look once it reads as mounted, and the reason is assertion 3: an
  // effect that throws runs after the commit that put words on the page, so a
  // check that stopped at the first good answer would never hear about it.
  if (verdict.mounted && verdict.words.length > 0) {
    await sleep(POLL_MS);
    verdict = await look();
  }

  const where = mode === 'dev' ? '`npm run workbench`' : '`npm run build:workbench`';
  const said = faults.length
    ? `The browser said:\n${[...new Set(faults)].map(brief).join('\n')}`
    : 'The browser reported no error.';

  if (!verdict.mounted || verdict.words.length === 0) {
    throw new Reported(
      `${mode}: #root is empty after ${READY_MS / 1000}s. ${where} serves a blank page.\n` +
        (faults.length
          ? said
          : 'The browser reported no error, so the shell mounted nothing of its own accord.'),
    );
  }
  if (verdict.failed !== null) {
    throw new Reported(
      `${mode}: the shell mounted and the view inside it did not. ${where} serves the error ` +
        `boundary on ${verdict.failed}, with the header and the rail around it — which is a ` +
        `page full of words and none of them the workbench's.\n${said}`,
    );
  }
  if (faults.length > 0) {
    throw new Reported(
      `${mode}: the workbench mounted, and the browser logged an error while it did. ` +
        `${where} serves a page that is broken in a way this cannot see the extent of.\n${said}`,
    );
  }

  console.log(
    `${mode}: the workbench renders — “${verdict.title}”, ${verdict.words.slice(0, 60)}…` +
      // Said rather than swallowed. A reload notice on a page that rendered is
      // not a failure, and it is not nothing either: a run that hit one has
      // proved less than a run that hit none, because the reload happened after
      // the assertions, not before them.
      (notices.length > 0
        ? `\n  note: ${notices.length} dependency-reload notice(s) from the dev server, ignored; the page had already mounted.`
        : ''),
  );
}

let status = 0;
try {
  await main();
} catch (error) {
  console.error(error instanceof Reported ? error.message : error);
  status = 1;
} finally {
  await unwind();
}
process.exit(status);
