// `react-native`, as this host answers it.
//
// The build aliases the bare `react-native` specifier here rather than straight to
// `@gjsify/react-native`, and this file is the entire reason why: the app passes six
// prop families that the GTK layer refuses BY NAME, in 110 places, and every one of
// those refusals is correct. This is where each of them gets a deliberate answer,
// once, instead of 110 times.
//
// Everything else is re-exported untouched, including the refusing exports — so a
// name the GTK layer does not implement is a loud throw naming its tier rather than an
// undefined import. `Animated` used to be the example here; 0.46 implements the subset
// this app uses, and it now arrives through this file as the real thing.
//
// ## The six, what each one is, and what happens to it here
//
// **The table below is prose; `answered-props.ts` is the same thing as DATA, and it is
// the one a test can check.** Keep them in step — and note that the check has already
// paid for itself twice: ten of the rows here describe a refusal the layer has since
// answered itself, so their entries live in that file's `UPSTREAM_CAUGHT_UP` ledger
// rather than among the necessary ones. The four newest arrived with gjsify 0.48, which
// answers the accessibility props on every primitive this app uses — the test went red
// on the upgrade and named all four, which is the whole reason it exists.
// `test/prop-gate.test.ts` holds the split exact in both directions, because a
// redundant workaround reads exactly like a necessary one.
//
// | prop | uses | GTK's refusal | this host |
// |---|---|---|---|
// | `accessibilityLabel` | 45 | — | the layer's, since 0.48 |
// | `accessibilityState` | 5 | — | the layer's, since 0.48 |
// | `accessibilityRole` | 40 | — | the layer's, since 0.48 |
// | `accessible` | 0 | — | the layer's, since 0.48 |
// | `hitSlop` | 13 | GTK hit-tests the allocation and cannot grow it | DROPPED, and correctly |
// | `pointerEvents="box-none"` | 4 | `can-target` is one boolean for a widget AND its subtree | mapped to `auto` |
// | `trackColor`/`thumbColor` | 2 | Adwaita paints a switch from the theme accent | DROPPED |
// | `placeholderTextColor` | 4 | the placeholder is a CSS SUBNODE, not a widget property | DROPPED — Adwaita already dims it |
// | `contentContainerClassName` | 10 | `<ScrollView>` has a content box; `<FlatList>` has none | merged into the list's own `className` |
// | `autoFocus` | 2 | `grab_focus()` only works once the widget is MAPPED | IMPLEMENTED, from the ref on `map` |
// | `autoComplete`/`textContentType` | 4 | autofill hints; a GTK app has no autofill service to hint AT | DROPPED — `keyboardType` and `secureTextEntry` already carry the purpose |
// | `submitBehavior` | 1 | it asks a soft keyboard to stay up, and there is none | DROPPED — Enter fires `onSubmitEditing` here either way |
// | `accessibilityLiveRegion` | 2 | GTK4 has no live-region property; its counterpart is imperative | DROPPED — see below |
//
// One entry is not a prop at all: `TextInput` is a CLASS in React Native, so it names
// a type as well as a value, and its ref carries `focus()`. The layer declares it as a
// function and hands over the bare widget, so `useRef<TextInput>(null)` does not
// compile and `ref.current.focus()` is `undefined is not a function`. Both are
// answered at the export near the bottom of this file, which says why only `focus` is.
//
// `hitSlop` is the one worth being explicit about, because dropping a prop is
// normally the failure mode this whole layer exists to prevent. It is an 8 px
// expansion of a TOUCH target — a concession to a fingertip, on a platform whose
// pointer is a mouse with single-pixel precision. There is nothing to preserve. The
// refusal exists to make someone decide rather than to forbid; this is the decision,
// made once and written down.
//
// `accessibilityRole` was called the honest loss here, on the grounds that GTK's
// `accessible-role` is set at construction and a ref fires too late. **That is wrong,
// and it was measured wrong rather than argued away.** In `Gtk-4.0.gir` the property is
// `writable="1"` with no `construct-only`; the `construct="1"` on `Gtk.Widget`'s copy
// means it MAY be set at construction, not only then. `construct-only="1"` appears 69
// times in that file and not on this property, and a post-construction write was
// measured to stick on twelve widget classes — including under `GTK_A11Y=none`.
//
// So the 41 call sites are not lost to GTK. They are unimplemented, which is a
// different sentence, and the difference matters: a capability believed absent gets
// designed around, and this one was.
//
// It was not implemented HERE, deliberately: `@gjsify/react-native` was growing the
// whole accessibility surface as a route family — 40 role names, 33 mapped, 7 refused by
// name with advice — and a 41-site reimplementation in this shim would have been
// redundant the day that landed. **It landed**, in 0.48
// ([gjsify #1541](https://github.com/gjsify/gjsify/pull/1541)), and the wait was the
// right call: the layer answers `accessibilityLabel`, `accessibilityRole`,
// `accessibilityState`, `accessibilityHint` and `accessible` on every primitive this
// app uses, so this file now passes all five through and applies none of them.
//
// It is a DELETION that adds a capability, which is the shape worth noticing. The two
// this file implemented were reimplementations; the two it dropped were losses. 40
// `accessibilityRole` call sites — 20 `link`, 17 `button`, one `radio`, one
// `adjustable` — reach `Gtk.Accessible:accessible-role` for the first time, and the
// layer maps all four names. `accessibilityState.disabled` goes through too, which this
// file used to withhold on the grounds that `disabled` already sets `sensitive` and two
// sources for one fact is a bug: the layer measured that pair on GTK 4.22.4 and they do
// not collide — an explicit write leaves `sensitive` alone, and React Native treats the
// two as separate props an application sets together.
//
// What is left of this file's accessibility handling is `applyAutoFocus`, which is a
// different thing entirely: a moment rather than an attribute.
//
// What still holds from the old paragraph: a `Pressable` is announced as a button
// because it IS a real `Gtk.Button`, and the label lands, which is the part a
// screen-reader user needs most.
//
// `accessibilityLiveRegion` is the second loss, and the one to come back to. GTK4 has
// no property for it: the counterpart is `Gtk.Accessible.announce()` (4.14+), an
// imperative call that needs the MOMENT and the TEXT, and a declarative prop on a
// container carries neither. Both uses are on the door — the sign-in failure and the
// "we are checking" line — so a screen-reader user there is told nothing until the
// announcement is wired from the state change that causes it, which is app code
// rather than this file. Named here so it is a decision with a cost rather than a
// prop that quietly went missing.
//
// It is coming back sooner than from here: `@gjsify/react-native` is growing an answer
// on `Text`, through that same `Gtk.Accessible.announce()`. That is the right place for
// it — the layer holds the widget and sees the text change, and this file sees neither.
// When it lands, the row above becomes IMPLEMENTED and this paragraph goes with it.
// Check the door when it does, because both uses are there.

import {
  Children,
  createElement,
  Fragment,
  isValidElement,
  useCallback,
  useLayoutEffect,
  useRef,
  type ComponentType,
  type ReactElement,
  type ReactNode,
  type Ref,
} from 'react';

import type { TextInputHandle } from '@gjsify/react-native';
import {
  ActivityIndicator as BaseActivityIndicator,
  FlatList as BaseFlatList,
  Platform as BasePlatform,
  Pressable as BasePressable,
  ScrollView as BaseScrollView,
  Switch as BaseSwitch,
  Text as BaseText,
  TextInput as BaseTextInput,
  View as BaseView,
} from '@gjsify/react-native';

import { cssFontFamily, fontCutFor } from '../style/fonts.js';

// Everything this file does not touch — including every refusing export, which is what
// keeps an unimplemented name a named error rather than `undefined`.
export * from '@gjsify/react-native';

// ---------------------------------------------------------------------------
// The type surface
// ---------------------------------------------------------------------------
//
// `@gjsify/react-native` types its props against what GTK can express, which is right
// for the layer and wrong for a drop-in `react-native`: the application is written
// against React Native's types and imports several names the layer does not export.
// Widening them here is the same trade as the prop normalisation above — the shim is
// the compatibility layer, so the compatibility belongs in it.
//
// Every widening below is a prop this file ANSWERS (accessibility, `onPress` on a
// `Text`) or a type-only name that costs nothing at runtime. None of them promises
// behaviour that is not implemented.

/** Style objects. Type-only in React Native too, so there is nothing to implement. */
export type ViewStyle = Record<string, unknown>;
export type TextStyle = Record<string, unknown>;
export type ImageStyle = Record<string, unknown>;
export type StyleProp<T> = T | null | undefined | false | ReadonlyArray<StyleProp<T>>;
export type ColorValue = string;

