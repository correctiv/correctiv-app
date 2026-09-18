import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

import {
  eatenByStripping,
  excusesWithoutReason,
  filesUnder,
  floorFaults,
  ratchet,
  under,
  withoutComments,
} from '@correctiv/prose-and-code';

import { IMPORT_RE, specifier } from './support/source';

/**
 * ADR 0040, the configuration half.
 *
 * **The rule is one direction and it is not symmetric.** `apps/workbench` may read
 * `apps/mobile`, and does: it compiles the app's components for `/components`, it
 * holds its own provider list against `AppEnvironment.tsx`, it writes the
 * `workbench:` override keys the app declares, and it frames the app's own web
 * export. None of that is a violation and none of it is what this file looks for.
 * What it looks for is the other direction: `apps/mobile` or a package it ships
 * reaching into the workbench.
 *
 * **Why the direction is worth a check.** The app ships, to a phone, through a
 * store. The workbench is a developer tool on a public URL with no access control.
 * A dependency from the app to the workbench puts a tool inside a release bundle,
 * and ADR 0026 §1 measured how quietly that happens: three of five ways of writing
 * a guarded `require()` leaked a devtool's export names into a production export
 * while every one of them looked guarded in the source.
 *
 * **Why this half exists at all, given the other one.** The backstop is
 * ci.yml's `independence` job: it moves `apps/workbench` out of the tree for real,
 * re-installs, and asks the app's own toolchain. That is the stronger half, because
 * it asks the toolchain rather than a regular expression. It cannot see the shapes
 * that go GREEN when the directory is gone, and there are several: a Tailwind
 * `@source`, a jest `moduleNameMapper`, a Metro `watchFolders` entry and a `paths`
 * alias all MATCH NOTHING and build. What comes out is an app missing whatever that
 * entry was contributing. `src/global.css` records this happening from the other
 * side: a stylesheet built green while dozens of the app's utilities were missing,
 * so every row in every drawn component stood on end. A dependency entry in
 * `package.json` with no import behind it yet is the same shape.
 *
 * And one more the record did not name, measured on 2026-09-17 by writing all three
 * and exporting with the directory gone: a **named import of the workbench whose
 * binding nothing reads** exports fine. The transform elides it, so it never enters
 * the graph and Metro never resolves it. A side-effect import and a used binding both
 * fail the export, loudly. So the line between the two halves is not "source versus
 * toolchain"; the import that is about to matter is on this side of it. (Writing that
 * example out as real code is what the import net below caught next, in this comment,
 * which is the second time this file has proved itself by failing.)
 *
 * **A cold review then wrote four real violations and watched all nine assertions
 * stay green**, which is the honest first result for a check like this and the reason
 * the list of limits at the end of this comment is now written against measurements
 * rather than against intentions. The four, and what answers each:
 *
 *  1. A whole-file excuse that a real read walked straight through — the generator
 *     was excused for naming the workbench in prose, and a `readFileSync` of a file
 *     under `apps/workbench` added to the same file was excused with it. The excuse
 *     counts OCCURRENCES now, and the filesystem net below excuses nothing.
 *  2. `.github/workflows/*` was read by neither half, while ADR 0040 §2 names that
 *     shape twice. The workflows are read below, per STEP.
 *  3. `build:workbench` is how this repository spells "run the workbench", and the
 *     script rule knew only the package name and the two paths. It reads the root
 *     manifest's own script names now, and the `pre`/`post` scripts with them.
 *  4. Inputs that make the comment stripper eat code — a `/*` inside a string —
 *     hid a Metro watch folder into the workbench. Every removal that carries the
 *     name is examined below, and the ones that do not look like comments are
 *     reported as a third bucket that nothing excuses.
 *
 * **What this cannot see**, per ADR 0031's obligation on a mechanism-4 check, and
 * written here rather than in a document because this is where somebody reaching
 * for a bypass is looking:
 *
 *  - **A path assembled at runtime.** `join(workspaceRoot, 'apps', 'workbench')` is
 *    two string literals and neither is a match. So is `require(name)` where `name`
 *    is a variable, and so is a workflow's `cp "$SOURCE" "$TARGET"`. The build half
 *    is what stands behind this.
 *  - **A configuration file nobody has written yet.** The named list below is what
 *    the app's toolchain reads TODAY. A new one is picked up automatically only if
 *    it sits at the root of one of the scanned workspaces; anywhere else it is
 *    invisible until somebody adds a line. Again: the build half.
 *  - **A read this file does not name.** The filesystem net is a list of call names,
 *    so `fs[verb](…)`, a path handed to a helper three calls away, or a shell
 *    written into a file and executed from there are all outside it. It reads the
 *    call's arguments as text, which is the same limit one layer down.
 *  - **The repository's own scripts.** `scripts/` at the root and `tools/` are out
 *    of scope — ADR 0040 §2 names `apps/mobile` and `packages/` — so a workflow step
 *    running `node scripts/something.mjs` is read as a step, while what that script
 *    does is not read at all.
 *  - **What a step does without naming either side.** The workflow rule asks whether
 *    a step that runs the app, or writes into it, also names the workbench. A step
 *    that does neither by name — an action from another repository, a reusable
 *    workflow, a Makefile — is invisible to it.
 *  - **A `/*` inside a string that the parity test cannot see.** The third bucket
 *    below decides "was this really a comment" by counting quotes, so a quote closed
 *    by another quote on the same line still passes as a comment. It is asked only
 *    of the removals that carry the workbench's name, which is a decision rather than
 *    an optimisation: asked of every removal in scope, on 2026-09-17 it flagged 130
 *    of 3409, most of them a generated stylesheet written inside a template literal,
 *    and a bucket that size is a bucket somebody switches off.
 *  - **This file's own text.** It has to write the three spellings down in order to
 *    look for them, so the text net excuses it wholesale rather than by occurrence.
 *    The import net and the filesystem net both read it with nothing excused, which
 *    is where a real dependency in here would land.
 *  - **A server.** ADR 0040 §4 records "no app server unless agreed otherwise" as
 *    the one way to invert the direction without writing an import: the app fetching
 *    a document the workbench operates is a dependency that no pattern here can see,
 *    because the reach is a URL and a URL is a string. One mechanism does stand in
 *    front of part of it, and saying there is none would be an overstatement:
 *    `apps/workbench/test/sources.test.ts` fails on a FILE in
 *    `packages/app-core/src/data` that has no row in the sources manifest, with a
 *    status and a reason, so a new source added to the core as a file of its own has
 *    to be named by a human in a diff. Its gaps are worth as much as its cover: it
 *    counts files rather than endpoints, so a URL added to a data file that already
 *    has a row passes, and it reads only the core, so a fetch written in
 *    `apps/mobile` is outside it altogether. What nothing here can do is tell a URL
 *    the workbench operates from correctiv.org's REST API, and a check that could
 *    not fail is not written. It stays a decision with a record.
 *  - **`tools/`.** Out of scope on purpose: ADR 0040 §2 names `apps/mobile` and
 *    `packages/`, and `tools/figma-plugin` ships with neither.
 */

/** The repository root, three levels up from `apps/mobile/__tests__`. */
const REPO = resolve(__dirname, '../../..');

/** A path as this file talks about it: relative to the repository, forward slashes. */
const rel = (full: string): string => under(REPO, full);

/**
 * Where the workbench is and what it is called, as one pair rather than as three
 * spellings scattered through the patterns below.
 *
 * Nothing else in this file asserts that the workbench still answers to either of
 * them, and a text net whose text has been renamed goes quiet rather than red. The
 * assertion that holds this pair is the first one in the suite.
 */
const WORKBENCH = { directory: 'apps/workbench', name: '@correctiv/workbench' };

