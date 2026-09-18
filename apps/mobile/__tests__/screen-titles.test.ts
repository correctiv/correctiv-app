import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

import { de } from '@correctiv/catalogue';

/**
 * Every route pushed over the tabs names itself, and no two name themselves the
 * same.
 *
 * Until ADR 0030 no `Stack.Screen` in this app set a title. On iOS and Android
 * that costs nothing visible yet, because the app drew its own bars; on the
 * published web target it meant every pushed route shipped an empty `<title>`,
 * so `/gespeichert` and `/backstage` were one browser tab apart and told apart
 * only by the address. Nothing could see it: the build is green, the typecheck is
 * green, and a missing title reads as the address bar doing its job.
 *
 * `title` is a required prop now, so the typechecker catches an absent one on a
 * screen that has a header. What it cannot catch is the three ways this defect
 * actually comes back — a placeholder that says nothing, a title copied from the
 * screen next door, and a route with no header at all, which inherits the title
 * of the screen it was pushed over and therefore names the wrong screen rather
 * than none. Those are what this file is for.
 *
 * Read as text rather than imported: importing a route pulls in the app's whole
 * component tree to answer a question about twenty string literals.
 */
const ROUTES = resolve(__dirname, '../src/app');

/** A tab root. Its tab is the app's entry page and nothing pushes it. */
const TAB_ROOT = /^\(tabs\)\//;
/** Not a screen: the navigators. */
const LAYOUT = /(^|\/)_layout(\.\w+)?\.tsx$/;
/**
 * Not a screen either: expo-router's `+`-prefixed conventions.
 *
 * `+html.tsx` is the HTML shell of the web export, rendered once at export time
 * with no navigator anywhere near it, so asking it for a screen title is asking
 * the document for the name of a page inside it. `+not-found.tsx` is the one
 * exception and stays in — it IS a screen, it is pushed, and it carries a title.
 */
const SHELL = /(^|\/)\+(?!not-found)[\w.-]+\.tsx$/;

function routeFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return routeFiles(full);
    return entry.endsWith('.tsx') ? [full] : [];
  });
}

/**
 * The block a descriptor key opens, from its `{` to the brace that closes it.
 *
 * Counted rather than matched with `[^}]*?`, because a `}` INSIDE the block is the
 * ordinary case and not the exotic one: `{count, plural, …}` and `"{id}"` both
 * carry one, so a character class that cannot cross a brace stops at the first and
 * reads the descriptor as carrying no id at all. Quoted text is skipped, so a
 * brace that is only a character in a sentence cannot unbalance the count.
 */
function descriptorBlock(source: string, key: string): string | undefined {
  const opening = new RegExp(`\\b${key}:\\s*\\{`).exec(source);
  if (!opening) return undefined;

  let depth = 0;
  let quote = '';
  for (let i = opening.index + opening[0].length - 1; i < source.length; i++) {
    const char = source[i];
    if (quote) {
      if (char === '\\') i++;
      else if (char === quote) quote = '';
    } else if (char === "'" || char === '"' || char === '`') quote = char;
    else if (char === '{') depth++;
    else if (char === '}' && --depth === 0) return source.slice(opening.index, i + 1);
  }
  return undefined;
}

/**
 * The German a descriptor key stands for, found in the route's own source.
 *
 * A migrated route writes `title={intl.formatMessage(COPY.screenTitle)}`, so the
 * word itself is two hops away: the key names a descriptor in the same file, the
 * descriptor carries an id, and the id is what the catalogue answers. Both hops
 * are done here rather than by importing the route, for the reason the file
 * header gives — and the catalogue is a plain object, so importing THAT costs
 * nothing.
 *
 * ~~Returns undefined when either hop fails, and the caller keeps the key, so that
 * a key with no descriptor surfaces as a title this file can judge~~ It throws,
 * and the caller has nothing to fall back to. Keeping the key was the hole rather
 * than the safety net: a key name is non-empty and is very nearly always unique,
 * so a route whose title could not be resolved passed every assertion below on the
 * strength of the word `screenTitle` — which is the same invisibility, reached by
 * a different road, that this file was written to catch. A title this file cannot
 * read is a defect in the route or in the catalogue, and neither is a thing to
 * have an opinion about quietly.
 */
function germanFor(source: string, key: string): string {
  const block = descriptorBlock(source, key);
  const id = block ? /\bid:\s*'([^']+)'/.exec(block)?.[1] : undefined;
  const german = id === undefined ? undefined : de[id];
  if (german === undefined) {
    throw new Error(
      block === undefined
        ? `no descriptor \`${key}: { … }\` in this route, so its title cannot be read`
        : id === undefined
          ? `the descriptor \`${key}\` carries no id, so its title cannot be read`
          : `the id \`${id}\` behind \`${key}\` has no German in the catalogue`,
    );
  }
  return german;
}

/** A title written as a descriptor, at a `ScreenHeader`. */
const HEADER_DESCRIPTOR = /<ScreenHeader\b[^>]*?\btitle=\{[^}]*?\bCOPY\.(\w+)/gs;
/** A title written as a descriptor, at `useDocumentTitle`. */
const DOCUMENT_DESCRIPTOR = /\buseDocumentTitle\([^)]*?\bCOPY\.(\w+)/g;

/**
 * The one key a route's title descriptor is written under.
 *
 * `title`, `screenTitle` and `documentTitle` were three spellings of one role,
 * which is a coin toss at every new screen and a second thing to work out when a
 * title has gone missing. The name is the ROLE and not the mechanism: a screen
 * with no header reaches the same place through `useDocumentTitle` and is still
 * naming itself.
 */
