import type { ReactElement } from 'react';
import { StyleSheet } from 'react-native';

/**
 * The four labels that may not wrap, and the two declarations that stop them.
 *
 * `Badge`, `Overline`, `Chip` and `LiveBanner`'s now-playing line each carry
 * `numberOfLines`, `flexShrink: 0`, or a deliberate absence of one of them, and
 * each of those is an answer to a measurement on the GTK4 host ADR 0012 names as
 * a reason. Every component's own docblock has the measurement.
 *
 * WHY A TEST AND NOT THE MEASUREMENT ITSELF. The measurement is a claim about
 * Pango and `Gtk.Box`, and there is no GTK in `npm run check` — the host that
 * produced it is not built here. So the oracle available on this side is the
 * weaker one: that the props still reach the text.
 *
 * That is exactly the failure worth catching, because three of the four look like
 * noise. `flexShrink: 0` is React Native's own default written out, so removing it
 * changes nothing a reviewer can see in a screenshot of either target; it changes
 * a chip rail on a third host into three clipped lines.
 *
 * WHAT IT DOES NOT PROVE: that the labels are readable on GTK. That is a route
 * sweep and a capture on the host, and it lives with the host.
 */

// Every suite that renders a component from the `@/components/ui` barrel needs
// this, because ScreenHeader reaches expo-router through it.
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn() },
  useLocalSearchParams: jest.fn(() => ({})),
  usePathname: jest.fn(() => '/'),
}));
jest.mock('@/lib/audio/player', () => ({
  playRadio: jest.fn(() => Promise.resolve()),
  stop: jest.fn(),
}));
jest.mock('@/lib/audio/useAudio', () => ({
  useRadioState: () => 'off',
}));

import { act } from 'react-test-renderer';

import { loaded as radioLoaded } from '@correctiv/app-core/stores/radio';
import { resetStore } from '@correctiv/app-core/stores/store';

import { render, walkHostNodes } from './support/rendering';

import { LiveBanner } from '@/components/media/LiveBanner';
import { Badge, Button, Chip, Overline } from '@/components/ui';
import { coreStore } from '@/lib/store/core';

/**
 * Seeded, so the banner's lazy loader does not reach the network on mount. The
 * title itself comes from the component's `subtitle` prop below, which is the
 * fallback the line uses when Icecast reports none.
 */
beforeEach(() => {
  act(() => {
    coreStore.dispatch(resetStore());
    coreStore.dispatch(
      radioLoaded({
        online: true,
        listeners: 5,
        listenerPeak: 86,
        bitrateKbps: 64,
        nowPlaying: null,
        stationName: 'Salon5 low',
      }),
    );
  });
});

/** One rendered text node: what the props say, and the style once flattened. */
interface Label {
  chars: string;
  numberOfLines: number | undefined;
  flexShrink: number | undefined;
  textAlign: string | undefined;
}

/**
 * The first `Text` in the tree whose text contains `chars`, as a platform sees it.
 *
 * `walkHostNodes` from `support/rendering.tsx` does the walking, so this file and
 * `renderedText` agree about what a component rendered; the header there says why
 * the host nodes are the honest reading rather than the component instances.
 */
function firstLabelContaining(element: ReactElement, chars: string): Label {
  let found: Label | undefined;
  walkHostNodes(render(element), {
    onEnter: (node) => {
      if (found || node.type !== 'Text' || !node.text.includes(chars)) return;
      const style = StyleSheet.flatten(node.props.style as never) as
        | { flexShrink?: number; textAlign?: string }
        | undefined;
      found = {
        chars: node.text,
        numberOfLines: node.props.numberOfLines as number | undefined,
        flexShrink: style?.flexShrink,
        textAlign: style?.textAlign,
      };
    },
  });
  if (!found) throw new Error(`No text node containing "${chars}"`);
  return found;
}