interface Reach {
  name: string;
  pattern: RegExp;
  why: string;
}

/**
 * Every spelling that reaches the workbench, and what each one is the shape of.
 *
 * Three rather than one because they are three different mistakes and the failure
 * message should say which. The `workbench:` override keys the app declares —
 * `workbench:seeded`, `workbench:home-layout`, `workbench:home-time` — match none
 * of them, and that is deliberate: ADR 0040 §3 is that a shared spelling is not a
 * dependency. The app may declare a seam the workbench uses; it may not read the
 * workbench to know what to declare.
 *
 * A fourth spelling exists and is not here, because it is not a pattern: the names
 * of the ROOT scripts that run the workbench. `npm run build:workbench` reaches it
 * without writing any of the three, and a pattern for the bare word `workbench`
 * would match every sentence in this file. They are read off the root manifest
 * instead, by `runsOneOf` below.
 */
const REACHES: Reach[] = [
  {
    name: '@correctiv/workbench',
    pattern: /@correctiv\/workbench/,
    why: "the workbench's package name: an import, a dependency entry, a `paths` alias, or `-w @correctiv/workbench` in a script",
  },
  {
    name: 'apps/workbench',
    pattern: /apps\/workbench/,
    why: 'the workbench directory named from the repository root: a tsconfig path, a Metro watch folder, a jest root, a Tailwind `@source`',
  },
  {
    name: '../workbench',
    pattern: /(?:\.\.\/)+workbench(?![\w:-])/,
    why: 'the workbench directory reached relatively, which is the spelling an import inside `apps/` writes',
  },
];

/** Which of the three a piece of text reaches by, if any. */
function reachesIn(text: string): Reach[] {
  return REACHES.filter((reach) => reach.pattern.test(text));
}

/**
 * How many times, rather than whether.
 *
 * The excuse list below is per occurrence, which is the fix for the hole a whole-file
 * excuse had: the generator is excused for naming the workbench ONCE, in the sentence
 * it writes into a generated file, and a second mention in the same file is an
 * arrival. A boolean cannot say that.
 */
function occurrences(text: string, reach: Reach): number {
  return (text.match(new RegExp(reach.pattern.source, 'g')) ?? []).length;
}

/* ========================================================================== *
 * WHAT THE REPOSITORY CALLS RUNNING EACH HALF
 * ========================================================================== */

const ROOT_SCRIPTS: Record<string, string> =
  (
    JSON.parse(readFileSync(join(REPO, 'package.json'), 'utf8')) as {
      scripts?: Record<string, string>;
    }
  ).scripts ?? {};

/**
 * `npm run <name>`, whatever flags are arranged around it — but only the ROOT's
 * script of that name.
 *
 * **`-w` changes which script is meant**, and the root's own `workbench:i18n:extract`
 * is the case: `npm run i18n:extract -w @correctiv/workbench` runs the WORKBENCH's
 * script, not the root's identically named one, so without this a script that only
 * ever touches the workbench was reported as the app reaching into it.
 *
 * **The `-w` has to be read out of the same command as the script name, and the
 * first version of this read it out of the whole string.** A cold review got three
 * things through that, each of which turns the rule off with no intent to:
 *
 *  - `npm run build:workbench && npm run build:web -w @correctiv/mobile` — the app's
 *    release path building the workbench, with the app's own `-w` three words later
 *    answering for it.
 *  - the same shape one script apart, which is what a `pre`/`post` step looks like.
 *  - `npm --prefix ../.. run build:workbench && tsc -w --noEmit` — an ordinary
 *    watch flag. The capture takes the next token, `--noEmit`, and `/mobile/` fails
 *    on it, so a TypeScript flag switched off a guard on the release path.
 *
 * So the search is scoped to the segment the name matched, `[^&|;\n]*`, which is
 * the same slice the name itself is found in. A `-w` in a neighbouring command of a
 * chain now says nothing about this one, which is the truth about how a shell reads
 * it. Both halves are held by cases in the pretend manifests below rather than by
 * the real repository happening to contain them.
 */
