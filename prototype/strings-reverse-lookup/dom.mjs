/**
 * PROTOTYPE, throwaway. The second half of the question:
 *
 *   The table says a string is unique. Does the DOM hand the picker that string?
 *
 * `resolve.mjs` measures the population. This walks the app as built and reads every
 * text node the way `preview/frame/locate.ts` reads one — `textContent` of the
 * element under the pointer — and asks the table what it could be.
 *
 * Serves `apps/mobile/dist` and drives headless Chrome over CDP, the way
 * `apps/workbench/scripts/renders.mjs` does, because the port and the browser on this
 * machine are shared and a one-shot process cannot be disturbed.
 *
 * Run: node dom.mjs
 */
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, readFileSync, writeFileSync } from 'node:fs';
import { connect } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const HERE = fileURLToPath(new URL('.', import.meta.url));
const require = createRequire(`${ROOT}/package.json`);
const { parse, TYPE } = require('@formatjs/icu-messageformat-parser');

const PORT = Number(process.env.PORT ?? 8137);
const DIST = join(ROOT, 'apps/mobile/dist');

/** Every screen the export has a document for, minus the ones that are not screens. */
const ROUTES = [
  '/',
  '/entdecken',
  '/mitmachen',
  '/mediathek',
  '/profil',
  '/einstellungen',
  '/suche',
  '/gespeichert',
  '/artikel',
  '/atlas',
  '/backstage',
  '/bericht',
  '/faktenforum',
  '/formular',
  '/onboarding',
  '/player',
  '/spotlight',
  '/video',
  '/aufruf/wem-gehoert-die-stadt',
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Through the app's door, the way `preview/frame/seed.ts` goes through it: the
 * same two `localStorage` keys, written before the app boots. Without this every
 * route renders the gate and nineteen screens read identically, which is how the
 * first run of this file measured one screen nineteen times.
 */
const SEED = `(() => {
  const P = 'correctiv.state\\\\';
  localStorage.setItem(P + 'store.session', JSON.stringify({
    account: { email: 'handbuch@example.org', name: 'Handbuch' },
    entitlement: { tier: 'paid', appAccess: true, source: 'paid', validUntil: null, localAreas: [], memberSince: '2026-03-04T09:12:00.000Z' },
  }));
  localStorage.setItem(P + 'store.settings', JSON.stringify({
    onboardingDone: true, pushOptIn: false, textScale: 1,
    newsletter: { spotlight: false, spotlightCh: false, klima: false }, theme: 'system',
  }));
  localStorage.setItem('workbench:seeded', '1');
  return Object.keys(localStorage).length;
})()`;
const started = [];

// ---- the table, and the same matcher resolve.mjs uses ----------------------

const TABLE = JSON.parse(
  readFileSync(`${ROOT}/apps/workbench/content/strings.generated.json`, 'utf8'),
);
const norm = (s) => s.replace(/[\s  ]+/g, ' ').trim();
const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const NUMBER = '[\\d][\\d.,\\u00a0\\u202f ]*';

function toSource(ast) {
  let out = '';
  for (const el of ast) {
    if (el.type === TYPE.literal) out += escape(el.value);
    else if (el.type === TYPE.pound || el.type === TYPE.number) out += NUMBER;
    else if (el.type === TYPE.tag) out += toSource(el.children);
    else if (el.type === TYPE.select || el.type === TYPE.plural) {
      const branches = [...new Set(Object.values(el.options).map((o) => toSource(o.value)))];
      out += `(?:${branches.join('|')})`;
    } else out += '.+?';
  }
  return out;
}
function runsOf(ast, into = []) {
  for (const el of ast) {
    if (el.type === TYPE.literal) into.push(el.value);
    else if (el.type === TYPE.tag) runsOf(el.children, into);
    else if (el.type === TYPE.plural || el.type === TYPE.select) {
      const per = Object.values(el.options).map((o) => runsOf(o.value, []));
      const weakest = per.reduce(
        (a, b) => (b.join('').length < a.join('').length ? b : a),
        per[0] ?? [],
      );
      into.push(...weakest);
    }
  }
  return into;
}
const solid = (s) => s.replace(/[^\p{L}\p{N}]/gu, '').length;

const MODEL = TABLE.strings
  .filter((r) => r.surface === 'app' && r.translations.de)
  .map((r) => {
    const ast = parse(r.translations.de);
    return {
      id: r.id,
      file: r.file,
      pattern: r.translations.de,
      anchor: runsOf(ast).reduce((n, x) => n + solid(x), 0),
      regex: new RegExp(`^${toSource(ast)}$`, 'u'),
    };
  });
const USABLE = MODEL.filter((m) => m.anchor >= 4);
const resolve = (text) => USABLE.filter((m) => m.regex.test(text));

// ---- the browser -----------------------------------------------------------

function accepts(port) {
  return new Promise((r) => {
    const s = connect({ port, host: '127.0.0.1' });
    s.once('connect', () => (s.destroy(), r(true)));
    s.once('error', () => (s.destroy(), r(false)));
  });
}

async function serve() {
  if (await accepts(PORT)) throw new Error(`Port ${PORT} is already held by something else.`);
  const child = spawn('node', [join(ROOT, 'screens/tools/serve-clean.mjs'), DIST, String(PORT)], {
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  started.push(() => child.kill());
  const deadline = Date.now() + 15_000;
  while (!(await accepts(PORT))) {
    if (child.exitCode !== null) throw new Error(`serve-clean exited ${child.exitCode}`);
    if (Date.now() > deadline) throw new Error('serve-clean never listened');
    await sleep(25);
  }
}

async function browser() {
  const profile = mkdtempSync(join(tmpdir(), 'strings-dom-'));
  started.push(() => rmSync(profile, { recursive: true, force: true }));
  const child = spawn(
    'google-chrome',
    [
      '--headless',
      '--disable-gpu',
      '--no-sandbox',
      '--remote-debugging-port=0',
      `--user-data-dir=${profile}`,
      '--window-size=420,860',
      'about:blank',
    ],
    { stdio: ['ignore', 'ignore', 'pipe'] },
  );
  started.push(() => child.kill());
  const endpoint = await new Promise((resolve_) => {
    let stderr = '';
    const timer = setTimeout(() => resolve_(undefined), 20_000);
    child.stderr.on('data', (chunk) => {
      stderr += chunk;
      const found = stderr.match(/ws:\/\/\S+/);
      if (found) {
        clearTimeout(timer);
        resolve_(found[0]);
      }
    });
  });
  if (!endpoint) throw new Error('Chrome printed no debugging endpoint.');
  return endpoint;
}

/** One CDP session over the browser endpoint, with a page target of its own. */
async function session(endpoint) {
  const ws = new WebSocket(endpoint);
  await new Promise((r, j) => {
    ws.onopen = r;
    ws.onerror = j;
  });
  let next = 1;
  const waiting = new Map();
  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    if (msg.id && waiting.has(msg.id)) {
      const { resolve: res, reject } = waiting.get(msg.id);
      waiting.delete(msg.id);
      if (msg.error) reject(new Error(JSON.stringify(msg.error)));
      else res(msg.result);
    }
  };
  const send = (method, params = {}, sessionId) =>
    new Promise((res, reject) => {
      const id = next++;
      waiting.set(id, { resolve: res, reject });
      ws.send(JSON.stringify({ id, method, params, sessionId }));
    });

  const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
  return {
    eval: async (expression, url) => {
      if (url) {
        await send('Page.enable', {}, sessionId);
        await send('Page.navigate', { url }, sessionId);
        await sleep(4000);
      }
      const { result, exceptionDetails } = await send(
        'Runtime.evaluate',
        { expression, returnByValue: true, awaitPromise: true },
        sessionId,
      );
      if (exceptionDetails) throw new Error(JSON.stringify(exceptionDetails));
      return result.value;
    },
    close: () => ws.close(),
  };
}

/**
 * What the picker would read, from every element that owns visible text.
 *
 * The innermost element carrying text, which is what `composedPath()[0]` gives the
 * picker on a pointerdown, and its `textContent` — the same field `armPicker` puts
 * in the handover's label.
 */
const WALK = `(() => {
  const SKIP = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TITLE', 'HEAD']);
  const out = [];
  for (const el of document.querySelectorAll('*')) {
    if (SKIP.has(el.tagName)) continue;
    if (el.closest('[aria-hidden="true"]')) continue;
    const own = [...el.childNodes].filter((n) => n.nodeType === 3 && n.textContent.trim() !== '');
    if (own.length === 0) continue;
    const rect = el.getBoundingClientRect();
    const whole = (el.textContent || '').trim();
    for (const node of own) {
      out.push({
        // The one text node, which is what a message renders to on its own.
        part: node.textContent.trim(),
        // What the picker reads today: everything under the element.
        whole,
        tag: el.tagName,
        fragments: own.length,
        onScreen: rect.width > 0 && rect.height > 0,
      });
    }
  }
  return out;
})()`;

// ---- run -------------------------------------------------------------------

try {
  await serve();
  const endpoint = await browser();
  const page = await session(endpoint);

  const seeded = await page.eval(SEED, `http://localhost:${PORT}/`);
  console.error(`  seeded ${seeded} storage keys`);

  const all = [];
  for (const route of ROUTES) {
    let found;
    try {
      found = await page.eval(WALK, `http://localhost:${PORT}${route}`);
    } catch (error) {
      console.error(`  ${route}: ${error.message.slice(0, 120)}`);
      continue;
    }
    for (const node of found) all.push({ ...node, route });
    console.error(`  ${route}: ${found.length} text-bearing elements`);
  }
  page.close();

  // One reading per distinct text, because the same word on four routes is one
  // question about the catalogue and not four.
  const byText = new Map();
  for (const node of all) {
    const text = norm(node.part);
    if (text === '') continue;
    if (!byText.has(text)) byText.set(text, { text, nodes: [], routes: new Set() });
    const item = byText.get(text);
    item.nodes.push(node);
    item.routes.add(node.route);
  }

  const rows = [...byText.values()].map((item) => {
    const onPart = resolve(item.text);
    const whole = norm(item.nodes[0].whole);
    const onWhole = onPart.length === 0 && whole !== item.text ? resolve(whole) : [];
    return {
      ...item,
      hits: onPart.length > 0 ? onPart : onWhole,
      answeredBy: onPart.length > 0 ? 'node' : onWhole.length > 0 ? 'element' : 'neither',
      whole,
      routes: [...item.routes],
    };
  });

  const none = rows.filter((r) => r.hits.length === 0);
  const one = rows.filter((r) => r.hits.length === 1);
  const many = rows.filter((r) => r.hits.length > 1);
  const pct = (n) => `${((n / rows.length) * 100).toFixed(1)}%`;

  console.log(`\n# What the DOM hands the picker, over ${ROUTES.length} routes`);
  console.log(`distinct texts on screen: ${rows.length}`);
  console.log(`  resolve to exactly one id: ${one.length} (${pct(one.length)})`);
  console.log(`  resolve to several: ${many.length} (${pct(many.length)})`);
  console.log(`  resolve to none: ${none.length} (${pct(none.length)})`);

  const separable = many.filter((r) => new Set(r.hits.map((h) => h.file)).size > 1);
  console.log(`    of the several, in different files: ${separable.length}`);

  console.log('\n## Matched nothing (the interesting half)');
  for (const r of none.slice(0, 60)) {
    console.log(`  ${JSON.stringify(r.text.slice(0, 90))}  [${r.routes.join(' ')}]`);
  }
  if (none.length > 60) console.log(`  … and ${none.length - 60} more`);

  console.log('\n## Matched several');
  for (const r of many) {
    console.log(
      `  ${JSON.stringify(r.text.slice(0, 70))} -> ${r.hits.map((h) => h.id).join(', ')}`,
    );
  }

  writeFileSync(join(HERE, 'dom-rows.json'), JSON.stringify(rows, null, 1));
} finally {
  for (const stop of started.reverse()) {
    try {
      stop();
    } catch {}
  }
}
