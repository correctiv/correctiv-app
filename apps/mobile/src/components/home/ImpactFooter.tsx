import { defineMessages, useIntl } from 'react-intl';
import { View } from 'react-native';

import { Typo } from '@/components/ui';

/**
 * The thank-you, in ENGLISH; the German ships in
 * `packages/catalogue/src/de/home.ts` (ADR 0026 §6). CORRECTIV keeps its spelling
 * inside the sentence rather than being lifted out of it.
 */
const COPY = defineMessages({
  headline: {
    id: 'home.impactHeadline',
    defaultMessage: 'Made possible by supporters like you',
  },
  body: {
    id: 'home.impactBody',
    defaultMessage:
      'CORRECTIV is non-profit. Your contribution funds the investigations you find here.',
  },
});

/**
 * Home's quiet closing moment.
 *
 * It used to end on a call to become a supporter and on the sentence that the
 * journalism stays free for everyone. Both addressed someone who had not paid yet, and
 * since the door (ADR 0016) that person is not in the app. What is left is the
 * thank-you, which is the part that was always true here. Removed with ADR 0018.
 */
export function ImpactFooter() {
  const intl = useIntl();

  return (
    <View className="mt-m items-center rounded-md bg-surface p-l">
      <Typo variant="headline-s" className="text-center">
        {intl.formatMessage(COPY.headline)}
      </Typo>
      <Typo variant="text-m" color="on-canvas-muted" className="mt-2xs text-center">
        {intl.formatMessage(COPY.body)}
      </Typo>
    </View>
  );
}
