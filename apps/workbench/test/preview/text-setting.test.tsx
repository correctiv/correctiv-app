/**
 * @vitest-environment jsdom
 */
import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';

import type { SettingValue } from '@correctiv/app-core/lib/home-layout';
import type { LocalisedText, TextSetting as TextSpec } from '@correctiv/app-core/lib/home-settings';

import { Localisation } from '../../src/i18n/Localisation';
import { SOURCE_LANGUAGE, type Language } from '../../src/i18n/language';
import { TextSetting } from '../../src/preview/home/TextSetting';
import { TooltipProvider } from '../../src/ui/kit/tooltip';

/**
 * The field a `text` setting gets, drawn.
 *
 * **What this holds.** The four things that can go quietly in a control nobody has typed
 * into yet: the field writes the language this workbench is in and no other, an edit in it
 * leaves the other languages of the word alone, the bound from the declaration stops what
 * is typed, and a language the word does not carry is marked rather than offered as an
 * empty field to be filled (ADR 0075 §2).
 *
 * **Why the rules live in `document.ts` and are tested there too.** Everything asserted
 * here that is arithmetic is also in `test/preview/home-document.test.ts`, and this file is
 * about what a person sees. The split is the reason the field is a file of its own at all:
 * `HomeDocument.tsx` cannot be rendered by a test (`test/preview/editor-controls.test.tsx`
 * says why at length), so a rule kept in the component beside its markup would be a rule
 * with no test at all.
 *
 * **A declaration of this tool's own, because no module declares a `text` yet** — step 4 of
 * the plan is what puts one on a block. It is a fixture in both directions: nothing here
 * adds a setting to an app module, and the ids in `text-setting.test.ts` are the same two
 * shapes the core's own test uses.
 *
 * At `SOURCE_LANGUAGE` wherever the assertion is about what the code does, because the
 * English of every descriptor is its source and pinning it pins the code rather than the
 * translation. The mark and the count are asserted in German, because their German wording
 * („Englisch fehlt“, „Noch 71 Zeichen“) is what ADR 0075 §2 names and what a newsroom reads,
 * and `i18n.test.ts` cannot see whether a translation reads like a sentence.
 */
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/** One line, 80 characters, and the block's own German — a screen's title, near enough. */
const TITLE: TextSpec = {
  key: 'title',
  kind: 'text',
  maxChars: 80,
  fallback: { de: 'Mitmachen' },
};

/** The same text declared as a paragraph, which is the only thing `multiline` changes. */
const PARAGRAPH: TextSpec = { ...TITLE, key: 'intro', maxChars: 40, multiline: true };

const MITMACHEN: LocalisedText = { de: 'Mitmachen' };

let container: HTMLDivElement;
let root: Root | null = null;
let written: (SettingValue | undefined)[] = [];

function draw(node: ReactNode, language: Language = SOURCE_LANGUAGE): void {
  // A second draw inside one test, which two of these do: the first tree is taken down
  // rather than left mounted behind the second one.
  if (root !== null) {
    act(() => root?.unmount());
    container.remove();
  }
  container = document.body.appendChild(document.createElement('div'));
  written = [];
  act(() => {
    root = createRoot(container);
    root.render(
      <Localisation language={language}>
        <TooltipProvider>{node}</TooltipProvider>
      </Localisation>,
    );
  });
}

/** A field over one declaration and one value, writing into `written`. */
function field(
  spec: TextSpec,
  value: unknown,
  { language = SOURCE_LANGUAGE, disabled = false } = {},
): void {
  draw(
    <TextSetting
      spec={spec}
      value={value}
      disabled={disabled}
      label="The sentence under the heading"
      onSet={(next) => written.push(next)}
    />,
    language,
  );
}

const input = (): HTMLInputElement => container.querySelector('input') as HTMLInputElement;
const textarea = (): HTMLTextAreaElement =>
  container.querySelector('textarea') as HTMLTextAreaElement;
const says = (needle: string): boolean => (container.textContent ?? '').includes(needle);

/**
 * Types into whatever the field is, the way a person does.
 *
 * Through the prototype's own setter rather than `element.value = …`, because React tracks
 * the value it last rendered and ignores an `input` event that did not change it: assign
 * the property and the field goes on calling itself unchanged, which is a test that passes
 * over a control that is not wired up. The property setter is the same one a keystroke
 * goes through.
 */
