// The props this host answers for the layer, as DATA rather than as a comment.
//
// `shims/react-native.tsx`'s header carries this as a prose table, and that table has
// now been wrong twice in the same way: it describes a refusal that upstream has since
// answered, the shim goes on handling the prop harmlessly, and the app is told it lost
// a capability it has. `flex-wrap` was the first (stripped here until
// `@gjsify/react-native` 0.46 mapped it to a wrapping widget, with a note to remove the
// branch that had been acted on while the README kept the consequence). This file is so
// that the second time is a failing test rather than a re-read.
//
// `@gjsify/react-native/prop-table` is what makes it checkable: `explainProp(primitive,
// prop)` returns `null` when the layer renders a prop and the sentence a render would
// print when it does not. So every entry here is a claim that can be verified against
// the installed layer, and `test/prop-gate.test.ts` verifies it in both directions.
//
// WHAT THIS FILE IS NOT. It is not the set of props the app passes — that is a question
// about JSX in 26 screens, and about components like `<Typo>` that forward `...rest`
// onto a primitive, which is what let `<Typo onPress>` through and took Home down. That
// check needs a parser and one level of forwarding analysis; `test/support-gate.test.ts`
// names it as the remaining half. This file answers the narrower question that needs no
// parser at all: **is each workaround still necessary?**

/** What this host does with a prop the layer refuses. */
export type Disposition =
  /** Reimplemented here, so the app keeps the behaviour. */
  | 'implemented'
  /** Deliberately not carried, with a reason. The prop is removed before the layer sees it. */
  | 'dropped'
  /** Translated to something the layer does accept. */
  | 'mapped';

export interface AnsweredProp {
  /** The prop as React Native spells it. */
  readonly prop: string;
  /** The primitive to ask the layer about — the one the app passes it to. */
  readonly primitive: string;
  readonly disposition: Disposition;
  /** One line, for a failure message that says what would be lost by removing this. */
  readonly why: string;
}

/**
 * Every prop `shims/react-native.tsx` answers, with the primitive to check it against.
 *
 * The primitive matters: the layer answers per element, so `accessibilityLiveRegion` is
 * refused on a `View` and accepted on a `Text`, and `contentContainerClassName` is
 * accepted on a `ScrollView` and refused on a `FlatList`. A single global list would
 * have to pick one and would be wrong about the other.
 */
export const ANSWERED_PROPS: readonly AnsweredProp[] = [
  {
    prop: 'hitSlop',
    primitive: 'Pressable',
    disposition: 'dropped',
    why: 'an 8px concession to a fingertip; a desktop pointer has single-pixel precision',
  },
  {
    // THE ENTRY THAT SHOULD HAVE EXISTED FIRST. `onLayout` is how React Native hands a
    // component its own measured size, and the layer refuses it because allocation is
    // `vfunc_size_allocate`, a subclass override only the layer can make. The shim
    // drops it, which is the only available answer — and the consequence is that
    // NOTHING IN THIS APP MAY DEPEND ON A MEASUREMENT.
    //
    // `overrides/ProgressBar.tsx` did. It sized a fill from an `onLayout` width, the
    // width stayed 0 for the whole session, the bar was invisible, and both sweeps
    // reported `ok` because an invisible widget throws nothing. It shipped for an hour.
    // With this entry, `prop-gate.test.ts` states the refusal as data, so the next
    // component that reaches for a measurement has something to have read.
    prop: 'onLayout',
    primitive: 'View',
    disposition: 'dropped',
    why: 'allocation is vfunc_size_allocate, a subclass override the layer owns; nothing here may depend on a measured size',
  },
  {
    prop: 'android_hyphenationFrequency',
    primitive: 'Text',
    disposition: 'dropped',
    why: 'an Android-only line-breaking hint (`Typo` passes it per variant); GTK hyphenates through Pango, not through this prop',
  },
  {
    prop: 'accessibilityElementsHidden',
    primitive: 'Text',
    disposition: 'dropped',
    why: 'hides a decorative glyph from assistive technology; the layer routes no such prop, so the glyph is announced (NavRail)',
  },
  {
    prop: 'importantForAccessibility',
    primitive: 'Text',
    disposition: 'dropped',
    why: 'the Android spelling of the same hint, passed beside it',
  },
  {
    prop: 'trackColor',
    primitive: 'Switch',
    disposition: 'dropped',
    why: 'Adwaita paints a switch from the theme accent; the track is a CSS subnode',
  },
  {
    prop: 'thumbColor',
    primitive: 'Switch',
    disposition: 'dropped',
    why: 'see trackColor',
  },
  {
    prop: 'placeholderTextColor',
    primitive: 'TextInput',
    disposition: 'dropped',
    why: 'the placeholder is a CSS subnode rather than a widget property; Adwaita already dims it',
  },
  {
    prop: 'autoFocus',
    primitive: 'TextInput',
    disposition: 'implemented',
    why: 'grab_focus() from the ref on `map`, because it only works once the widget is mapped',
  },
  {
    prop: 'contentContainerClassName',
    primitive: 'FlatList',
    disposition: 'mapped',
    why: 'a FlatList has no content box, so the classes are merged into the list own className',
  },
];