/**
 * `onLayout`'s event.
 *
 * Exported as a TYPE so `components/player/ProgressBar.tsx` compiles; the PROP is
 * refused by the layer (GTK reports allocation through
 * `Gtk.Widget.vfunc_size_allocate`, a subclass override rather than a signal) and is
 * dropped by `normalize` above. The consequence is named where it bites: the progress
 * bar cannot measure itself, so tap-to-seek has no width to work from.
 */
export interface LayoutChangeEvent {
  nativeEvent: { layout: { x: number; y: number; width: number; height: number } };
}

/** The accessibility props this file implements, as a mixin. */
export interface AccessibilityProps {
  accessible?: boolean;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  accessibilityRole?: string;
  accessibilityState?: { selected?: boolean; checked?: boolean; disabled?: boolean };
  /** Used once, on the progress bar (`accessibilityRole="adjustable"`). */
  accessibilityValue?: { min?: number; max?: number; now?: number; text?: string };
  testID?: string;
}

export interface ViewProps extends AccessibilityProps {
  className?: string;
  style?: StyleProp<ViewStyle>;
  pointerEvents?: 'auto' | 'none' | 'box-none' | 'box-only';
  children?: ReactNode;
  ref?: Ref<unknown>;
  [key: string]: unknown;
}

export interface TextProps extends AccessibilityProps {
  className?: string;
  style?: StyleProp<TextStyle>;
  numberOfLines?: number;
  selectable?: boolean;
  /** Implemented by wrapping in a `Pressable`, which is what the layer's refusal advises. */
  onPress?: () => void;
  children?: ReactNode;
  [key: string]: unknown;
}

/**
 * What React Native hands a press handler.
 *
 * `locationX`/`locationY` are the coordinates WITHIN the pressed element, and this host
 * does not have them: `onPress` routes to `Gtk.Button::clicked`, which carries no
 * position (a coordinate would need a `Gtk.GestureClick` controller, which is what ADR
 * 0032 puts at tier P3 as its own project).
 *
 * They are typed as present-but-zero rather than omitted, because omitting them would
 * make `components/player/ProgressBar.tsx` a type error in a file this host may not
 * edit. The CONSEQUENCE is real and named here: tap-to-seek on the progress bar reads
 * 0, so a tap seeks to the start of the track instead of to the tapped position. The
 * transport buttons and the position display are unaffected.
 */
export interface GestureResponderEvent {
  nativeEvent: {
    locationX: number;
    locationY: number;
    pageX: number;
    pageY: number;
  };
}

export interface ScrollViewProps extends ViewProps {
  horizontal?: boolean;
  showsVerticalScrollIndicator?: boolean;
  showsHorizontalScrollIndicator?: boolean;
  contentContainerStyle?: StyleProp<ViewStyle>;
  contentContainerClassName?: string;
  keyboardShouldPersistTaps?: 'always' | 'never' | 'handled';
}

export interface ActivityIndicatorProps extends AccessibilityProps {
  className?: string;
  style?: StyleProp<ViewStyle>;
  animating?: boolean;
  color?: ColorValue;
  size?: 'small' | 'large' | number;
  [key: string]: unknown;
}

export interface TextInputProps extends AccessibilityProps {
  className?: string;
  style?: StyleProp<TextStyle>;
  value?: string;
  defaultValue?: string;
  placeholder?: string;
  placeholderTextColor?: ColorValue;
  multiline?: boolean;
  autoFocus?: boolean;
  maxLength?: number;
  keyboardType?: string;
  returnKeyType?: string;
  onChangeText?: (text: string) => void;
  onSubmitEditing?: () => void;
  [key: string]: unknown;
}

export interface SwitchProps extends AccessibilityProps {
  className?: string;
  style?: StyleProp<ViewStyle>;
  value?: boolean;
  onValueChange?: (value: boolean) => void;
  disabled?: boolean;
  trackColor?: { false?: ColorValue; true?: ColorValue };
  thumbColor?: ColorValue;
  ios_backgroundColor?: ColorValue;
  [key: string]: unknown;
}

/** `ListRenderItemInfo`, which two screens import for their `renderItem`. */
export interface ListRenderItemInfo<T> {
  item: T;
  index: number;
}

export interface FlatListProps extends AccessibilityProps {
  className?: string;
  style?: StyleProp<ViewStyle>;
  data?: readonly unknown[] | null;
  renderItem?: (info: ListRenderItemInfo<never>) => ReactNode;
  keyExtractor?: (item: never, index: number) => string;
  ListHeaderComponent?: ReactNode;
  ListFooterComponent?: ReactNode;
  /**
   * An element OR a component, which is React Native's own type for all three of
   * these and the one `gespeichert.tsx` relies on: it passes `ListEmptyComponent={Empty}`,
   * the function itself, so the notice is only built when the list has nothing in it.
   * A `ReactNode` here typed that call as an object that happens to be callable, and
   * the error names the symptom rather than the cause (`() => Element` is not a
   * `ReactNode`). The layer renders either, so only the type was ever too narrow.
   */
  ListEmptyComponent?: ReactNode | ComponentType;
  contentContainerClassName?: string;
  ListHeaderComponentClassName?: string;
  ListFooterComponentClassName?: string;
  [key: string]: unknown;
}

/**
 * NO INDEX SIGNATURE on this one, and that is load-bearing.
 *
 * `components/ui/Button.tsx` builds its own props as
 * `Omit<PressableProps, 'children' | 'style'> & { … }`. `Omit` is
 * `Pick<T, Exclude<keyof T, K>>`, and when `T` has a `[key: string]: unknown` member,
 * `keyof T` includes `string` — so `Exclude` cannot remove anything, `Pick` keeps only
 * the index signature, and every named prop collapses to `unknown`. The symptom was
 * `disabled` being `unknown` inside a component that had declared it a boolean.
 *
 * So this interface names what it accepts. That is the right shape for the one props
 * type the app derives from.
 */
export interface PressableProps extends AccessibilityProps {
  className?: string;
  style?: StyleProp<ViewStyle>;
  onPress?: (event: GestureResponderEvent) => void;
  disabled?: boolean;
  hitSlop?: number | { top?: number; bottom?: number; left?: number; right?: number };
  pointerEvents?: 'auto' | 'none' | 'box-none' | 'box-only';
  /** Accepted and dropped — see `LayoutChangeEvent` for what that costs. */
  onLayout?: (event: LayoutChangeEvent) => void;
  children?: ReactNode;
  ref?: Ref<unknown>;
  key?: string | number;
}

