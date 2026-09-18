import { Ionicons } from '@expo/vector-icons';
import { defineMessages, useIntl } from 'react-intl';
import { Pressable, View } from 'react-native';

import { Badge, Typo } from '@/components/ui';
import { useColors } from '@/lib/theme';

type IoniconName = keyof typeof Ionicons.glyphMap;

/**
 * The badge's word, which is the club's name and therefore not a message — the
 * same exception `profile/ClubCard.tsx` makes for "CORRECTIV Club". It reaches a
 * screen reader inside the row's name below, in its own spelling.
 */
const CLUB = 'Club';

const COPY = defineMessages({
  /**
   * The row's accessible name when it is a club entry: ONE message with the title
   * in it, not a title with a word appended. Where the mark goes in that sentence
   * is a question about the language, and a join in TypeScript answers it once for
   * every language there will ever be.
   */
  clubRow: {
    id: 'profile.nav.clubAccessibility',
    defaultMessage: '{title}, Club',
    description:
      "The accessible name of a club row in the profile, read aloud and never seen. {title} is the row's own title; the mark is appended as one message so the language decides where it goes.",
  },
});

/**
 * Row with an icon, a title, an explanation and a chevron — the profile has five
 * of them (report, backstage, saved, settings …). Separated by hairlines like the
 * directory on Entdecken, so the app speaks one list language and not two.
 *
 * `club` marks what membership brings, in the club's yellow. The draft carries that
 * badge on every entry the membership brings. It marks what a contribution pays
 * for; it has never withheld anything, and since ADR 0018 there is nobody here it
 * could withhold from.
 *
 * `title` and `subtitle` arrive as finished text: they name what the row opens, so
 * they belong to the screen that owns the list rather than to the row.
 */
export function NavCard({
  icon,
  title,
  subtitle,
  club = false,
  onPress,
}: {
  icon: IoniconName;
  title: string;
  subtitle: string;
  club?: boolean;
  onPress: () => void;
}) {
  const colors = useColors();
  const intl = useIntl();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="link"
      accessibilityLabel={club ? intl.formatMessage(COPY.clubRow, { title }) : title}
      className="flex-row items-center border-b border-stroke py-s active:opacity-70"
    >
      <Ionicons name={icon} size={20} color={colors['on-canvas-muted']} />
      <View className="ml-s flex-1">
        <View className="flex-row items-center">
          <Typo variant="text-m" weight="bold">
            {title}
          </Typo>
          {club && <Badge label={CLUB} tone="club" className="ml-2xs" />}
        </View>
        <Typo variant="text-s" color="on-canvas-muted" className="mt-4xs">
          {subtitle}
        </Typo>
      </View>
      <Ionicons name="chevron-forward" size={16} color={colors['grey-500']} />
    </Pressable>
  );
}
