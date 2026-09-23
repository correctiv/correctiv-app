import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { MODULE_SETTINGS } from '@correctiv/app-core/lib/home-settings';
import { MODULE_SETTINGS as ARTEFACT } from '@correctiv/app-core/lib/home-settings.generated';
import { floorFaults, withoutComments } from '@correctiv/prose-and-code';

import { MODULE_AUDIENCES } from '@correctiv/app-core/lib/home-audience';
import { MODULE_AUDIENCES as AUDIENCE_ARTEFACT } from '@correctiv/app-core/lib/home-audience.generated';

import {
  APP,
  AUDIENCES_OUT,
  OUT,
  REPO,
  render,
  renderAudiences,
} from '../scripts/generate-home-settings.mjs';
import { HOME_MODULE_AUDIENCES } from '@/lib/home/conditions';
import { HOME_MODULE_SETTINGS } from '@/lib/home/settings';

/**
 * What holds a declaration written in this app to the table the core validates against.
 *
 * ADR 0045 §9 puts the declaration beside the module that reads it and has
 * `scripts/generate-home-settings.mjs` carry it into
 * `packages/app-core/src/lib/home-settings.generated.ts`. That buys a module and its
 * settings being one thing to write and one thing to read, and it charges a commit: an
 * agent or a person who edits a declaration and does not run the generator gets a red
 * check here and a one-line fix. ADR 0031's mechanism 2, and the deal is only good while
 * this file exists.
 *
 * **Four failures, and they are four different questions.** They are asked separately
 * because each one has a different fix and, more to the point, because a check that
 * answered three of them would read as though it answered all four.
 *
 *  1. The artefact is stale against the declarations. `npm run home-settings`.
 *  2. The artefact is current and the core is not reading it — the re-export in
 *     `home-settings.ts` names something else, or a refactor inlined the table beside it.
 *     Measured: with the import severed and an identical literal in its place, every
 *     other assertion here stayed green while the artefact was imported by nothing in the
 *     repository. `toBe` and not `toEqual` is what sees that, and it is the whole
 *     difference between the two.
 *  3. The generator is wrong, so both sides agree and are both wrong. A text comparison
 *     cannot see that by construction; comparing the core's values against the
 *     declarations can.
 *  4. The declaration file grew an import that is not a type, so the generator can no
 *     longer load it. That one fails **outside** `npm run check` — the drift check reads
 *     the declarations through jest's resolver and never runs Node's — which is the price
 *     of the seam and the reason the import shapes are read as source below.
 *
 * **What none of it says** is that a setting does anything. A spec no module reads still
 * validates, still shows up in the configurator and still draws a control — this checks
 * that both sides hold the same declarations, not that the declarations are wanted.
 * `__tests__/home-layout.test.tsx` is what refuses a module that cannot be drawn at all.
 */

/** The declarations, as source, for the two facts about them that are not values. */
const DECLARATIONS = resolve(APP, 'src/lib/home/settings.ts');

/** This package's manifest, which is where the generator's command is spelled twice. */
const APP_PACKAGE = resolve(APP, 'package.json');
const REPO_PACKAGE = resolve(REPO, 'package.json');

/** @returns the scripts of a manifest, by path. */
const scriptsOf = (path: string): Record<string, string> =>
  JSON.parse(readFileSync(path, 'utf8')).scripts ?? {};

