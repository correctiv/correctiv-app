import { KeyboardAvoidingView, ScrollView, View } from 'react-native';
import type { ReactTestInstance, ReactTestRenderer } from 'react-test-renderer';

/**
 * The three screens that take text input, and the shape that keeps a keyboard off
 * the control a person is reaching for.
 *
 * **What this cannot do.** No unit test opens a software keyboard, so nothing here
 * proves that a field, its caret or a submit button is visible on a phone. Whether
 * `behavior="padding"` lands the footer exactly above the keyboard is a device
 * question and stays one.
 *
 * **What it does do** is hold the structure that makes the device answer possible,
 * and every assertion below is one that failed before this change or would fail
 * again under an edit that looks reasonable:
 *
 * - each of the three screens has an avoiding view around its scroller at all
 *   (none of them had one; `KeyboardAvoidingView` was absent from the repository),
 * - the participation form's action footer is INSIDE that view and OUTSIDE the
 *   scroller, which is the half of the problem that is about this app's markup and
 *   not about the platform: inside the scroller it satisfies the first half and
 *   scrolls away, which is worse than the bug being fixed,
 * - search's field is OUTSIDE the avoiding view, because wrapping the whole screen
 *   would shorten the bar the field sits in instead of the result list,
 * - the avoiding view sits inside the door's `SafeAreaView`, not around it, so the
 *   bottom inset is counted once,
 * - and the one decision, `behavior="padding"` with no vertical offset, is pinned
 *   where a later `Platform.OS === 'ios' ? 'padding' : 'height'` would break it.
 *   That ternary is wrong here and the component says why; a test is what stops it
 *   arriving back by habit. Once, against the component: `KeyboardAvoidingProps`
 *   exposes `children` and `className` and nothing else, so no screen can pass a
 *   `behavior` or an offset of its own and three copies of that case could never
 *   disagree.
 */

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn(), canGoBack: () => true },
  useLocalSearchParams: jest.fn(() => ({})),
  // `ScreenHeader` configures the platform's stack header through `Stack.Screen` on
  // native, so a screen with a header reaches expo-router for more than `router`
  // now (ADR 0030). Both screens rendered here have one.
  Stack: { Screen: () => null },
}));

import { useLocalSearchParams } from 'expo-router';

import { callouts } from '@correctiv/app-core/data/callouts';

import FormularScreen from '@/app/formular';
import SucheScreen from '@/app/suche';
import { LoginGate } from '@/components/gate/LoginGate';
import { KeyboardAvoiding } from '@/components/keyboard/KeyboardAvoiding';
import { SafeAreaView } from '@/components/ui';

import { findPressable, render } from './support/rendering';

/**
 * The form renders a "this does not exist" screen without a known slug, and that
 * screen has neither a scroller nor a footer, so every assertion below would pass
 * vacuously. Read off the fixture rather than typed out, for the same reason.
 */
beforeEach(() => {
  (useLocalSearchParams as jest.Mock).mockReturnValue({ slug: callouts[0].slug });
});

/** The single avoiding view of a screen; more than one would be the bug itself. */
function avoidingView(tree: ReactTestRenderer): ReactTestInstance {
  const found = tree.root.findAllByType(KeyboardAvoidingView);
  expect(found).toHaveLength(1);
  return found[0]!;
}

/** The one text field carrying that accessibility label. */
function field(tree: ReactTestRenderer, label: string): ReactTestInstance {
  return tree.root.find(
    (node) => node.props?.accessibilityLabel === label && !!node.props?.onChangeText,
  );
}

/** Whether `node` is `ancestor` or sits anywhere below it. */
function contains(ancestor: ReactTestInstance, node: ReactTestInstance): boolean {
  return ancestor.findAll((candidate) => candidate === node).length > 0;
}

/** Factories rather than elements, so each case renders its own tree. */
const screens: [name: string, screen: () => React.ReactElement][] = [
  ['the door', () => <LoginGate />],
  ['the participation form', () => <FormularScreen />],
  ['search', () => <SucheScreen />],
];

