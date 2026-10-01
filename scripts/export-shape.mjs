// The shape of a web export, in the two forms that can be compared between two
// exports of the same tree. Read by ci.yml's `independence` job (ADR 0040).
//
// ## Why not simply compare the bytes
//
// Because `expo export` does not emit the same bytes twice, and the first version of
// that job asserted it did. It went red on a pull request that changed nothing but
// Markdown, which is the twin of the failure AGENTS.md warns about: a check that
// fails when nothing is wrong is one people learn to merge past.
//
// **Measured on 2026-09-17, from cold caches.** Metro's transform cache lives under
// `os.tmpdir()` and `npm ci` does not touch it, so an export that follows another one
// replays its bytes; the first measurements taken for this file were cache hits and
// wrongly said the bytes were stable. The numbers below are from a fresh `TMPDIR` and
// `--clear` per export, so every one is genuinely cold, over ONE UNCHANGED TREE:
// twenty-eight exports on a developer's machine and twelve across four CI runners.
// The sample size is the claim here, which is why it is written down.
//
//   - **The bundle hash was different every one of the forty times.**
//   - The bundle's LENGTH held on all twelve runner exports and on twenty-six of the
//     twenty-eight local ones; two came back 528 bytes shorter.
//   - The `Web Bundled … (N modules)` line read 1944 on all twelve runner exports
//     and on twenty-six local ones, and 1937 and 1942 on the same two.
//   - **The module list, the stylesheets and the assets were identical in all
//     forty.**
//
// Because the bundle's filename carries its content hash and every HTML page names
// the bundle, that one varying artefact moves most of the export's files. So the
// difference is in how the modules are written, not in which ones are there, and this
// file compares what is reproducible and nothing else. The length looked like a free
// extra, and a review proposed it; those two exports are why it is printed and not
// asserted.
//
// **Where the bytes differ**, diffed between two cold exports rather than assumed:
// one region of 999 bytes at offset 1,291,178, which is the CSS-modules export map
// for `expo-router/assets/native-tabs.module.css` — the same seven class names and
// the same seven values, in a different order each time. An unordered set being
// iterated somewhere in the CSS-modules transform. Knowing that is what makes this
// safe to stop comparing: it is not a mystery about the app, it is a mystery about
// one map in one dependency, and it cannot hide a module.
//
// ## The number in the log is not this number
//
// `Web Bundled … (N modules)` is not the size of the graph, and reading it as one is
// how two people measuring the same thing get different answers — which is exactly
// what happened here, one of them reporting a 19 to 36 module swing that never
// touched the bundle's contents. It counts what that invocation bundled rather than
// what the bundle holds: a warm cache pushes it down as far as 1777 while the module
// list underneath stays 1949, and even from cold it wanders by a few. Anything
// reasoning about what the app CONTAINS reads the source map, which is what this
// file does.
//
// ## What the two files say
//
// `modules` is the bundle's module list, out of its source map, sorted. A module
// that disappears when the workbench does is the app having depended on it, and it
// is named rather than implied by a hash. This needs an export made with
// `--source-maps`.
//
// Each name is written as a JSON string, which looks like an affectation until you
// run `diff` on the raw list: five of them are virtual modules whose names begin
// with a NUL byte (`\0polyfill:assets-registry` and its four siblings), so `diff`
// calls the file binary and prints "Binary files differ" instead of the module that
// went. The whole point of this list is that the failure names names.
//
// `shape` is one line per emitted file: its path with content hashes normalised
// away, and a digest of its contents. Three kinds of file are treated differently
// and each for a stated reason:
//
//   - The JS bundle: its path is normalised and NOTHING about its contents is
//     compared, not even its length. That is the concession this whole file exists
//     to make, and `modules` is what stands in for it.
//
//     **The blind spot this leaves, named rather than left to be found.** The same
//     modules with less code inside them is invisible here: a module that resolved
//     to an emptier one, a transform that silently did nothing. The module list
//     cannot see it because the module is still listed, and the length cannot be
//     asserted because the length moves on its own. Nothing else in this repository
//     can see it either. It is the price of a bundler that does not emit the same
//     bytes twice, and the configuration half is what stands in front of the way
//     that would actually happen: a path or a name that stopped resolving.
//   - HTML: compared with hashes normalised, because every page embeds the bundle's
//     hashed name. What survives that is the prerendered markup, which is the part
//     worth comparing. Today every route emits the same shell, so these lines are
//     all one digest; that is this export's normal shape and not a symptom.
//   - Everything else — the stylesheets above all — compared byte for byte, rather
//     than as a projection such as a sorted selector set. The stylesheet is the one
//     artefact this repository has actually seen go silently wrong
//     (`apps/mobile/src/global.css`: a sheet that built green while dozens of the
//     app's utilities were missing); it was identical in every sample, so the whole
//     file can be compared, and a projection would only throw away a changed
//     declaration for nothing.
//
// ## Why this does not use `packages/prose-and-code`
//
// Asked, not overlooked. That package is for checks that read THIS REPOSITORY as
// text, and holds the walk, the floor and the ratchet they share. This reads a build
// artefact instead, has no floor of its own — ci.yml carries it, because that is
// where the two sides are compared — and runs as a plain `node` script inside a
// gate, where an import of the package's TypeScript source would make the gate
// depend on Node's type stripping. One small walk here is the cheaper of the two.
//
// Usage: node scripts/export-shape.mjs <dist-dir> <out-prefix>
//   writes <out-prefix>.shape.txt and, when the export carries source maps,
//   <out-prefix>.modules.txt