/** The props this host answers itself. Removed before anything reaches L2. */
interface NormalizedProps {
  accessibilityLabel?: string;
  accessibilityRole?: string;
  accessibilityHint?: string;
  accessible?: boolean;
  accessibilityState?: { selected?: boolean; checked?: boolean; disabled?: boolean };
  hitSlop?: number | { top?: number; bottom?: number; left?: number; right?: number };
  pointerEvents?: 'auto' | 'none' | 'box-none' | 'box-only';
  trackColor?: unknown;
  thumbColor?: unknown;
  onLayout?: (event: LayoutChangeEvent) => void;
  placeholderTextColor?: unknown;
  contentContainerClassName?: string;
  autoFocus?: boolean;
  ref?: Ref<unknown>;
  children?: ReactNode;
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// The style-object bridge
// ---------------------------------------------------------------------------
//
// `className` and `style={{…}}` go through the SAME partition (ADR 0032 section 4),
// which is right — the object literals carry the class families' own property names.
// But they are not the same VOCABULARY: the partition routes 22 paint properties and
// 24 layout ones, and React Native's style surface is wider. A property neither half
// routes is a named throw, deliberately, because that front end has no class name to
// check against.
//
// Six of the app's style properties fall outside it. Each is translated to what GTK
// actually expresses, or dropped with a reason — never passed through to throw.
//
// The routed set, for reference while reading the table below:
//   paint  backgroundColor color opacity border{,Top,Right,Bottom,Left}Width
//          border{,TopLeft,TopRight,BottomLeft,BottomRight}Radius borderColor
//          fontSize fontWeight fontFamily fontStyle letterSpacing lineHeight
//          textDecorationLine textTransform
//   layout margin{Top,Bottom,Start,End,Left,Right} padding{Top,Right,Bottom,Left}
//          flexDirection flexGrow alignItems justifyContent alignSelf
//          gap columnGap rowGap width height overflow display position top

const styleReported = new Set<string>();

/**
 * React Native's `style={[a, b, false && c]}` -> one object, later winning.
 *
 * Not optional plumbing: `components/ui/Typo.tsx` passes
 * `style={[typography(variant), style]}`, and an array spread as an object gives the
 * partition properties named `"0"` and `"1"` — which it correctly refuses by name
 * ('"0" — is not a property the style partition routes'), from inside a `<Text>`,
 * taking the screen with it. React Native flattens; so does this.
 */
function flattenStyle(style: unknown): Record<string, unknown> | undefined {
  if (style === null || style === undefined || style === false) return undefined;
  if (Array.isArray(style)) {
    const merged: Record<string, unknown> = {};
    for (const entry of style) {
      const flat = flattenStyle(entry);
      if (flat !== undefined) Object.assign(merged, flat);
    }
    return Object.keys(merged).length > 0 ? merged : undefined;
  }
  if (typeof style !== 'object') return undefined;
  return style as Record<string, unknown>;
}

function reportStyle(property: string, message: string): void {
  if (styleReported.has(property)) return;
  styleReported.add(property);
  console.warn(`[desktop] style property "${property}": ${message}`);
}

/**
 * A React Native style object -> one the partition routes.
 *
 * Runs on the merged style, so a value computed by `lib/theme/typography.ts` (which
 * returns `fontFamily`, `fontSize`, `lineHeight` and `letterSpacing` — all routed) is
 * unaffected.
 */
function normalizeStyle(style: unknown): Record<string, unknown> | undefined {
  if (style === null || style === undefined || typeof style !== 'object') return undefined;
  const source = flattenStyle(style);
  if (source === undefined) return undefined;
  const out: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(source)) {
    if (value === undefined || value === null) continue;

    switch (key) {
      // `flex: 1` is React Native's shorthand for "take the remaining main-axis
      // space", which is exactly `flexGrow: 1` and exactly GTK's `hexpand`/`vexpand`.
      // A factor other than 1 is refused by the partition itself (GTK has no flex
      // factor: a box gives every expanding child an equal share), so it is reported
      // rather than rounded.
      case 'flex':
        if (value === 1) out.flexGrow = 1;
        else
          reportStyle(
            'flex',
            `GTK has no flex factor, only "expands or does not". flex: ${String(value)} was dropped; use flex: 1, or gap-*.`,
          );
        break;

      // `width-request`/`height-request` ARE minimums in GTK — "at least this" is
      // the property's own meaning — so this is an exact translation rather than an
      // approximation.
      case 'minWidth':
        out.width = value;
        break;
      case 'minHeight':
        out.height = value;
        break;

      // `textAlignVertical` is where the text sits inside a taller input, and GTK
      // already puts it there. A single-line `Gtk.Entry` centres its line because it
      // has one; a multiline `Gtk.TextView` starts at the top because that is where
      // text starts. The app passes exactly those two values and exactly for those
      // two cases (`participate/FormField`: `'top'` for a textarea, `'center'`
      // otherwise), so both are the toolkit's own behaviour and there is nothing to
      // carry.
      //
      // DROPPED RATHER THAN LEFT TO REFUSE, and this one cost the most of any entry
      // in this file. The partition throws `UnknownUtilityError` on it, the app's
      // error boundary caught that, and the boundary's own recovery screen then
      // refused as well — so the log showed the SECOND refusal and the real message
      // never appeared. `participate/FormField` read as a layout fault for hours.
      // See `app/_layout.tsx`, where the wrapper that unmasks it is, and the README.
      case 'textAlignVertical':
        reportStyle(
          'textAlignVertical',
          'GTK puts text where this asks already: a single-line Gtk.Entry centres its one line, a multiline Gtk.TextView starts at the top. Dropped, because both values the app passes are the toolkit default.',
        );
        break;

      // The physical pair. `marginHorizontal` has no single GTK property, and the
      // partition refuses a physical and a logical margin together, so it becomes the
      // two physical edges.
      //
      // A NEGATIVE VALUE IS DROPPED, and the reason is measured rather than assumed.
      // The first version of this branch passed it through on the theory that GTK
      // margins are unsigned and would clamp to 0. They are not: `margin-left` is a
      // plain int, the negative value reaches the measurement, and GTK reports
      //
      //   Gtk-WARNING **: GtkBox (box) reported min width -48, but sizes must be >= 0
      //
      // four times per render — a broken measurement rather than a clamp. So it is
      // dropped here, which IS the clamp that GTK does not do.
      //
      // The visible loss is real: `components/ui/Bleed.tsx` is
      // `marginHorizontal: -24`, whose whole job is to let a Rail run to the window
      // edge past the screen's `px-m`. On this host a Rail stops at the screen
      // padding instead. Reported once so it is attributable, because "the carousel
      // is inset by 24px" is otherwise a mysterious design difference.
      case 'marginHorizontal':
        if (typeof value === 'number' && value < 0) {
          reportStyle(
            'marginHorizontal',
            `GTK does not clamp a negative margin — it measures with it and reports "min width ${value * 2}, but sizes must be >= 0" — so the negative bleed (${value}px) was dropped. A Rail stops at the screen padding instead of running to the window edge.`,
          );
          break;
        }
        out.marginLeft = value;
        out.marginRight = value;
        break;
      case 'marginVertical':
        out.marginTop = value;
        out.marginBottom = value;
        break;
      case 'paddingHorizontal':
        out.paddingLeft = value;
        out.paddingRight = value;
        break;
      case 'paddingVertical':
        out.paddingTop = value;
        out.paddingBottom = value;
        break;

      // `border: 0` / `border: 'none'` is a DOM spelling that reached a couple of
      // shared files; the partition's name for it is `borderWidth`.
      case 'border':
        out.borderWidth = value;
        break;

      // GTK has no aspect-ratio property on a box, and it does not need one: the
      // widget for this is `Gtk.AspectFrame`, which `wrap` puts AROUND the element
      // (see `aspectRatioOf`). Consumed here so it does not reach the partition as an
      // unroutable property, and NOT reported, because it is answered.
      //
      // It used to be dropped with "used once, on the video stage, which is a
      // placeholder here anyway". That was wrong twice over: `Thumbnail` frames every
      // podcast cover and every video still with one, so it is on 97 image widgets in
      // this application, and dropping it left them with no height at all — a 116px
      // cover came out 99x31.
      case 'aspectRatio':
        break;

      // `flexShrink` IS ANSWERED HERE TOO, by `usePinnedWidth`, so it is consumed
      // rather than reported. GTK has no shrink factor and the partition refuses the
      // name outright — measured, `UnknownUtilityError: "flexShrink" — is not a
      // property the style partition routes`, which React caught as an unhandled
      // error and left the window empty. React Native's default is 0, so what a
      // consumer writing it out asks for is "do not squeeze me below my content";
      // that is a width request on this host, and only a `<Text>` gets one.
      case 'flexShrink':
        break;

      // The app names one loaded family per CUT — `Merriweather_700Bold` — because
      // Android ignores `fontWeight` on a custom font, so `lib/theme/typography.ts`
      // emits `fontFamily` and no `fontWeight` at all. Pango has never heard of those
      // names: a registered `.ttf` declares its own family and its own weight.
      //
      // Passing the name through is the ONE case in this switch where doing nothing is
      // worse than dropping. Every other unroutable property either throws in the
      // partition or is reported here; an unknown font family does neither — Pango
      // substitutes the default sans, reports nothing, and the app renders correctly in
      // the wrong typeface. `src/style/fonts.ts` carries the split, read off the files
      // with `fc-query` rather than derived from their names.
      case 'fontFamily': {
        const cut = typeof value === 'string' ? fontCutFor(value) : undefined;
        if (cut === undefined) {
          reportStyle(
            'fontFamily',
            `"${String(value)}" is not one of this app's cuts (src/style/fonts.ts), so Pango may substitute it silently. Passed through unchanged.`,
          );
          out[key] = value;
          break;
        }
        // Quoted where GTK needs it — see `cssFontFamily`, which carries the reason and
        // the trigger that removes it (gjsify #1539).
        out.fontFamily = cssFontFamily(cut.family);
        // The name is the app's canonical carrier of the weight, so it wins over an
        // explicit `fontWeight`: a style asking for `Merriweather_700Bold` at weight 400
        // is a contradiction, and the family name is the half the design system keeps.
        out.fontWeight = String(cut.weight);
        break;
      }

      // `top`, `right`, `bottom` and `left` are all routed (28 layout properties, read
      // out of the installed build rather than guessed — an earlier version of this
      // file dropped three of them on the belief that only `top` was there, which
      // would have silently unpinned every absolutely positioned child). They need no
      // branch: the default case passes them through.

      default:
        // Percentages are refused by the partition by name ("GTK has no percentage
        // size: a widget requests a MINIMUM in pixels or expands to fill"), and the
        // message is right — but it arrives as a throw that takes down the screen.
        // `w-full`/`h-full` are the class spellings that DO have an exact meaning.
        if (typeof value === 'string' && value.endsWith('%')) {
          reportStyle(
            `${key}: %`,
            `GTK has no percentage size. "${value}" was dropped; use the w-full / h-full classes, which map to hexpand/vexpand.`,
          );
          break;
        }
        out[key] = value;
    }
  }

