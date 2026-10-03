#!/usr/bin/env node
/**
 * How tall the workbench header is at a range of window widths, and what it gave
 * up to stay one row.
 *
 *     node apps/workbench/scripts/measure-header.mjs
 *     WIDTHS=1280,1600,2000 SHOTS=/tmp/shots node apps/workbench/scripts/measure-header.mjs
 *
 * **A script and not a test, on the same ground as `measure-direct.mjs`.** What it
 * reads is this machine's fonts at this machine's widths: the tier the ladder in
 * `src/ui/header-row.tsx` settles on is measured, not asserted, and a check that
 * reddened for a font somebody else's machine has would be a check that gets
 * switched off. What CI keeps is `test/header-row.test.tsx`, which asserts the
 * ladder's SHAPE — that the walk steps and settles, that each tier gives up what
 * the next one keeps — over boxes whose widths are numbers the test owns.
 *
 * **So this is the script that turns "the header is one row" into a number.**
 * `flex-wrap` put the header in three rows at 1280, 1600 and 2000 CSS pixels
 * alike, which no source-reading test can see and no `flex-nowrap` in a
 * stylesheet proves: `nowrap` is what the header now says, and what the header
 * now DOES is this script's output. Three boxes are asked, because the header,
 * the context bar inside it and the frame's own toolbar are three claims, and a
 * bar that overflows into its neighbour without overflowing itself is the failure
 * this round is about — the route field disappearing rather than the bar growing.
 *
 * **A script and not a page in `screens/`.** Those are the app's shots under fixed
 * step names, and this is the workbench's header at widths nobody picked; it
 * writes wherever `SHOTS` says and to nothing by default, so a run leaves the
 * repository as it found it.
 *
 * Chrome over CDP and no dependency, for the reason `renders.mjs` says: the
 * protocol is JSON, the global `WebSocket` is there, and a check whose first act
 * is `npm install puppeteer` is a check that does not run on a fresh machine.
 */

import { spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const WORKBENCH = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/**
 * The widths, and why these three.
 *
 * 1280 is the narrowest laptop this site is looked at on and the width the header
 * broke at first; 1600 is a common desktop; 2000 is the width where the header
 * has so much room that the ladder should have been at tier 0, and finding it
 * folded there is the finding. All three are where it broke into three rows.
 */
const WIDTHS = (process.env.WIDTHS ?? '1280,1600,2000').split(',').map(Number);

/** `PORT` because two runs of this at once is the normal case and neither is a test. */
const PORT = Number(process.env.PORT ?? 8194);

/** Where to write the pictures. Nothing by default: a run leaves no trace. */
const SHOTS = process.env.SHOTS;

/** Where the pictures go, and the mode the page is looked at in. */
const APPEARANCE = process.env.APPEARANCE ?? 'dark';
const LANGUAGE = process.env.LANGUAGE ?? 'de';

const sleep = (ms) => new Promise((done) => setTimeout(done, ms));

/** Everything started here, unwound in reverse, because a half-run is a port held. */
const started = [];
async function unwind() {
  while (started.length > 0) {
    try {
      await started.pop()();
    } catch {
      // A process that is already gone is the state this wanted.
    }
  }
}

/**
 * The dev server, started in-process.
 *
 * `renders.mjs` runs it too and for the same reason: the thing under
 * measurement is what the dev server serves, and a script that spawned `npm run
 * dev` would be measuring a build nobody ships. `measure-direct.mjs`'s comment on
 * Uniwind applies to the cwd as well.
 */
process.chdir(WORKBENCH);
const { createServer } = await import('vite');
const server = await createServer({
  root: WORKBENCH,
  logLevel: 'warn',
  server: { port: PORT, strictPort: true },
});
started.push(() => server.close());
await server.listen();
const base = `${server.resolvedUrls.local[0].replace(/\/$/, '')}/preview`;

/** Headless Chrome, and the socket to drive it over. `CHROME_PATH` first, as always. */
const profile = mkdtempSync(join(tmpdir(), 'workbench-header-'));
started.push(() => rmSync(profile, { recursive: true, force: true }));
const chrome = spawn(
  process.env.CHROME_PATH ?? 'google-chrome',
  [
    '--headless=new',
    '--disable-gpu',
    '--no-sandbox',
    '--hide-scrollbars',
    `--user-data-dir=${profile}`,
    '--remote-debugging-port=0',
    'about:blank',
  ],
  { stdio: ['ignore', 'ignore', 'pipe'] },
);
started.push(() => chrome.kill('SIGKILL'));

const endpoint = await new Promise((done) => {
  let stderr = '';
  const timer = setTimeout(() => done(undefined), 20_000);
  chrome.stderr.on('data', (chunk) => {
    stderr += chunk;
    const found = stderr.match(/ws:\/\/\S+/);
    if (found) {
      clearTimeout(timer);
      done(found[0]);
    }
  });
  chrome.once('error', () => done(undefined));
  chrome.once('exit', () => done(undefined));
});
if (!endpoint) {
  console.error('No browser to look with. Install Chrome or point CHROME_PATH at one.');
  await unwind();
  process.exit(1);
}

const socket = new WebSocket(endpoint);
started.push(() => socket.close());
await new Promise((done, failed) => {
  socket.addEventListener('open', done, { once: true });
  socket.addEventListener('error', failed, { once: true });
});
let last = 0;
const waiting = new Map();
socket.addEventListener('message', (event) => {
  const message = JSON.parse(event.data);
  if (message.id && waiting.has(message.id)) {
    waiting.get(message.id)(message.result ?? {});
    waiting.delete(message.id);
  }
});
const call = (method, params = {}, sessionId) =>
  new Promise((done) => {
    const id = ++last;
    waiting.set(id, done);
    socket.send(JSON.stringify({ id, method, params, sessionId }));
  });

const { targetId } = await call('Target.createTarget', { url: 'about:blank' });
const { sessionId } = await call('Target.attachToTarget', { targetId, flatten: true });
await call('Page.enable', {}, sessionId);
await call('Runtime.enable', {}, sessionId);

const evaluate = async (expression) => {
  const out = await call(
    'Runtime.evaluate',
    { expression, awaitPromise: true, returnByValue: true },
    sessionId,
  );
  if (out.exceptionDetails) throw new Error(JSON.stringify(out.exceptionDetails).slice(0, 300));
  return out.result?.value;
};

/**
 * What is measured, and what each number is FOR, which is the part a reader of the
 * output needs and cannot guess.
 *
 * `rows` is the finding itself and the reason this script exists: it counts the rows
 * the header's children occupy, so `1` is the claim and `3` is the defect #331's
 * screenshots show. It counts them by vertical OVERLAP rather than by comparing
 * baselines, because the children are of different heights — the mark is 20 pixels and
 * a button is 32, and centre-aligned neighbours of different sizes have different
 * `top`s on the same row. The first version counted distinct `top`s and called a
 * one-row header three rows, which is how a script can be wrong and the page right.
 *
 * `clipped` is the other half, and the quiet one: a child can be narrower than its
 * content and lose its tail without the bar knowing, and nothing else in the page says
 * so. So every leaf inside the header and inside the context bar is asked, not just
 * the header's own children.
 */
const READ = `(() => {
  const header = document.querySelector('header');
  if (!header) return null;
  const box = (el) => {
    const r = el.getBoundingClientRect();
    return { top: Math.round(r.top), h: Math.round(r.height), w: Math.round(r.width) };
  };
  const leaf = (el) => ({
    ...box(el),
    label: (el.getAttribute('data-testid') || el.getAttribute('aria-label') || el.tagName).slice(0, 24),
    // \`scrollWidth > clientWidth\` on a box that clips: the tail is not drawn and
    // nothing else in the page says so.
    clipped: el.scrollWidth > el.clientWidth + 1,
  });
  const context = header.querySelector(':scope > div');
  /*
   * What can be asked about a box: something that occupies space, outside an SVG and
   * not a \`<legend>\`. A legend inside its fieldset is laid out as one pixel whatever
   * it says, so asking it whether it is clipped reports a defect in every fieldset
   * the header has ever had, and an SVG path has no client width to speak of.
   */
  const drawable = (el) =>
    el.children.length === 0 && el.tagName !== 'LEGEND' && !el.closest('svg') && !el.closest('select');
  /** Rows by vertical overlap, which is what a row IS. */
  const rowsIn = (parent) => {
    const boxes = [...parent.children].map(box).filter((b) => b.h > 0).sort((a, b) => a.top - b.top);
    let rows = 0;
    let bottom = -Infinity;
    for (const b of boxes) {
      if (b.top >= bottom - 1) {
        rows += 1;
        bottom = Math.max(bottom, b.top + b.h);
      }
    }
    return rows;
  };
  return {
    rows: rowsIn(header),
    contextRows: context ? rowsIn(context) : null,
    height: Math.round(header.getBoundingClientRect().height),
    header: { client: header.clientWidth, scroll: header.scrollWidth },
    context: context ? { client: context.clientWidth, scroll: context.scrollWidth } : null,
    leaves: [
      // The two boxes this script measures are not asked about themselves: the
      // context bar is min-w-0 and takes the shortfall on purpose, which is the
      // arrangement rather than a defect, and the header's own overflow is reported
      // beside it. What is asked about is everything inside them.
      ...[...header.children].filter(drawable).map(leaf),
      ...(context ? [...context.querySelectorAll('*')].filter(drawable).map(leaf) : []),
    ].filter((b) => b.w > 1),
    density: header.dataset.density ?? null,
  };
})()`;

/**
 * One row: everything the header's own children draw, on one line, with nothing
 * clipped inside the bar or inside the context bar.
 *
 * **The context bar's own `scrollWidth` is reported and not required.** It is the
 * box that takes the shortfall on purpose — the route field is `flex-1` with a
 * `min-w-0`, so the bar is wider than its content whenever the field has been
 * squeezed, and that is the arrangement working. What must not happen is something
 * VISIBLE losing its tail, which is what `leaves` asks of every leaf inside both
 * bars: measured on the widest header state, the context bar read 509 against 449
 * and no leaf was clipped, because what was 60 pixels over is the field being
 * narrower than the text it would hold.
 *
 * The header's own overflow IS required to be zero: every one of its children is
 * `shrink-0`, so a header wider than its box means a control pushed off the end of
 * it, which is the defect this whole round is about.
 */
const ONE_ROW = (m) =>
  m !== null &&
  m.rows === 1 &&
  m.contextRows === 1 &&
  m.header.scroll <= m.header.client + 1 &&
  !m.leaves.some((c) => c.clipped);

/**
 * A selector the page is not expected to have for a moment, waited for rather than
 * slept through: the dev server compiles the app's own graph on the first hit at
 * `/preview`, and a fixed sleep is either long enough to be slow everywhere or short
 * enough to measure an empty page in one run and a full one in the next.
 */
async function until(selector, tries = 60) {
  for (let waited = 0; waited < tries; waited += 1) {
    if (await evaluate(`document.querySelector(${JSON.stringify(selector)}) !== null`)) return true;
    await sleep(1000);
  }
  return false;
}

/** The home tool open, in the appearance and language a reader here would use. */
await call('Page.navigate', { url: base }, sessionId);
await until('header');
await evaluate(`localStorage.setItem('workbench:appearance', ${JSON.stringify(APPEARANCE)})`);
await evaluate(`localStorage.setItem('workbench:language', ${JSON.stringify(LANGUAGE)})`);
/*
 * The address written out, and not `#?tool=home`. Two things are being asked for
 * here and the short form asks for neither: the workbench reads its appearance and
 * its language once, on mount, so a hash change from `/preview` is the same
 * document and re-reads nothing; and the preview route answers `?tool=` by
 * rewriting itself into `full=1`, which is the one state with no header at all
 * (`App.tsx` draws it only when `!full`). So the device, the tool and `full=0` are
 * written out, and `?r=1` is there to make this a load rather than a hash change.
 */
await call('Page.navigate', { url: `${base}?r=1#/?d=iphone-15-pro&tool=home&full=0` }, sessionId);
if (!(await until('header'))) {
  console.error(
    'The header never appeared. What the page says:\n',
    await evaluate('document.body.innerText'),
  );
  await unwind();
  process.exit(1);
}
await sleep(4000);

if (SHOTS !== undefined) mkdirSync(SHOTS, { recursive: true });

/** A picture of the window as it stands, written wherever `SHOTS` says. */
async function shot(name) {
  const { data } = await call('Page.captureScreenshot', { format: 'png' }, sessionId);
  writeFileSync(join(SHOTS, `${name}.png`), Buffer.from(data, 'base64'));
}

/**
 * The element the needle names, by the test id or the accessible name it carries.
 *
 * Both helpers below find it this way and neither uses a CSS selector for the whole
 * thing: the ids here are stable and the labels are in the reader's language, so a
 * German run and an English run both find the same control.
 */
const FIND = `(() => {
  const all = [...document.querySelectorAll('[data-testid], [aria-label]')];
  const el = all.find((e) =>
    (e.getAttribute('data-testid') || e.getAttribute('aria-label') || '').includes(NEEDLE));
  return el === undefined ? null : true;
})()`;

/** A find that says so when there is nothing, because a silent miss is a missing picture. */
const named = async (needle) => {
  const found = await evaluate(FIND.replace('NEEDLE', JSON.stringify(needle)));
  if (found !== true) console.error(`\n   nothing on the page is called ${JSON.stringify(needle)}`);
  return found === true;
};

/**
 * A press on the control.
 *
 * `element.click()` and not a dispatched event, and not the CDP mouse: Radix opens a
 * popover from an `onClick`, and a `MouseEvent` that is not trusted never reaches
 * React's listener on the root. Measured here — the CDP events landed on the button
 * (`document.elementFromPoint` said so, at x=826) and no menu appeared, which is what
 * sent this looking. What is lost is the physicality — there is no pointer resting on
 * the button afterwards — and for a menu that opens on a click that is nothing.
 */
async function click(needle) {
  if (!(await named(needle))) return false;
  await evaluate(`(() => {
    const el = [...document.querySelectorAll('[data-testid], [aria-label]')].find((e) =>
      (e.getAttribute('data-testid') || e.getAttribute('aria-label') || '').includes(${JSON.stringify(needle)}));
    el.scrollIntoView({ block: 'center' });
    el.click();
  })()`);
  await sleep(900);
  return true;
}

const widths = [];
for (const width of WIDTHS) {
  await call(
    'Emulation.setDeviceMetricsOverride',
    { width, height: 1000, deviceScaleFactor: 1, mobile: false },
    sessionId,
  );
  await sleep(2500);
  const measured = await evaluate(READ);
  widths.push({ width, ...measured });
  console.log(
    `\n== ${width}px  height=${measured.height}  rows=${measured.rows}/${measured.contextRows}  ` +
      `header=${measured.header.scroll}/${measured.header.client}  ` +
      `context=${measured.context ? `${measured.context.scroll}/${measured.context.client}` : '-'}  ` +
      `density=${measured.density}  ${ONE_ROW(measured) ? 'one row' : 'NOT ONE ROW'}`,
  );
  for (const box of measured.leaves) {
    console.log(
      `   ${String(box.top).padStart(4)} ${String(box.w).padStart(5)}  ${box.label}${box.clipped ? '  CLIPPED' : ''}`,
    );
  }
  if (SHOTS !== undefined) await shot(`header-${width}`);
}

/**
 * The `⋯` open, at the width where the ladder is at its tightest.
 *
 * A screenshot of a menu that is not open is a screenshot of a button, and what this
 * picture carries is that the menu holds the two actions that left the bar, with their
 * names. At the narrowest of the measured widths, because that is the one where there
 * is a tier to fold.
 *
 * **It says so when the click does not arrive.** A press on the trigger is a `click`,
 * and whether one reaches the page is a fact about the browser this script drives and
 * not about the header: measured here, the CDP pointer events arrive as `pointerdown`
 * and no `click` is ever synthesised, and `element.click()` reaches a listener on
 * `document` and not the handler React has on the root. Where that is the case the run
 * still measures and still shoots the headers, and prints this line so nobody reads
 * the absence of the picture as the absence of the menu.
 */
if (SHOTS !== undefined) {
  const narrow = Math.min(...WIDTHS);
  await call(
    'Emulation.setDeviceMetricsOverride',
    { width: narrow, height: 1000, deviceScaleFactor: 1, mobile: false },
    sessionId,
  );
  await sleep(2500);
  if (await click('action-more')) {
    /*
     * The pointer somewhere harmless before the picture, because a menu item under a
     * resting pointer carries its tooltip and the tooltip is drawn over the item
     * below it — two pictures of one thing, one of them showing the other.
     */
    await call(
      'Input.dispatchMouseEvent',
      { type: 'mouseMoved', x: 4, y: 999, buttons: 0 },
      sessionId,
    );
    await sleep(700);
    const opened = await evaluate(
      `document.querySelector('[data-testid="action-discard"]') !== null`,
    );
    if (opened) {
      /*
       * The pointer onto the menu itself, on the gap between its two items. It has to
       * be somewhere: a pointer that has never been over the panel takes the open
       * menu down with it before the shutter (measured — the layer reads the focus
       * that moved when the panel was drawn). It must not be over an item either,
       * because a menu item under the pointer carries its tooltip and the tooltip is
       * drawn over the item below it.
       */
      await call(
        'Input.dispatchMouseEvent',
        { type: 'mouseMoved', x: narrow / 2, y: 190, buttons: 0 },
        sessionId,
      );
      await sleep(600);
      console.log(
        `\n   the ⋯ is open: ${await evaluate(`document.querySelector('[data-testid="action-discard"]') !== null`)}`,
      );
      await shot(`more-${narrow}`);
    } else {
      console.log(`\n   the ⋯ did not open: no click reaches this browser (see above)`);
    }
  }
}

const bad = widths.filter((m) => !ONE_ROW(m));
console.log(
  bad.length === 0
    ? `\none row at ${widths.map((m) => `${m.width}px`).join(', ')}`
    : `\nnot one row at ${bad.map((m) => `${m.width}px`).join(', ')}`,
);

await unwind();
process.exit(bad.length === 0 ? 0 : 1);
