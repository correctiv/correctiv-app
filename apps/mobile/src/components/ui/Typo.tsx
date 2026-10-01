import type { TextProps } from 'react-native';

import {
  typography,
  typoFamily,
  typoWeight,
  fontFamilyFor,
  useColors,
  type FontFamily,
  type FontWeightName,
  type TypoVariant,
  type ColorToken,
} from '@/lib/theme';

import { ScaledText } from './ScaledText';

export type TypoProps = TextProps & {
  /** Composite variant from typography.css: typeface, size, tracking, line height. */
  variant?: TypoVariant;
  /**
   * Colour token; defaults to `on-canvas`, the brand's body-text colour — which is
   * near-white in dark mode, because `on-canvas` names the role and not the value.
   *
   * On a surface whose colour does NOT follow the scheme — the brand red, club
   * yellow, a photograph — that flip is wrong, and a primitive is the answer:
   * `white` and `neutral-700` are the same colour in both schemes, because a
   * primitive names a value. (`always-light` and `always-dark` are the older names
   * for those two and still resolve; ADR 0022 retires them.)
   */
  color?: ColorToken;
  /**
   * Overrides the weight only; the family and the metrics stay. typography.css
   * treats weight as its own axis (`ty-text-m font-sans-semibold`) — exactly the
   * combination list titles need.
   */
  weight?: FontWeightName;
  /**
   * Overrides the family only; the metrics stay. The same separate axis as
   * `weight`: the mission screen and the reader set a headline in Merriweather,
   * which no single variant provides — and inventing a `display` variant would
   * break this file's 1:1 mirroring of typography.css.
   */
  family?: FontFamily;
  /** Utility classes for layout and spacing, not for typography. */
  className?: string;
};

/**
 * Where Android may divide a word too long for its line, one answer per variant.
 *
 * A `Record` rather than `variant.startsWith('headline')`, which is what this was
 * and is ADR 0031's own example of mechanism 1 standing where a string test was.
 * The prefix classified `button` by accident — it is neither prose nor a headline
 * and nobody had decided about it — and it would have classified the twelfth
 * variant the same way, silently. As a record, a variant added to
 * `typography.generated.ts` stops this file compiling until somebody answers.
 *
 * `none` on the headlines is measured and the reason is at the call site below.
 * `none` on `button` is a decision: a control's label is a name rather than a
 * sentence, and a name divided across two lines reads as a fault in the control.
 * It is `Typo variant="button"` this governs, not `ui/Button`, which sets
 * `typography.button` on a `ScaledText` of its own.
 */
const HYPHENATION: Record<TypoVariant, 'none' | 'normal'> = {
  'text-article': 'normal',
  'text-s': 'normal',
  'text-m': 'normal',
  'text-l': 'normal',
  'headline-xs': 'none',
  'headline-s': 'none',
  'headline-m': 'none',
  'headline-l': 'none',
  'headline-xl': 'none',
  'headline-xxl': 'none',
  button: 'none',
};

/**
 * The app's text component: the variant decides typeface, size and line height,
 * `color` the colour token, `className` the layout. That keeps typography true to
 * the tokens and independent of Android's fontWeight behaviour.
 *
 * **Not every line of text in the app, and the exceptions are worth knowing**
 * because what this component declares does not reach them. `ui/Button`,
 * `ui/Badge` and `ui/Chip` each render a `ScaledText` of their own with a
 * `typography[...]` style, so none of them is hyphenated whatever the table above
 * says. That is right for all three — they draw one short label in a box sized
 * for it — and it is the reason a rule that belongs to every line of text has to
 * be stated somewhere other than here.
 */
export function Typo({
  variant = 'text-m',
  color = 'on-canvas',
  weight,
  family,
  style,
  className,
  ...rest
}: TypoProps) {
  const colors = useColors();
  // Either axis alone falls back to the variant's own value for the other one.
  const override =
    weight || family
      ? {
          fontFamily: fontFamilyFor(family ?? typoFamily[variant], weight ?? typoWeight[variant]),
        }
      : null;
  return (
    <ScaledText
      className={className}
      /*
       * German compounds are longer than the lines a phone draws, and a word that
       * does not fit is broken somewhere whatever we say. Off — which is Android's
       * default — it is broken wherever the line happens to end and no hyphen is
       * printed, which is how Home's teaser read "Gebäud / emodernisierungsgesetz"
       * at 200 % system font (#158). `normal` hands the break to Android's own
       * hyphenator, which knows where a German word may be divided and marks it.
       *
       * **Not on a headline**, and that line was measured rather than preferred.
       * Hyphenation does not know about the font scale, so switching it on for
       * everything changes 100 % as well. Shot on the emulator before and after:
       * every screen whose words are the app's own came back identical — the gate,
       * both onboarding steps, Entdecken, the settings — at 0.7 % RMSE, which is
       * the clock in the status bar. The one thing that moved was a live headline,
       * which divided as "Abgeord-netenhaus" where it had wrapped whole. German
       * headlines are not hyphenated, and #158 asks for the 200 % defect to be
       * fixed without changing 100 %, so the rule stops at the display sizes.
       *
       * What that leaves standing: a headline holding a single word longer than the
       * line still breaks without a hyphen at 200 %. There is no such headline in
       * the app's own copy, and a feed could carry one.
       *
       * Android only — the prop's own name says so, and there is no iOS or web
       * equivalent to keep in step.
       *
       * Before `{...rest}`, so a caller can still turn it off for a line that must
       * not be divided.
       */
      android_hyphenationFrequency={HYPHENATION[variant]}
      style={[typography[variant], override, { color: colors[color] }, style]}
      {...rest}
    />
  );
}