  return Object.keys(out).length > 0 ? out : undefined;
}

/**
 * `autoFocus` — `Gtk.Widget.grab_focus()`, at the moment it actually works.
 *
 * L2 refuses the prop and says why: focus is an imperative call, and it only takes
 * once the widget is MAPPED, which is a moment a declarative layer does not own. The
 * refusal also names the remedy — "call it from a ref in an effect" — and a ref is
 * exactly what this file already has for `accessibilityLabel`, so the answer costs one
 * helper rather than a change one layer down.
 *
 * Both cases are needed, not just the deferred one: a widget can already be mapped by
 * the time the ref fires (a search field on a screen that is being re-entered), and
 * connecting to `map` there would wait for a signal that has already passed.
 *
 * The handler disconnects itself. `autoFocus` means "when this appears", once — a
 * field that stole the focus back every time its window was re-shown would be a
 * different and worse behaviour.
 *
 * SYNCHRONOUS, and it imports nothing. It only calls methods on a widget it was
 * handed, so the structural type below is the whole dependency. The first version
 * copied a `Gtk` import from the accessibility helper beside it and bound a namespace
 * it used only in a type position, which the linter caught.
 */
/**
 * The `aspectRatio` an element authored, as a positive number, or `undefined`.
 *
 * Read off the RAW props: `normalizeStyle` consumes the property on the way past, and
 * by the time `wrap` has a `passthrough` it is gone. React Native's own rule is
 * width ÷ height, which is `Gtk.AspectFrame:ratio` exactly.
 */
function aspectRatioOf(style: unknown): number | undefined {
  const flat = flattenStyle(style);
  const value = flat?.aspectRatio;
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : undefined;
}

function applyAutoFocus(widget: unknown, autoFocus: boolean | undefined): void {
  if (widget === null || widget === undefined || autoFocus !== true) return;

  const target = widget as {
    get_mapped(): boolean;
    grab_focus(): boolean;
    connect(signal: string, handler: () => void): number;
    disconnect(handler: number): void;
  };

  try {
    if (target.get_mapped()) {
      target.grab_focus();
      return;
    }
    let handler = 0;
    handler = target.connect('map', () => {
      target.disconnect(handler);
      target.grab_focus();
    });
  } catch (error) {
    // Reported rather than swallowed: a field that silently does not take focus is
    // the failure this layer refuses props to prevent.
    console.warn('[desktop] autoFocus: could not focus the widget:', error);
  }
}

/**
 * The widget behind a ref, whatever the layer chose to hand back.
 *
 * `createHandle` in @gjsify/react-native gives an imperative handle to the primitives
 * React Native documents one for and the bare `Gtk.Widget` to everything else, so a
 * ref is one of two shapes. `.widget` is the layer's own way back out — its comment
 * calls it "the way out of every refusal" — and reading it is how this file stays
 * indifferent to which primitives grow handles next.
 */
function widgetOf(instance: unknown): unknown {
  if (instance === null || instance === undefined) return instance;
  const handle = instance as { widget?: unknown };
  return typeof handle === 'object' && 'widget' in handle ? handle.widget : instance;
}

// ---------------------------------------------------------------------------
// The className bridge: the utilities GTK refuses, answered structurally
// ---------------------------------------------------------------------------

/**
 * `justify-between` -> a spacer child between every pair.
 *
 * The refusal is a good one and its message names the fix: "GTK's box has no
 * main-axis justification ... Spell the distribution with a spacer child (`flex-1`)".
 * ADR 0032 section 6 adds why a property cannot answer it — the mapping is
 * `Gtk.CenterBox`, a different WIDGET, and WHICH widget depends on the child count,
 * which the property resolver has no children to count.
 *
 * This layer does have the children, so it does the thing the message asks for: strip
 * the utility and interleave `<View className="flex-1" />` between the children. That
 * is not an approximation of `space-between` — it is what `space-between` IS: equal
 * expanding gaps between items, with none at the ends.
 *
 * Nine call sites, every one of them a header or a row with a label on the left and an
 * action on the right.
 */
const SPACER_KEY = '__gjsify_between_spacer__';
const CENTRE_KEY = '__gjsify_centre_spacer__';

/**
 * `shrink` -> stripped, loudly.
 *
 * A genuine GTK refusal rather than a gap in the vocabulary, and the layer's message
 * says why: GTK expresses main-axis growth as the boolean `hexpand`/`vexpand`, so
 * there is no growth factor, no shrink factor and no flex basis to carry. `flex-1` is
 * the only spelling with a GTK meaning.
 *
 * One call site: the label/value `Row` in the profile's membership card, where the
 * value carries `shrink text-right` so a long value wraps instead of pushing the
 * label out. The visible consequence here is that it does not wrap — a long value
 * takes its natural width and the row grows.
 *
 * Stripped rather than translated to `flex-1`, which is the tempting move and would
 * be wrong: `flex-1` is hexpand, which makes the value take the REMAINING space, and
 * on a short value that changes where the text sits. Doing nothing leaves the row as
 * GTK would lay it out; guessing would leave it subtly different on every row.
 *
 * `flex-wrap` was stripped here too until @gjsify/react-native 0.46, which maps it to
 * a wrapping widget — the note said to remove the branch on the next bump, and this is
 * it. The chip rows on `onboarding` and `ArticleRow`'s metadata line flow onto a
 * second line now instead of running off the edge.
 */
function bridgeClassName(className: unknown): {
  className?: string;
  between: boolean;
  centre: boolean;
} {
  if (typeof className !== 'string' || className === '') {
    return { className: className as string | undefined, between: false, centre: false };
  }
  let between = false;
  let centre = false;
  const kept: string[] = [];
  for (const token of className.split(/\s+/)) {
    if (token === '') continue;
    if (token === 'justify-between') {
      between = true;
      continue;
    }
    if (token === 'justify-center') {
      // KEPT as well as reported. The layer maps `justify-content` onto the BOX's own
      // alignment, which is a documented approximation and is what positions a
      // content-sized box inside its parent today; taking it away would move every one
      // of those. The spacers are additive, and a box with no slack allocates them
      // nothing.
      centre = true;
      kept.push(token);
      continue;
    }
    if (token === 'shrink') {
      reportStyle(
        'shrink',
        'GTK expresses main-axis growth as the boolean hexpand/vexpand, so there is no shrink factor to carry. Stripped: a long value takes its natural width instead of wrapping.',
      );
      continue;
    }
    kept.push(token);
  }
  return { className: kept.length > 0 ? kept.join(' ') : undefined, between, centre };
}

/**
 * Strip what this host answers itself, and translate what it can.
 *
 * Returns the props L2 may see. The accessibility values are handed back separately
 * because they are applied to the WIDGET rather than passed as props.
 */
