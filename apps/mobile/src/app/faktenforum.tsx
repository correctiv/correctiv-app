import { router } from 'expo-router';
import { defineMessages, useIntl } from 'react-intl';
import { Pressable, ScrollView, View } from 'react-native';

import { ClaimStatusTag } from '@/components/participate/ClaimStatusTag';
import { Card, ScreenHeader, Typo } from '@/components/ui';
import { claims, type Claim } from '@correctiv/app-core/data/claims';
import { formatDateShortDe } from '@correctiv/app-core/lib/format';

/**
 * Everything a person reads on this screen, in ENGLISH; the German that ships is
 * `src/i18n/catalogue/de/faktenforum.ts`.
 *
 * The screen's own name is not among them, and it is written out twice below
 * rather than lifted: Faktenforum is the product's name, the same word in every
 * language, so it is a mark and not a message — the exception
 * `gate/LoginGate.tsx` makes for the wordmark.
 */
const COPY = defineMessages({
  lead: {
    id: 'faktenforum.lead',
    defaultMessage:
      'The community checks claims together with the CORRECTIV newsroom. Have a look at what is being worked on.',
  },
  quote: {
    id: 'faktenforum.quote',
    defaultMessage: '"{quote}"',
    description:
      "A claim in the Faktenforum list, in quotation marks. {quote} is the claim's wording and is not translated. The quotation marks belong to the language: German uses low and high ones. `claim.quote` is the same construction on a claim's own screen.",
  },
  submitted: {
    id: 'faktenforum.submitted',
    defaultMessage: '{shortId} · submitted {date}',
    description:
      "The line under a claim in the Faktenforum list. {shortId} is the claim's short identifier and {date} the day it was submitted, already formatted.",
  },
});

/**
 * The Faktenforum — what the community is checking right now. The data sits in the
 * core in the GraphQL response shape of the real Faktenforum backend, so that a
 * later phase only has to swap the data layer.
 */
export default function FaktenforumScreen() {
  const intl = useIntl();
  return (
    <View className="flex-1 bg-canvas">
      <ScreenHeader title="Faktenforum" />
      <ScrollView
        className="flex-1"
        contentContainerClassName="px-m pt-m pb-2xl"
        showsVerticalScrollIndicator={false}
      >
        <Typo variant="headline-l">Faktenforum</Typo>
        <Typo variant="text-m" color="on-canvas-muted" className="mt-2xs">
          {intl.formatMessage(COPY.lead)}
        </Typo>

        <View className="mt-m">
          {claims.map((claim) => (
            <ClaimRow key={claim.id} claim={claim as Claim} />
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

function ClaimRow({ claim }: { claim: Claim }) {
  const intl = useIntl();
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={claim.shortId}
      onPress={() => router.push({ pathname: '/behauptung/[id]', params: { id: claim.id } })}
      className="mb-s active:opacity-80"
    >
      <Card>
        <ClaimStatusTag claim={claim} />
        <Typo variant="headline-xs" className="mt-2xs">
          {intl.formatMessage(COPY.quote, { quote: claim.quote })}
        </Typo>
        <Typo variant="text-s" color="grey-500" className="mt-2xs">
          {intl.formatMessage(COPY.submitted, {
            shortId: claim.shortId,
            date: formatDateShortDe(claim.submittedAt),
          })}
        </Typo>
      </Card>
    </Pressable>
  );
}
