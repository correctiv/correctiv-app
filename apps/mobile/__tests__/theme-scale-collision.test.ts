/**
 * No scale key may name a Tailwind built-in utility that means something else.
 *
 * ## What this is for
 *
 * Tailwind v4 has logical SIDE utilities: `rounded-s` is the start side,
 * `border-start-start-radius`, and it exists whenever the theme declares a
 * `--radius` default — which Tailwind ships. A design token whose key is `s`
 * therefore emits `.rounded-s { border-radius: … }` beside Tailwind's own
 * `.rounded-s { border-start-start-radius: … }`: one class name, two rules, two
 * meanings, and no assertion about the token's VALUE can see it, because the value
 * is right and the rule it emits is correct.
 *
 * Measured on 2026-10-02, on the token named `--var-radius-s`: in the workbench,
 * which declares `--radius` in an `@theme` of its own, both rules were emitted for
 * every `rounded-s` on the site. The app got away with it because the generated
 * theme clears `--radius` (`--radius: initial`, held by `tokens.test.ts`), which
 * is a property of ONE consumer's import order rather than of the name — so the
 * name is what this holds. ADR 0077.
 *
 * ## How the question is asked
 *
 * Not "is this a key Tailwind happens to list" — that would refuse `xs`, `sm` and
 * `md` in the radius scale and the four dozen Tailwind-legitimate keys elsewhere,
 * which ADR 0008 already rejected: overriding a Tailwind default with this design
 * system's value is the point of a theme, not a collision.
 *
 * A collision is narrower and has a testable shape: **the same class name meaning
 * two different things.** So every key is compiled twice — once against this
 * package's theme, once against Tailwind's default theme alone — and the two must
 * agree about what the class sets. `rounded-sm` sets `border-radius` in both, so it
 * is an override and passes; `rounded-s` sets `border-radius` here and
 * `border-start-start-radius` there, and fails with both readings in the message,
 * which is the pair of rules a person has to go and look at.
 *
 * The baseline is Tailwind's DEFAULT theme rather than this one, so the answer does
 * not depend on which consumer is asking. That matters: the workbench and the app
 * compile this package's theme with different `--radius` defaults, and a check that
 * only held for one of them would pass while the other shipped the collision.
 *
 * ## Why it is here and not in the workbench
 *
 * This is the only place with a Tailwind compiler that has no workbench dependency,
 * and the collision is a property of the shared theme, not of either app
 * (`apps/mobile/__tests__/no-workbench-dependency.test.ts`). It reads
 * `packages/design-tokens/theme.standalone.css`, which is what
 * `apps/workbench/src/styles/app.css` imports and the same theme with the `light`
 * and `dark` variant definitions spelled out — `theme.css` alone aborts under plain
 * Tailwind with `Cannot use @variant with unknown variant: light`, since Uniwind is
 * what supplies those in the app. A key the generator renames therefore fails here
 * whether or not anybody opens a browser.
 */
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { compile } = require('tailwindcss') as {
  compile: (
    css: string,
    options: {
      base: string;
      loadStylesheet: (
        id: string,
        base: string,
      ) => Promise<{ path: string; base: string; content: string }>;
    },
  ) => Promise<{ build: (candidates: string[]) => string }>;
};

const ROOT = resolve(__dirname, '../../..');
const TOKENS_PKG = join(ROOT, 'packages/design-tokens');
const TAILWIND = dirname(require.resolve('tailwindcss/package.json'));

/**
 * The class prefixes each scale's keys reach a stylesheet under. One per namespace
 * rather than every utility that reads it: the bare form is where a name collides,
 * because that is the spelling with nothing in front of it to separate two meanings.
 * `--spacing-*` is the widest of them — `p-s`, `gap-s` and `w-s` are three utilities
 * off one key — and they are asked as one, because they collide or they do not
 * together.
 */
const PREFIXES: Record<string, string[]> = {
  radius: ['rounded-'],
  spacing: ['p-', 'm-', 'gap-', 'w-', 'h-', 'min-w-', 'max-w-', 'top-', 'left-', 'inset-x-'],
  text: ['text-'],
  leading: ['leading-'],
  tracking: ['tracking-'],
  'font-weight': ['font-'],
  container: ['max-w-'],
};

async function compilerFor(css: string, base: string) {
  return await compile(css, {
    base,
    loadStylesheet: async (id, from) => {
      const path = id === 'tailwindcss' ? join(TAILWIND, 'index.css') : resolve(from, id);
      return { path, base: dirname(path), content: readFileSync(path, 'utf8') };
    },
  });
}

/**
 * The CSS properties one class sets, out of one compiled stylesheet.
 *
 * Every rule the class name matches, not the first: the collision IS two rules for
 * one name, so a walk that stopped at the first match would report the half that
 * looks right. `--tw-*` is left out because those are the custom properties
 * Tailwind carries beside a declaration rather than a second thing the class means
 * — `leading-looser` sets both `--tw-leading` and `line-height` from one utility.
 */
function propertiesSetting(css: string, className: string): string[] {
  const escaped = className.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const out = new Set<string>();
  for (const rule of css.matchAll(new RegExp(`\\.${escaped}(?![\\w-])[^{}]*\\{([^}]*)\\}`, 'g'))) {
    for (const declaration of rule[1].split(';')) {
      const property = declaration.split(':')[0]?.trim();
      if (property && !property.startsWith('--tw-')) out.add(property);
    }
  }
  return [...out].sort();
}

