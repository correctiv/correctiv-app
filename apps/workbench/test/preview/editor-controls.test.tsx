/**
 * @vitest-environment jsdom
 */
import { act, useState, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';

import { MINUTES_IN_DAY, type HomeLayout } from '@correctiv/app-core/lib/home-layout';

import { Localisation } from '../../src/i18n/Localisation';
import { TooltipProvider } from '../../src/ui/kit/tooltip';
import { SOURCE_LANGUAGE } from '../../src/i18n/language';
import { EditorBar, PointChip } from '../../src/preview/home/Controls';
import { EDITION_COPY } from '../../src/preview/home/Edition';
import type { Point } from '../../src/preview/home/document';
import type { ScreensControl } from '../../src/preview/home/CustomScreens';
import type { ScenarioControl } from '../../src/preview/home/Scenario';

/**
 * The editor's bar and the chip under it, which this suite is about because they
 * used to be five rows of controls and a card above the block list.
 *
 * **What it holds.** Three things that can go quietly. The screen switcher is five
 * RADIOS named by the screen they switch to and not five anonymous glyph buttons, so
 * a screen reader says „Mediathek“ where it used to say „radio button“. The GitHub
 * paragraph is not here at all, ⓘ or no ⓘ, because the button it describes is in the
 * header and says it. And the point's card is a chip that is shut until it is asked
 * for, which is the whole of the height it used to take.
 *
 * **Why this file exists at all.** `HomeDocument.tsx` cannot be rendered by a test:
 * it draws the app's own blocks through `AppHost`, which mounts `expo-router` and
 * `react-native`, and importing it raises `SyntaxError` before the first assertion
 * runs. The controls need none of that, which is why they are a file of their own —
 * and the alternative, a check that reads the source for a `data-testid`, is the
 * shape of check this repository has been bitten by three times in a week.
 *
 * **A live tree and not a static render**, because the defect each of these answers
 * is in the transition: a chip that does not open, a toggle that does not press, a
 * radio group where the fifth radio is not reachable. The press is done with
 * `.click()` on the input itself rather than through its label, because jsdom does
 * not forward a label's activation to its input and a test that pretended otherwise
 * would pass on a control that is not wired up.
 *
 * At `SOURCE_LANGUAGE`, which consults no catalogue: the source of every string on
 * this site is its `defaultMessage`, so the English below is what the code says
 * rather than a translation this test would then be pinning. `tool-panel.test.tsx`
 * gives the same reason for the same choice.
 */
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const SCENARIO: ScenarioControl = {
  open: null,
  asking: null,
  choose: () => {},
  replace: () => {},
  keep: () => {},
  close: () => {},
};

/** A day that changes at nothing, so the chip has no moments to count. */
const DAY: HomeLayout = {
  version: 1,
  words: null,
  sections: [],
  moments: [],
  editions: [],
};

let container: HTMLDivElement;
let root: Root;

function draw(node: ReactNode): void {
  container = document.body.appendChild(document.createElement('div'));
  act(() => {
    root = createRoot(container);
    // The provider `App.tsx` mounts around everything, and Radix's tooltip refuses
    // to be drawn without it — which is itself the reason this file has to mount it
    // rather than only the component under test.
    root.render(
      <Localisation language={SOURCE_LANGUAGE}>
        <TooltipProvider>{node}</TooltipProvider>
      </Localisation>,
    );
  });
}

const byTestId = (id: string): HTMLElement =>
  container.querySelector(`[data-testid="${id}"]`) as HTMLElement;
const list = (): HTMLButtonElement | null =>
  container.querySelector<HTMLButtonElement>('button[role="combobox"][aria-label="Screens"]');

/** The titles a screen is listed by, as `screenTitle` would say them for the demo's five. */
const TITLES: Record<string, string> = {
  home: 'Home',
  entdecken: 'Entdecken',
  mediathek: 'Mediathek',
  mitmachen: 'Mitmachen',
  profil: 'Profil',
};

const SCREENS: ScreensControl = {
  ids: Object.keys(TITLES),
  titleOf: (id) => TITLES[id] ?? id,
  fault: () => null,
  create: () => null,
};

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

function bar(over: Partial<Parameters<typeof EditorBar>[0]> = {}): ReactNode {
  return (
    <EditorBar
      screen="home"
      guarded={false}
      onScreen={() => {}}
      scenario={SCENARIO}
      follow
      onFollow={() => {}}
      screens={SCREENS}
      openScreen={{
        id: over.screen ?? 'home',
        words: null,
        onTitle: () => {},
        onPreview: () => {},
        onDelete: () => {},
      }}
      deleted={[]}
      {...over}
    />
  );
}

/**
 * The bar draws no paragraph, and why that is a claim rather than an accident.
 *
 * **This bar had a `notice` slot, and what went in it is now three words in the
 * header.** The sentence said a draft had arrived in a link and that this machine
 * holds nothing of it (ADR 0076 §3) — a permanent paragraph above the block list,
 * which is a sentence everybody reads once and then never again, and it pushes the
 * work down. #323 took the draft paragraphs out of the panels and this one came back
 * through the same door in #331, so it goes out the same way: `Aus Link` beside the
 * change status, and the sentence behind it in the tooltip
 * (`test/shell/actions.test.tsx` holds the bar's half).
 *
 * **Asserted on the paragraphs and not on the slot.** A check for `notice=` would
 * read the prop list of a component nobody can render from here — `HomeDocument.tsx`
 * is the caller and it cannot be rendered at all, which is why this file exists — and
 * would be a check that a renamed prop passes. A `<p>` is what a reader would see, and
 * this asks whether any is there at all.
 */
describe("the panel's bar", () => {
  it('draws no paragraph of its own while the screen is unlocked', () => {
    draw(bar());
    expect(container.querySelectorAll('p')).toHaveLength(0);
  });

  it('draws the one paragraph a locked screen needs, and no other', () => {
    draw(bar({ guarded: true }));
    const said = [...container.querySelectorAll('p')].map((p) => p.textContent);
    expect(said).toEqual([
      'A scenario is a Home document, so the screen stays on Home while one is open.',
    ]);
  });
});

describe('the screen list', () => {
  it('is one list, named for what it holds, showing the screen being edited', () => {
    draw(bar({ screen: 'mediathek' }));
    expect(list()).not.toBeNull();
    expect(list()?.textContent).toContain('Mediathek');
  });

  it('holds every screen of the layout alike, whatever it is called', () => {
    draw(bar({ screens: { ...SCREENS, ids: ['kampagne', 'home'] } }));
    // The list is a closed control until it is opened; what it was handed is what it can show.
    expect(list()?.textContent).toContain('Home');
  });

  it('draws no list while the layout has no screen, and still a way to make one', () => {
    draw(bar({ screens: { ...SCREENS, ids: [] }, openScreen: null }));
    expect(list()).toBeNull();
    expect(byTestId('new-screen')).not.toBeNull();
  });

  it('switches off while a scenario is open, and says why underneath', () => {
    draw(bar({ guarded: true }));
    expect(list()?.disabled).toBe(true);
    expect(container.textContent).toContain('A scenario is a Home document');
  });

  it('offers the scenario only on Home, which is the only screen a scenario is', () => {
    draw(bar({ screen: 'home' }));
    expect(container.querySelector('[data-testid="scenario-bar"]')).not.toBeNull();
    draw(bar({ screen: 'entdecken' }));
    expect(container.querySelector('[data-testid="scenario-bar"]')).toBeNull();
  });
});

describe('the scroll-follow toggle', () => {
  it('is a pressed button, on to begin with, named after what it does', () => {
    draw(bar());
    const button = byTestId('follow-toggle');
    expect(button.getAttribute('aria-pressed')).toBe('true');
    // The name is the sentence that used to be the checkbox's label, so the control
    // is not a glyph with a tooltip alone.
    expect(button.getAttribute('aria-label')).toBe('Scroll the frame to the block you point at');
  });

  it('presses and unpresses, and the panel hears which way round it is', () => {
    const heard: boolean[] = [];
    let held: boolean | null = null;
    function Bound() {
      const [follow, setFollow] = useState(true);
      held = follow;
      return bar({
        follow,
        onFollow: (next) => {
          heard.push(next);
          setFollow(next);
        },
      });
    }
    draw(<Bound />);
    act(() => byTestId('follow-toggle').click());
    expect(byTestId('follow-toggle').getAttribute('aria-pressed')).toBe('false');
    expect(held).toBe(false);
    act(() => byTestId('follow-toggle').click());
    expect(byTestId('follow-toggle').getAttribute('aria-pressed')).toBe('true');
    expect(heard).toEqual([false, true]);
  });
});

/**
 * What the GitHub paragraph became.
 *
 * **This bar carries no ⓘ about Submit at all now**, and that is the point of the
 * block: the sentence was about a button in the header, so it is on that button
 * (`ui/ToolActions.tsx`), together with the reason the button is off, which is the
 * only part a reader of this panel could not reach. So these assert what is NOT
 * here — the ⓘ, its heading and its three variants — and `test/shell/actions.test.tsx`
 * holds the button's own half, which is where the words went.
 */
describe('what the GitHub paragraph became', () => {
  it('is nowhere in this panel, ⓘ or no ⓘ', () => {
    draw(bar());
    expect(container.textContent).not.toContain('GitHub');
    expect(container.textContent).not.toContain('GitHub account');
    expect(container.querySelector('[data-testid="submit-hint"]')).toBeNull();
  });

  it('left no ⓘ behind it either', () => {
    draw(bar());
    expect(container.querySelector('button[title*="Submitting the change"]')).toBeNull();
    // The row draws the screen switcher, the scenario chip and the follow toggle and
    // nothing else, so the ⓘ that stood between them is gone rather than moved.
    expect(container.querySelectorAll('[data-testid="scenario-bar"]')).toHaveLength(1);
  });

  it('keeps the follow toggle at the right end of the row, where the ⓘ stood', () => {
    draw(bar());
    // `ml-auto` is the spacer and it moved onto the toggle with the ⓘ gone; without it
    // the row would end at the scenario chip and the toggle would sit in the middle.
    const toggle = byTestId('follow-toggle');
    expect(toggle.className).toContain('ml-auto');
  });
});

describe('the point’s chip', () => {
  /** A moment at 14:00 that differs on two blocks. */
  const MOMENT = 14 * 60;

  function chip(point: Point, over: Partial<Parameters<typeof PointChip>[0]> = {}): ReactNode {
    return (
      <PointChip
        layout={DAY}
        point={point}
        span={{ from: 0, to: MINUTES_IN_DAY }}
        changes={2}
        landsOn={EDITION_COPY.landsOnDay}
        onMove={() => {}}
        onRemove={() => {}}
        {...over}
      />
    );
  }

  it('is shut to begin with, so the card is not on the page', () => {
    draw(chip(MOMENT));
    const point = byTestId('point-chip');
    expect(point.getAttribute('aria-expanded')).toBe('false');
    expect(point.tagName).toBe('BUTTON');
    expect(container.querySelector('[data-testid="point-time"]')).toBeNull();
  });

  it('says the time and how much this moment changes', () => {
    draw(chip(MOMENT));
    const text = byTestId('point-chip').textContent ?? '';
    expect(text).toContain('14:00');
    expect(text).toContain('2 changed here');
    expect(text).toContain('until midnight');
  });

  it('says which point it is and which way round it is, in its name', () => {
    draw(chip(MOMENT));
    expect(byTestId('point-chip').getAttribute('aria-label')).toBe(
      'The point being edited: 14:00. Show its time, its rule and what can be done to it.',
    );
    act(() => byTestId('point-chip').click());
    expect(byTestId('point-chip').getAttribute('aria-label')).toBe(
      'The point being edited: 14:00. Hide its time, its rule and what can be done to it.',
    );
  });

  it('opens the card on a click, and the card carries the time, the delete and the layer', () => {
    const moved: number[] = [];
    draw(chip(MOMENT, { onMove: (to) => moved.push(to) }));
    act(() => byTestId('point-chip').click());
    const point = byTestId('point-chip');
    expect(point.getAttribute('aria-expanded')).toBe('true');
    // What it controls is the card it names, which is what an expanded control needs
    // to be operable from a keyboard.
    const card = container.querySelector<HTMLElement>(
      `[id="${point.getAttribute('aria-controls')}"]`,
    );
    expect(card).not.toBeNull();
    const time = container.querySelector<HTMLInputElement>('[data-testid="point-time"]');
    expect(time?.value).toBe('14:00');
    expect(card?.contains(time ?? null)).toBe(true);
    // The sentence about which layer an edit lands on is in the card and not in the
    // bar, which is the other half of what this tool used to spend its height on.
    expect(card?.textContent).toContain('Your changes go into the ordinary day.');
    expect(card?.querySelector('button[aria-label^="Remove the moment"]')).not.toBeNull();
    // And the time field is still the time field it was: typing into it moves the
    // moment, which is the one thing the card is for. Written through the prototype's
    // own setter because React tracks the value it last wrote and a plain assignment
    // reads to it as no change at all.
    act(() => {
      const field = time!;
      const setter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        'value',
      )?.set;
      setter?.call(field, '18:30');
      field.dispatchEvent(new Event('input', { bubbles: true }));
    });
    expect(moved).toEqual([18 * 60 + 30]);
  });

  it('shuts again, and the card goes with it', () => {
    draw(chip(MOMENT));
    act(() => byTestId('point-chip').click());
    act(() => byTestId('point-chip').click());
    expect(byTestId('point-chip').getAttribute('aria-expanded')).toBe('false');
    expect(container.querySelector('[data-testid="point-time"]')).toBeNull();
  });

  it('names the day itself while there is no moment in it, and says so when it opens', () => {
    draw(chip(null));
    const text = byTestId('point-chip').textContent ?? '';
    expect(text).toContain('The day’s start');
    // “from midnight” is not on the chip: the label beside it already says so, and
    // the one-line chip has room for the half that is new. The card says it whole.
    expect(text).toContain('bis midnight');
    expect(text).not.toContain('from midnight');
    act(() => byTestId('point-chip').click());
    expect(container.textContent).toContain('from midnight until midnight');
    expect(container.textContent).toContain('This day has no moments.');
  });
});
