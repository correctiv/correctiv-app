import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { Localisation } from '../../src/i18n/Localisation.tsx';
import { SOURCE_LANGUAGE } from '../../src/i18n/language.ts';
import { SlotProvider, slotsOf } from '../../src/shell/slots.tsx';
import { ToolPanel } from '../../src/ui/ToolPanel.tsx';
import { VIEWS, type SectionId, type ViewDeclaration } from '../../src/shell/views.ts';

/**
 * What a shut tool does, which is the half the address cannot see.
 *
 * `shell/address.ts` has a test of its own and it passed while every section of
 * every panel was stuck open. This is the successor to `section.test.tsx`, which
 * was written for the accordion this replaces and for the same defect in it: a
 * reader clicking a chevron got the URL rewritten, the trigger's `data-state`
 * flipped, and the body did not move, because Radix's `forceMount` pinned its
 * presence on and the `hidden` it would otherwise have written was never written.
 *
 * One tool at a time has the same two halves and the same trap. Every tool's
 * target stays mounted, because unmounting takes the slot with it and the
 * console's level filter and the component route's device choice reset every time
 * somebody looked at another tool. And every tool but one is `hidden`, on an
 * element with no `display` of its own — a `flex` class on the same element beats
 * the user agent's `[hidden]` rule, which is the accordion's failure in a new
 * spelling and the reason this test is over the rendered markup rather than over
 * the hash.
 *
 * `renderToStaticMarkup` rather than a browser, because the defect is in the
 * first render and not in an interaction. It also costs no jsdom, and
 * `workbench:renders` is what opens a real page.
 *
 * One object per assertion rather than an `expect` per tool, as
 * `test/shell/address.test.ts` does it and for the same reason: a failure names
 * every tool that is wrong, and this defect was wrong in all of them at once.
 */

/** Every view with a panel, and every tool on it. */
const PANELLED: readonly ViewDeclaration[] = Object.values(VIEWS).filter(
  (view) => view.sections.length > 0,
);

/** React writes a boolean attribute as `hidden=""`, so this matches nothing else. */
const HIDDEN = 'hidden=""';

/**
 * `Localisation` around it, because the panel's names are descriptors now.
 *
 * At `SOURCE_LANGUAGE`, which consults no catalogue: the source of every string
 * on this site is its `defaultMessage`, so the English below is what the code says
 * rather than a translation this test would then be pinning. What is being asked
 * here is which tool is hidden, and the words are only how the last assertion
 * finds the heading.
 */
function draw(view: ViewDeclaration, tool: SectionId | null): string {
  return renderToStaticMarkup(
    <Localisation language={SOURCE_LANGUAGE}>
      <SlotProvider declared={slotsOf(view)}>
        <ToolPanel view={view} tool={tool} />
      </SlotProvider>
    </Localisation>,
  );
}

/** One tool's wrapper, as its opening tag, found by the name it carries. */
function wrapperOf(html: string, id: SectionId): string {
  const at = html.indexOf(`<div data-tool="${id}"`);
  if (at === -1) return '';
  return html.slice(at, html.indexOf('>', at) + 1);
}

/** The same answer for every tool of every panelled view. */
function each<T>(answer: (id: SectionId, view: ViewDeclaration) => T): Record<string, T> {
  return Object.fromEntries(
    PANELLED.flatMap((view) => view.sections.map((id) => [`${view.kind}/${id}`, answer(id, view)])),
  );
}

describe('the right panel, showing one tool', () => {
  it('shows the open tool and hides every other', () => {
    expect(
      each((id, view) => ({
        open: wrapperOf(draw(view, id), id).includes(HIDDEN) ? 'hidden' : 'on screen',
        // The view's first tool is open: every other one is away.
        elsewhere: wrapperOf(draw(view, view.sections[0] ?? null), id).includes(HIDDEN)
          ? 'hidden'
          : 'on screen',
        shut: wrapperOf(draw(view, null), id).includes(HIDDEN) ? 'hidden' : 'on screen',
      })),
    ).toEqual(
      each((id, view) => ({
        open: 'on screen',
        elsewhere: id === view.sections[0] ? 'on screen' : 'hidden',
        shut: 'hidden',
      })),
    );
  });

  it('keeps every tool’s slot mounted, whichever one is open', () => {
    expect(
      each((id, view) => ({
        shut: draw(view, null).includes(`data-slot="${id}"`) ? 'mounted' : 'gone',
        elsewhere: draw(view, view.sections.at(-1) ?? null).includes(`data-slot="${id}"`)
          ? 'mounted'
          : 'gone',
      })),
    ).toEqual(each(() => ({ shut: 'mounted', elsewhere: 'mounted' })));
  });

  /**
   * The trap this test is named for.
   *
   * `hidden` is `display: none` from the user agent's stylesheet, which any
   * `display` in a class beats. The wrapper therefore carries no class at all, and
   * the flex column that lays a tool's contents out is one element further in, on
   * the slot target itself.
   */
  it('hides on an element that declares no display of its own', () => {
    const offenders: string[] = [];
    for (const view of PANELLED) {
      for (const id of view.sections) {
        const wrapper = wrapperOf(draw(view, null), id);
        const opening = wrapper.slice(0, wrapper.indexOf('>'));
        if (/class="[^"]*\b(flex|grid|block|inline|table|flow-root|contents)\b/.test(opening)) {
          offenders.push(`${view.kind}/${id}: ${opening}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it('names the open tool, and the panel itself while nothing is open', () => {
    const view = VIEWS.preview;
    expect(draw(view, 'console')).toContain('Console');
    expect(draw(view, null)).toContain('Tools');
  });
});