import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const [dist, prefix] = process.argv.slice(2);
if (!dist || !prefix) {
  console.error('usage: node scripts/export-shape.mjs <dist-dir> <out-prefix>');
  process.exit(2);
}

/** A 32-character content hash, wherever Metro writes one. */
const HASH = /[0-9a-f]{32}/g;

const digest = (buffer) => createHash('sha256').update(buffer).digest('hex').slice(0, 32);

function filesUnder(dir) {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    return statSync(full).isDirectory() ? filesUnder(full) : [full];
  });
}

const files = filesUnder(dist)
  .map((full) => ({ full, path: relative(dist, full).split(sep).join('/') }))
  .sort((a, b) => a.path.localeCompare(b.path));

if (files.length === 0) {
  console.error(`${dist} holds no files — an export that produced nothing is not a shape`);
  process.exit(1);
}

const shape = files.map(({ full, path }) => {
  const normalised = path.replace(HASH, 'HASH');
  // Neither its bytes NOR ITS LENGTH. The length looked like a free extra — it was
  // constant over the first several cold exports, and a review proposed it — and
  // then two exports out of a longer run came back 528 bytes shorter with the same
  // module list, the same stylesheets and the same assets. A figure that is stable
  // until it is not is the worst kind of assertion to put in a gate, so it is not
  // one; it is printed in the job's log where a person can see it move.
  if (/^_expo\/static\/js\/.*\.js$/.test(path)) return `${normalised}  (bundle not compared)`;
  if (path.endsWith('.js.map')) return null;
  const bytes = readFileSync(full);
  if (path.endsWith('.html')) {
    return `${normalised}  ${digest(bytes.toString('utf8').replace(HASH, 'HASH'))}`;
  }
  return `${normalised}  ${digest(bytes)}`;
});

writeFileSync(`${prefix}.shape.txt`, `${shape.filter(Boolean).join('\n')}\n`);

const jsDir = join(dist, '_expo/static/js/web');
let maps = [];
try {
  maps = readdirSync(jsDir).filter((f) => f.endsWith('.js.map'));
} catch {
  maps = [];
}

if (maps.length > 0) {
  const sources = new Set();
  for (const map of maps) {
    for (const source of JSON.parse(readFileSync(join(jsDir, map), 'utf8')).sources ?? []) {
      sources.add(source);
    }
  }
  const named = [...sources].sort().map((source) => JSON.stringify(source));
  writeFileSync(`${prefix}.modules.txt`, `${named.join('\n')}\n`);
  console.log(`${files.length} files, ${sources.size} modules`);
} else {
  console.log(`${files.length} files, no source map (module list not written)`);
}
