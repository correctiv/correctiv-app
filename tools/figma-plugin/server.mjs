// Serves the board description to the running plugin.
//
// The plugin is an interpreter: its code never changes, only `spec.json` does. This
// server hands that file out and reports its mtime as a generation counter, so the
// plugin can poll something cheap and only fetch the whole document when it actually
// changed. Edit spec.json, save, and the board redraws — no clicking, no re-import,
// and no code crossing the wire.
//
//   node tools/figma-plugin/server.mjs
//
// Binds 127.0.0.1 AND [::1], because Chromium may resolve `localhost` to either.
// The manifest allows `http://localhost:8787`; Figma rejects a bare IP there.

import { createServer } from 'node:http';
import { copyFile, readFile, stat } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { diff } from './diff.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const SPEC = join(HERE, 'spec.json');
const PORT = Number(process.env.FIGMA_SPEC_PORT ?? 8787);

/**
 * The plugin's files, kept current where Figma reads them.
 *
 * On Linux the flatpak can only read a directory it was granted, so the plugin runs
 * from a COPY outside this repository (`fix-plugin-path.mjs` says why). That copy
 * goes stale in silence, and the plugin is an interpreter: a stale one draws a
 * description with a vocabulary it does not have yet, and the symptom is a board
 * that quietly misses whatever the new word said. It happened on 2026-09-10 — three
 * interpreter changes were committed, the copy was not refreshed, the plugin was
 * restarted, and its summary still reported the old component count.
 *
 * `fix-plugin-path.mjs` copies too, and having to remember to run it is what failed.
 * This runs on the way to serving anything, which is the one thing nobody forgets.
 * A `code.js` change still needs the plugin closed and reopened; the line below says
 * so, because only a person can do that.
 */
async function installPlugin() {
  const dir =
    process.env.FIGMA_PLUGIN_DIR ?? join(homedir(), 'Dokumente/correctiv-figma-wireframes');
  const copied = [];
  for (const file of ['manifest.json', 'code.js', 'ui.html']) {
    const from = join(HERE, file);
    const to = join(dir, file);
    const same = await readFile(to, 'utf8')
      .then(async (there) => there === (await readFile(from, 'utf8')))
      .catch(() => null);
    // `null` is "no such directory", which is every host but this one.
    if (same === null || same === true) continue;
    await copyFile(from, to);
    copied.push(file);
  }
  if (copied.length > 0) {
    console.log(`installed ${copied.join(', ')} into ${dir}`);
    if (copied.includes('code.js') || copied.includes('ui.html')) {
      console.log('close the plugin and run it again: the interpreter is only read at start');
    }
  }
}

// The plugin's UI runs on null-origin, so it needs CORS to reach us at all.
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function send(res, status, body, type = 'application/json') {
  res.writeHead(status, { ...CORS, 'Content-Type': type });
  res.end(body);
}

async function generation() {
  const info = await stat(SPEC);
  return Math.round(info.mtimeMs);
}

// What the last draw produced, and what the board says right now.
//
// The redraw is gated on the difference between the two: a person's manual
// changes since the last draw. The spec's own changes are a separate diff, so a
// regeneration alone does not block a redraw — only a person's edit does. Both
// live in memory, so a server that restarts has neither, and the first redraw
// after a restart proceeds unguarded (ADR 0069).
let baseline = null;
let current = null;

const server = createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, CORS);
    res.end();
    return;
  }

  try {
    if (req.url === '/generation') {
      send(res, 200, JSON.stringify({ generation: await generation() }));
      return;
    }

    if (req.url === '/spec') {
      const text = await readFile(SPEC, 'utf8');
      const spec = JSON.parse(text); // fail here rather than in the plugin
      const tokens = spec.tokens || {};
      // What a redraw would destroy: the person's changes since the last draw.
      const pending =
        baseline && current ? diff(baseline, current, tokens, { generatedIsBoard: true }) : [];
      // What the spec itself changed since the last draw. Informational — it does
      // not block the redraw, but the person is told the board is about to move.
      const page = (spec.pages || []).find((p) => p.name === 'Bausteine');
      const screens = page ? page.screens || spec.screens || [] : [];
      const specChanges = baseline ? diff(screens, baseline, tokens) : [];
      send(
        res,
        200,
        JSON.stringify({
          generation: await generation(),
          spec: spec,
          pending: pending,
          specChanges: specChanges,
        }),
      );
      return;
    }

    if (req.url === '/report' && req.method === 'POST') {
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      const body = Buffer.concat(chunks).toString('utf8');
      // The plugin's own account of what it drew. This is the only feedback channel
      // that does not need a screenshot, so it is worth printing in full.
      console.log(new Date().toISOString().slice(11, 19), body);
      try {
        const msg = JSON.parse(body);
        if (msg.type === 'done' && msg.board) {
          // A draw just completed: the board now matches the spec, so this is the
          // baseline the next board is diffed against.
          baseline = msg.board;
          current = msg.board;
        } else if (msg.type === 'board' && msg.board) {
          // A description of the board as it is right now, posted before a redraw
          // is allowed to proceed. Not the baseline — the person may have changed
          // something since the last draw.
          current = msg.board;
        }
      } catch {
        // A malformed report is logged above and otherwise ignored.
      }
      send(res, 200, '{"ok":true}');
      return;
    }

    send(res, 404, '{"error":"not found"}');
  } catch (error) {
    // A broken spec.json is the expected failure here, and the plugin should hear
    // about it rather than silently keep the last good board.
    send(res, 500, JSON.stringify({ error: String(error && error.message) }));
  }
});

// Both loopbacks, because the plugin fetches http://localhost:8787 and Chromium may
// resolve that to ::1 before 127.0.0.1. Binding the name itself would pick only one.
// Nothing beyond loopback is bound, so this stays off the network.
await installPlugin();

server.listen(PORT, '127.0.0.1', () => {
  console.log(`spec server on http://127.0.0.1:${PORT} serving ${SPEC}`);
});

const server6 = createServer(server.listeners('request')[0]);
server6.on('error', (error) => {
  if (error.code !== 'EAFNOSUPPORT' && error.code !== 'EADDRNOTAVAIL') throw error;
  console.log('no IPv6 loopback; IPv4 only');
});
server6.listen(PORT, '::1', () => {
  console.log(`spec server on http://[::1]:${PORT}`);
});
