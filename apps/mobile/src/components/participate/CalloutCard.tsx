import { defineMessages, useIntl } from 'react-intl';
import { View } from 'react-native';

import { Button, Card, Overline, Typo } from '@/components/ui';
import type { Callout } from '@correctiv/app-core/data/callouts';
import { calloutKicker, calloutStyle } from '@/lib/participate/calloutStyle';
import { useExtraCount, useHasSubmitted } from '@/lib/store/core';
import { sizes } from '@/lib/theme';

/**
 * An arbitrary target for the progress bar. The data carries no goal figure and the
 * bar should still show movement. The value is carried over from the first
 * implementation rather than picked afresh, so the same callout does not suddenly
 * look differently filled.
 */
const GOAL = 3000;

/**
 * The card's own two words, in ENGLISH; the German is in
 * `packages/catalogue/src/de/callout.ts`. Everything else it says comes from
 * `lib/participate/calloutStyle.ts`, which answers for the card and the home
 * teaser alike.
 */
const COPY = defineMessages({
  contributed: { id: 'callout.card.contributed', defaultMessage: '✓ You have contributed' },
  contributeAgain: { id: 'callout.contributeAgain', defaultMessage: 'Send another tip' },
});

/**
 * An open callout in the overview. The counter is the demo's magic: your own
 * submission raises it at once and for good (persisted in the core store), and the
 * bar grows with it.
 *
 * Only the button is tappable, not the whole card — a button inside a tappable card
 * would be two targets for one action, and the label carries the meaning anyway
 * (the draft does it the same way).
 */
export function CalloutCard({
  callout,
  onPress,
}: {
  callout: Callout;
  onPress: (callout: Callout) => void;
}) {
  const intl = useIntl();
  const extra = useExtraCount(callout.slug);
  const submitted = useHasSubmitted(callout.slug);
  const total = callout.responseCount + extra;
  const percent = Math.min(95, Math.max(8, Math.round((total / GOAL) * 100)));
  const style = calloutStyle(callout);

  return (
    <Card className="mb-s">
      <Overline label={calloutKicker(intl, style)} color="accent" />
      <Typo variant="headline-xs" className="mt-2xs">
        {callout.title}
      </Typo>
      <Typo variant="text-s" color="on-canvas-muted" numberOfLines={2} className="mt-2xs">
        {callout.excerpt}
      </Typo>

      <View
        className="mt-s overflow-hidden rounded-s bg-stroke"
        style={{ height: sizes.progressBar }}
      >
        <View className="h-full bg-on-surface" style={{ width: `${percent}%` }} />
      </View>
      <Typo variant="text-s" color="grey-500" className="mt-3xs">
        {intl.formatMessage(style.count, { count: total })}
      </Typo>

      {submitted && (
        <Typo variant="text-s" color="accent" className="mt-2xs">
          {intl.formatMessage(COPY.contributed)}
        </Typo>
      )}

      <Button
        title={intl.formatMessage(submitted ? COPY.contributeAgain : style.cta)}
        variant={submitted ? 'outline' : style.variant}
        onPress={() => onPress(callout)}
        className="mt-s"
      />
    </Card>
  );
}
