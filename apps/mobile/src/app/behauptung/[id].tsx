import { useLocalSearchParams } from 'expo-router';
import { defineMessages, useIntl, type MessageDescriptor } from 'react-intl';
import { Pressable, ScrollView, View } from 'react-native';

import { ClaimStatusTag } from '@/components/participate/ClaimStatusTag';
import { Button, Card, ScreenHeader, Typo } from '@/components/ui';
import {
  claims,
  type Claim,
  type ClaimSource,
  type ClaimStatus,
} from '@correctiv/app-core/data/claims';
import { openExternal } from '@/lib/openExternal';

const FORUM_URL = 'https://faktenforum.org';

/** The claims are fixed, so one file per id in the static export. */
export function generateStaticParams(): { id: string }[] {
  return claims.map((claim) => ({ id: claim.id }));
}

/**
 * Everything a person reads on this screen, in ENGLISH; the German that ships is
 * `packages/catalogue/src/de/claim.ts`.
 *
 * `quote` is a message even though the claim itself is content: the marks around
 * it are typography, German sets them low-then-high and English does not, so they
 * belong with the language rather than in the markup.
 */
const COPY = defineMessages({
  screenTitle: { id: 'claim.screenTitle', defaultMessage: 'Claim' },
  unknownHeadline: { id: 'claim.unknownHeadline', defaultMessage: 'This claim does not exist' },
  unknownId: {
    id: 'claim.unknownId',
    defaultMessage: 'Unknown identifier "{id}".',
    description:
      'Shown when the claim screen is opened with an identifier no claim has. {id} is that identifier, unchanged, in quotation marks. Three other screens say the same under diary.unknownId, project.unknownId and series.unknownId.',
  },
  noId: {
    id: 'claim.noId',
    defaultMessage: 'No identifier was passed.',
    description:
      'Shown when the claim screen is opened with no identifier at all. Four other screens say the same thing under callout.detail.noSlug, diary.noId, project.noId and series.noId.',
  },
  quote: {
    id: 'claim.quote',
    defaultMessage: '"{quote}"',
    description:
      "The claim itself, on its own screen, in quotation marks. {quote} is the claim's wording and is not translated. The quotation marks belong to the language: German uses low and high ones.",
  },
  sourcesHeading: { id: 'claim.sourcesHeading', defaultMessage: 'Source assessment' },
  noSources: {
    id: 'claim.noSources',
    defaultMessage: 'No sources yet. The community is gathering them.',
  },
  credibility: {
    id: 'claim.credibility',
    defaultMessage: 'Reliability: {level}',
    description:
      "Under a source on a claim's screen. {level} is the source's reliability exactly as the data holds it, the literal German words `hoch`, `mittel` or `niedrig`, and it is NOT translated anywhere. Leave it in the sentence as it arrives; getting it translated is a change to the code, not to this string.",
  },
  submitOwn: {
    id: 'claim.submitOwn',
    defaultMessage: 'Submit a tip of your own (in the Faktenforum)',
  },
});

/**
 * The three stages a claim goes through, as the app names them.
 *
 * Typed as the record rather than left to inference, so a fourth `ClaimStatus`
 * fails to compile here instead of leaving a dot on the progress row unlabelled.
 */
const STAGE_LABELS: Record<ClaimStatus, MessageDescriptor> = defineMessages({
  submitted: {
    id: 'claim.stage.submitted',
    defaultMessage: 'Submitted',
    description:
      "One step of the progress row on a claim's screen. `participate.claimSubmitted` is the same word in the status tag a few lines above it on the same screen, so the two are read together.",
  },
  checking: {
    id: 'claim.stage.checking',
    defaultMessage: 'Being checked',
    description:
      "One step of the progress row on a claim's screen. `participate.claimChecking` is the same word in the status tag a few lines above it on the same screen, so the two are read together.",
  },
  checked: { id: 'claim.stage.checked', defaultMessage: 'Checked' },
});

/** How far along the check is, in order: submitted, being checked, checked. */
const STAGES = [STAGE_LABELS.submitted, STAGE_LABELS.checking, STAGE_LABELS.checked];