const TITLE_KEY = 'screenTitle';

/**
 * Every name a route gives itself.
 *
 * Two shapes now, from one split, which is where the title goes: a screen with a
 * `ScreenHeader` passes it a `title`, and the five without one — the reader, the
 * player, the onboarding, the gallery and the 404 — call `useDocumentTitle`
 * directly, which is the same string reaching the same place by the shorter route
 * (ADR 0030).
 *
 * Each of those is read in both spellings, the German literal the gallery still
 * writes and the descriptor every migrated screen writes, and both resolve to the
 * German — because what the assertions below test is the word a person sees:
 * whether two routes share it, whether it says anything, and whether it is typed
 * the way German is typed. A migrated route would otherwise contribute nothing at
 * all and pass every one of them by being invisible, which is how a missing title
 * got into the app in the first place.
 */
function headerTitlesIn(source: string): string[] {
  return [
    ...[...source.matchAll(/<ScreenHeader\b[^>]*?\btitle="([^"]*)"/gs)].map((m) => m[1]),
    ...[...source.matchAll(HEADER_DESCRIPTOR)].map((m) => germanFor(source, m[1])),
  ];
}

function titlesIn(source: string): string[] {
  return [
    ...headerTitlesIn(source),
    ...[...source.matchAll(/\buseDocumentTitle\('([^']*)'\)/g)].map((m) => m[1]),
    ...[...source.matchAll(DOCUMENT_DESCRIPTOR)].map((m) => germanFor(source, m[1])),
  ];
}

/** The descriptor key each of those titles was written under. */
function titleKeysIn(source: string): string[] {
  return [...source.matchAll(HEADER_DESCRIPTOR), ...source.matchAll(DOCUMENT_DESCRIPTOR)].map(
    (m) => m[1],
  );
}

describe('screen titles', () => {
  const routes = routeFiles(ROUTES).map((file) => {
    const rel = relative(ROUTES, file).replaceAll('\\', '/');
    const source = readFileSync(file, 'utf8');
    try {
      // Resolved once, here, rather than inside each assertion: `germanFor` throws
      // on a title it cannot read, and this is the only place that knows which
      // route was being read when it did.
      return { rel, source, titles: titlesIn(source), headerTitles: headerTitlesIn(source) };
    } catch (error) {
      throw new Error(`${rel}: ${(error as Error).message}`, { cause: error });
    }
  });

  const named = routes.filter(({ titles }) => titles.length > 0);

  it('finds the routes that name themselves', () => {
    // A moved route tree would otherwise make this whole file pass by having
    // nothing to say.
    expect(named.length).toBeGreaterThan(10);
  });

  it('names every route that is pushed over the tabs', () => {
    // The five tab roots keep the entry page's tab, which is the app's address
    // and is a separate, smaller change. Everything else is pushed on top of one
    // of them, and a pushed route with no name of its own does not leave the tab
    // empty — it leaves it reading the screen underneath.
    const nameless = routes.filter(
      ({ rel, titles }) =>
        !TAB_ROOT.test(rel) && !LAYOUT.test(rel) && !SHELL.test(rel) && titles.length === 0,
    );

    expect(nameless.map((r) => r.rel)).toEqual([]);
  });

  it('gives every ScreenHeader call site a title', () => {
    const offenders = routes.filter(({ source, headerTitles }) => {
      const calls = source.match(/<ScreenHeader\b/g)?.length ?? 0;
      // Both spellings, through the same helper the rest of the file uses: a
      // call site whose title is a descriptor has a title, and counting only
      // literals here would report every migrated screen as untitled.
      return headerTitles.filter((t) => t.trim().length > 0).length !== calls;
    });

    expect(offenders.map((r) => r.rel)).toEqual([]);
  });

  it('gives every route a title of its own', () => {
    // One title per route, not per call site: `formular.tsx` has two headers and
    // they are two states of one screen. A duplicate ACROSS routes is the defect
    // — it is what the web target looked like when every page had none.
    const byTitle = new Map<string, string[]>();
    for (const { rel, titles } of named) {
      for (const title of new Set(titles)) {
        byTitle.set(title, [...(byTitle.get(title) ?? []), rel]);
      }
    }

    const shared = [...byTitle].filter(([, routes_]) => routes_.length > 1);

    expect(shared).toEqual([]);
  });

  it('writes them in German typography, with no em dash', () => {
    // AGENTS.md: everything a user reads is German, and a German sentence uses
    // „…“ and never an em dash. A title is the shortest user-facing string in the
    // app and the easiest one to have typed in English by habit.
    //
    // U+201C is NOT in this class, because it is German's CLOSING quote and only
    // English's opening one: „Abriss-Atlas“ is correct and has to pass. What is
    // rejected is U+201D, which is English's closing quote and appears in German
    // only by mistake, and the straight `"`, which is reachable now that a title
    // can also be written inside `useDocumentTitle('…')`.
    const offenders = named.flatMap(({ rel, titles }) =>
      titles.filter((title) => /[—”"]/.test(title)).map((title) => `${rel}: ${title}`),
    );

    expect(offenders).toEqual([]);
  });

  it('writes the title descriptor under one key on every route', () => {
    // A convention nobody can break is noise; this one can be, silently, because
    // a route naming `COPY.title` renders exactly as well as one naming
    // `COPY.screenTitle`. Three spellings is what the seam arrived with, and they
    // cost a reader one lookup per screen.
    const offenders = routes.flatMap(({ rel, source }) =>
      titleKeysIn(source)
        .filter((key) => key !== TITLE_KEY)
        .map((key) => `${rel}: COPY.${key}`),
    );

    expect(offenders).toEqual([]);
  });
});