function runsScript(command: string, script: string): boolean {
  const name = script.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const call = new RegExp(
    `\\bnpm\\b[^&|;\\n]*?\\brun\\b\\s+["']?${name}(?![\\w:.-])[^&|;\\n]*`,
  ).exec(command);
  if (call === null) return false;
  const workspace = /\s(?:-w|--workspace)(?:=|\s+)["']?(@?[\w./@-]+)/.exec(call[0]);
  return workspace === null || /mobile/.test(workspace[1] ?? '');
}

/**
 * The root scripts that end up running one half, by NAME rather than by pattern.
 *
 * Read off the root manifest so that renaming `build:workbench` renames what this
 * check looks for, which is the property the patterns above cannot have. Two ways a
 * name joins the set after the seed, and the second is the one a cold review got
 * through:
 *
 *  - it runs a script already in the set (`npm run build:workbench && …`), and
 *  - it is the `pre` or `post` script of one. npm runs `prebuild:web` as part of
 *    `build:web` without either of them naming the other, so a lifecycle script is
 *    the natural place to hide a step and it names neither half by itself.
 */
function scriptsThatReach(
  scripts: Record<string, string>,
  seed: (command: string) => boolean,
): Set<string> {
  const set = new Set(
    Object.entries(scripts)
      .filter(([, command]) => seed(command))
      .map(([name]) => name),
  );
  for (let grew = true; grew;) {
    grew = false;
    for (const [name, command] of Object.entries(scripts)) {
      if (set.has(name)) continue;
      const base = name.replace(/^(?:pre|post)/, '');
      const reaches =
        [...set].some((other) => other !== name && runsScript(command, other)) ||
        (base !== name && set.has(base));
      if (!reaches) continue;
      set.add(name);
      grew = true;
    }
  }
  return set;
}

/** `workbench`, `build:workbench`, `workbench:renders`, … — whatever they are called today. */
const WORKBENCH_SCRIPTS = scriptsThatReach(
  ROOT_SCRIPTS,
  (command) => reachesIn(command).length > 0,
);

/**
 * The root scripts that run the app.
 *
 * `check`, `test` and `typecheck` use `--workspaces` and reach both halves; they are
 * the repository asking, not the app, so they are not in this set and the rule below
 * does not apply to them.
 */
const APP_SCRIPTS = scriptsThatReach(ROOT_SCRIPTS, (command) =>
  /@correctiv\/mobile|apps\/mobile\b/.test(command),
);

/**
 * Which of a set of scripts a command runs by name.
 *
 * `except` is the script the command belongs to, so that a script is never reported
 * as running itself: the day `build:web` joins both sets, the finding worth printing
 * is the workbench script it runs, not its own name.
 */
function runsOneOf(command: string, scripts: Iterable<string>, except?: string): string[] {
  return [...scripts].filter((script) => script !== except && runsScript(command, script)).sort();
}

/**
 * The two sets of script names a rule reads, passed rather than reached for, so that
 * the fixtures below can hand it a manifest of their own. A case that asks the real
 * repository is a case that fails whenever the repository is broken, wherever the
 * break actually is.
 */
interface Halves {
  workbench: Set<string>;
  app: Set<string>;
}

const ROOT_HALVES: Halves = { workbench: WORKBENCH_SCRIPTS, app: APP_SCRIPTS };

/* ========================================================================== *
 * WHAT THIS READS
 * ========================================================================== */

/**
 * The files the app's toolchain reads, each with the reason it is on the list.
 *
 * ADR 0031's first obligation on a mechanism-4 check: an exception carries its
 * reason, and so does an entry — a list of bare paths says nothing about which of
 * them could go and which could not. Every one of these is asserted to EXIST, so a
 * config file renamed or moved fails here rather than dropping silently off the
 * scan, which is the way a list like this normally stops working.
 *
 * The workspaces' package roots are scanned wholesale on top of this (see
 * `configurationFiles`), so a new config file beside one of these is in the net
 * from the day it is written. This list is what makes a DISAPPEARANCE red.
 */
const TOOLCHAIN: { path: string; why: string }[] = [
  {
    path: 'apps/mobile/package.json',
    why: "the app's manifest: its dependencies, and every script npm will run for it",
  },
  {
    path: 'apps/mobile/tsconfig.json',
    why: '`paths`, `include` and `extends`; jest-expo derives its own moduleNameMapper from `paths`, so an alias here reaches the suite too',
  },
  { path: 'apps/mobile/tsconfig.test.json', why: "the suite's program and its ambient files" },
  { path: 'apps/mobile/tsconfig.scripts.json', why: "the generators' program" },
  {
    path: 'apps/mobile/metro.config.js',
    why: '`watchFolders`, `nodeModulesPaths` and `resolveRequest`: what the bundler may read and how it resolves',
  },
  {
    path: 'apps/mobile/jest.config.js',
    why: '`moduleNameMapper`, `setupFiles`, `transformIgnorePatterns`',
  },
  { path: 'apps/mobile/babel.config.js', why: 'presets and plugins, which resolve as modules' },
  {
    path: 'apps/mobile/app.json',
    why: "Expo's configuration: plugins and asset paths, which prebuild copies into the native projects",
  },
  { path: 'apps/mobile/app.config.js', why: 'the dynamic half of the same configuration' },
  { path: 'apps/mobile/index.js', why: 'the entry point Metro starts from' },
  {
    path: 'apps/mobile/src/global.css',
    why: "Tailwind's `@source` and `@import`; the entry on this list whose violation would build green while the app lost utilities",
  },
  {
    path: 'apps/mobile/assets.d.ts',
    why: 'an ambient declaration file, which can `declare module` at any path',
  },
  { path: 'apps/mobile/uniwind-types.d.ts', why: 'the same' },
  { path: 'packages/app-core/package.json', why: "the core's manifest" },
  { path: 'packages/app-core/tsconfig.json', why: "the core's program" },
  { path: 'packages/app-core/vitest.config.ts', why: "the core's suite" },
  { path: 'packages/design-tokens/package.json', why: "the token package's manifest" },
  { path: 'packages/design-tokens/tsconfig.json', why: "the token package's program" },
  {
    path: '.github/workflows/ci.yml',
    why: "the build half of this check lives in it, and so does the `web` job that exports the app — the two places a step could build the workbench on the app's way out",
  },
  {
    path: '.github/workflows/pages.yml',
    why: 'it builds both halves and assembles them into one artefact, so it is where a copy out of the workbench into the app would be written',
  },
];

/**
 * The workspaces whose toolchain must not be able to see the workbench: the app,
 * and every package it may ship. `packages/` is read rather than listed, so a
 * package added tomorrow is in the net without anybody remembering this file.
 */
function scannedWorkspaces(): string[] {
  const packages = readdirSync(join(REPO, 'packages'))
    .map((entry) => join(REPO, 'packages', entry))
    .filter((full) => statSync(full).isDirectory());
  return [join(REPO, 'apps/mobile'), ...packages];
}

/** Text files worth reading: source, configuration, stylesheets, data. */
const READABLE = /\.(tsx?|jsx?|mts|cts|mjs|cjs|css|json)$/;

/**
 * Everything at the root of a scanned workspace, plus the named list above.
 *
 * `READABLE` filters the named list too, which is what keeps the two workflows on it
 * out of this set: they are asserted to EXIST here and read per step further down,
 * where the rule is about a step rather than about a line of text.
 */
function configurationFiles(): string[] {
  const roots = scannedWorkspaces().flatMap((root) =>
    readdirSync(root)
      .map((entry) => join(root, entry))
      .filter((full) => statSync(full).isFile() && READABLE.test(full)),
  );
  const named = TOOLCHAIN.map((entry) => join(REPO, entry.path)).filter(
    (full) => existsSync(full) && READABLE.test(full),
  );
  return [...new Set([...roots, ...named])].sort();
}

/** The trees under a workspace that hold code rather than build output. */
const SOURCE_TREES = ['src', 'scripts', 'test', '__tests__'];

function sourceFiles(): string[] {
  return scannedWorkspaces()
    .flatMap((root) => SOURCE_TREES.map((tree) => join(root, tree)))
    .flatMap((dir) => (existsSync(dir) ? filesUnder(dir, READABLE) : []))
    .sort();
}

/* ========================================================================== *
 * READING A FILE AS CODE, AND SAYING SO WHEN THAT FAILED
 * ========================================================================== */

function parses(text: string): boolean {
  try {
    JSON.parse(text);
    return true;
  } catch {
    return false;
  }
}

/**
 * A file as this check reads it: its comments out, except where taking them out is
 * the thing that goes wrong.
 *
 * JSON that parses as written has no comments to take out, and `withoutComments`
 * has a known limit that turns one into damage: it truncates a line at a `//`
 * preceded by whitespace, inside a string literal as readily as outside one. Any
 * `.json` in scope carrying `" … // … "` in a value would stop being JSON, and
 * `packages/catalogue/src/` is in scope — a trip-wire under the copy deck, which is a
 * red for a reason that has nothing to do with the workbench. So: JSONC is
 * stripped, JSON is read as written.
 */
function asCode(full: string, text: string): string {
  return full.endsWith('.json') && parses(text) ? text : withoutComments(text);
}

const BLOCK_COMMENT = /(^|[\s;{}(),=:[])(\/\*[\s\S]*?\*\/)/g;
const LINE_COMMENT = /(^|\s)\/\/[^\n]*/g;

/**
 * What the comment stripper takes out of a file, as spans rather than as an
 * absence.
 *
 * This is the third bucket's machinery and it is the answer to the fourth hole. The
 * reviewer's suggestion was to match the three spellings against the RAW text as
 * well as the stripped text and report the difference as "seen but not
 * classifiable". Cheap and total, and measured on this repository on 2026-09-17 it
 * reported nineteen mentions, every one of them a comment that names the other end
 * of a seam — which ADR 0040 §3 puts on the permitted side. A bucket that size needs
 * an excuse list, and an excuse list is what the fourth hole came through.
 *
 * So the question is asked of the REMOVAL rather than of the difference: the
 * stripper took this span out because it decided the span was a comment, and the
 * span names the workbench, so was it a comment? Two counts answer it, both cheap
 * and neither a parser, and the answer is only ever needed for the handful of
 * removals that carry the name.
 *
 * The two expressions are the stripper's own, copied deliberately rather than
 * exported from it: `withoutComments` applies them in sequence, and reading them
 * back off one pass over the raw text is an approximation of that, not a replay. It
 * over-reports — a `//` inside a block comment shows up here as a removal of its own
 * — and over-reporting is the safe direction for a bucket that excuses nothing.
 *
 * `@correctiv/prose-and-code` has no shape for this, and that is said here rather
 * than worked around quietly: it owns `eatenByStripping`, which asks whether what
 * came out still READS, and this asks a different question — whether what went out
 * was a comment at all. One caller is not yet a shape, by that package's own
 * standard of two or three copies; the day a second check wants it, this is what it
 * should take there.
 */
function removals(source: string): { at: number; text: string }[] {
  const found: { at: number; text: string }[] = [];
  for (const match of source.matchAll(BLOCK_COMMENT)) {
    found.push({ at: match.index + (match[1] ?? '').length, text: match[2] ?? '' });
  }
  for (const match of source.matchAll(LINE_COMMENT)) {
    const before = (match[1] ?? '').length;
    found.push({ at: match.index + before, text: match[0].slice(before) });
  }
  return found.sort((a, b) => a.at - b.at);
}

/**
 * Whether the thing that opened a removal was sitting inside a string literal, as
 * far as counting can say, and in which of the two ways.
 *
 * Quotes on the opener's own line for `'` and `"`, because a string in one of those
 * cannot cross a line; every character of the surviving CODE before the opener for a
 * backtick, because a template literal can and does. The apostrophe in `don't` is
 * taken out first, or every sentence in a double-quoted string would read as an open
 * string.
 */
function openedInsideAString(source: string, at: number): string {
  const line = source
    .slice(source.lastIndexOf('\n', at - 1) + 1, at)
    .replace(/\\./g, '')
    .replace(/(\w)'(\w)/g, '$1$2');
  for (const quote of ["'", '"']) {
    if ((line.split(quote).length - 1) % 2 === 1) {
      return `an odd number of ${quote} before it on its line`;
    }
  }
  const ticks = (withoutComments(source.slice(0, at)).replace(/\\./g, '').match(/`/g) ?? []).length;
  return ticks % 2 === 1 ? 'an odd number of backticks before it in the code' : '';
}

/** The mentions this check could not honestly call either code or prose. */
function doubts(name: string, source: string): string[] {
  return removals(source).flatMap((removal) => {
    const why = reachesIn(removal.text).length > 0 ? openedInsideAString(source, removal.at) : '';
    if (!why) return [];
    return [
      `${name}: the comment stripper removed text naming the workbench, and that removal opened with ${why}` +
        ` — so it may have eaten code rather than a comment: ${removal.text.replace(/\s+/g, ' ').slice(0, 80)}`,
    ];
  });
}

/* ========================================================================== *
 * READING A FILE, WITHOUT IMPORTING IT
 * ========================================================================== */

/**
 * The calls that make the app need a file to be there, without importing it.
 *
 * The import net below is the stated backstop for the text nets, and the first hole
 * a cold review found was that it is not one: `import`, `require` and `import()` are
 * three spellings, and `readFileSync`, `readdirSync`, `createRequire`, `spawn` and
 * `execSync` are all outside them. A generator that reads a file under
 * `apps/workbench` genuinely fails when the directory is gone, and it looked exactly
 * like the prose the generator is excused for.
 *
 * Reads and processes, not writes: the app writing INTO the workbench would be odd
 * but it is not a dependency, and `writeFileSync` on this list would report the
 * generator that writes the sentence naming it.
 */
const READING_CALLS = [
  'readFileSync',
  'readFile',
  'readdirSync',
  'readdir',
  'existsSync',
  'statSync',
  'lstatSync',
  'realpathSync',
  'opendirSync',
  'createReadStream',
  'copyFileSync',
  'cpSync',
  'globSync',
  'glob',
  'createRequire',
  'require\\.resolve',
  'import\\.meta\\.resolve',
  'execSync',
  'execFileSync',
  'execFile',
  'exec',
  'spawnSync',
  'spawn',
  'fork',
];

const READS_A_FILE = new RegExp(`(?<![\\w$])(${READING_CALLS.join('|')})\\s*\\(`, 'g');

/**
 * How far past the opening bracket to read. A call whose brackets never balance —
 * inside a template, or in a file this net has mis-parsed — would otherwise read to
 * the end of the file and report the next mention of the workbench anywhere below it.
 */
const ARGUMENT_WINDOW = 2000;

function argumentsAt(source: string, open: number): string {
  let depth = 0;
  const end = Math.min(source.length, open + ARGUMENT_WINDOW);
  for (let i = open; i < end; i += 1) {
    if (source[i] === '(') depth += 1;
    else if (source[i] === ')') {
      depth -= 1;
      if (depth === 0) return source.slice(open, i + 1);
    }
  }
  return source.slice(open, end);
}

/** Every call in a file that reads something under the workbench. */
function filesystemReadsIn(source: string): string[] {
  return [...source.matchAll(READS_A_FILE)].flatMap((match) => {
    const call = (match[1] ?? '').replace(/\\/g, '');
    const args = argumentsAt(source, match.index + match[0].length - 1);
    return reachesIn(args).map(
      (reach) => `${call}(…) → ${reach.name}: ${args.replace(/\s+/g, ' ').slice(0, 100)}`,
    );
  });
}

/* ========================================================================== *
 * THE WORKFLOWS
 * ========================================================================== */

const WORKFLOWS = join(REPO, '.github/workflows');

/**
 * A workflow with its comments out.
 *
 * Comments go for the reason they go everywhere else in this file: ADR 0040 §3 puts
 * naming the other end of a seam on the permitted side, and `pages.yml` opens with
 * five paragraphs about what the workbench is. It carries `withoutComments`'s known
 * limit in YAML's dialect — a `#` inside a quoted shell string truncates the line —
 * and that limit was measured here on 2026-09-17: of every `#` this takes out across
 * the workflows in this repository, not one sat after code, and not one named the
 * workbench.
 */
function withoutYamlComments(text: string): string {
  return text.replace(/(^|\s)#[^\n]*/g, '$1');
}

interface Step {
  where: string;
  text: string;
}

/**
 * A workflow's steps, split at every list item.
 *
 * Not a YAML parser, and it does not need to be: the rule below asks what one step
 * says, so splitting too finely weakens a net and splitting too coarsely invents
 * violations. Every `- ` at the start of a line opens a new item, which over-splits
 * (a `paths:` list becomes several one-line "steps" that say nothing) and never
 * merges two steps into one.
 */
function stepsIn(where: string, text: string): Step[] {
  const steps: Step[] = [];
  let current: Step | undefined;
  withoutYamlComments(text)
    .split('\n')
    .forEach((line, index) => {
      if (/^\s*- /.test(line)) {
        current = { where: `${where}:${index + 1}`, text: line };
        steps.push(current);
      } else if (current) {
        current.text += `\n${line}`;
      }
    });
  return steps;
}

function workflowFiles(): string[] {
  if (!existsSync(WORKFLOWS)) return [];
  return readdirSync(WORKFLOWS)
    .filter((entry) => /\.ya?ml$/.test(entry))
    .map((entry) => join(WORKFLOWS, entry))
    .sort();
}

/**
 * The ways a workflow step runs the app, each with what it is.
 *
 * Plus the root scripts in `APP_SCRIPTS`, by name, which is how `npm run build:web`
 * is recognised without this list having to know what `build:web` does.
 */
const RUNS_THE_APP: { pattern: RegExp; why: string }[] = [
  {
    pattern: /-w\s+@correctiv\/mobile|--workspace[= ]@correctiv\/mobile/,
    why: "runs npm in the app's workspace",
  },
  {
    pattern: /working-directory:\s*(?:\.\/)?apps\/mobile/,
    why: 'runs inside `apps/mobile`',
  },
  {
    pattern: /\bexpo\s+(?:export|start|run:|prebuild)/,
    why: "runs expo, which is the app's own toolchain",
  },
];

/** A line that puts something into the app's tree rather than taking something out of it. */
const COPIES = /\b(?:cp|mv|rsync|tee)\b|>>?/;

/**
 * Where a step writes into the app's tree.
 *
 * The direction is the whole of it. `cp -r apps/mobile/dist site/app` is the deploy
 * READING the app, which is the permitted direction and is in `pages.yml` today;
 * `cp apps/workbench/dist/home.json apps/mobile/src/…` is the workbench's output
 * being planted in the app, which is ADR 0040 §2's "a generated file the app reads,
 * taken out by copy rather than by path". The destination is the last word on the
 * line, so continuations are joined before the line is read.
 */
function writesIntoTheApp(step: Step): string[] {
  return step.text
    .replace(/\\\n\s*/g, ' ')
    .split('\n')
    .filter((line) => COPIES.test(line))
    .map((line) => line.trim().split(/\s+/).at(-1) ?? '')
    .filter((target) => /^["']?(?:\.\/)?(?:apps\/mobile|packages)\//.test(target));
}

/**
 * A workflow step that reaches both halves at once.
 *
 * ADR 0040 §2 names two shapes and this is where both of them are written: "a
 * workflow step that builds the workbench before exporting the app", and "a
 * generated file the app reads, taken out by copy rather than by path". Neither half
 * of the check read `.github/` until 2026-09-17, when a cold review added a step
 * doing both to `pages.yml` and watched every assertion stay green.
 *
 * Per STEP rather than per job or per file, and that is the line that makes the rule
 * hold today rather than merely being strict: `pages.yml` builds the app, builds the
 * workbench and assembles both into one artefact, which is what ADR 0024 says the
 * deploy is for. Those are three steps. A step that does two of them is the
 * dependency.
 */
function workflowOffenders(where: string, text: string, halves: Halves = ROOT_HALVES): string[] {
  return stepsIn(where, text).flatMap((step) => {
    // A root script that runs BOTH halves is the script rule's finding, reported
    // where it is written; naming it again at every step that runs the app would
    // bury the one line that says where the dependency actually is.
    const names = [
      ...reachesIn(step.text).map((reach) => `${reach.name} (${reach.why})`),
      ...runsOneOf(step.text, halves.workbench)
        .filter((script) => !halves.app.has(script))
        .map((script) => `npm run ${script}`),
    ];
    if (names.length === 0) return [];

    const app = [
      ...RUNS_THE_APP.filter((form) => form.pattern.test(step.text)).map((form) => form.why),
      ...runsOneOf(step.text, halves.app).map((script) => `runs \`npm run ${script}\``),
      ...writesIntoTheApp(step).map((target) => `writes into ${target}`),
    ];
    if (app.length === 0) return [];

    return [`${step.where}: names ${names.join(', ')} in a step that ${app.join(', and ')}`];
  });
}

/* ========================================================================== *
 * THE EXCUSES
 * ========================================================================== */

/**
 * This file, and the one thing that excuses it.
 *
 * It has to write the three spellings down in order to look for them, so the text
 * net below would find itself. The import net and the filesystem net do NOT excuse
 * it, which is the half that matters: this file importing the workbench, or reading
 * a file inside it, is still red.
 */
const THIS_FILE = 'apps/mobile/__tests__/no-workbench-dependency.test.ts';

/**
 * The occurrences that name the workbench outside a comment, and why each one is not
 * a dependency.
 *
 * ADR 0031: an exception carries its reason. Keyed by file AND spelling, with the
 * number of times that spelling may survive the strip, because the excuse the first
 * version of this file carried was for the FILE — and a cold review added a
 * `readFileSync` of the workbench's own `scripts/api.mjs` to the excused file and
 * watched all nine assertions stay green. An excuse that covers a file covers
 * whatever lands in it next.
 *
 * (Writing that example out with its argument, here in this comment, is what the
 * filesystem net caught next. It excuses nothing, comments included, and this is the
 * third time this file has proved itself by failing.)
 *
 * `generate-component-ids.mjs` writes prose for a file it generates, and the prose
 * says that a component's address is spelled in three places and that they move
 * together. One of the three is `apps/workbench/scripts/api.mjs`. That sentence is a
 * comment in every sense except that the generator carries it as a template literal,
 * which is the one thing `withoutComments` cannot see through. The script does not
 * resolve the workbench, read a file under it, or shell into it — it names it,
 * exactly as ADR 0040 §3 says a comment may.
 *
 * A second entry here is an argument to have in a pull request rather than a line to
 * add quietly; several would mean the text net has stopped being a net and become a
 * list of the files that are allowed through it.
 */
const NAMES_IT_IN_PROSE: Record<string, { occurrences: number; why: string }> = {
  'apps/mobile/scripts/generate-component-ids.mjs → apps/workbench': {
    occurrences: 1,
    why: "the error message and the doc comment it writes into `src/gallery/components.generated.ts`, which name the workbench's `api.mjs` as the third place a component address is spelled",
  },
  'packages/prose-and-code/test/licence-boundary.test.ts → @correctiv/workbench': {
    occurrences: 1,
    why: "the list of names that Apache-2.0 code in `packages/prose-and-code` may not import, the workbench among them. It is a check that FORBIDS the import, so the name is there to be refused, which is ADR 0040 §3's line drawn by another check rather than crossed. The import net below reads the file with nothing excused, so an actual import would still be red.",
  },
};

/** The same table as the ratchet wants it: a key and a count. */
const EXCUSED_OCCURRENCES = Object.fromEntries(
  Object.entries(NAMES_IT_IN_PROSE).map(([key, entry]) => [key, entry.occurrences]),
);

/** And as the reason check wants it: a key and a sentence. */
const EXCUSE_REASONS = Object.fromEntries(
  Object.entries(NAMES_IT_IN_PROSE).map(([key, entry]) => [key, entry.why]),
);

describe('the app does not depend on the workbench', () => {
  const configs = configurationFiles();
  const sources = sourceFiles();
  const workflows = workflowFiles().map((full) => ({
    name: rel(full),
    text: readFileSync(full, 'utf8'),
  }));
  const steps = workflows.flatMap((workflow) => stepsIn(workflow.name, workflow.text));

  /** Every file this check reads, as its name and the text the rules read it as. */
  const documents = [...new Set([...configs, ...sources])].map((full) => {
    const text = readFileSync(full, 'utf8');
    return { name: rel(full), text, code: asCode(full, text) };
  });

  /**
   * The workbench is still called what this file says and still lives where it says.
   *
   * Nothing else here would notice a rename: every pattern above is the workbench's
   * name or its path, so moving `apps/workbench` to `apps/studio` takes the whole text
   * net quiet with no assertion failing. One read of one manifest closes that.
   *
   * The one benign absence is ci.yml's `independence` job, which moves the directory
   * out of the checkout for real and then runs this suite — so "nothing in `apps/` is
   * the workbench" is a failure only when `apps/` still holds a package that is not
   * the app. That distinguishes the deletion from the rename, which is what this has
   * to do, and the build half asserts the directory name itself before it moves it.
   */
  it('is still looking for the workbench where the workbench is', () => {
    const apps = readdirSync(join(REPO, 'apps'))
      .map((entry) => ({
        directory: `apps/${entry}`,
        manifest: join(REPO, 'apps', entry, 'package.json'),
      }))
      .filter((app) => existsSync(app.manifest))
      .map((app) => ({
        directory: app.directory,
        name: (JSON.parse(readFileSync(app.manifest, 'utf8')) as { name?: string }).name ?? '',
      }));

    const claimants = apps.filter((app) => reachesIn(app.name).length > 0);
    const others = apps.filter((app) => app.name !== '@correctiv/mobile');
    const faults: string[] = [];

    for (const claimant of claimants) {
      if (claimant.directory === WORKBENCH.directory) continue;
      faults.push(
        `${claimant.name} lives at ${claimant.directory}, and every pattern in this file spells it ${WORKBENCH.directory}`,
      );
    }
    if (claimants.length > 1) {
      faults.push(`more than one package answers to ${WORKBENCH.name}`);
    }
    if (claimants.length === 0 && others.length > 0) {
      faults.push(
        `nothing in apps/ is called ${WORKBENCH.name} any more, and ${others
          .map((app) => app.directory)
          .join(', ')} is there instead — this whole file is looking for a name that has moved`,
      );
    }

    expect(faults).toEqual([]);
  });

  /**
   * The guard against a scan that matches nothing, which is the state every check
   * in this file would otherwise report as success.
   *
   * Five ways this can go quiet: the walk finds no files, the configuration set
   * loses the entries that matter, a named file is renamed and silently drops out,
   * a file is read and comes back BLANK, or a rule is written against a set that is
   * empty on this machine. The last one is why the workflow floors count STEPS THAT
   * RUN THE APP rather than workflow files: a splitter that stopped splitting, or a
   * form of running the app that nobody writes any more, would leave the workflow
   * rule asking its question of nothing at all.
   */
  it('reads the files it claims to (guards against a silently empty scan)', () => {
    const missing = TOOLCHAIN.filter((entry) => !existsSync(join(REPO, entry.path))).map(
      (entry) => `${entry.path} — on the list because ${entry.why}`,
    );

    expect(missing).toEqual([]);
    expect(sources.map(rel)).toContain(THIS_FILE);
    expect(
      floorFaults({
        'the configuration files read': { found: configs.length, atLeast: 20 },
        'the source files read': { found: sources.length, atLeast: 200 },
        'the workflows read': { found: workflows.length, atLeast: 3 },
        'the workflow steps read': { found: steps.length, atLeast: 40 },
        'the steps that run the app': {
          found: steps.filter(
            (step) =>
              RUNS_THE_APP.some((form) => form.pattern.test(step.text)) ||
              runsOneOf(step.text, APP_SCRIPTS).length > 0,
          ).length,
          atLeast: 3,
        },
        'the root scripts that run the workbench': { found: WORKBENCH_SCRIPTS.size, atLeast: 3 },
        'the root scripts that run the app': { found: APP_SCRIPTS.size, atLeast: 3 },
      }),
    ).toEqual([]);
  });

  /**
   * And the blank file on its own, because it is the way this check actually failed
   * first and nothing about it looked like a failure.
   *
   * `withoutComments` is a pair of regular expressions. Until 2026-09-17 a block
   * comment opened on a slash-star anywhere, so the first `paths` entry in
   * `apps/mobile/tsconfig.json` — written `"@` slash star `"` — opened one and the
   * first recursive glob under `include` closed it: every path alias the file has
   * came back blank, and this check went green on a `paths` entry pointing straight
   * into the workbench. `jest.config.js` carries the same pair in `testMatch`.
   *
   * Every JSON the check strips therefore has to still BE JSON once its comments are
   * out. It is the cheapest total statement available — a file the stripper has
   * eaten the middle of does not parse — and unlike a length or a keyword it needs
   * no number that goes stale.
   *
   * Only the JSONC, and that is the fix for a red this could have thrown for an
   * unrelated reason: a `.json` that parses as written is not stripped at all (see
   * `asCode`), so a catalogue entry containing `" … // … "` cannot fail here. The
   * floor underneath is what keeps that from turning the assertion off: if nothing in
   * scope is JSONC any more, this guards nothing and says so.
   *
   * The shape of the guard is `@correctiv/prose-and-code`'s `eatenByStripping`,
   * because a stripper that can produce nonsense should be able to say so wherever
   * one is used, and the oracle — here `JSON.parse`, which is its default — is the
   * caller's, because only the caller knows what the file was supposed to be.
   */
  it('reads JSON that is still JSON once the comments are out', () => {
    const jsonc = documents.filter(
      (document) => document.name.endsWith('.json') && !parses(document.text),
    );

    expect(floorFaults({ 'the JSONC files read': { found: jsonc.length, atLeast: 1 } })).toEqual(
      [],
    );
    expect(eatenByStripping({ documents: jsonc })).toEqual([]);
  });

  /**
   * The second guard, and the one that can go wrong without anything looking
   * wrong: every assertion below reads source through REACHES, so a pattern that
   * stopped matching would report an app with no dependency on anything and pass.
   * One fixture per shape, so a shape that falls out of the net fails here by name.
   *
   * The second half is the other direction, and it is the part that keeps this
   * check honest rather than merely strict: everything the app writes about the
   * workbench today has to stay green, or the check is one somebody will delete
   * the first time it is in the way.
   */
  it('catches every shape it claims to, and nothing that is correct today', () => {
    const caught = (text: string): string[] => reachesIn(text).map((reach) => reach.name);

    // The import shape is written as the SPECIFIER rather than as a whole
    // `import … from …` statement, and that is the last assertion in this file
    // proving itself: the import net below excuses nothing, not even this file, so a
    // fixture written as a real import statement is a real import statement as far
    // as it is concerned. It failed exactly that way once, which is how this comment
    // came to be here.
    expect(caught('@correctiv/workbench/preview')).toEqual(['@correctiv/workbench']);
    expect(caught('"@correctiv/workbench": "*"')).toEqual(['@correctiv/workbench']);
    expect(caught('"build:web": "npm run build -w @correctiv/workbench && expo export"')).toEqual([
      '@correctiv/workbench',
    ]);
    expect(caught("@source '../../workbench/src';")).toEqual(['../workbench']);
    expect(caught("config.watchFolders = [path.resolve(root, 'apps/workbench')];")).toEqual([
      'apps/workbench',
    ]);
    expect(caught('"@/workbench/*": ["../../apps/workbench/src/*"]')).toEqual(['apps/workbench']);

    // And the permitted direction, the declared seam and the prose. Each of these
    // is written in the app today; every one of them must stay green.
    expect(caught("const SEEDED_KEY = 'workbench:seeded';")).toEqual([]);
    expect(caught("export const HOME_LAYOUT_OVERRIDE_KEY = 'workbench:home-layout';")).toEqual([]);
    expect(caught("export const HOME_TIME_OVERRIDE_KEY = 'workbench:home-time';")).toEqual([]);
    expect(caught("const label = 'open the workbench';")).toEqual([]);
  });

  /**
   * The same, for the three nets that are not the patterns: the script names, the
   * filesystem calls and the workflow steps.
   *
   * Every fixture here is a violation a cold review wrote into the repository and
   * watched pass, so this case is the record of what each of them was. The
   * filesystem call is assembled from a variable rather than written out, because
   * the net that reads it excuses nothing and this file is not exempt — spelling it
   * out here would be a real read of the workbench in the app's test suite.
   */
  it('catches the shapes that are not a pattern: a script name, a read, a workflow step', () => {
    // The script rules read a manifest, so their fixture is a manifest — the three
    // lines the review wrote, in a table of their own. Asking the REPOSITORY's
    // scripts here instead would make this case fail whenever one of those lines is
    // present, which is a red for the right reason in the wrong assertion.
    const pretend = {
      'build:workbench': 'npm run build -w @correctiv/workbench',
      'build:web': 'npm run build:workbench && npm run build:web -w @correctiv/mobile',
      'prebuild:web': 'npm run build:workbench',
      web: 'npm run web -w @correctiv/mobile',
    };
    const reaching = (seed: (command: string) => boolean): string[] =>
      [...scriptsThatReach(pretend, seed)].sort();

    expect(reaching((command) => reachesIn(command).length > 0)).toEqual([
      'build:web',
      'build:workbench',
      'prebuild:web',
    ]);
    // `prebuild:web` names neither half and npm runs it as part of `build:web`,
    // which is how it was the shape that went through the old second gate.
    expect(reaching((command) => /@correctiv\/mobile/.test(command))).toEqual([
      'build:web',
      'prebuild:web',
      'web',
    ]);

    expect(runsScript('npm run build:workbench && npm run build:web', 'build:workbench')).toBe(
      true,
    );
    expect(runsScript('npm --prefix ../.. run build:workbench', 'build:workbench')).toBe(true);
    expect(runsScript('npm run workbench:renders', 'workbench:renders')).toBe(true);
    // A script name is not a prefix of another one, and a workspace flag is not a
    // script name: `npm run build -w @correctiv/workbench` runs `build`, not `web`.
    expect(runsScript('npm run workbench:renders', 'workbench')).toBe(false);
    expect(runsScript('npm run build -w @correctiv/workbench', 'web')).toBe(false);
    expect(runsScript('npm run build:web -w @correctiv/mobile', 'build:workbench')).toBe(false);

    /*
     * `-w` decides WHICH script of that name is meant, and it has to be read out of
     * the same command as the name. A cold review got three shapes through a version
     * that searched the whole string, and each is here so that the property is held
     * by this table rather than by what the root manifest happens to contain today.
     *
     * The three that must stay TRUE are the exploits: a chain whose other command
     * carries the app's own `-w`, the same one script apart, and a plain `tsc -w`,
     * which captured `--noEmit` and turned the rule off from a TypeScript flag.
     */
    expect(
      runsScript(
        'npm run tokens -w @correctiv/design-tokens && npm run build:workbench',
        'build:workbench',
      ),
    ).toBe(true);
    expect(
      runsScript(
        'npm run build:workbench && npm run build:web -w @correctiv/mobile',
        'build:workbench',
      ),
    ).toBe(true);
    expect(
      runsScript('npm --prefix ../.. run build:workbench && tsc -w --noEmit', 'build:workbench'),
    ).toBe(true);
    // And the false positive the clause exists for: the workbench's own script of a
    // name the root also has. Both spellings of the flag, because npm takes both.
    expect(runsScript('npm run i18n:extract -w @correctiv/workbench', 'i18n:extract')).toBe(false);
    expect(
      runsScript('npm run i18n:extract --workspace @correctiv/workbench', 'i18n:extract'),
    ).toBe(false);
    expect(
      runsScript('npm run i18n:extract --workspace=@correctiv/workbench', 'i18n:extract'),
    ).toBe(false);
    // The other half, which nothing held before: `-w` naming the app still counts.
    expect(runsScript('npm run build:web -w @correctiv/mobile', 'build:web')).toBe(true);

    const read = 'readFileSync';
    expect(
      filesystemReadsIn(`${read}(resolve(cwd(), '../workbench/scripts/api.mjs'), 'utf8')`),
    ).toHaveLength(1);
    expect(filesystemReadsIn(`${read}(join(root, 'apps/workbench/dist/home.json'))`)).toHaveLength(
      1,
    );
    expect(filesystemReadsIn(`${read}(join(root, 'src/lib/home/home.json'))`)).toEqual([]);

    const halves: Halves = {
      workbench: new Set(['build:workbench']),
      app: new Set(['build:web', 'web']),
    };

    // ADR 0040 §2's two shapes, in one step, which is how they arrive.
    expect(
      workflowOffenders(
        'pages.yml',
        [
          '      - name: Generate the home document from the workbench',
          '        run: |',
          '          npm run build -w @correctiv/workbench',
          '          cp apps/workbench/dist/home.json apps/mobile/src/lib/home/home.generated.json',
        ].join('\n'),
        halves,
      ),
    ).toHaveLength(1);

    // And the same two commands as the deploy writes them: three steps, each of
    // which touches one half. Every one of these is in `pages.yml` today.
    expect(
      workflowOffenders(
        'pages.yml',
        [
          '      - name: Export the app',
          '        working-directory: apps/mobile',
          '        run: npm run build:web',
          '',
          '      - name: Build the workbench',
          '        run: npm run build -w @correctiv/workbench',
          '',
          '      - name: Assemble the site',
          '        run: |',
          '          cp -r apps/workbench/dist site',
          '          cp -r apps/mobile/dist site/app',
        ].join('\n'),
        halves,
      ),
    ).toEqual([]);
  });

  /**
   * And the third bucket's fixtures: the inputs that make the comment stripper eat
   * code, each of which hid a real violation from every assertion in this file.
   *
   * The headline one is the last: a Metro watch folder into the workbench, invisible
   * because the line above it carries a slash-star inside a string, which opened a
   * block comment that ran to the end of the next doc comment.
   */
  it('reports a mention it cannot classify, rather than reading it as a comment', () => {
    const eaten = (lines: string[]): number => doubts('fixture.js', lines.join('\n')).length;

    expect(
      eaten(["const hint = 'write /* here';", "const p = '../workbench/src';", '/** doc */']),
    ).toBe(1);
    expect(
      eaten(['const NOTE = `a /* glob`;', "const p = ['apps/workbench'];", '/** doc */']),
    ).toBe(1);
    expect(
      eaten(["const u = 'https://x.dev/ /*';", "const p = '../workbench';", '/** doc */']),
    ).toBe(1);
    expect(eaten(["@source ' /*';", "@source '../workbench/src';", '/* a comment */'])).toBe(1);
    expect(eaten(["const p = 'a // ../workbench/src';"])).toBe(1);
    expect(
      eaten([
        "const NOTE = 'watchFolders takes directories, not /* globs';",
        "config.watchFolders = [workspaceRoot, path.resolve(projectRoot, '../workbench')];",
        '/** The bundler reads this. */',
      ]),
    ).toBe(1);

    // A comment that names the other end of a seam is the permitted case, and there
    // were nineteen of them in scope on 2026-09-17, every one a comment. None of
    // these may be reported.
    expect(eaten(['// see apps/workbench/scripts/api.mjs for the other half'])).toBe(0);
    expect(eaten(['/** The workbench reads this: `apps/workbench/vite.app.mjs`. */'])).toBe(0);
    expect(eaten(['const x = 1; // and ../workbench/test/environment.test.ts asks the same'])).toBe(
      0,
    );
  });

  /**
   * Every manifest, read as data rather than as text, because a dependency entry is
   * the shape that goes green when the directory is gone: the workspace symlink is
   * what makes the import compile, and without it the entry is a line nobody has
   * used YET. A dependency declared is a dependency that will be used.
   */
  it('declares no dependency on the workbench, in any manifest', () => {
    const fields = [
      'dependencies',
      'devDependencies',
      'peerDependencies',
      'optionalDependencies',
    ] as const;

    // The repository root is read too. Its own manifest names no `@correctiv/*` at
    // all — the workspace list is the glob `apps/*` — so a package name appearing
    // there would be somebody installing the workbench for every workspace at once,
    // which is the same entry with a wider blast radius.
    const offenders = [REPO, ...scannedWorkspaces()].flatMap((root) => {
      const path = join(root, 'package.json');
      if (!existsSync(path)) return [];
      const manifest = JSON.parse(readFileSync(path, 'utf8')) as Record<
        string,
        Record<string, string> | undefined
      >;
      return fields.flatMap((field) =>
        Object.keys(manifest[field] ?? {})
          .filter((name) => reachesIn(name).length > 0)
          .map((name) => `${rel(path)}: ${field}.${name}`),
      );
    });

    expect(offenders).toEqual([]);
  });

  /**
   * A script of the app's shelling into the workbench workspace, which is the shape
   * with no import and no path in it: `npm run build -w @correctiv/workbench`
   * before the export, added for a good local reason, and the app's release path now
   * needs a developer tool to build.
   *
   * **Three things a cold review got through the first version of this**, and every
   * one of them is how somebody would actually write it here:
   *
   *  - `npm run build:workbench`. The root script names are what this repository
   *    calls running the workbench, and the patterns knew only the package name and
   *    the two paths. They are read off the root manifest now, so renaming the script
   *    renames what this looks for.
   *  - `prebuild:web`. npm runs it as part of `build:web` and it names neither half,
   *    so the old second gate — "the command mentions `@correctiv/mobile`" — let
   *    every `pre` and `post` script through by construction.
   *  - `npm --prefix ../.. run build:workbench` in the app's own manifest, which
   *    names no path this file matches.
   *
   * The ROOT manifest is the delicate one, because the repository's own scripts name
   * the workbench on purpose. What makes a root script the APP's is that it runs the
   * app, directly or as a lifecycle script of one that does; `check`, `test` and
   * `typecheck` use `--workspaces` and reach both halves, and they are the repository
   * asking rather than the app.
   */
  it('runs no workbench script from a script that runs the app', () => {
    const offenders: string[] = [];

    for (const root of scannedWorkspaces()) {
      const path = join(root, 'package.json');
      if (!existsSync(path)) continue;
      const { scripts = {} } = JSON.parse(readFileSync(path, 'utf8')) as {
        scripts?: Record<string, string>;
      };
      for (const [name, command] of Object.entries(scripts)) {
        for (const reach of reachesIn(command)) {
          offenders.push(`${rel(path)}: ${name} → ${reach.name} (${reach.why})`);
        }
        for (const script of runsOneOf(command, WORKBENCH_SCRIPTS, name)) {
          offenders.push(`${rel(path)}: ${name} runs the root's \`${script}\``);
        }
      }
    }

    for (const [name, command] of Object.entries(ROOT_SCRIPTS)) {
      if (!APP_SCRIPTS.has(name)) continue;
      for (const reach of reachesIn(command)) {
        offenders.push(`package.json: ${name} runs the app and names ${reach.name}`);
      }
      for (const script of runsOneOf(command, WORKBENCH_SCRIPTS, name)) {
        offenders.push(`package.json: ${name} runs the app and runs \`${script}\``);
      }
    }

    expect(offenders).toEqual([]);
  });

  /**
   * The workflows, read per step.
   *
   * `.github/` was read by neither half of this check until 2026-09-17, while ADR
   * 0040 §2 names the shape twice — "a workflow step that builds the workbench before
   * exporting the app", and "a generated file the app reads, taken out by copy rather
   * than by path". A record naming a shape that no half covers is the worse outcome,
   * so they are read here rather than listed as a blind spot.
   */
  it('names the workbench in no workflow step that runs the app or writes into it', () => {
    const offenders = workflows.flatMap((workflow) =>
      workflowOffenders(workflow.name, workflow.text),
    );

    expect(offenders).toEqual([]);
  });

  /**
   * The configuration files, read as text with their comments taken out.
   *
   * Comments are taken out because ADR 0040 §3 puts them on the correct side of the
   * line and the app is full of them: `global.css` explains at length why its
   * `@source` line exists and names the workbench test that fails if it goes, and
   * `AppEnvironment.tsx` names the workbench component that shares its provider
   * list. A comment names the other end of a seam so the next reader knows the seam
   * has two ends, and it compiles to nothing.
   */
  it('reaches into the workbench from no configuration file', () => {
    const wanted = new Set(configs.map(rel));
    const offenders = documents
      .filter((document) => wanted.has(document.name))
      .flatMap((document) =>
        reachesIn(document.code).map((reach) => `${document.name} → ${reach.name} (${reach.why})`),
      );

    expect(offenders).toEqual([]);
  });

  /**
   * The same read over the app's and the packages' source, against the excuse list,
   * which is a ratchet rather than a list: an excuse counts occurrences, so a second
   * mention in an excused file is an arrival.
   */
  it('names the workbench in no source file, outside a comment', () => {
    const wanted = new Set(sources.map(rel));
    const found = documents
      .filter((document) => wanted.has(document.name) && document.name !== THIS_FILE)
      .flatMap((document) =>
        REACHES.flatMap((reach) =>
          Array.from({ length: occurrences(document.code, reach) }, () => ({
            key: `${document.name} → ${reach.name}`,
            as: reach.why,
          })),
        ),
      );

    expect(ratchet(found, EXCUSED_OCCURRENCES).arrivals).toEqual([]);
  });

  /**
   * And the one net with no exemptions at all, which is why the two above may have
   * them: an import is the shape that actually makes the app need the workbench to
   * exist, and nothing excuses one — not the generator, not this file. It reads the
   * shared matcher in `packages/app-core/test/support/source.ts`, whose own fixture,
   * the one that proves it still catches every form a specifier arrives in, lives
   * beside the core's platform check in `boundary.test.ts`.
   *
   * It reads the RAW text, comments included, and that is deliberate:
   * `withoutComments` has a known limit — it truncates a line at a `//` inside a
   * string literal — and a net that excuses nothing should not inherit an exemption
   * from a helper. The price is that a commented-out import of the workbench is red,
   * which is the right direction for a line somebody is about to uncomment.
   */
  it('imports the workbench from nowhere, with nothing excused', () => {
    const offenders = documents.flatMap((document) =>
      [...document.text.matchAll(IMPORT_RE)]
        .map((match) => specifier(match))
        .filter((spec): spec is string => !!spec && reachesIn(spec).length > 0)
        .map((spec) => `${document.name} imports ${spec}`),
    );

    expect(offenders).toEqual([]);
  });

  /**
   * The second net with no exemptions, and the reason the first one is not enough.
   *
   * `import`, `require` and `import()` are three spellings of needing a module.
   * `readFileSync`, `readdirSync`, `createRequire`, `spawn` and `execSync` are five
   * more of needing a FILE, and the import net sees none of them — which is how a
   * cold review put a real read of `apps/workbench/scripts/api.mjs` into the file
   * this check excuses for naming it in prose, and watched every assertion stay
   * green. The generator failed without the workbench and the check said it was fine.
   */
  it('reads no file inside the workbench, with nothing excused', () => {
    const offenders = documents.flatMap((document) =>
      filesystemReadsIn(document.text).map((read) => `${document.name}: ${read}`),
    );

    expect(offenders).toEqual([]);
  });

  /**
   * The third bucket: every mention this check could not honestly call code or
   * prose.
   *
   * It excuses nothing, for the same reason the two nets above do not: this is the
   * bucket a bypass lands in. What lands here is not necessarily a violation — the
   * finding is that the comment stripper removed text naming the workbench and the
   * removal did not look like a comment, so nobody can say from the outside which it
   * was. The fix is to make it readable: move the sentence into a comment of its own,
   * or take the slash-star out of the string.
   */
  it('classifies every mention as code or as prose, and reports the rest', () => {
    const unclassifiable = documents
      .filter((document) => document.name !== THIS_FILE)
      .flatMap((document) => doubts(document.name, document.text));

    expect(unclassifiable).toEqual([]);
  });

  /**
   * The excuse list, asserted in the direction a one-sided list cannot do: an entry
   * that no longer matches anything is an excuse left lying around for the next
   * person to read as permission. ADR 0031 — a ratchet is a debt, not a state.
   *
   * And the reason beside it, which is the third assertion a ratchet wants: an entry
   * that is only a key says nothing about whether it is a debt or a fact.
   */
  it('excuses nothing that has stopped naming the workbench', () => {
    const wanted = new Set(sources.map(rel));
    const found = documents
      .filter((document) => wanted.has(document.name) && document.name !== THIS_FILE)
      .flatMap((document) =>
        REACHES.flatMap((reach) =>
          Array.from(
            { length: occurrences(document.code, reach) },
            () => `${document.name} → ${reach.name}`,
          ),
        ),
      );

    expect(ratchet(found, EXCUSED_OCCURRENCES).stale).toEqual([]);
    expect(excusesWithoutReason(EXCUSE_REASONS)).toEqual([]);
  });
});