describe('the settings a module declares beside itself', () => {
  const modules = Object.keys(HOME_MODULE_SETTINGS);
  const specs = Object.values(HOME_MODULE_SETTINGS).flat();

  it('declares something at all (guards against a silently empty table)', () => {
    // An empty table is not a table with nothing in it: the parser reads
    // `MODULE_SETTINGS[module] ?? []` and refuses every key it is given, so every
    // configured place in the shipped document would be dropped at once. `render` throws
    // rather than emit that, and this is the floor under the declarations themselves —
    // the half that sees a table gone from three entries to one.
    //
    // A floor and not a count: what has to hold is that something was read, and a figure
    // measured against this repository goes stale the first time somebody declares a
    // fourth setting.
    expect(
      floorFaults({
        'modules with settings declared': { found: modules.length, atLeast: 2 },
        'settings declared': { found: specs.length, atLeast: 3 },
      }),
    ).toEqual([]);
  });

  it('keeps the generated table current (no drift against the declarations)', () => {
    // The hinge of the whole arrangement. When it fails the fix is
    // `npm run home-settings` and a commit — never a hand-edit of the artefact, which
    // says so on its first line.
    //
    // No subprocess and no write: `render` takes the table rather than importing it, so
    // what runs here is the same string `main()` writes, to the same path it writes it.
    expect(readFileSync(OUT, 'utf8')).toBe(render(HOME_MODULE_SETTINGS));
  });

  it('is the table the core hands the parser, and not a copy of it', () => {
    // Failure 2. `toBe`, because what is being asked is whether the import resolves to
    // the artefact — a hand-written literal with the same contents passes `toEqual` and
    // leaves the generated file orphaned, which is measured and is why this line exists.
    expect(MODULE_SETTINGS).toBe(ARTEFACT);
  });

  it('carries the values the declarations carry', () => {
    // Failure 3, and the only assertion that sees a wrong GENERATOR: emit `min` where
    // `max` was meant and the artefact still matches `render`, because both sides are the
    // same mistake. Comparing against the declarations is what does not.
    expect(MODULE_SETTINGS).toEqual(HOME_MODULE_SETTINGS);
  });

  it('keeps the declaration file loadable by the generator (types and nothing else)', () => {
    // Failure 4, and the one the rest of `npm run check` cannot see. The generator reads
    // the declarations by importing them under Node's type stripping, so an ordinary
    // import is a specifier Node has to resolve at a path it has no resolver for. Under
    // jest the same file is resolved by babel and the tsconfig paths, so it imports
    // happily and every assertion above stays green while `npm run home-settings` is
    // dead — measured, with `import { settingsFor } from '@correctiv/app-core/…'`.
    //
    // So this reads the shapes rather than the values: every `import` and every
    // `export … from` has to be type-only, and nothing may reach a module at runtime.
    const source = withoutComments(readFileSync(DECLARATIONS, 'utf8'));
    const statements = [...source.matchAll(/^\s*(?:import|export)\b[^;]*?\bfrom\b/gm)].map(
      ([match]) => match.trim().replace(/\s+/g, ' '),
    );
    expect(statements.filter((one) => !/^(?:import|export) type\b/.test(one))).toEqual([]);
    // A side-effect import, `require`, and a dynamic `import()` all survive type
    // stripping too, and none of them is matched above.
    expect(source).not.toMatch(/^\s*import\s*['"]/m);
    expect(source).not.toMatch(/\b(?:require|import)\s*\(/);
    // And the floor under all of it: a walk that read nothing would agree with every
    // line above.
    expect(statements.length).toBeGreaterThan(0);
  });

  it('gives every setting a key its module can only mean one way', () => {
    // A key repeated inside one module is a spec the parser can never reach: it takes
    // the first match and the second is dead. Across modules it is fine and deliberate —
    // `count` belongs to two of them.
    const doubled = Object.entries(HOME_MODULE_SETTINGS).filter(
      ([, declared]) => new Set(declared.map((spec) => spec.key)).size !== declared.length,
    );
    expect(doubled.map(([module]) => module)).toEqual([]);
  });

  it('gives every count bounds it can hold and a default inside them', () => {
    // The bounds are what the module can actually draw, and the editor draws the control
    // from them — a slider whose ends are the wrong way round, or a default outside them,
    // is a control that opens on a value nobody can choose. Reachable: `render` will
    // happily write `max: NaN`, and the core's type calls it a `number`.
    const counts = specs.filter((spec) => spec.kind === 'count');
    const wrong = counts.filter(
      (spec) =>
        !Number.isInteger(spec.min) ||
        !Number.isInteger(spec.max) ||
        !Number.isInteger(spec.fallback) ||
        spec.min >= spec.max ||
        spec.fallback < spec.min ||
        spec.fallback > spec.max,
    );
    expect(wrong).toEqual([]);
    expect(counts.length).toBeGreaterThan(0);
  });

  it('refuses to write a kind it has never heard of', () => {
    // The union in the core would reject the artefact anyway, but the message would name
    // a generated file rather than the declaration that caused it. This is the generator
    // failing where the fix is.
    expect(() => render({ quiz: [{ key: 'answers', kind: 'choice' }] as never })).toThrow(
      /kind 'choice'/,
    );
  });

  it('refuses a name it cannot write into a source file as it stands', () => {
    // Everything emitted is TypeScript, and a name is interpolated into it unescaped. A
    // key spelled with a quote and a bracket emitted a VALID file declaring a module the
    // declarations do not have — and the drift check compares text, so it saw nothing.
    // Theoretical while every name is a kebab-case document id, and refused rather than
    // escaped so that it stays that way.
    expect(() => render({ "x': [], 'evil": [] })).toThrow(/plain one/);
    expect(() => render({ quiz: [{ key: "a'b", kind: 'article', fallback: null }] })).toThrow(
      /plain one/,
    );
  });

  it('tells a reader of the artefact to run a command that exists', () => {
    // The artefact's header names a script and a file. Both are typed strings in the
    // generator, so both can outlive what they name: rename the npm script and the
    // artefact goes on telling people to run something that is not there, with every
    // check green. This is the join — the script that runs THIS generator, by its key.
    const artefact = readFileSync(OUT, 'utf8');
    const [key] =
      Object.entries(scriptsOf(APP_PACKAGE)).find(([, run]) =>
        run.includes('generate-home-settings.mjs'),
      ) ?? [];
    expect(key).toBeDefined();
    expect(artefact).toContain(`npm run ${key}`);
    // The root forwards it under the same name, because the header does not say where to
    // stand and the repository root is where somebody will be.
    expect(scriptsOf(REPO_PACKAGE)[key!]).toContain(`-w @correctiv/mobile`);
    // And the file it names itself by is a file.
    const named = artefact.match(/AUTO-GENERATED by (\S+)/)?.[1];
    expect(named).toBeDefined();
    expect(existsSync(resolve(REPO, named!))).toBe(true);
    expect(artefact).toContain('do not edit by hand');
  });
});

/**
 * The same questions for the second artefact the generator writes: the audience a block is
 * for unless the document says otherwise
 * ([ADR 0060](../../../adr/0060-a-block-says-when-it-appears-and-an-editor-says-for-whom.md) §2).
 *
 * No floor here, and that is the difference from the settings: an empty table is a legal
 * one, because no default anywhere means every block is for everyone.
 */
describe('the audiences a module declares beside itself', () => {
  const CONDITIONS = resolve(APP, 'src/lib/home/conditions.ts');

  it('keeps the generated table current', () => {
    expect(readFileSync(AUDIENCES_OUT, 'utf8')).toBe(renderAudiences(HOME_MODULE_AUDIENCES));
  });

  it('is the table the core folds with, and not a copy of it', () => {
    expect(MODULE_AUDIENCES).toBe(AUDIENCE_ARTEFACT);
  });

  it('carries the values the declarations carry', () => {
    expect(MODULE_AUDIENCES).toEqual(HOME_MODULE_AUDIENCES);
  });

  it('keeps the declaration file loadable by the generator (types and nothing else)', () => {
    const source = withoutComments(readFileSync(CONDITIONS, 'utf8'));
    const statements = [...source.matchAll(/^\s*(?:import|export)\b[^;]*?\bfrom\b/gm)].map(
      ([match]) => match.trim().replace(/\s+/g, ' '),
    );
    expect(statements.filter((one) => !/^(?:import|export) type\b/.test(one))).toEqual([]);
    expect(source).not.toMatch(/^\s*import\s*['"]/m);
    expect(source).not.toMatch(/\b(?:require|import)\s*\(/);
    expect(statements.length).toBeGreaterThan(0);
  });

  it('refuses a name it cannot write into a source file as it stands', () => {
    expect(() => renderAudiences({ "x': 'everyone', 'evil": 'everyone' })).toThrow(/plain one/);
    expect(() => renderAudiences({ quiz: "every'one" })).toThrow(/plain one/);
    expect(renderAudiences({})).toContain('= {};');
  });
});
