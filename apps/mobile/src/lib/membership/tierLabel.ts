import { defineMessages, type MessageDescriptor } from 'react-intl';

import type { MembershipTier } from '@correctiv/app-core/types/models';

/**
 * The membership tiers, as the app names them to a reader.
 *
 * Shared rather than kept per screen, which is the exception to "user-facing text
 * lives in one obvious place per screen": these three strings are the names of a
 * domain enum, the door and the profile both print them, and two copies of an enum's
 * labels drift the moment a tier is renamed.
 *
 * Descriptors and not strings, because this module has no React and therefore no
 * `useIntl`. What it can own is the vocabulary; the formatting belongs to whoever
 * renders it, which is `components/gate/LoginGate.tsx` and `app/(tabs)/profil.tsx`.
 * Typed as the record rather than left to inference, so a fourth `MembershipTier`
 * fails to compile here instead of printing nothing on both screens.
 */
export const TIER_LABELS: Record<MembershipTier, MessageDescriptor> = defineMessages({
  free: { id: 'profile.tier.free', defaultMessage: 'Free membership' },
  paid: {
    id: 'profile.tier.paid',
    defaultMessage: 'Membership with a contribution',
    description:
      'The name of the paid tier, wherever a tier is named. settings.access.paid is the same words in the settings, where it answers how app access was granted rather than which tier the account is on.',
  },
  soli: { id: 'profile.tier.soli', defaultMessage: 'Solidarity membership' },
});
