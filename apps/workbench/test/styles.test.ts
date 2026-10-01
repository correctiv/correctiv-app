import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { ROOT } from '../plugin/collect.ts';
import { filesUnder } from './source.ts';

const SRC = join(ROOT, 'apps/workbench/src');

const FILES = filesUnder(SRC, /\.(tsx?|css)$/);

describe('colour, which this package does not decide', () => {
  it('has files to check', () => {
    expect(FILES.length).toBeGreaterThan(10);
  });

  /**
   * The one rule that replaced four weaker ones.
   *
   * The workbench used to carry five hand-written stylesheets, and the guards here
   * were about keeping them from colliding: names shared between sheets, bare
   * element selectors, layout elements styled by the prose sheet. Tailwind and
   * one entry stylesheet make all of that impossible to express, so what is left
   * to protect is the thing those guards were really for.
   *
   * `packages/design-tokens` decides colour. The app consumes it through Uniwind
   * and this package consumes the same file through Tailwind, which is why
   * `bg-canvas` means one thing in both. A literal colour written here is a fork,
   * and a fork is invisible until somebody changes the palette and one of the two
   * does not move.
   *
   * Two exceptions, both deliberate. A scrim over the page is not a role in the
   * palette, and `black/40` is the honest way to say a translucent black. And
   * `preview/frame/` writes CSS into the app's document rather than this one,
   * where these class names do not exist, and reads computed colours back out of
   * it to compare against the palette. That code has to work in literals; it is
   * the only code here that does.
   */
  it('writes no colour value of its own', () => {
    const LITERAL = /#[0-9a-f]{3,8}\b|\brgba?\(|\bhsla?\(/gi;
    const ALLOWED = /black\/\d+|white\/\d+/;
    // Prose about a colour is not a colour.
    const COMMENT = /^\s*(\/\/|\*|\/\*)/;
    // And one line may opt out by saying so, which is a marker a reader can grep
    // for. There is one: the appearance panel's two swatches stand for the
    // device's schemes and must not follow this page's, and the token package has
    // no name for "the dark canvas as a fixed value". That is the boundary
    // AGENTS.md describes, where the app says `always-dark` and the package says
    // nothing.
    const OPT_OUT = /palette-exempt/;
    // The rule is about colour the code APPLIES. A hex named in a sentence is
    // prose: the measure panel explains that `#ffffff` names two tokens in the
    // light scheme, and rewriting that as a variable would say nothing.
    // Property names only. A colon before a hex is not enough: "ambiguous in
    // light: #ffffff" is a sentence, and it was the one false positive.
    const APPLIES = /(background|colou?r|fill|stroke|border|outline|shadow|--[a-z-]+)\s*[:=]/i;

    const offenders: string[] = [];
    for (const file of FILES) {
      if (file.includes('/preview/frame/')) continue;
      const text = readFileSync(file, 'utf8');
      for (const [index, line] of text.split('\n').entries()) {
        if (!LITERAL.test(line) || ALLOWED.test(line)) continue;
        if (COMMENT.test(line) || OPT_OUT.test(line) || !APPLIES.test(line)) {
          LITERAL.lastIndex = 0;
          continue;
        }
        LITERAL.lastIndex = 0;
        offenders.push(`${file.slice(SRC.length + 1)}:${index + 1}: ${line.trim().slice(0, 70)}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('takes the palette from the token package rather than defining one', () => {
    const entry = readFileSync(join(SRC, 'styles/app.css'), 'utf8');
    expect(entry).toContain("@import '@correctiv/design-tokens/theme.standalone.css'");
    // The standalone build is the one with the `light` and `dark` variants. The
    // bare theme has the values but not the rules that choose between them, and
    // importing it instead gives a site that is permanently light.
    expect(entry).not.toMatch(/@import '@correctiv\/design-tokens\/theme\.css'/);
  });
});
