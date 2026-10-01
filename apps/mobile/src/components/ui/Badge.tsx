import { View } from 'react-native';

import { typography, useColors, type ColorToken } from '@/lib/theme';
import { ScaledText } from './ScaledText';

type Tone = 'emphasis' | 'club' | 'neutral' | 'live';

export type BadgeProps = {
  label: string;
  /** emphasis = project badge (red), club = Backstage (yellow), live = red dot plus label. */
  tone?: Tone;
  className?: string;
};

const SURFACE: Record<Tone, string> = {
  emphasis: 'bg-accent',
  club: 'bg-accent-alternative',
  neutral: 'bg-grey-250',
  live: 'bg-transparent',
};
// The two coloured surfaces carry role colours, which are the same in both
// schemes; the two neutral tones sit on the page surface and change with it.
const TEXT_COLOR: Record<Tone, ColorToken> = {
  emphasis: 'always-light',
  club: 'always-dark',
  neutral: 'on-canvas-muted',
  live: 'accent',
};

/**
 * A small label (project / fact check / backstage). Radius s, no shadows.
 *
 * **One line, and it does not shrink.** A pill is one line in the design, and the
 * two declarations are the same pair `Overline` carries for the same reason: this
 * is the same letter-spaced typography, on a fill instead of on the page, so a
 * layout engine that derives a label's minimum width from its text clips the
 * second line here too. `Overline`'s docblock has the argument, the pointer to
 * where the pixels are recorded, and why `flexShrink` is in `style`.
 *
 * `flexShrink: 0` is React Native's own default written out, so on a phone it is
 * nothing. In a browser it is not, because `react-native-web` gives that default
 * to `View` and not to `Text` — so this was read off the running web target
 * rather than reasoned about. At 320px, the narrower of the two widths, over
 * every specimen of the eight components where one of these labels sits beside
 * flexible content — `ui/Badge`, `ui/Overline`, `ui/Chip`, `profile/NavCard`,
 * `profile/ClubCard` (the one place an `Overline` is itself a row's flex item),
 * `media/EpisodeRow`, `media/LiveBanner`, `home/EarlyAccessCard` — every
 * rectangle holds still except the three that go from two lines to one, and all
 * three belong to the two components that say so themselves: `ui/Overline`'s long
 * kicker, and `media/LiveBanner`'s unbreakable track title plus, at this width
 * only, its ordinary subtitle. At 393px it is two.
 *
 * What does change is declarations. Eleven computed properties on a label that
 * gained `numberOfLines`, because rn-web swaps its whole one-line rule in
 * (`flex-shrink`, `max-width`, the four `overflow` longhands, `overflow-wrap`,
 * `text-overflow`, `text-wrap-mode`, `white-space-collapse`), and exactly one on
 * a `Chip` label, which gained only `flexShrink`.
 *
 * Why the rectangles hold: rn-web's `View` default already refuses to shrink, so
 * a pill overflows its row rather than being squeezed, and its label was never
 * under shrink pressure to begin with. `Backstage · Früher lesen` from
 * `home/EarlyAccessCard` is the label this was worth checking on, at 24
 * characters, and it still sets on one line at 393px.
 */
export function Badge({ label, tone = 'emphasis', className }: BadgeProps) {
  const colors = useColors();
  return (
    <View
      className={[
        'flex-row items-center self-start rounded-s px-2xs py-4xs',
        SURFACE[tone],
        className ?? '',
      ].join(' ')}
    >
      {tone === 'live' && (
        <View className="mr-3xs rounded-full bg-accent" style={{ width: 7, height: 7 }} />
      )}
      <ScaledText
        numberOfLines={1}
        style={[
          typography['text-s'],
          {
            color: colors[TEXT_COLOR[tone]],
            fontSize: 11,
            letterSpacing: 0.4,
            flexShrink: 0,
            textTransform: 'uppercase',
          },
        ]}
      >
        {label}
      </ScaledText>
    </View>
  );
}
