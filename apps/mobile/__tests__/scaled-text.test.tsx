import { StyleSheet, Text, TextInput } from 'react-native';
import { act } from 'react-test-renderer';

import { ScaledTextInput } from '@/components/ui/ScaledTextInput';
import { Typo } from '@/components/ui/Typo';
import { coreActions, coreStore } from '@/lib/store/core';
import { typography } from '@/lib/theme';
import { resetStore } from '@correctiv/app-core/stores/store';

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
});
