import { createContext, useCallback, useContext, type ReactNode, type RefObject } from 'react';
import { KeyboardAvoidingView, type HostInstance, ScrollView, type TextInput } from 'react-native';

/**
 * The scroller that has to move, handed down from the screen.
 *
 * The field and the scroller are never neighbours: search draws its field in the bar
 * above the list, and the door's fields sit in a form component the screen renders
 * further down. Drilling one ref through both of those is what the context is for.
 *
 * Lower-case, unlike the convention for a context: `gallery-catalogue.test.ts` reads
 * every PascalCase export under `src/components` as a component of the gallery, and
 * this is not one.
 */
export const scrollerContext = createContext<RefObject<ScrollView | null> | null>(null);

/**
 * Room left above a focused field, so the caret and the line it sits on are both
 * readable instead of flush against the keyboard.
 */
const SCROLL_EXTRA_OFFSET = 16;

/**
 * Asks the scroller to bring a focused field into the part of the box the keyboard
 * leaves free.
 *
 * React Native can do this — `ScrollView` measures the field and the window itself,
 * and works out where the keyboard is — and calls it nowhere in the framework, which
 * is why an avoiding view on its own leaves a low field cut off. The field goes in as
 * an instance rather than as a node handle because that is one of the two shapes the
 * method takes.
 *
 * Nothing happens without both halves: there is no scroller to scroll, and a test
 * tree has no native view to point at.
 */
export function useFieldIntoView(): (input: TextInput | null) => void {
  const scroller = useContext(scrollerContext);
  return useCallback(
    (input: TextInput | null) => {
      if (!scroller?.current || !input) return;
      scroller.current.scrollResponderScrollNativeHandleToKeyboard(
        input as unknown as HostInstance,
        SCROLL_EXTRA_OFFSET,
      );
    },
    [scroller],
  );
}

export type KeyboardAvoidingProps = {
  /**
   * The scroller, and anything pinned below it. Everything that has to stay above
   * the keyboard belongs in here rather than beside it — see below.
   */
  children: ReactNode;
  /** Classes for the avoiding view itself: it stands where a plain `View` would. */
  className?: string;
  /**
   * The screen's own scroller, so a field inside it can be brought out from behind
   * the keyboard. See `scrollIntoView.ts`.
   */
  scrollerRef?: RefObject<ScrollView | null>;
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
 * **And the scroller is registered here, so a field below can be brought into the
 * part of the box the keyboard leaves.** That is a second thing this view does and it
 * is not what `KeyboardAvoidingView` does: shrinking the box moves nothing inside it,
 * and React Native's `scrollResponderScrollNativeHandleToKeyboard` is never called
 * from within the framework. The field asks for the call on focus, with the node this
 * screen registered; `keyboard-avoidance.test.tsx` says what a test can and cannot see
 * about it.
 *
 * **And on Android that call was measured to be no help, on 2026-10-01.** On
 * `Medium_Phone_API_36` at `wm size 720x800`, debug build, the participation form's
 * step two: with the keyboard open the textarea's bottom edge is at y 608 of 800 while
 * the keyboard starts at y 275, and the accessibility tree holds no visible
 * `EditText` at all — with the call and without it, to the pixel. The geometry is
 * right (the field is where the layout puts it, y 374–608 before the focus) and the
 * call is made; React Native does not move it. So the escalation named above is no
 * longer a precaution for a layout that might demand it: it is what this needs, and
 * #93 is open until it lands. Nothing in this file claims the field is visible.
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
export function KeyboardAvoiding({ children, className, scrollerRef }: KeyboardAvoidingProps) {
  return (
    <scrollerContext.Provider value={scrollerRef ?? null}>
      <KeyboardAvoidingView behavior="padding" className={className}>
        {children}
      </KeyboardAvoidingView>
    </scrollerContext.Provider>
  );
}
