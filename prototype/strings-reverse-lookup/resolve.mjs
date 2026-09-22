/**
 * PROTOTYPE, throwaway. Answers one question and nothing else:
 *
 *   A person points at a word in the framed app. How many message ids could it be?
 *
 * No app, no browser: every string the app can render is in
 * `apps/workbench/content/strings.generated.json` already, and a rendering is what
 * `intl-messageformat` makes of a pattern. So the whole population is reachable here,
 * which the DOM is not — a DOM only carries the screens somebody opened.
 *
 * Run: node resolve.mjs [--csv]
 */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
// Resolved against the repository, because this file lives outside it.
const require = createRequire(`${ROOT}/package.json`);
const { parse, TYPE } = require('@formatjs/icu-messageformat-parser');
const { IntlMessageFormat } = require('intl-messageformat');
const TABLE = JSON.parse(
  readFileSync(`${ROOT}/apps/workbench/content/strings.generated.json`, 'utf8'),
);

const LOCALE = 'de';
const SURFACE = 'app';
const entries = TABLE.strings.filter((r) => r.surface === SURFACE && r.translations[LOCALE]);

/** What the picker would read off a text node, and what a pattern renders to. */
const norm = (s) => s.replace(/[\s  ]+/g, ' ').trim();

const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** A number as German prints it, including the separators `Intl` uses. */
const NUMBER = '[\\d][\\d.,\\u00a0\\u202f ]*';

/** The ICU pattern as a regular expression over what it can render to. */
function toSource(ast) {
  let out = '';
  for (const el of ast) {
    switch (el.type) {
      case TYPE.literal:
        out += escape(el.value);
        break;
      case TYPE.pound:
        out += NUMBER;
        break;
      case TYPE.number:
        out += NUMBER;
        break;
      case TYPE.argument:
      case TYPE.date:
      case TYPE.time:
        // Anything at all, which is the honest answer and the expensive one.
        out += '.+?';
        break;
      case TYPE.select:
      case TYPE.plural: {
        const branches = [...new Set(Object.values(el.options).map((o) => toSource(o.value)))];
        out += `(?:${branches.join('|')})`;
        break;
      }
      case TYPE.tag:
        out += toSource(el.children);
        break;
      default:
        out += '.+?';
    }
  }
  return out;
}