/** `--<namespace>-<key>` in the generated theme, as [namespace, key]. */
function declaredScales(css: string): [string, string][] {
  return (
    [...css.matchAll(/^\s*--([a-z0-9-]+)-([a-z0-9-]+):/gm)]
      .map((match) => [match[1], match[2]] as [string, string])
      // `--color-*` is a list of names, not a scale of steps, and `bg-canvas` is a
      // token rather than a collision; `--shadow-*` would be the same.
      .filter(([namespace]) => namespace in PREFIXES)
  );
}

/**
 * A theme of one colliding key, written as CSS text rather than as a file beside
 * the artefact.
 *
 * An `@theme` block after `@import 'tailwindcss'` is what every consumer writes —
 * `apps/workbench/src/styles/app.css` does exactly this — so it needs no fixture, and
 * a file dropped into `packages/design-tokens/` would sit where the generator and its
 * drift check could trip over it.
 */
const COLLIDING_THEME = "@import 'tailwindcss';\n@theme { --radius-s: 0.125rem; }\n";

describe('a theme scale key may not name a Tailwind built-in utility', () => {
  const theme = readFileSync(join(TOKENS_PKG, 'theme.css'), 'utf8');
  const scales = declaredScales(theme);

  /**
   * One compile of the theme and one of Tailwind's default, and every key answered
   * out of both. Built in `beforeAll` because `compile()` parses Tailwind's whole
   * index and there are a hundred-odd class names to answer.
   */
  let withTheme: Map<string, string[]>;
  let withDefaults: Map<string, string[]>;

  beforeAll(async () => {
    const mine = await compilerFor(
      "@import 'tailwindcss';\n@import './theme.standalone.css';\n",
      TOKENS_PKG,
    );
    // `@import 'tailwindcss'` alone: Tailwind's own theme, none of ours.
    const stock = await compilerFor("@import 'tailwindcss';\n", ROOT);
    const candidates = [
      ...new Set(
        scales.flatMap(([namespace, key]) =>
          (PREFIXES[namespace] ?? []).map((prefix) => prefix + key),
        ),
      ),
    ];
    const mineCss = mine.build(candidates);
    const stockCss = stock.build(candidates);
    withTheme = new Map(candidates.map((c) => [c, propertiesSetting(mineCss, c)]));
    withDefaults = new Map(candidates.map((c) => [c, propertiesSetting(stockCss, c)]));
  });

  it('has keys to check in every scale the theme declares', () => {
    // The floor that stops this passing on nothing: an empty matchAll, a typo in the
    // regex, or a renamed `@theme` all leave `scales` empty, and every assertion
    // below is then vacuously true.
    expect(new Set(scales.map(([namespace]) => namespace))).toEqual(new Set(Object.keys(PREFIXES)));
    expect(scales.length).toBeGreaterThan(30);
  });

  /**
   * Every key, every prefix, one assertion each — so a failure names the key rather
   * than a list of thirty of them.
   */
  it.each(
    scales.flatMap(([namespace, key]) =>
      (PREFIXES[namespace] ?? []).map(
        (prefix) => [namespace, key, prefix + key] as [string, string, string],
      ),
    ),
  )('%s key %s -> .%s means one thing', (_namespace, _key, className) => {
    const ours = withTheme.get(className) ?? [];
    const stock = withDefaults.get(className) ?? [];

    // The theme declared the key, so the class it names has to exist. Without this
    // an empty `ours` would sail through everything below.
    expect(ours.length).toBeGreaterThan(0);

    // Not a class Tailwind has, or one it means the same thing by: overriding a
    // Tailwind default is what a theme is for.
    if (stock.length === 0) return;
    expect({ className, thisTheme: ours, tailwindDefault: stock }).toEqual({
      className,
      thisTheme: stock,
      tailwindDefault: stock,
    });
  });

  /**
   * The shape of the failure, pinned — because the loop above can only report a class
   * name, and this is the pair of rules somebody has to go and read. Written against
   * the compiler rather than against a fixture, so it cannot rot with Tailwind: it
   * asks for a colliding key and expects the two readings to differ.
   *
   * This is what the check above could not see. `--radius-s` in the generated theme
   * produced exactly this pair, and every other assertion in this file stayed green
   * through it.
   */
  it('sees a colliding key as the two rules it really is', async () => {
    const colliding = await compilerFor(COLLIDING_THEME, ROOT);
    const stock = await compilerFor("@import 'tailwindcss';\n", ROOT);

    // Two rules for one class name, which is the whole of it: Tailwind's own reading
    // of `.rounded-s`, plus a `border-radius` the theme added under the same name.
    const ours = propertiesSetting(colliding.build(['rounded-s']), 'rounded-s');
    const theirs = propertiesSetting(stock.build(['rounded-s']), 'rounded-s');
    expect(theirs).toEqual(['border-end-start-radius', 'border-start-start-radius']);
    expect(ours).toEqual(['border-end-start-radius', 'border-radius', 'border-start-start-radius']);
    expect(ours).not.toEqual(theirs);
  });
});
