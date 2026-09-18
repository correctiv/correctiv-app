import { Ionicons } from '@expo/vector-icons';
import { defineMessages, useIntl } from 'react-intl';
import { Pressable, View } from 'react-native';

import { Button, Overline, Typo } from '@/components/ui';
import type { Callout } from '@correctiv/app-core/data/callouts';
import { calloutKicker, calloutStyle } from '@/lib/participate/calloutStyle';
import { colors } from '@/lib/theme';

/**
 * The two words this module adds to what `lib/participate/calloutStyle.ts` already
 * answers, and both are two halves that a call site could have glued together
 * instead — which is why they are messages.
 *
 * `kicker`: on Home the kicker names the module before it names the callout.
 *
 * `ctaAccessibility`: the card's button says "Mitmachen" and the card is about one
 * investigation, so the button's accessibility name has to carry the headline as
 * well. Which separator does that, and in which order, is a question about the
 * language and not about the card — the same shape `gespeichert.tsx`,
 * `MediaCard` and `EpisodeRow` already put in a message for the same reason.
 */
const COPY = defineMessages({
  kicker: {
    id: 'callout.teaser.kicker',
    defaultMessage: 'Take part · {kicker}',
    description:
      "The kicker above a callout teaser on the home screen. {kicker} is the callout's own kicker; the word before the separator is the app's.",
  },
  ctaAccessibility: {
    id: 'callout.teaser.ctaAccessibility',
    defaultMessage: '{cta}: {title}',
    description:
      "The accessible name of a callout teaser on the home screen, read aloud and never seen. {cta} is the button's own label and {title} the callout's headline.",
  },
});

/**
 * The participate module on Home: one open callout, dark card, coral button.
 *
 * Dark is the point. Everything above it is journalism to read; this is the one
 * block that asks the reader for something, and the design draft sets it apart
 * that way. Home was missing it entirely, which left the Mitmachen tab as the only
 * door into the callouts.
 *
 * Dark in both schemes, so everything on it is `always-light`, dimmed where the
 * light scheme used a grey. In dark mode the card no longer stands out from the
 * page by brightness — the coral button carries that job, which is what it is for.
 */
export function CalloutTeaser({
  callout,
  onPress,
}: {
  callout: Callout;
  onPress: (callout: Callout) => void;
}) {
  const intl = useIntl();
  const style = calloutStyle(callout);
  const cta = intl.formatMessage(style.cta);

  return (
    <Pressable
      onPress={() => onPress(callout)}
      accessibilityRole="link"
      accessibilityLabel={callout.title}
      className="rounded-md bg-always-dark p-m active:opacity-90"
    >
      <Overline
        label={intl.formatMessage(COPY.kicker, { kicker: calloutKicker(intl, style) })}
        color="always-light"
        className="opacity-70"
      />
      <Typo variant="headline-s" color="always-light" className="mt-2xs">
        {callout.title}
      </Typo>
      <Typo variant="text-m" color="always-light" className="mt-2xs opacity-70" numberOfLines={3}>
        {callout.excerpt}
      </Typo>
      {/* The dimming sits on the row so the icon and the number recede together.
          An Ionicon takes no opacity of its own. */}
      <View className="mt-s flex-row items-center opacity-70">
        <Ionicons name="people-outline" size={16} color={colors['always-light']} />
        <Typo variant="text-s" color="always-light" className="ml-2xs">
          {intl.formatMessage(style.countSoFar, { count: callout.responseCount })}
        </Typo>
      </View>
      <Button
        title={cta}
        className="mt-s"
        onPress={() => onPress(callout)}
        accessibilityLabel={intl.formatMessage(COPY.ctaAccessibility, {
          cta,
          title: callout.title,
        })}
      />
    </Pressable>
  );
}
