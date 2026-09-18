import { Ionicons } from '@expo/vector-icons';
import { defineMessages, useIntl } from 'react-intl';
import { Pressable, View } from 'react-native';

import { Badge, Typo } from '@/components/ui';
import { bonusMedia, diaries } from '@correctiv/app-core/data/backstage';
import { sizes, useColors } from '@/lib/theme';

/**
 * The card's one action, in ENGLISH; the German ships in
 * `packages/catalogue/src/de/backstage.ts` (ADR 0026 §6). The badge says `Backstage`,
 * which is a mark and carries no id; the diary entry and the bonus episode are
 * content.
 *
 * The arrow stays out of the message and beside it in the markup. It is
 * decoration on the link, and a screen reader that reads the accessibility name
 * should say the words and not "right arrow" — which is why the same message
 * serves both.
 */
const COPY = defineMessages({
  allFromBackstage: {
    id: 'backstage.allFromBackstage',
    defaultMessage: 'Everything from Backstage',
  },
});

/**
 * Backstage on Home: the latest research diary, with the bonus episode named
 * underneath.
 *
 * Yellow is the club's colour throughout the design system, and the card stays
 * readable for everyone — the diary is open, the bonus is the member's part. That
 * is the whole argument of the app in one card, which is why the design draft puts
 * it on Home rather than hiding it behind the profile.
 */
export function BackstageTeaser({
  onOpenDiary,
  onOpenBackstage,
}: {
  onOpenDiary: (id: string) => void;
  onOpenBackstage: () => void;
}) {
  const intl = useIntl();
  const colors = useColors();
  const diary = diaries[0];
  const bonus = bonusMedia[0];

  return (
    <View className="overflow-hidden rounded-md border border-accent-alternative">
      <Pressable
        onPress={() => onOpenDiary(diary.id)}
        accessibilityRole="link"
        accessibilityLabel={diary.title}
        className="p-m active:opacity-90"
      >
        <Badge label="Backstage" tone="club" />
        <Typo variant="headline-s" className="mt-2xs">
          {diary.title}
        </Typo>
        <Typo variant="text-m" color="on-canvas-muted" className="mt-2xs" numberOfLines={2}>
          {diary.teaser}
        </Typo>
      </Pressable>

      {bonus && (
        <View className="mx-m mb-m flex-row items-center rounded-md bg-surface p-s">
          <Ionicons name="headset-outline" size={20} color={colors['on-canvas-muted']} />
          <Typo variant="text-s" weight="semibold" className="ml-s flex-1" numberOfLines={2}>
            {bonus.title}
          </Typo>
        </View>
      )}

      <Pressable
        onPress={onOpenBackstage}
        accessibilityRole="link"
        accessibilityLabel={intl.formatMessage(COPY.allFromBackstage)}
        className="mx-m mb-m justify-center active:opacity-60"
        /*
         * 24 dp with an 8 dp slop around it before #102. This link has a line of
         * the card to itself, above the card's bottom margin, so the box takes the
         * room without reaching either neighbour.
         */
        style={{ minHeight: sizes.tapTarget }}
      >
        <Typo variant="button" color="accent">
          {intl.formatMessage(COPY.allFromBackstage)} →
        </Typo>
      </Pressable>
    </View>
  );
}
