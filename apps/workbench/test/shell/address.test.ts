import { describe, expect, it } from 'vitest';

import { parseAddress, writeAddress, type ShellAddress } from '../../src/shell/address.ts';
import { VIEWS } from '../../src/shell/views.ts';

const DOCUMENT = VIEWS.document;
const PREVIEW = VIEWS.preview;
const COMPONENT = VIEWS.component;

/** A view's own defaults, which is what an empty hash means on it: nothing open. */
function defaults(head = ''): ShellAddress {
  return { head, tool: null, full: false, rest: new URLSearchParams() };
}

describe('the hash contract, on every route', () => {
  it('round-trips every view with every parameter at its non-default', () => {
    for (const view of Object.values(VIEWS)) {
      const flipped: ShellAddress = {
        head: view.kind === 'preview' ? '/artikel' : 'the-four-ports',
        // The last tool, so the answer is not the first one by accident.
        tool: view.sections.at(-1) ?? null,
        full: view.canGoFull,
        rest: new URLSearchParams({ d: 'ipad-mini' }),
      };

      const back = parseAddress(writeAddress(flipped, view), view);

      // One object per view, so a failure names the view rather than a boolean.
      expect({
        kind: view.kind,
        head: back.head,
        tool: back.tool,
        full: back.full,
        device: back.rest.get('d'),
      }).toEqual({
        kind: view.kind,
        head: flipped.head,
        tool: flipped.tool,
        full: flipped.full,
        device: 'ipad-mini',
      });
    }
  });

  /**
   * The one thing that makes the grammar safe: an app route starts with `/` and a
   * heading id never does, because `src/lib/slug.ts` strips everything but
   * letters, digits, spaces and hyphens — for every id this site mints, since
   * the board stopped carrying a second copy of that function.
   */
  it('keeps a document anchor an anchor when nothing else is said', () => {
    expect(parseAddress('#the-four-ports', DOCUMENT).head).toBe('the-four-ports');
    expect(writeAddress(defaults('the-four-ports'), DOCUMENT)).toBe('#the-four-ports');
  });

  it('writes nothing at all when nothing is open and there is no head', () => {
    expect(writeAddress(defaults(), DOCUMENT)).toBe('');
  });

  /**
   * Nothing opens by default, on any view, so the panel needs no way to say shut.
   *
   * `tools=0` existed because `/design` and the component route opened their
   * panels on arrival and a reader who shut one had said something. One tool at a
   * time made that untenable — the panel would have had to choose which of six —
   * and the rail is what pays for it: every tool is on screen and named whether or
   * not the panel is open. ADR 0038.
   */
  it('names a tool only when one is open', () => {
    expect(writeAddress(defaults(), VIEWS.design)).toBe('');
    expect(writeAddress({ ...defaults(), tool: 'design-code' }, VIEWS.design)).toBe(
      '#?tool=design-code',
    );
    expect(parseAddress('#?tool=design-code', VIEWS.design).tool).toBe('design-code');
    expect(parseAddress('', VIEWS.design).tool).toBe(null);
  });

  it('appends the tool to an anchor, and the anchor survives it', () => {
    const open: ShellAddress = { ...defaults('the-four-ports'), tool: 'contents' };
    expect(writeAddress(open, DOCUMENT)).toBe('#the-four-ports?tool=contents');
    expect(parseAddress('#the-four-ports?tool=contents', DOCUMENT).tool).toBe('contents');
  });

  it('drops a tool the open view does not declare rather than refusing the link', () => {
    expect(parseAddress('#?tool=console', DOCUMENT).tool).toBe(null);
    // And it never reaches the view either: `tool` is the shell's name.
    expect(parseAddress('#?tool=console', DOCUMENT).rest.has('tool')).toBe(false);
  });

  /**
   * What a link written before ADR 0038 does, which is a decision and not an
   * accident.
   *
   * `tools=1|0` said whether the panel was open and `open=a,b,c` which sections
   * inside it were. One tool at a time cannot honour both, so an old link is read
   * for what its reader SAW: the panel shut unless `tools` said otherwise, and the
   * first section of `open` that this view declares where it did.
   */
  it('still reads a preview link written before the shell owned the hash', () => {
    const address = parseAddress('#/artikel?d=ipad-mini&o=l&tools=1', PREVIEW);

    expect(address.head).toBe('/artikel');
    // No `open` beside it, so the view's first tool.
    expect(address.tool).toBe('appearance');
    expect(address.rest.get('d')).toBe('ipad-mini');
    expect(address.rest.get('o')).toBe('l');
    // The names the shell owns never reach the view, written or not.
    expect(address.rest.has('tools')).toBe(false);
  });

  it('opens the first of an old `open` list that this view declares', () => {
    expect(parseAddress('#?tools=1&open=console,measure', PREVIEW).tool).toBe('console');
    // Written against another view: those two are dropped and the third stands.
    expect(parseAddress('#?tools=1&open=design-links,props,measure', PREVIEW).tool).toBe('measure');
    expect(parseAddress('#?tools=1&open=design-links', PREVIEW).tool).toBe('appearance');
  });

  it('opens nothing for an old link whose panel was shut', () => {
    // The sections were "open" inside a panel nobody could see, which is what
    // `/preview` did on every link that named no `tools`.
    expect(parseAddress('#?open=console,measure', PREVIEW).tool).toBe(null);
    expect(parseAddress('#?tools=0&open=console', PREVIEW).tool).toBe(null);
    expect(parseAddress('#?tools=0', VIEWS.design).tool).toBe(null);
  });

  it('prefers the new name where a link carries both', () => {
    expect(parseAddress('#?tool=tokens&tools=1&open=console', PREVIEW).tool).toBe('tokens');
  });

  it('ignores `full` on a view that cannot go full', () => {
    expect(parseAddress('#?full=1', DOCUMENT).full).toBe(false);
    expect(writeAddress({ ...defaults(), full: true }, DOCUMENT)).toBe('');
  });

  it('carries a view’s own parameters through untouched', () => {
    const address = parseAddress('#?r=bundle&d=pixel-8', COMPONENT);
    expect(address.rest.get('r')).toBe('bundle');
    expect(writeAddress(address, COMPONENT)).toBe('#?r=bundle&d=pixel-8');
  });
});