function normalize(
  props: NormalizedProps,
  displayName: string,
): {
  passthrough: Record<string, unknown>;
  accessibility: NormalizedProps;
} {
  const {
    hitSlop: _hitSlop,
    trackColor: _trackColor,
    thumbColor: _thumbColor,
    onLayout: _onLayout,
    // The placeholder's colour lives on a CSS SUBNODE (`entry > text > placeholder`),
    // not on a widget property, so there is nothing for L2 to route it to and it
    // refuses by name. Dropping it is the right answer here rather than a concession:
    // every use passes `grey-500`, which is what Adwaita already paints a placeholder,
    // so the widget without the prop looks like the design with it.
    placeholderTextColor: _placeholderTextColor,
    // The two autofill hints, and they are the same hint twice: `autoComplete` is
    // React Native's cross-platform spelling, `textContentType` the iOS one. Both name
    // a field to a CREDENTIAL STORE, and a GTK application has none to name it to —
    // there is no autofill service on this platform, so there is nothing to route them
    // to and nothing lost by dropping them. What they also carry, the purpose of the
    // field, is carried again by props L2 does answer: the door passes
    // `keyboardType="email-address"` beside `autoComplete="email"`, and
    // `secureTextEntry` beside `autoComplete="password"`.
    autoComplete: _autoComplete,
    textContentType: _textContentType,
    // `submitBehavior="submit"` means "fire onSubmitEditing and leave the keyboard
    // up". There is no soft keyboard to leave up, and Enter in a `Gtk.Entry` already
    // emits `activate` without taking focus anywhere — so the behaviour it asks for is
    // what this host does anyway.
    submitBehavior: _submitBehavior,
    // No GTK property expresses it; see the note in this file's header for what the
    // counterpart is and what dropping it costs on the door.
    accessibilityLiveRegion: _accessibilityLiveRegion,
    // `accessibilityValue={{ min, max, now }}` is the position of a slider, and
    // `player/ProgressBar` is the one place this app passes it. The layer refuses it
    // by name and answers no accessibility VALUE at all — `accessibility.ts` routes
    // role, label, state and hint, and nothing that carries a number.
    //
    // DROPPED, and this is a real accessibility loss rather than a concession worth
    // shrugging at: GTK does have somewhere to put it, `Gtk.Accessible` publishes
    // `VALUE_NOW`/`VALUE_MIN`/`VALUE_MAX` on the AT-SPI side, so the gap is in the
    // layer and not in the toolkit. Until it routes them, Orca reads this bar as a
    // control with no position. Named here and in README beside the two other
    // accessibility losses, because a screen reader gap that nobody wrote down is a
    // gap nobody fixes.
    accessibilityValue: _accessibilityValue,
    autoFocus,
    contentContainerClassName,
    pointerEvents,
    ...rest
  } = props;

  const passthrough: Record<string, unknown> = { ...rest };

  // `multiline`, DROPPED, and it is the one entry here whose loss you can see.
  //
  // `<TextInput multiline>` is a `Gtk.TextView`, which keeps its content in a
  // `Gtk.TextBuffer` rather than in a property — the layer measured 61 properties and
  // no `text` — so it refuses BOTH `value` and `onChangeText` on that widget. Dropping
  // those two instead would leave a box that accepts typing and reports none of it,
  // which is the silent-failure shape this whole file exists to refuse.
  //
  // So the flag goes and the widget stays a `Gtk.Entry`, which has the property and
  // the signal. `participate/FormField`'s textarea is therefore ONE LINE TALL here,
  // scrolling sideways instead of wrapping, and its `minHeight: 96` still gives it the
  // height the design asks for. Typing works, the store updates, nothing is lost
  // except the wrap.
  //
  // NOT COVERABLE BY `test/prop-gate.test.ts`, and that is worth knowing: the refusal
  // depends on a SIBLING prop, so `explainProp('TextInput', 'value')` answers `null`
  // and a per-prop table cannot express the pair. The sweep is the only oracle.
  // A buffer binding in the layer is what would make this unnecessary.
  if (passthrough.multiline === true) {
    reportStyle(
      'TextInput.multiline',
      'a Gtk.TextView holds its content in a Gtk.TextBuffer rather than a property, so it answers neither value nor onChangeText. Dropped, which leaves a one-line Gtk.Entry that does answer both.',
    );
    delete passthrough.multiline;
  }

  // Every style-SHAPED prop, not just `style`. A `ScrollView`'s content box is a
  // second styleable node, and `components/ui/Rail.tsx` reaches it with
  // `contentContainerStyle={{ paddingHorizontal, gap }}` — where `paddingHorizontal`
  // is exactly as unroutable as it is on `style`, and arrives from `resolveNode`
  // rather than from `partition`, which is the same refusal one node over.
  for (const key of ['style', 'contentContainerStyle', 'imageStyle'] as const) {
    if (!(key in rest)) continue;
    const normalized = normalizeStyle(rest[key]);
    if (normalized === undefined) delete passthrough[key];
    else passthrough[key] = normalized;
  }

  // `box-none` and `box-only` split hit-testing between a widget and its subtree,
  // which `can-target` — one boolean for both — cannot express, so L2 refuses them
  // by name. Every use in this app is an overlay container whose intent is "let taps
  // reach what is under/inside me", and the container is a `Gtk.Box`, which has no
  // click handler of its own to steal one. `auto` is therefore the accurate answer
  // rather than the nearest one.
  if (pointerEvents !== undefined) {
    passthrough.pointerEvents = pointerEvents === 'none' ? 'none' : 'auto';
  }

  // `contentContainerClassName` is answered by L2 on a `ScrollView`, whose content box
  // is a real `Gtk.Box`, and refused on a `FlatList`, whose rows are built by a
  // `Gtk.ListView` that owns the space between them — there is no such box to style.
  //
  // Dropping it would lose visible layout: every use in this app is padding
  // (`px-m pt-m pb-2xl`), and a list whose last row sits under the window edge looks
  // broken rather than unstyled. So it is merged into the list's OWN class list, which
  // is the closest true thing: React Native's content container holds the header, the
  // rows and the footer, and so does the box this lands on. The one difference is worth
  // stating — padding there does not scroll with the content, it frames it — and for
  // the four sides this app asks for, that is the same picture.
  if (contentContainerClassName !== undefined) {
    if (displayName === 'FlatList') {
      const own = passthrough.className;
      passthrough.className =
        typeof own === 'string' && own.length > 0
          ? `${own} ${contentContainerClassName}`
          : contentContainerClassName;
    } else {
      passthrough.contentContainerClassName = contentContainerClassName;
    }
  }

  return { passthrough, accessibility: { autoFocus } };
}

/**
 * Utilities that describe how an element arranges its CHILDREN, as opposed to how it
 * sits in its own parent or how it is painted.
 *
 * The distinction matters for exactly one primitive and it is a structural difference
 * rather than a gap. On React Native a `Pressable` IS a `View`: it lays out its
 * children. On GTK it is a `Gtk.Button`, which takes ONE child and has no
 * `orientation` at all — so `<Pressable className="flex-row items-center">` reaches
 * the host as a property a button does not install:
 *
 *   <GtkButton> has no property "orientation"
 *
 * The refusal is right, and the shape a GTK author would write is
 * `Gtk.Button > Gtk.Box > children`. So these utilities move to an inner `<View>` and
 * everything else stays on the button, where it belongs: margins position the button
 * in its row, padding and background paint the button itself, `flex-1` expands the
 * button in ITS parent, and `active:opacity-70` is the button's own pressed state.
 */
const CHILD_ARRANGEMENT = /^(flex-(row|col)(-reverse)?|items-\S+|justify-\S+|gap(-[xy])?-\S+)$/;

function splitArrangement(className: string | undefined): { outer?: string; inner?: string } {
  if (className === undefined || className === '') return {};
  const outer: string[] = [];
  const inner: string[] = [];
  for (const token of className.split(/\s+/)) {
    if (token === '') continue;
    (CHILD_ARRANGEMENT.test(token) ? inner : outer).push(token);
  }
  return {
    outer: outer.length > 0 ? outer.join(' ') : undefined,
    inner: inner.length > 0 ? inner.join(' ') : undefined,
  };
}

/**
 * Flatten `<>…</>` out of a child list.
 *
 * THIS IS A WORKAROUND FOR A REAL gjsify DEFECT, and it is worth stating precisely
 * because the symptom points somewhere else entirely.
 *
 * A `View` becomes a `Gtk.Overlay` only if it can SEE that one of its children is
 * absolutely positioned. `childFacts` in @gjsify/react-native asks each child element
 * for its own props (`isAbsoluteChild` -> `declaresAbsolute(child.props)`), and a
 * `React.Fragment` answers for itself: it has no `className`, so it is not absolute,
 * and the fragment's CONTENTS are never examined.
 *
 * So a parent handed `<>{a}{absolute}</>` stays a `Gtk.Box`, and the failure surfaces
 * one level down, on the child, as
 *
 *   <View> absolute — positions this element on top of its parent, so the PARENT has
 *   to be a `Gtk.Overlay` — and it is not ... the parent here is either not a `View`
 *   (a `ScrollView`, a `Pressable`, a `Text`) or the element is a root
 *
 * — a message that lists three causes, none of which is the actual one. Measured on
 * `components/media/MediaCard.tsx`, which passes `overlay={<>…</>}` to
 * `components/ui/Thumbnail.tsx`; that is every video thumbnail on Home and in the
 * Mediathek, so it is the whole screen rather than an edge case.
 *
 * Flattening here restores the parent's view of its own children. It is a consumer-side
 * shim for a layer defect, so:
 *
 * fixed upstream in gjsify: childFacts should flatten Fragments before counting
 * absolute children — remove this function and its two call sites on the next bump.
 */
function flattenFragments(children: ReactNode): ReactNode {
  const list = Children.toArray(children);
  if (!list.some((child) => isValidElement(child) && child.type === Fragment)) return children;
  const out: ReactNode[] = [];
  for (const child of list) {
    if (isValidElement(child) && child.type === Fragment) {
      const inner = (child.props as { children?: ReactNode }).children;
      for (const nested of Children.toArray(flattenFragments(inner))) out.push(nested);
    } else {
      out.push(child);
    }
  }
  return out;
}

