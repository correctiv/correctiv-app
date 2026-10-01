import { Ionicons } from '@expo/vector-icons';
import { defineMessages, useIntl } from 'react-intl';
import { View } from 'react-native';

import { Overline, SplitRow, Typo } from '@/components/ui';
import { formatDateShort } from '@correctiv/app-core/lib/format';
import { useLocale } from '@/lib/store/core';
import { colors } from '@/lib/theme';

/**
 * The club's name, and the one string on this card that is not a message.
 *
 * Same exception as the door's wordmark: a mark is not a sentence, and a catalogue
 * line mapping "CORRECTIV Club" to "CORRECTIV Club" is a line for a translator to
 * wonder about.
 */
const CLUB = 'CORRECTIV Club';

/**
 * What the card says around the name.
 *
 * The second line is ONE message with two placeholders rather than a tier and a
 * date glued together, because the order of the two, and the word between them,
 * are the translator's to decide. The date itself stays with `formatDateShort`,
 * which pins the German pattern deliberately where German is what renders.
 */
const COPY = defineMessages({
  fallbackName: { id: 'profile.club.fallbackName', defaultMessage: 'Member' },
  tierSince: {
    id: 'profile.club.tierSince',
    defaultMessage: '{tier} · since {date}',
    description:
      "Under the name on the membership card. {tier} is the tier's name, already translated, and {date} the day the membership began, already formatted.",
  },
});

/**
 * The head of the profile.
 *
 * There used to be a second state here, a guest card offering to join. It had an
 * audience while the app was open to everyone. Since the door (ADR 0016) everyone
 * inside has an entitlement that includes the app, so the guest branch addressed
 * nobody and said the opposite of what the door had just said. Removed with ADR 0018.
 *
 * The card stays yellow in both schemes, because the yellow carries meaning.
 * Everything on it therefore takes the fixed dark role colour rather than the page's
 * text colour, which turns near-white in dark mode and would vanish on the yellow.
 *
 * `tierLabel` arrives formatted. The tier names are a shared vocabulary one level up
 * (`lib/membership/tierLabel.ts`) and the caller is the one holding the entitlement,
 * so this card takes the finished words and does not look the tier up itself.
 */
export function ClubCard({
  name,
  tierLabel,
  memberSince,
}: {
  name: string;
  tierLabel: string;
  memberSince: string | null;
}) {
  const intl = useIntl();
  const locale = useLocale();
  return (
    <View className="mt-s rounded-md bg-accent-alternative p-m">
      <SplitRow>
        <Overline label={CLUB} color="always-dark" />
        <Ionicons name="heart" size={20} color={colors['always-dark']} />
      </SplitRow>
      <Typo variant="headline-l" color="always-dark" className="mt-m">
        {name || intl.formatMessage(COPY.fallbackName)}
      </Typo>
      {/* Not `on-canvas-muted`: club yellow does not follow the scheme, so the
          secondary line is dimmed rather than recoloured — otherwise every fixed
          surface would need a foreground scale of its own. */}
      <Typo variant="text-s" color="always-dark" className="opacity-70">
        {memberSince
          ? intl.formatMessage(COPY.tierSince, {
              tier: tierLabel,
              date: formatDateShort(memberSince, locale),
            })
          : tierLabel}
      </Typo>
    </View>
  );
}
