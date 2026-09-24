import { Profiler } from 'react';
import { StyleSheet, Text, TextInput } from 'react-native';
import { act } from 'react-test-renderer';

import { ScaledTextInput } from '@/components/ui/ScaledTextInput';
import { Typo } from '@/components/ui/Typo';
import { coreActions, coreStore } from '@/lib/store/core';
import { typography } from '@/lib/theme';
import { resetStore } from '@correctiv/app-core/stores/store';

import { ScaledText } from '@/components/ui/ScaledText';

import { render } from './support/rendering';

/**
 * ADR 0033's one place, rendered: what the platform is told about a line of text in
 * each of the two states the setting has.
 *
 * `accessibility.test.ts` holds WHERE the opt-out may be written, by reading the
 * source. This holds what it does once it is there, which a parse cannot see: that
 * following the system leaves the platform's scaling on and the sizes alone, and
 * that a chosen size switches it off and multiplies the metrics instead — replaced,
 * not stacked on the system's. React Native's jest preset reports a font scale of 2,
 * which is what makes "replaced" visible here: a product would come out doubled.
 */
beforeEach(() => {
  act(() => {
    coreStore.dispatch(resetStore());
  });
});

const base = typography['text-m'];

function drawn(element: React.ReactElement, host: typeof Text | typeof TextInput) {
  const node = render(element).root.findByType(host);
  return {
    allowFontScaling: node.props.allowFontScaling,
    style: StyleSheet.flatten(node.props.style),
  };
}

describe('the app text size, where it is applied', () => {
  it('leaves the platform to scale while it follows the system', () => {
    const { allowFontScaling, style } = drawn(<Typo variant="text-m">Probe</Typo>, Text);
    expect(allowFontScaling).toBe(true);
    expect(style.fontSize).toBe(base.fontSize);
    expect(style.lineHeight).toBe(base.lineHeight);
  });

  it('replaces the system scale with the chosen step', () => {
    act(() => {
      coreActions.settings.setTextSize(1.15);
    });
    const { allowFontScaling, style } = drawn(<Typo variant="text-m">Probe</Typo>, Text);
    expect(allowFontScaling).toBe(false);
    expect(style.fontSize).toBeCloseTo(Number(base.fontSize) * 1.15);
    expect(style.lineHeight).toBeCloseTo(Number(base.lineHeight) * 1.15);
  });

  it('applies the same step to a field', () => {
    act(() => {
      coreActions.settings.setTextSize(0.9);
    });
    const { allowFontScaling, style } = drawn(
      <ScaledTextInput value="" style={[typography['text-m'], { color: 'red' }]} />,
      TextInput,
    );
    expect(allowFontScaling).toBe(false);
    expect(style.fontSize).toBeCloseTo(Number(base.fontSize) * 0.9);
    // Everything that is not a metric passes through untouched.
    expect(style.color).toBe('red');
  });

  it("draws the recovery screen's way, following the system, with no provider above it", () => {
    // The root error boundary renders outside the app's Provider; a store read
    // there would throw inside the boundary. `render()` mounts the provider, so
    // this mounts the bare element through a renderer of its own.
    const { create } =
      jest.requireActual<typeof import('react-test-renderer')>('react-test-renderer');
    act(() => {
      coreActions.settings.setTextSize(1.15);
    });
    let tree!: ReturnType<typeof create>;
    act(() => {
      tree = create(<ScaledText style={base}>Probe</ScaledText>);
    });
    expect(tree.root.findByType(Text).props.allowFontScaling).toBe(true);
    act(() => tree.unmount());
  });

  it('re-renders a line of text on its own setting and on no other', () => {
    // One subscription at the root, to the primitive `textSize`. The first version
    // had every text subscribe to the whole settings object, so a switch anywhere
    // in the settings re-drew every line on the screen.
    let commits = 0;
    render(
      <Profiler id="probe" onRender={() => (commits += 1)}>
        <Typo variant="text-m">Probe</Typo>
      </Profiler>,
    );
    const mounted = commits;

    act(() => {
      coreActions.settings.setPushOptIn(true);
      coreActions.settings.setTheme('dark');
      coreActions.settings.setActiveTab('profile');
    });
    expect(commits).toBe(mounted);

    act(() => {
      coreActions.settings.setTextSize(0.9);
    });
    expect(commits).toBe(mounted + 1);
  });
});
