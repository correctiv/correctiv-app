import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { ROOT } from '../plugin/collect.ts';

import { cn, TEXT_SIZES } from '../src/lib/cn';

/**
 * Issue #249: `tailwind-merge` read this project's `text-s` as a colour and dropped it
 * whenever a colour class followed, so a note meant to be small rendered at the size of
 * the text around it. Nothing failed, because the class was written correctly in the
 * source; the merge is what took it out.
 */
describe('cn', () => {
  it('keeps a project text size beside a colour', () => {
    expect(cn('text-s leading-relaxed text-on-canvas')).toBe(
      'text-s leading-relaxed text-on-canvas',
    );
  });

  it('still lets a later colour win over an earlier one', () => {
    expect(cn('text-s text-on-canvas-muted', 'text-on-canvas')).toBe('text-s text-on-canvas');
  });

  it('lets a later project size win over an earlier one', () => {
    expect(cn('text-m text-on-canvas', 'text-s')).toBe('text-on-canvas text-s');
  });

  it('keeps a leading written before a size', () => {
    expect(cn('leading-relaxed text-s')).toBe('leading-relaxed text-s');
  });

  /*
   * The list is derived from the generated token table rather than typed, and this is
   * what says the derivation still matches what Tailwind makes utilities of: every
   * `--text-X` the theme declares, and nothing it does not. It also holds the premise of
   * the leading override in `cn.ts`: a `--text-s--line-height` would be matched here as a
   * size called `s--line-height`, and this would fail.
   */
  it('knows exactly the sizes the theme declares', () => {
    const theme = readFileSync(join(ROOT, 'tokens/theme.css'), 'utf8');
    const declared = [...theme.matchAll(/^\s*--text-([a-z0-9-]+):/gm)].map((match) => match[1]);
    expect(declared.length).toBeGreaterThan(0);
    expect([...TEXT_SIZES].sort()).toEqual(declared.sort());
  });
});