/**
 * Props this file used to answer and the layer has since answered ITSELF.
 *
 * A DECLARED EXCEPTION LEDGER, not a to-do list that reads as one. Each of these is
 * measured `ACCEPTED` by the installed layer, which means the shim's handling of it is
 * now redundant — harmless, because handling a prop the layer would also handle changes
 * nothing observable, and worth removing on the next touch of the relevant branch
 * because a redundant workaround is indistinguishable from a necessary one.
 *
 * The reason it is a LIST and not a set of deletions is that removing each one is a
 * behaviour change to verify on three platforms, and the sessions that added them
 * measured rather than rewrote. The test holds the list exact in both directions: a
 * further prop the layer catches up on fails here, and so does an entry the layer goes
 * back to refusing.
 *
 * Two of these are capability GAINS rather than bookkeeping, and both are still to be
 * wired:
 *
 *   * `accessibilityLiveRegion` on `Text`. This host's header says a screen-reader user
 *     is told nothing on the door, and the layer answers it through
 *     `Gtk.Accessible.announce()` on the one element whose content IS its message.
 *
 *     TWO THINGS HAVE TO MOVE FOR THAT, and the entry is easy to misread as one. The
 *     layer accepts it on `Text` and still REFUSES it on `View`
 *     (`explainProp('View', 'accessibilityLiveRegion')` is not null), and the app's two
 *     call sites are both `<View accessibilityLiveRegion="polite">`
 *     (`gate/LoginGate.tsx`). So the shim's drop is load-bearing for the app as it
 *     stands, and the gain needs the prop moved onto the `Typo` whose text is the
 *     message — a change in `apps/mobile`, not here.
 *
 *     THE HAZARD IS THAT THE DROP IS UNCONDITIONAL while the layer's answer is
 *     per-primitive: the day somebody moves the prop to the `Typo`, this shim will
 *     swallow a prop the layer would have honoured, silently. Making the drop
 *     conditional on the primitive is the fix, and it needs the primitive threaded into
 *     `normalize`, which is why it is written down here rather than done in passing.
 *   * **`accessibilityRole` on `View`, 41 call sites**, which this shim DROPS. It was
 *     dropped because the layer had no answer, not because GTK has none — the header of
 *     `react-native.tsx` measured that and said the entry would move the day the layer
 *     grew the role family. gjsify 0.48 grew it
 *     ([#1541](https://github.com/gjsify/gjsify/pull/1541)), so those 41 sites are a
 *     deletion away from having a role, and `accessible` and the two implemented ones
 *     come with them.
 */
export const UPSTREAM_CAUGHT_UP: readonly (readonly [primitive: string, prop: string])[] = [
  ['View', 'accessibilityLabel'],
  ['View', 'accessibilityState'],
  ['View', 'accessibilityRole'],
  ['View', 'accessible'],
  ['Text', 'accessibilityLiveRegion'],
  ['TextInput', 'autoComplete'],
  ['TextInput', 'textContentType'],
  ['TextInput', 'submitBehavior'],
  ['ScrollView', 'contentContainerClassName'],
  // TRUE AT PROP LEVEL AND NOT THE WHOLE STORY. The layer accepts `pointerEvents` on a
  // `View`, so this entry belongs here — but `POINTER_EVENTS` maps only `auto` and
  // `none`, and the app passes `box-none` at four sites, which throws at RENDER. So the
  // shim's value mapping in `react-native.tsx` is still load-bearing, and removing it
  // because this list says "caught up" would break four screens.
  //
  // The published oracle cannot see it either: `explainPropValue('View',
  // 'pointerEvents', 'box-none')` answers accepted, because `propRefusedValues` reads
  // an explicit `refuses` field and not a mapped route's key set. That is a defect in
  // the oracle rather than in this ledger, and it is filed upstream — a value-level
  // refusal invisible to the table is how a consumer's own ledger goes wrong.
  ['View', 'pointerEvents'],
];