/** The literal runs of a pattern, which is everything a match can be anchored on. */
function runsOf(ast, into = []) {
  for (const el of ast) {
    if (el.type === TYPE.literal) into.push(el.value);
    else if (el.type === TYPE.tag) runsOf(el.children, into);
    else if (el.type === TYPE.plural || el.type === TYPE.select) {
      // A branch is an alternative, so the weakest branch is what a match is worth.
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

/** Letters and digits only: a colon and a space pin nothing down. */
const solid = (s) => s.replace(/[^\p{L}\p{N}]/gu, '').length;
const anchorOf = (ast) => runsOf(ast).reduce((n, r) => n + solid(r), 0);
const longestRunOf = (ast) => runsOf(ast).reduce((n, r) => Math.max(n, solid(r)), 0);

/** Plausible values for every argument a pattern names, so it can be rendered. */
function specimenValues(ast, into = {}) {
  for (const el of ast) {
    if (el.type === TYPE.literal || el.type === TYPE.pound) continue;
    if (el.type === TYPE.tag) {
      specimenValues(el.children, into);
      continue;
    }
    if (el.type === TYPE.plural) {
      into[el.value] = 2;
      for (const o of Object.values(el.options)) specimenValues(o.value, into);
      continue;
    }
    if (el.type === TYPE.select) {
      into[el.value] = Object.keys(el.options)[0];
      for (const o of Object.values(el.options)) specimenValues(o.value, into);
      continue;
    }
    if (el.type === TYPE.number) into[el.value] = 2;
    else if (el.type === TYPE.date || el.type === TYPE.time) into[el.value] = new Date(2026, 8, 21);
    else into[el.value] = 'Beispiel';
  }
  return into;
}

const model = entries.map((entry) => {
  const pattern = entry.translations[LOCALE];
  const ast = parse(pattern);
  const source = toSource(ast);
  return {
    ...entry,
    pattern,
    ast,
    // Whether the pattern has any hole at all. A hole-free pattern renders to
    // exactly one string, which is the case the picker can be exact about.
    literal: ast.every((el) => el.type === TYPE.literal),
    // How much fixed text the pattern pins down. A pattern of nothing but holes
    // and punctuation matches almost any sentence: `{cta}: {title}` is two holes
    // and a colon, and it matched every long string in the catalogue.
    anchor: anchorOf(ast),
    longestRun: longestRunOf(ast),
    regex: new RegExp(`^${source}$`, 'u'),
  };
});

/** Every rendering a person could see of one id: plurals give one per branch. */
function specimens(item) {
  if (item.literal) return [norm(item.pattern)];
  const base = specimenValues(item.ast);
  const counts = [1, 2, 7];
  const out = new Set();
  for (const n of counts) {
    const values = { ...base };
    for (const [k, v] of Object.entries(values)) if (typeof v === 'number') values[k] = n;
    try {
      out.add(norm(String(new IntlMessageFormat(item.pattern, 'de').format(values))));
    } catch {
      // A pattern this prototype cannot render is reported below, not swallowed.
    }
  }
  return [...out];
}

function resolve(text) {
  return model.filter((m) => m.regex.test(text));
}

// ---- the measurement -------------------------------------------------------

const rows = [];
let unrenderable = 0;
for (const item of model) {
  const seen = specimens(item);
  if (seen.length === 0) {
    unrenderable++;
    continue;
  }
  for (const text of seen) {
    const hits = resolve(text);
    const others = hits.filter((h) => h.id !== item.id);
    rows.push({
      id: item.id,
      file: item.file,
      literal: item.literal,
      openWildcard: item.openWildcard,
      text,
      hits: hits.length,
      others,
      // Could the owner chain separate them? Only if they are not all one file.
      separableByFile: others.some((o) => o.file !== item.file),
      sameFileOnly: others.length > 0 && others.every((o) => o.file === item.file),
    });
  }
}

const LOOSE_EARLY = (m) => m.anchor < 4;
const pct = (n, d) => `${((n / d) * 100).toFixed(1)}%`;
const unique = rows.filter((r) => r.hits === 1);
const ambiguous = rows.filter((r) => r.hits > 1);
/**
 * A pattern too loose to be a matcher at all. Measured rather than guessed: the
 * threshold is set so that `{cta}: {title}` is out and `{title} pausieren` is in.
 */
const LOOSE = (m) => m.anchor < 4;
const loose = model.filter(LOOSE);
const wildcardVictims = ambiguous.filter((r) => r.others.some(LOOSE));
const realCollisions = ambiguous.filter((r) => !r.others.some(LOOSE));

console.log(`# Reverse lookup over ${SURFACE}/${LOCALE}`);
console.log(`ids: ${model.length}, renderings measured: ${rows.length}`);
console.log(`  hole-free ids: ${model.filter((m) => m.literal).length}`);
console.log(`  patterned ids: ${model.filter((m) => !m.literal).length}`);
console.log(`  too loose to match on: ${model.filter(LOOSE_EARLY).length}`);
if (unrenderable) console.log(`  ids this prototype could not render: ${unrenderable}`);
console.log('');
console.log(
  `unique (exactly one id): ${unique.length} of ${rows.length} (${pct(unique.length, rows.length)})`,
);
console.log(`ambiguous: ${ambiguous.length} (${pct(ambiguous.length, rows.length)})`);
console.log(`  of those, poisoned by an open-hole id: ${wildcardVictims.length}`);
console.log(`  genuine collisions: ${realCollisions.length}`);
console.log(
  `    separable by the owner chain (candidates in different files): ${realCollisions.filter((r) => r.separableByFile).length}`,
);
console.log(
  `    same file only (the panel has to ask): ${realCollisions.filter((r) => r.sameFileOnly).length}`,
);

console.log('\n## Too loose to match on: holes with punctuation between them');
for (const m of loose) {
  console.log(`  ${m.id.padEnd(34)} ${JSON.stringify(m.pattern)}  ${m.file}`);
}

console.log('\n## Genuine collisions, grouped');
const groups = new Map();
for (const r of realCollisions) {
  const key = [r.id, ...r.others.map((o) => o.id)].sort().join(' + ');
  if (!groups.has(key)) groups.set(key, r);
}
const sorted = [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0]));
for (const [key, r] of sorted) {
  const files = new Set([r.file, ...r.others.map((o) => o.file)]);
  console.log(`  ${JSON.stringify(r.text)}`);
  console.log(`    ${key}`);
  console.log(`    ${files.size} file(s): ${[...files].map((f) => f.split('/').pop()).join(', ')}`);
}

if (process.argv.includes('--csv')) {
  console.log('\n## CSV');
  console.log('id,hits,literal,text');
  for (const r of rows) console.log(`${r.id},${r.hits},${r.literal},${JSON.stringify(r.text)}`);
}