/**
 * React Native left-aligns `<Text>`; a `Gtk.Label` centres it.
 *
 * A SYSTEMATIC visual defect, and the kind that is easy to look straight past: nothing
 * errors, every screen renders, and the whole app is subtly wrong. `Gtk.Label:xalign`
 * defaults to 0.5, so every paragraph, byline and teaser in the app came out centred —
 * visible on Home (the hero teaser and its byline) and on Spotlight (every item's
 * text). React Native's default is `textAlign: 'left'`.
 *
 * `textAlign` IS a routed layout property, so the fix is to supply the default React
 * Native would have: left, unless the author said otherwise. Both spellings count as
 * saying otherwise — the `text-center` / `text-right` / `text-justify` utilities and an
 * explicit `textAlign` in a style object — so `app/artikel.tsx`'s centred error message
 * and `components/ui/Typo`'s callers keep working exactly as written.
 *
 * fixed upstream in gjsify: Gtk.Label should default to xalign 0 so the React Native
 * default holds — the primitive already sets `wrap: true` for the same reason (React
 * Native wraps by default and a Gtk.Label does not), so this is the same argument for a
 * second property. Remove this function and its call site on the next bump.
 */
const AUTHOR_SET_ALIGNMENT = /(^|\s)text-(center|right|left|justify)(\s|$)/;

function withDefaultTextAlign(
  className: unknown,
  style: Record<string, unknown> | undefined,
): Record<string, unknown> | undefined {
  if (style !== undefined && 'textAlign' in style) return style;
  if (typeof className === 'string' && AUTHOR_SET_ALIGNMENT.test(className)) return style;
  return { ...style, textAlign: 'left' };
}

/**
 * Whether any child is an ELEMENT rather than text.
 *
 * The gate on giving a `Pressable` an inner box: a string child belongs in
 * `Gtk.Button:label` through the primitive's own text sink, and a `Gtk.Box` has no
 * text sink to receive it.
 */
function hasElementChild(children: unknown): boolean {
  return Children.toArray(children as ReactNode).some(
    (child) => typeof child === 'object' && child !== null,
  );
}

/**
 * `[a, b]` -> `[a, spacer, b]`. The structural half of `justify-between`.
 *
 * `Children.toArray` rather than the raw value, because a single child is not an
 * array and a `{condition ? x : null}` branch contributes a null that must not get a
 * spacer of its own — `toArray` drops nulls and assigns stable keys.
 */
function interleaveSpacers(children: unknown): ReactNode {
  const list = Children.toArray(children as ReactNode).filter(Boolean);
  if (list.length < 2) return children as ReactNode;
  const out: ReactNode[] = [];
  list.forEach((child, index) => {
    if (index > 0) {
      out.push(
        createElement(BaseView as never, { key: `${SPACER_KEY}${index}`, className: 'flex-1' }),
      );
    }
    out.push(child);
  });
  return out;
}

/**
 * `[a, b]` -> `[spacer, a, b, spacer]`. The structural half of `justify-center`.
 *
 * THE SAME ANSWER AS `justify-between`, AND FOR THE SAME REASON. GTK's box has no
 * main-axis distribution, the layer's own refusal message says to spell one with a
 * `flex-1` child, and `justify-content: center` IS equal expanding space at the two
 * ENDS with none between — where `space-between` is the gaps with none at the ends.
 *
 * WHAT THIS REPLACED, kept because it is the record of two wrong answers. First
 * `vexpand` on the icon itself, in `shims/vector-icons.tsx`: it does centre, and it is
 * set on every icon this app draws, so an expanding child in a vertical box took all
 * the slack and collapsed the video stage to `470x0` with the header drawn inside it.
 * Reverted within the hour. Then `homogeneous` on the box, decided from its own props:
 * that centred a lone child correctly — measured, a 22x22 icon in a 52x52 badge went
 * from y=0 to y=15 — and mangled a box with two, because homogeneous means EQUAL SHARES
 * and not centre. `app/atlas.tsx` is that box, and measured in the running app its
 * caption was squeezed to its minimum width, 103 px, and wrapped over three lines
 * instead of sitting on one at 162.
 *
 * A child count then fixed the caption and left the pair at the TOP of a 142 px box —
 * which the photograph showed and the measurement had not, because the guard removed a
 * wrong distribution without supplying the right one. Spacers supply it, for one child
 * and for several, with no property to unset and nothing to decide from a class list.
 *
 * INERT WHERE THERE IS NO SLACK, which is what makes it safe on every `justify-center`
 * box rather than only the ones with a fixed size: an expanding child of a
 * content-sized box is allocated nothing, so a box that hugs its content lays out
 * exactly as it did before.
 */
function padWithSpacers(children: unknown): ReactNode {
  const list = Children.toArray(children as ReactNode).filter(Boolean);
  if (list.length === 0) return children as ReactNode;
  const spacer = (side: string): ReactNode =>
    createElement(BaseView as never, { key: `${CENTRE_KEY}${side}`, className: 'flex-1' });
  return [spacer('start'), ...list, spacer('end')];
}

/**
 * Set a caller's ref, whichever of the two shapes it has.
 *
 * Both appear in this app — `expo-image` passes a callback, `LoginGate` passes the
 * object from `useRef` — and a wrapper that handled only one would drop the other
 * silently, which reads as a widget that never mounted.
 */
function assignRef<T>(ref: Ref<T> | undefined, value: T): void {
  if (typeof ref === 'function') ref(value);
  else if (ref !== null && ref !== undefined) (ref as { current: T }).current = value;
}

/**
 * One wrapper shape for every primitive that can receive these props.
 *
 * The ref is merged rather than replaced: `WebView` and `expo-image` both take a ref
 * of their own through these components, and swallowing it would break them in a way
 * that looks like the widget never mounting.
 */
