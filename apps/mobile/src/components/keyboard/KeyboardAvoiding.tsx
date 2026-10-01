import type { ReactNode } from 'react';
import { KeyboardAvoidingView } from 'react-native';

export type KeyboardAvoidingProps = {
  /**
   * The scroller, and anything pinned below it. Everything that has to stay above
   * the keyboard belongs in here rather than beside it — see below.
   */
  children: ReactNode;
  /** Classes for the avoiding view itself: it stands where a plain `View` would. */
  className?: string;
};

/**
 * The box that gets out of the software keyboard's way.
 *
 * Three screens take text input — the door, the participation form and search —
 * and this is the single place the decision behind all three lives.
 *
 * **`behavior="padding"` on both platforms**, and not the
 * `Platform.OS === 'ios' ? 'padding' : 'height'` this usually gets written as. The
 * reason is Android, and it is specific to how this app is built:
 *
 * - `app.json` sets no `android.softwareKeyboardLayoutMode`, so Expo's CNG writes
 *   `android:windowSoftInputMode="adjustResize"` onto the main activity. That was
 *   read out of a generated manifest, not assumed: `npx expo prebuild --platform
 *   android` and then `android/app/src/main/AndroidManifest.xml`.
 * - The attribute is inert **for the resize**, and only for that. The same prebuild
 *   writes `edgeToEdgeEnabled=true` into `gradle.properties`, which becomes
 *   `BuildConfig.IS_EDGE_TO_EDGE_ENABLED`; the generated entry point calls
 *   `WindowUtilKt.setEdgeToEdgeFeatureFlagOn()`, and `ReactActivityDelegate.onCreate`
 *   then runs `enableEdgeToEdge()`, which is
 *   `WindowCompat.setDecorFitsSystemWindows(window, false)`. A window that does not
 *   fit system windows is not shrunk for the IME, so `adjustResize` has nothing left
 *   to resize. That chain has no version gate, so it holds on everything this app
 *   installs on (`minSdkVersion` 24) and not only from Android 15, where targetSdk
 *   35+ has the platform enforce edge to edge whether the flag is set or not.
 *   Android's own keyboard guide still asks for `adjustResize`, for backward
 *   compatibility with the AndroidX inset implementation, and says nothing about the
 *   platform ignoring it.
 * - **Which is exactly why the attribute has to stay.** `ReactRootView.java` reads
 *   `softInputMode` off the window when it builds `keyboardDidShow` and picks
 *   `endCoordinates.screenY` from it: `adjustNothing` gets
 *   `visibleFrame.bottom - keyboardHeight`, anything else gets `visibleFrame.bottom`.
 *   That coordinate is the only input `behavior="padding"` has at all
 *   (`KeyboardAvoidingView.js`: `Math.max(frame.y + frame.height - keyboardY, 0)`).
 *   So do not read "inert" as dead weight and delete it, and do not set
 *   `android.softwareKeyboardLayoutMode` in `app.json`: `@expo/config-plugins` writes
 *   that value straight onto the activity (`pan` becomes `adjustPan`), the padding is
 *   then measured against a window that behaves differently, and no build and no test
 *   in this repository would say so.
 * - So Android needs precisely the explicit avoidance iOS needs. The older advice,
 *   that on Android having the view is enough and `behavior` may be left off,
 *   describes a window that resizes itself. This one does not.
 *
 * React Native 0.86 is the first release where that actually works. It carries
 * facebook/react-native#55855, which rebuilt the Android keyboard events on
 * `WindowInsetsCompat` and stopped `keyboardDidHide` re-entering the measurement
 * with stale coordinates; the `behavior="height"` render loop is one of the three
 * things that pull request names. 0.85's `ReactRootView` has no `WindowInsetsCompat`
 * path and takes the coordinate from `mVisibleViewArea.height()` instead, which is
 * why the version is worth naming. What this component would have done there was
 * never run, and is not claimed here.
 *
 * **It goes inside the safe area, never around it.** `padding` adds the overlap
 * between this view's own frame and the top of the keyboard. A bottom inset applied
 * outside it already lifts that frame, so the inset is subtracted from what this
 * adds and the two compose to exactly the keyboard's height. Wrapping the
 * `SafeAreaView` instead counts the inset twice, and the symptom is a gap that
 * reads as a layout bug rather than as too much padding.
 *
 * **The footer goes inside it, not beside it.** A footer that is a sibling of the
 * scroller reacts to the keyboard on its own and the two fight. Inside, one box
 * shrinks and both move together.
 *
 * **What it does not do is scroll the focused field into view, and that is a known
 * limit of what landed here rather than an oversight.** This shrinks the box; nothing
 * inside it moves. React Native's own `scrollResponderScrollNativeHandleToKeyboard`
 * is never called from within the framework, and none of the three scrollers sets
 * `automaticallyAdjustKeyboardInsets`. So a field low in the shortened box stays cut
 * off, and the caret walks out of view as the text grows. Measured in the built web
 * export at 390 × 844 on the form's first step: the multiline field occupies
 * y 414–510 and the avoiding box 58–844 with a ~73pt footer, so a ~336pt keyboard
 * leaves the scroller 58–435 and cuts the field 21pt after its top edge. The
 * escalation for that is named and not taken: `react-native-keyboard-controller`'s
 * `KeyboardAwareScrollView` (ADR 0026 §2), a dependency to add when a layout
 * demands it rather than in advance.
 *
 * `keyboardVerticalOffset` stays 0, and that is a measured fact about these three
 * screens rather than a default worth keeping: none of them sits under a native
 * stack header. The door is rendered in place of the whole route tree, and the form
 * and search draw the app's own bar. If one of them ever takes the platform's
 * header (ADR 0026 §9) the offset it then needs is `useHeaderHeight()` from
 * `@react-navigation/elements`.
 *
 * On web this is a plain `View`: react-native-web's `KeyboardAvoidingView` drops
 * `behavior` and renders its children, because there the browser moves the page.
 * That is why there is no platform split here and the web layout is unchanged — one
 * more `<div>` carrying the same flex rules.
 */
export function KeyboardAvoiding({ children, className }: KeyboardAvoidingProps) {
  return (
    <KeyboardAvoidingView behavior="padding" className={className}>
      {children}
    </KeyboardAvoidingView>
  );
}