describe.each(screens)('%s', (_name, screen) => {
  it('puts its scroller inside an avoiding view', () => {
    const view = avoidingView(render(screen()));
    expect(view.findAllByType(ScrollView)).toHaveLength(1);
  });
});

describe('KeyboardAvoiding', () => {
  it('avoids the keyboard by padding, on both platforms, with no offset', () => {
    // `padding` rather than a per-platform behaviour because this app is built
    // edge-to-edge, so Android does not resize its window either — KeyboardAvoiding
    // carries the manifest reading and the React Native version that argument
    // depends on. The offset is 0 because none of the three screens sits under a
    // native stack header.
    //
    // Asserted here and not once per screen: the props type takes `children` and
    // `className`, so a screen has no way to pass either value and three copies of
    // this case would have been three readings of one constant.
    const tree = render(
      <KeyboardAvoiding>
        <View />
      </KeyboardAvoiding>,
    );
    const view = avoidingView(tree);

    expect(view.props.behavior).toBe('padding');
    expect(view.props.keyboardVerticalOffset ?? 0).toBe(0);
  });
});

describe('the participation form', () => {
  it('keeps the action footer inside the avoiding view, not beside it', () => {
    // The regression this pins: the footer used to be a sibling of the ScrollView.
    // Then the keyboard covers "Weiter" while the field above it is being typed in,
    // and an avoiding view wrapping only the scroller would leave it there.
    const tree = render(<FormularScreen />);

    expect(contains(avoidingView(tree), findPressable(tree, 'Weiter'))).toBe(true);
  });

  it('keeps that footer out of the scroller, so it cannot scroll away', () => {
    // The other half, and the one the case above does not see: moved into the
    // ScrollView's content the footer is still inside the avoiding view, so that
    // assertion holds — and "Weiter" now scrolls off the bottom with the field above
    // it, which is a worse defect than the keyboard covering it.
    const tree = render(<FormularScreen />);
    const scroller = tree.root.findByType(ScrollView);

    expect(contains(scroller, findPressable(tree, 'Weiter'))).toBe(false);
  });
});

describe('search', () => {
  it('leaves its field outside the avoiding view, in the bar above it', () => {
    // The decision this screen makes, and the only one in the change with nothing
    // else pinning it: wrapping the whole screen, ScreenHeader included, passes every
    // assertion above. It would then shorten the bar the field sits in rather than
    // the result list, and the field would ride up over its own header.
    const tree = render(<SucheScreen />);

    expect(contains(avoidingView(tree), field(tree, 'Suchbegriff'))).toBe(false);
  });
});

describe('the door', () => {
  it('keeps the avoiding view inside the safe area, so the bottom inset counts once', () => {
    // Around the SafeAreaView instead, the inset it already applies is added to the
    // keyboard overlap and the form floats a home-indicator's height too high. That
    // reads as a layout bug rather than as too much padding, which is why it is
    // worth a test rather than a comment.
    const tree = render(<LoginGate />);
    const view = avoidingView(tree);

    expect(view.findAllByType(SafeAreaView)).toHaveLength(0);
    expect(tree.root.findByType(SafeAreaView).findAll((n) => n === view)).toHaveLength(1);
  });

  it('still hands the return key from the e-mail field to the password field', () => {
    // Focus-next is pre-existing behaviour that this change had to leave alone, and
    // the honest limit: react-test-renderer gives a ref no host instance, so
    // `passwordRef.current` is null and calling the handler moves nothing. What is
    // asserted is that the wiring survived — the key still says "Weiter", the
    // handler is still there, and it does not throw.
    const tree = render(<LoginGate />);
    const email = field(tree, 'E-Mail-Adresse');

    expect(email.props.returnKeyType).toBe('next');
    expect(email.props.submitBehavior).toBe('submit');
    expect(() => email.props.onSubmitEditing()).not.toThrow();
  });
});