// `P extends object`, not a shape. The exported components declare CONCRETE props
// (`PressableProps` and friends), and those deliberately carry no `[key: string]:
// unknown` — an index signature there collapses `Omit<PressableProps, …>` to
// `unknown` in `components/ui/Button.tsx`. So the constraint cannot demand one, and
// `normalize` takes the internal shape by cast: it reads named props and spreads the
// rest, which is true of any props object.
function wrap<P extends object>(
  Base: unknown,
  displayName: string,
  /** True for a primitive that is NOT a box, so child-arrangement utilities need an inner one. */
  isButton = false,
  /** True for a primitive backed by a `Gtk.Label`, which needs React Native's alignment default. */
  isLabel = false,
) {
  // The return type is DECLARED, not inferred. `createElement(Base as never, …)`
  // resolves to an overload returning `never`, which makes every one of these
  // components "not a valid JSX element type" the moment anything else renders it —
  // `VideoView` in `app/video.tsx` was where that surfaced.
  const Wrapped = (props: P): ReactElement => {
    const aspect = aspectRatioOf((props as { style?: unknown }).style);
    const { passthrough, accessibility } = normalize(props as NormalizedProps, displayName);

    if ('children' in passthrough) {
      passthrough.children = flattenFragments(passthrough.children as ReactNode);
    }

    if (isLabel) {
      const aligned = withDefaultTextAlign(
        passthrough.className,
        passthrough.style as Record<string, unknown> | undefined,
      );
      if (aligned !== undefined) passthrough.style = aligned;
    }

    const bridged = bridgeClassName(passthrough.className);
    if (bridged.className === undefined) delete passthrough.className;
    else passthrough.className = bridged.className;
    if (bridged.between) {
      passthrough.children = interleaveSpacers(passthrough.children);
    } else if (bridged.centre) {
      // `else`, because the two are mutually exclusive in flexbox: a class list
      // carrying both is a mistake in the markup, not a shape to compose.
      passthrough.children = padWithSpacers(passthrough.children);
    }

    if (isButton && hasElementChild(passthrough.children)) {
      // ALWAYS an inner box when there are element children, not only when the class
      // list carries an arrangement utility — and the second half of that rule was
      // learned from a second refusal, not designed in:
      //
      //   <View> absolute — positions this element on top of its parent, so the
      //   PARENT has to be a `Gtk.Overlay` — and it is not.
      //
      // A `View` becomes a `Gtk.Overlay` as soon as one of its children is absolutely
      // positioned, and a `Gtk.Button` never does. So a `Pressable` whose child is
      // `absolute` (`components/ui/Thumbnail.tsx`' centred overlay, inside a card that
      // is a `Pressable`) needs a real box between the two whether or not the button
      // itself was asked to arrange anything.
      //
      // Gated on ELEMENT children because `Pressable`'s text sink is the button's own
      // `label`: a bare string child is meant to become `Gtk.Button:label`, and a
      // `Gtk.Box` has no text sink at all, so wrapping one would turn a working label
      // into "text under this widget is an ERROR".
      const split = splitArrangement(passthrough.className as string | undefined);
      if (split.outer === undefined) delete passthrough.className;
      else passthrough.className = split.outer;
      passthrough.children = createElement(
        BaseView as never,
        (split.inner === undefined ? {} : { className: split.inner }) as never,
        passthrough.children as never,
      );
    }
    // Read off the internal shape rather than `P`: not every exported props type
    // declares `ref`, and the ones that do not still forward one at runtime.
    const userRef = (props as { ref?: Ref<unknown> }).ref;
    const widget = useRef<unknown>(null);

    // Destructured OUT of `accessibility` before the hook, so the dependency list holds
    // the VALUE rather than the object that carries it. `normalize` builds that object
    // fresh on every render, so depending on it would rebuild the ref callback every
    // time — which makes React detach and re-attach the ref on every commit.
    const { autoFocus } = accessibility;

    const mergedRef = useCallback(
      (instance: unknown) => {
        widget.current = instance;
        // A ref does not always carry the widget: a `TextInput` receives a
        // `TextInputHandle`, which answers focus/blur/clear and keeps the widget on
        // `.widget`. Everything else still hands the widget itself, and `grab_focus`
        // is about the WIDGET, so unwrap first.
        //
        // That unwrap is not hypothetical tidiness — it is the bug that shipped. The
        // handle arrived in 0.46 while this file was still applying accessibility to
        // whatever the ref held, and the door's two fields, the only `TextInput`s in
        // the app, lost their screen-reader labels behind a warning that named the
        // symptom rather than the cause. Those calls have gone to the layer; the
        // unwrap is what `autoFocus` still needs.
        applyAutoFocus(widgetOf(instance), autoFocus as boolean | undefined);
        assignRef(userRef, instance);
      },
      [userRef, autoFocus],
    );

    const element = createElement(Base as never, { ...passthrough, ref: mergedRef } as never);
    if (aspect === undefined) return element;
    /**
     * `aspectRatio` is a WIDGET here, not a property, so the element goes inside one.
     *
     * `Gtk.AspectFrame` with `obey-child: false` is a height-for-width request and not
     * merely an alignment — MEASURED on GTK 4.22.4, `measure(VERTICAL, 116)` answers
     * 116 at ratio 1 and 65 at 16/9, with a `Gtk.Picture` inside as with a box. That
     * is React Native's rule, width ÷ height, with nothing to translate.
     *
     * Everything else stays on the INNER element: the ratio is the only thing the
     * frame is for, and a class list split across two widgets would put the rounding
     * and the background on one and the margins on the other, which is the kind of
     * difference nobody finds later. `hexpand` is the frame's own, because a frame
     * that does not take the width it is offered computes its height from nothing.
     *
     * BELONGS UPSTREAM. This is React Native semantics against a GTK widget, with no
     * part of it specific to this application; the reason it is here is that
     * `@gjsify/react-native` routes `aspectRatio` nowhere yet, and a wrapper node
     * around a primitive is a change to how plans are shaped rather than a property
     * mapping. The descriptor it needs is upstream already (gjsify #1598).
     */
    return createElement(
      'gtk-aspect-frame' as never,
      { ratio: aspect, obeyChild: false, hexpand: true } as never,
      element,
    );
  };
  Wrapped.displayName = displayName;
  return Wrapped;
}

/**
 * `Platform`, with `OS` widened to the values the application ASKS about.
 *
 * The layer types `OS` as `'linux' | 'macos' | 'windows'`, which is the truth about
 * what this host can be. But `components/profile/SettingRow.tsx` writes
 * `Platform.OS === 'web'`, and against the narrow union that is a type error — TS
 * correctly points out the two can never overlap. The COMPARISON is not wrong, though:
 * the app is asking a question whose answer here is simply "no".
 *
 * So the type is widened to include the three values the app tests for and this host
 * never returns. The runtime value is untouched — it is the layer's own, and it reports
 * `linux`.
 */
export const Platform = BasePlatform as Omit<typeof BasePlatform, 'OS'> & {
  readonly OS: 'linux' | 'macos' | 'windows' | 'web' | 'ios' | 'android';
};

// The props type is given EXPLICITLY on each one rather than inferred.
//
// `wrap` is generic in its props, and a generic component gets its type argument from
// the JSX attributes at each call site — which means an attribute the site does not
// annotate has no contextual type at all. That is not academic: `onPress={(event) => …}`
// in `components/player/ProgressBar.tsx` was an implicit `any`, so `event.nativeEvent`
// typechecked clean and would have accepted any misspelling of it.
export const View = wrap<ViewProps>(BaseView, 'View');

const TextBase = wrap<TextProps>(BaseText, 'Text', false, true);

/** Just enough of `Gtk.Label` to measure it and pin its width, structurally. */
type MeasurableLabel = {
  measure(orientation: number, forSize: number): [number, number, number, number];
  set_size_request(width: number, height: number): void;
  width_request: number;
  height_request: number;
};
/** `Gtk.Orientation.HORIZONTAL`, spelled out because this file imports no GI. */
const HORIZONTAL = 0;

function letterSpacingOf(style: unknown): number {
  const value = flattenStyle(style)?.letterSpacing;
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : 0;
}

/** `flexShrink: 0` written out — React Native's default, and here a declaration. */
function refusesToShrink(style: unknown): boolean {
  return flattenStyle(style)?.flexShrink === 0;
}

/**
 * A TEXT THAT DECLARES `flexShrink: 0` IS PINNED TO THE WIDTH IT NEEDS, and so is a
 * one-line letter-spaced one, which needs one pixel more than GTK reports.
 *
 * ## The shrink half
 *
 * `flexShrink` DEFAULTS TO 0 IN REACT NATIVE, so a row item there is never squeezed
 * below its content and the row overflows instead. GTK has no shrink factor — the
 * layer below strips the property and says so at startup — and a `Gtk.Box` squeezes
 * its children anywhere between their minimum and their natural size. MEASURED on a
 * four-chip rail in a 260 px viewport, the same tree three ways:
 *
 * | the label | row min | row allocated | label widths | heights |
 * | --- | --- | --- | --- | --- |
 * | wrapping | 293 | 293 | 39, 38, 59, **53** | 18, 18, 18, **54** |
 * | `numberOfLines={1}` | 168 | 260 | 39, 38, **40**, **39** | all 18 |
 * | pinned | 358 | **358** | 39, 38, 59, **118** | all 18 |
 *
 * Wrapping is what the chips did: the last one was squeezed to 53 px, wrapped onto
 * three lines and was clipped by a 34 px rail. `numberOfLines={1}` is WORSE, and that
 * is the measurement worth keeping — `ellipsize` takes a label's minimum width to
 * about one character, so the box squeezed every chip and truncated all four. Pinned,
 * nothing is squeezed, the row overflows its viewport and the rail scrolls, which is
 * what the phone does.
 *
 * It is keyed on the DECLARATION and not on the shape of the element, because the
 * same host has to leave the mini player's title alone: that one is `numberOfLines={1}`
 * inside a flex row and it is supposed to ellipsize.
 *
 * ## The letter-spacing half
 *
 * MEASURED on GTK 4.22.4, „Backstage · Früher lesen" at 11px with the app's own
 * tracking: the label reports a natural width of 165 and Pango needs 166 to set it
 * on one line. It is allocated exactly its own natural width, so the last pixel is
 * missing at every size. The shortfall follows the tracking rather than the text,
 * measured across the values in use and beyond them:
 *
 * | `letterSpacing` | 0 | 0.4 | 1 | 1.2 | 1.5 | 2 | 3 |
 * | shortfall (px)  | 0 |  1  | 1 |  1  |  1  | 2 | 3 |
 *
 * A SINGLE-WORD MARK IS NEVER AFFECTED — „RECHERCHE", „Live", „Spotlight" all
 * measure minimum == natural, so there is no break opportunity to take. That is
 * why this only ever showed on the two-word ones.
 *
 * The symptom depends on what the label does when it runs out: a wrapping one puts
 * one word on a second line the parent has already committed no height for, and the
 * yellow Backstage band clipped it; a `numberOfLines={1}` one ellipsizes instead,
 * and the rail's badge read "FAKTENCHE…" at exactly its natural width. Both are the
 * same missing pixel.
 *
 * PADDING CANNOT FIX IT, measured: padding raises the natural width and the text's
 * own budget by the same amount, so the shortfall survives (165 → 166 → 167, still
 * short). `width-request` is the only lever that moves one and not the other, and
 * GTK ties it to the MINIMUM width too — which is why this is scoped to
 * `numberOfLines={1}`. There, a floor at the one-line width is not a side effect
 * but the behaviour React Native already has: `flexShrink` defaults to 0, so a
 * one-line label is never squeezed below its content on the phone either.
 *
 * Upstream in gjsify this is an `it.failing` vector in `text-metrics.spec.ts`. When
 * GTK reports the width Pango needs, that vector goes green and this goes with it.
 */