function stageOf(claim: Claim): number {
  return claim.status === 'checked' ? 2 : claim.status === 'checking' ? 1 : 0;
}

/** Reliability as a dot — full, half, empty. */
function credibilityDot(level: ClaimSource['credibility']): string {
  return level === 'hoch' ? '●' : level === 'mittel' ? '◐' : '○';
}

export default function BehauptungScreen() {
  const intl = useIntl();
  const { id } = useLocalSearchParams<{ id: string }>();
  const claim = (claims.find((c) => c.id === id) ?? null) as Claim | null;

  return (
    <View className="flex-1 bg-canvas">
      <ScreenHeader title={intl.formatMessage(COPY.screenTitle)} />

      {!claim ? (
        <View className="flex-1 items-center justify-center px-m">
          <Typo variant="headline-s" className="text-center">
            {intl.formatMessage(COPY.unknownHeadline)}
          </Typo>
          <Typo variant="text-m" color="on-canvas-muted" className="mt-2xs text-center">
            {id ? intl.formatMessage(COPY.unknownId, { id }) : intl.formatMessage(COPY.noId)}
          </Typo>
        </View>
      ) : (
        <ScrollView
          className="flex-1"
          contentContainerClassName="px-m pt-m pb-2xl"
          showsVerticalScrollIndicator={false}
        >
          <ClaimStatusTag claim={claim} />
          <Typo variant="headline-m" className="mt-s">
            {intl.formatMessage(COPY.quote, { quote: claim.quote })}
          </Typo>
          <Typo variant="text-m" color="on-canvas-muted" className="mt-s">
            {claim.synopsis}
          </Typo>

          <ReviewProgress stage={stageOf(claim)} />

          <Typo variant="headline-xs" className="mt-m">
            {intl.formatMessage(COPY.sourcesHeading)}
          </Typo>
          {claim.sources.length === 0 ? (
            <Card tone="surface" className="mt-s">
              <Typo variant="text-s" color="on-canvas-muted">
                {intl.formatMessage(COPY.noSources)}
              </Typo>
            </Card>
          ) : (
            claim.sources.map((source) => (
              <Pressable
                key={source.url}
                accessibilityRole="link"
                accessibilityLabel={source.note ?? source.url}
                onPress={() => openExternal(source.url)}
                className="mt-s active:opacity-80"
              >
                <Card className="flex-row">
                  <Typo variant="text-m">{credibilityDot(source.credibility)}</Typo>
                  <View className="ml-s flex-1">
                    <Typo variant="text-m">{source.note ?? source.url}</Typo>
                    <Typo variant="text-s" color="grey-500" className="mt-4xs">
                      {intl.formatMessage(COPY.credibility, { level: source.credibility })}
                    </Typo>
                  </View>
                </Card>
              </Pressable>
            ))
          )}

          <Button
            title={intl.formatMessage(COPY.submitOwn)}
            variant="outline"
            className="mt-m"
            onPress={() => openExternal(FORUM_URL)}
          />
        </ScrollView>
      )}
    </View>
  );
}

/** Three dots joined by lines, filled up to the stage reached. */
function ReviewProgress({ stage }: { stage: number }) {
  const intl = useIntl();
  return (
    <View className="mt-m flex-row items-start">
      {STAGES.map((message, i) => (
        <View key={message.id} className="flex-1 flex-row items-start">
          {i > 0 && (
            <View
              className={['flex-1 self-start', i <= stage ? 'bg-accent' : 'bg-stroke'].join(' ')}
              style={{ height: 2, marginTop: 5 }}
            />
          )}
          <View className="items-center px-2xs">
            <View
              className={[
                'rounded-full',
                i <= stage ? 'bg-accent' : 'border border-stroke bg-canvas',
              ].join(' ')}
              style={{ width: 12, height: 12 }}
            />
            <Typo
              variant="text-s"
              color={i <= stage ? 'on-canvas' : 'grey-500'}
              className="mt-3xs text-center"
              style={{ fontSize: 11 }}
            >
              {intl.formatMessage(message)}
            </Typo>
          </View>
        </View>
      ))}
    </View>
  );
}
