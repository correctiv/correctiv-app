/**
 * `theme.standalone.css` compiles for a consumer that has no Uniwind.
 *
 * That file exists for exactly one reason: the CORRECTIV CMS should be able to
 * import this repo's design tokens — including the dark palette, which its own
 * copy of wp-design-tokens does not carry. Nothing imports it yet, so without this
 * test the claim rests on one manual check made the day it was written.
 *
 * It has already been wrong twice, and neither failure was loud:
 *
 *  - the first version was a single file, and it aborted under plain Tailwind v4
 *    with `Cannot use @variant with unknown variant: light`, because Uniwind
 *    defines that variant and nothing else does;
 *  - patched by hand it then compiled *successfully and emitted no colour utility
 *    at all*, because the `@theme` registration that creates them is synthesised by
 *    Uniwind into its own node_modules.
 *
 * A green build and a colourless stylesheet. So this compiles the real file with
 * the real Tailwind, no Uniwind anywhere, and looks at what comes out.
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

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

const TOKENS_PKG = resolve(__dirname, '../../../packages/design-tokens');
const TAILWIND = dirname(require.resolve('tailwindcss/package.json'));

/** The classes a consumer would most plausibly reach for first. */
const CANDIDATES = ['bg-grey-100', 'text-grey-700', 'p-s', 'gap-2xs', 'rounded-md'];

async function buildAsAnOutsideConsumerWould(): Promise<string> {
  const compiler = await compile("@import 'tailwindcss';\n@import './theme.standalone.css';\n", {
    base: TOKENS_PKG,
    loadStylesheet: async (id, base) => {
      // The only two things a consumer imports: Tailwind itself and this package.
      const path = id === 'tailwindcss' ? resolve(TAILWIND, 'index.css') : resolve(base, id);
      return { path, base: dirname(path), content: readFileSync(path, 'utf8') };
    },
  });
  return compiler.build(CANDIDATES);
}

/**
 * The name of the `@layer` a rule sits in, or undefined outside any.
 *
 * Written rather than regexed because the distinction is the point: `:root` in
 * `@layer base` compiles identically and is still discarded, so an assertion that
 * only looked at the selector would pass the one mistake worth catching.
 */
function layerAround(css: string, needle: string): string | undefined {
  const at = css.indexOf(needle);
  if (at === -1) return undefined;
  const stack: (string | undefined)[] = [];
  for (const m of css.slice(0, at).matchAll(/@layer\s+([\w-]+)\s*\{|\{|\}/g)) {
    if (m[0] === '}') stack.pop();
    else stack.push(m[1]);
  }
  return stack.findLast((name) => name !== undefined);
}

describe('the standalone theme, as a consumer outside this repo sees it', () => {
  let css: string;

  beforeAll(async () => {
    css = await buildAsAnOutsideConsumerWould();
  });

  it('compiles at all', () => {
    // The first failure mode: an unknown `light` variant aborted the build.
    expect(css.length).toBeGreaterThan(0);
  });

  it('emits colour utilities, not just the scales', () => {
    // The second, quieter failure mode: spacing and radius came through while
    // every colour was silently absent.
    expect(css).toMatch(/\.bg-grey-100\s*\{/);
    expect(css).toMatch(/\.text-grey-700\s*\{/);
  });

  it('carries the dark palette on both paths', () => {
    // A class on the root for an app that overrides the device, and the media
    // query for one that follows it. Losing either leaves half a dark mode.
    expect(css).toMatch(/where\(\.dark/);
    expect(css).toMatch(/prefers-color-scheme:\s*dark/);
    // #1a1a1a is grey-100's dark value — present means the palette, not just the
    // selectors, made it through.
    expect(css).toContain('#1a1a1a');
  });

  /**
   * The shape the native side needs, checked on the artefact rather than in prose.
   *
   * Uniwind's native CSS processor reads a theme's dark values only out of a rule
   * that satisfies BOTH conditions at once, hard-coded in
   * `uniwind/dist/module/bundler/css-visitor/rule-visitor.js:14`: the enclosing
   * layer must be named `theme`, and the rule's first selector must be `:root`.
   * Anything else falls through to `processor.ts`'s `unsupported` branch and the
   * rule is discarded whole — no dark variable table is built at all, and every
   * `bg-*` class renders its light value on a dark phone while `useColors()`
   * switches correctly.
   *
   * So `@variant dark { … }` written at the top level is not merely untidy. Tailwind
   * has no element to anchor it to and compiles it against `:scope`, outside any
   * layer; a browser reads that as `:root` and is right, which is why this was
   * invisible on the web target for as long as it shipped.
   *
   * Asserted here because this is the only place with a Tailwind compiler, and it
   * is the compiled output that the native processor actually reads. Red before the
   * nesting landed.
   *
   * The nesting costs the CMS consumer something, and it is worth knowing rather
   * than asserting: unlayered CSS beats every layer whatever the specificity, so a
   * consumer that sets one of our `--color-*` in its own unlayered `:root` now wins
   * in the dark scheme too, where before the dark block was unlayered and won.
   * There is no test for that here on purpose — one was written and it passed
   * against the broken file as well, because the light values were always layered
   * and a stylesheet's text cannot say who wins. The README's consumer section
   * carries the sentence instead, where the consumer reads.
   */
  it('puts the dark values where the native processor can find them', () => {
    expect(css).toMatch(/:root:where\(\s*\.dark/);
    // The failing spelling, named rather than left to a negated match nobody can
    // read: this is what the top-level form compiled to, and what was shipped.
    expect(css).not.toMatch(/:scope/);
    expect(layerAround(css, ':root:where(.dark')).toBe('theme');
  });

  /**
   * There is deliberately no `rounded-s` collision check here.
   *
   * One was written and then removed: it passed whether or not `--radius: initial`
   * was in the theme, because `build()` emits only the candidates it is handed and
   * the duplicate side utility never arises on this path. A green assertion that
   * cannot fail is worse than none — the real guard is in tokens.test.ts, and that
   * one was confirmed red against a generator that stops emitting the line.
   */
});