function usePinnedWidth(props: TextProps): ((widget: unknown) => void) | undefined {
  const spacing = letterSpacingOf(props.style);
  // THE DECLARATION AND NOTHING ELSE. This also read `numberOfLines === 1 && spacing
  // > 0`, and that was far too wide: every variant in `lib/theme/typography.ts` carries
  // a `letterSpacing` from the design tokens, so the second clause fired on EVERY
  // single-line `<Typo>` in the application. Measured, it pinned the live banner's
  // now-playing line at its natural 445 px — the exact opposite of what that line
  // needs, since a stream announces titles nobody chose — and the mini player's title
  // with it.
  const active = props.ref === undefined && refusesToShrink(props.style);
  const labelRef = useRef<MeasurableLabel | null>(null);
  const pinnedRef = useRef<number | null>(null);

  const apply = useCallback(() => {
    const label = labelRef.current;
    if (label === null) return;
    // OUR OWN VALUE FIRST. `measure` answers `max(natural, size request)`, so a
    // width written here is read back as if the text had asked for it and the
    // number only ever grows — the same ratchet the rails' height hit.
    if (pinnedRef.current !== null && label.width_request === pinnedRef.current) {
      label.set_size_request(-1, label.height_request);
      pinnedRef.current = null;
    }
    const natural = label.measure(HORIZONTAL, -1)[1];
    if (natural <= 0) return;
    const pinned = natural + Math.ceil(spacing);
    label.set_size_request(pinned, label.height_request);
    pinnedRef.current = pinned;
  }, [spacing]);

  useLayoutEffect(() => {
    if (active) apply();
  });

  return active
    ? (widget: unknown): void => {
        labelRef.current = (widget ?? null) as MeasurableLabel | null;
      }
    : undefined;
}

export function Text(props: TextProps): ReactElement {
  const pin = usePinnedWidth(props);
  return createElement(TextBase, pin === undefined ? props : { ...props, ref: pin as never });
}
export const Pressable = wrap<PressableProps>(BasePressable, 'Pressable', true);
const ScrollViewBase = wrap<ScrollViewProps>(BaseScrollView, 'ScrollView');

/**
 * THIS HOST SHOWS ITS SCROLLBARS, whatever the screen asked for.
 *
 * Seventeen call sites in this application pass `showsVerticalScrollIndicator={false}`
 * and `Rail` passes the horizontal one, which is right where they were written: a
 * finger has nothing to grab, the bar would sit under it, and the content moving IS
 * the feedback. None of that is true of a pointer. On the desktop the indicator is
 * the only thing that says a rail continues past the window edge, and it is the only
 * way to reach the rest of it without a horizontal wheel — a mouse has none, and a
 * rail is exactly where this bites: the topic chips and every card row scroll
 * sideways and looked like they simply ended.
 *
 * ONLY THE AXIS THAT SCROLLS, because the two props are not independent here: a
 * horizontal `<ScrollView>` already pins the other axis to `never` (the layer's own
 * table), and overriding both would have the two routes writing the same property.
 *
 * It costs no layout. GTK's scrollbars are OVERLAY by default: they appear over the
 * content on hover and take no space, so the rail is exactly as tall either way.
 *
 * The same decision as the tab switcher, one control down: each platform's own
 * idiom rather than one drawing stretched across all of them (ADR 0013).
 */
export function ScrollView(props: ScrollViewProps): ReactElement {
  const shown: ScrollViewProps = props.horizontal
    ? { ...props, showsHorizontalScrollIndicator: true }
    : { ...props, showsVerticalScrollIndicator: true };
  return createElement(ScrollViewBase, shown);
}

/**
 * The same name as a TYPE, because React Native declares `ScrollView` as a class and
 * an app written against it spells a ref `Ref<ScrollView>`.
 *
 * `lib/rail/useRailDrag.ts` is the one caller: it returns `Ref<ScrollView> | undefined`
 * and, off the web, always `undefined` — so this host never receives a handle through
 * it at all, and what is needed here is a name in the type space rather than a
 * description of anything. `unknown` is therefore the honest width: the layer hands a
 * ref the author's own `Gtk.Widget` (see `widgetOf`), which has no `ScrollView` members
 * to promise, and a richer type here would be a promise nothing keeps.
 *
 * A function declaration and an interface of the same name cannot merge, so this is an
 * alias rather than the `TextInput` pattern below, where the layer publishes a handle
 * type to point at.
 */
export type ScrollView = unknown;

/**
 * `AppState`, which this host does not have, said once rather than per caller.
 *
 * Tier P3 in the layer's support table, with `Gtk.Application` / `Gdk.Surface` named as
 * the route to a real one. Nothing is built on that here: Android's foreground
 * lifecycle and a window losing the compositor's focus are different events, and
 * reporting a focus change as `'background'` would be worse than reporting nothing —
 * `useHomeLayoutRefresh` would re-fetch the home document every time the user alt-tabbed
 * away and back.
 *
 * **What it costs, stated.** `lib/home/layout.ts` refreshes the home document on every
 * return to the foreground. On this host that never fires, so the document is whatever
 * the launch fetched until the app is restarted. The desktop host is a feasibility
 * demonstration that runs for minutes, so this is a real absence and not a real
 * problem; a host that ran for days would want `Gdk.Surface:state` wired to it.
 *
 * The subscription is a real object with a real `remove()`, because the caller stores
 * it and calls that on unmount — a `null` here would be a crash on the way out.
 */
export const AppState = {
  currentState: 'active' as const,
  addEventListener(_event: string, _handler: (state: string) => void) {
    return { remove(): void {} };
  },
};

/**
 * `BackHandler`, which this host does not have either, and for a sharper reason.
 *
 * The layer's table measured it: `Adw.NavigationView` emits `popped` AFTER the fact and
 * has no vetoable "about to pop" signal, so there is nothing for a handler that
 * INTERCEPTS a back press to intercept. `useSystemBack` is Android's hardware button,
 * which no desktop has.
 *
 * **What it costs.** `app/onboarding.tsx` uses it to keep the back button inside the
 * three onboarding steps instead of leaving the flow. Here the window has no back
 * button at that point — the onboarding is a pushed page with the navigation view's own
 * chrome — so the behaviour the phone is protecting against is one this host does not
 * offer in the first place.
 */
export const BackHandler = {
  addEventListener(_event: string, _handler: () => boolean) {
    return { remove(): void {} };
  },
};

export const ActivityIndicator = wrap<ActivityIndicatorProps>(
  BaseActivityIndicator,
  'ActivityIndicator',
);
/**
 * `TextInput`, and the local translation that used to live here.
 *
 * React Native declares `TextInput` as a class, so the name is a value AND a type, and
 * `useRef<TextInput>(null)` is how an app moves focus between two fields. The phone's
 * `LoginGate` does exactly that: a ref on the password field, then
 * `passwordRef.current?.focus()` from the email field's `onSubmitEditing`.
 *
 * Until @gjsify/react-native 0.46 the layer handed a ref the raw `Gtk` widget, which
 * has no `focus()` — so this file carried a hand-written handle wrapping
 * `grab_focus()`, plus an interface declaring the one member it could honour. The note
 * on it said: it belongs upstream, it is being built there, and **when it arrives,
 * DELETE this rather than grow it.**
 *
 * It arrived. `TextInputHandle` answers all five members React Native documents —
 * `focus`, `blur`, `clear`, `isFocused`, `setSelection` — refuses the four it cannot
 * over GTK by name, and keeps the widget on `.widget`. Every one of those is a better
 * answer than the local handle had: `blur()` guards that this widget actually holds
 * the focus before clearing the root's, and `isFocused()` reads `is_focus()` rather
 * than `has-focus`, which is false whenever the window is not the compositor's active
 * one. Neither distinction was in the deleted code, and both are the kind a port gets
 * wrong.
 *
 * So the value is `wrap`ped like every other primitive and the type is the layer's.
 * `wrap`'s ref unwraps `.widget` — see `widgetOf` — so the props this file answers
 * still reach the widget.
 */
export type TextInput = TextInputHandle;

export const TextInput = wrap<TextInputProps>(BaseTextInput, 'TextInput');

export const Switch = wrap<SwitchProps>(BaseSwitch, 'Switch');
export const FlatList = wrap<FlatListProps>(BaseFlatList, 'FlatList');