describe('the labels that may not wrap', () => {
  it('sets a Badge to one line that does not shrink', () => {
    const label = firstLabelContaining(<Badge label="Faktencheck" />, 'Faktencheck');
    expect(label.numberOfLines).toBe(1);
    expect(label.flexShrink).toBe(0);
  });

  it('sets a Badge on every tone, including the one with a dot beside it', () => {
    // `live` renders a second child before the text, so the label is not the
    // first node in the box — a fix applied to the wrong child would pass above.
    for (const tone of ['emphasis', 'club', 'neutral', 'live'] as const) {
      const label = firstLabelContaining(<Badge label="Live" tone={tone} />, 'Live');
      expect({ tone, ...label }).toEqual({ tone, chars: 'Live', numberOfLines: 1, flexShrink: 0 });
    }
  });

  it('sets an Overline to one line that does not shrink', () => {
    // Two words, which is the case that showed the shortfall; a single-word mark
    // has no break opportunity and was never affected.
    const label = firstLabelContaining(<Overline label="Junge Formate" />, 'JUNGE FORMATE');
    expect(label.numberOfLines).toBe(1);
    expect(label.flexShrink).toBe(0);
  });

  it('keeps a Chip label unshrinkable and lets it wrap', () => {
    const label = firstLabelContaining(<Chip label="Klima und Umwelt" />, 'Klima und Umwelt');
    expect(label.flexShrink).toBe(0);
    // NOT one line, and that is the decision rather than an omission: the chip's
    // docblock records `numberOfLines={1}` as measured and worse, because it
    // takes the label's minimum width down to a single character and truncates
    // every chip in the rail. Someone reaching for it has to read that first.
    expect(label.numberOfLines).toBeUndefined();
  });

  it('sets the live banner’s now-playing line to one line', () => {
    // A stream announces titles nobody chose, and an unbreakable token in one of
    // them is what pinned the window open at two lines.
    const banner = <LiveBanner subtitle="20260901_Gamescom_Laberpocast_Sophie_Amelie" />;
    const label = firstLabelContaining(banner, '20260901_Gamescom');
    expect(label.numberOfLines).toBe(1);
  });

  /**
   * A button's label is not sized to its own measurement, which is the opposite
   * problem to the four above: those may not wrap, this one may — it just must not
   * be given exactly the width it measured.
   *
   * `Weiter` rendered as `Weite` on an Android emulator. The text node was 124px,
   * the right width for six characters, and about 106px of glyphs were painted with
   * one glyph of dead space after them: a line break inside the word, its second
   * line outside the measured height. `items-center` on the Pressable gave the
   * label its own content width to the pixel, so a sub-pixel disagreement between
   * what the measure returned and what the line breaker computed had nowhere to go.
   * Stretching the label to the button's inner width and centring the glyphs with
   * `textAlign` removes the disagreement's only consequence.
   *
   * WHAT THIS DOES NOT PROVE, and it matters: the fix reaches a button that is
   * wider than its text, which is `fullWidth` and `flex-1`. A `self-start` button
   * shrink-wraps to the label, so stretching hands the label the same number and
   * the exposure remains. None of the app's twelve is affected today — measured on
   * a device, right-hand gaps of 1 to 3px, which is the side bearing — and the
   * underlying cause is the `button` variant's 0.2px tracking, which is #145.
   */
  it('gives a button label the width of the button, not of the label', () => {
    let classes = '';
    walkHostNodes(render(<Button title="Weiter" />), {
      onEnter: (node) => {
        if (node.type === 'View' && typeof node.props.className === 'string' && !classes) {
          classes = node.props.className;
        }
      },
    });
    expect(classes).not.toBe('');
    // `items-center` is what sized the label to itself. Named rather than asserted
    // away, so a regression reads as the thing that came back.
    expect(classes).not.toContain('items-center');
    expect(firstLabelContaining(<Button title="Weiter" />, 'Weiter').textAlign).toBe('center');
  });

  it('leaves the banner’s station name alone, so the assertions above mean something', () => {
    // The oracle for the oracle: this file would pass on a tree where every text
    // node had been set to one line, which is not what any of it claims.
    const label = firstLabelContaining(<LiveBanner />, 'Salon5 Radio');
    expect(label.numberOfLines).toBeUndefined();
  });
});