function type(what: string): void {
  const element = container.querySelector('textarea') ?? input();
  const prototype = element.tagName === 'TEXTAREA' ? HTMLTextAreaElement : HTMLInputElement;
  const setter = Object.getOwnPropertyDescriptor(prototype.prototype, 'value')?.set;
  act(() => {
    setter?.call(element, what);
    element.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

afterEach(() => {
  act(() => root?.unmount());
  root = null;
  container.remove();
});

describe('the field for a word', () => {
  it('writes the language this workbench is in, and reads it back out', () => {
    field(TITLE, { de: 'Mitmachen' }, { language: 'de' });
    expect(input().value).toBe('Mitmachen');

    type('Mitmachen, bitte');
    expect(written).toEqual([{ de: 'Mitmachen, bitte' }]);

    // And the write is what the next render shows, rather than a second copy of the value.
    field(TITLE, written[0], { language: 'de' });
    expect(input().value).toBe('Mitmachen, bitte');
  });

  it('shows the block’s own words where the document says none', () => {
    // The same answer every other setting gives (ADR 0039 §4): what the field edits when
    // nobody has chosen is what the module draws itself.
    field(TITLE, undefined, { language: 'de' });
    expect(input().value).toBe('Mitmachen');
    field({ ...TITLE, fallback: null }, undefined, { language: 'de' });
    expect(input().value).toBe('');
  });

  it('in English writes English and leaves the German standing', () => {
    field(TITLE, MITMACHEN);
    // Not the German, and not a second field to fill: ADR 0075 §2's whole argument.
    expect(input().value).toBe('');

    type('Take part');
    expect(written).toEqual([{ de: 'Mitmachen', en: 'Take part' }]);
  });

  it('counts what is left of the bound, and stops at it', () => {
    field(TITLE, MITMACHEN, { language: 'de' });
    expect(says('Noch 71 Zeichen')).toBe(true);
    expect(input().maxLength).toBe(80);

    // Past the bound, in a document and in a paste: `maxLength` is what a person typing at
    // the end runs into, and the handler is what a paste and a test run into.
    field({ ...TITLE, maxChars: 10 }, undefined, { language: 'de' });
    type('Mitmachen und mehr');
    expect(written).toEqual([{ de: 'Mitmachen ' }]);
    field({ ...TITLE, maxChars: 10 }, { de: 'Mitmachen und mehr' }, { language: 'de' });
    expect(says('Keine Zeichen mehr')).toBe(true);
  });

  it('breaks the line only where the declaration says it may', () => {
    field(PARAGRAPH, { de: 'Mitmachen' }, { language: 'de' });
    expect(container.querySelector('input')).toBeNull();
    expect(textarea().rows).toBe(3);

    type('Mitmachen\nunterstützen');
    expect(written).toEqual([{ de: 'Mitmachen\nunterstützen' }]);

    // The same two lines typed into a field declared as one line, where the line break
    // does not survive into the document at all. It is the input's own value sanitisation
    // that drops it, before any handler runs, which is why there is nothing to strip here.
    field(TITLE, undefined, { language: 'de' });
    type('Mitmachen\nunterstützen');
    expect(written).toEqual([{ de: 'Mitmachenunterstützen' }]);
  });

  it('marks a language the word does not carry, and only that one', () => {
    field(TITLE, MITMACHEN, { language: 'de' });
    expect(says('Englisch fehlt')).toBe(true);

    field(TITLE, { de: 'Mitmachen', en: 'Take part' }, { language: 'de' });
    expect(says('Englisch fehlt')).toBe(false);

    // And the other way round: an English workbench marks the German, which is the one the
    // document has to carry, and says nothing about a language it is not writing.
    field(TITLE, { en: 'Take part' });
    expect(says('German is missing')).toBe(true);
    field(TITLE, MITMACHEN);
    expect(says('German is missing')).toBe(false);
  });

  it('says the bound and the rule behind the count, not in the panel', () => {
    // Three sentences for this feature and none of them in the panel, which is the
    // difference between a control that reads as three things and one that reads as a form
    // with help text in it (#323 removed the drafts hints for the same reason). One ⓘ for
    // the count and one for the mark, and no prose until one of them is opened.
    field(TITLE, undefined, { language: 'de' });
    expect(container.querySelectorAll('p')).toHaveLength(0);
    expect(says('Höchstens')).toBe(false);
    expect(container.querySelectorAll('button')).toHaveLength(2);

    // A word in both languages has no mark, and then there is one tip rather than two.
    field(TITLE, { de: 'Mitmachen', en: 'Take part' }, { language: 'de' });
    expect(container.querySelectorAll('button')).toHaveLength(1);
  });

  it('is switched off with every other setting on a block that is off', () => {
    field(TITLE, MITMACHEN, { language: 'de', disabled: true });
    expect(input().disabled).toBe(true);
  });
});
