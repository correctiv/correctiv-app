import { defineMessages, useIntl } from 'react-intl';
import { Pressable, View } from 'react-native';

import { Badge, Typo } from '@/components/ui';

/**
 * The card's own vocabulary, in ENGLISH; the German ships in
 * `packages/catalogue/src/de/backstage.ts` (ADR 0026 §6).
 *
 * **The headline and the teaser below are NOT here, and that is the decision.**
 * They are a sample article standing in for one that will come from the source,
 * so they are content and not vocabulary — the same category as the bundled
 * journalism the seam leaves alone. They keep their German and get no descriptor;
 * when the source supplies them they will arrive in German as data. The badge and
 * the action around them are the card's own words, and those do get ids.
 *
 * `readNow` is the id `app/backstage.tsx` uses for the same action, with the same
 * default; `npm run i18n:extract --throws` fails if the two ever disagree.
 */
const COPY = defineMessages({
  badge: { id: 'backstage.earlyAccessBadge', defaultMessage: 'Backstage · read it earlier' },
  readNow: { id: 'backstage.readNow', defaultMessage: 'Read it now' },
});

/**
 * Early-access card (SAMPLE data).
 *
 * It used to carry two copies, an invitation for guests and "Jetzt lesen" for
 * members, and Home never passed the flag, so members saw the guest copy. Since the
 * door (ADR 0016) everyone here is a member, so there is one copy and the bug it
 * carried is gone with the branch. Removed with ADR 0018.
 */
export function EarlyAccessCard({ onPress }: { onPress?: () => void }) {
  const intl = useIntl();

  return (
    <Pressable
      onPress={onPress}
      /*
       * The role, and no label: the card's own three lines already say what it is
       * and what tapping it does, and a name typed over them would replace them
       * rather than add to them. What was missing is that it announces as a
       * control at all — without this it read as a paragraph that happened to end
       * in an arrow (#102).
       */
      accessibilityRole="link"
      className="overflow-hidden rounded-md border border-stroke active:opacity-90"
    >
      <View className="bg-accent-alternative px-m py-s">
        <Badge label={intl.formatMessage(COPY.badge)} tone="club" />
      </View>
      <View className="p-m">
        <Typo variant="headline-s">Die Pensionskassen-Recherche, exklusiv vorab</Typo>
        <Typo variant="text-m" color="on-canvas-muted" className="mt-2xs">
          Sie lesen jetzt, drei Tage vor allen anderen.
        </Typo>
        <Typo variant="button" color="accent" className="mt-s">
          {intl.formatMessage(COPY.readNow)} →
        </Typo>
      </View>
    </Pressable>
  );
}
