import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { defineMessages, useIntl } from 'react-intl';
import { Pressable, ScrollView, View } from 'react-native';

import { Badge, Button, Card, Overline, ScreenHeader, SectionCard, Typo } from '@/components/ui';
import {
  clubNewsletter,
  diaries,
  earlyAccess,
  events,
  qa,
  verlagPerk,
  type DiaryEntry,
} from '@correctiv/app-core/data/backstage';
import { formatDateShortDe } from '@correctiv/app-core/lib/format';
import { openArticle } from '@/lib/openArticle';
import { openExternal } from '@/lib/openExternal';
import { useColors } from '@/lib/theme';

/**
 * The shelf labels and actions, in ENGLISH; the German ships in
 * `packages/catalogue/src/de/backstage.ts` (ADR 0026 §6).
 *
 * Three words on this screen are NOT here, and deliberately: `Backstage` (the
 * header, the headline) and `Club` (the badge) are marks, and a catalogue entry
 * mapping Backstage to Backstage is a line for a translator to wonder about — the
 * call `components/gate/LoginGate.tsx` makes for the wordmark. `Backstage-Brief`
 * is a message, because only half of it is the mark.
 *
 * Everything under these labels — the early-access article, the letter, the
 * questions, the dates — is content from `@correctiv/app-core/data/backstage` and
 * is rendered as it arrives.
 */
const COPY = defineMessages({
  earlyAccess: { id: 'backstage.earlyAccessLabel', defaultMessage: 'Read it earlier' },
  publicFrom: {
    id: 'backstage.publicFrom',
    defaultMessage: 'Public from {date}',
    description:
      'On a Backstage card for a piece members read before everybody else. {date} is a weekday out of the content, already written as a word and in German, not a formatted date.',
  },
  readNow: { id: 'backstage.readNow', defaultMessage: 'Read it now' },
  diary: {
    id: 'backstage.diaryLabel',
    defaultMessage: 'Research diary',
    description:
      "The group heading over the research-diary entries on the Backstage screen. `diary.screenTitle` is the same words as the name of a single entry's route, which on the web target is the browser tab.",
  },
  letter: { id: 'backstage.letterLabel', defaultMessage: 'Backstage letter' },
  qa: { id: 'backstage.qaLabel', defaultMessage: 'Questions and answers' },
  events: { id: 'backstage.eventsLabel', defaultMessage: 'Dates' },
  publisher: { id: 'backstage.publisherLabel', defaultMessage: 'Publishing house' },
  shop: { id: 'backstage.shop', defaultMessage: 'To the shop' },
});

/**
 * Backstage — early access, the research diary, the club letter, the Q&A, events,
 * the publishing house.
 *
 * Nothing here is locked, and that has not changed: the rule was and is that the club
 * is closeness rather than a paywall. What has gone is the second copy for a guest,
 * because since the door (ADR 0016) there is no guest to tease. Removed with ADR 0018.
 */
export default function BackstageScreen() {
  const intl = useIntl();

  return (
    <View className="flex-1 bg-canvas">
      <ScreenHeader title="Backstage" />
      <ScrollView
        className="flex-1"
        contentContainerClassName="px-m pt-m pb-2xl"
        showsVerticalScrollIndicator={false}
      >
        <Badge label="Club" tone="club" />
        <Typo variant="headline-xl" className="mt-s">
          Backstage
        </Typo>

        <SectionCard
          label={intl.formatMessage(COPY.earlyAccess)}
          labelColor="accent"
          className="mt-l"
        >
          <Typo variant="headline-xs">{earlyAccess.title}</Typo>
          <Typo variant="text-s" color="on-canvas-muted" className="mt-2xs">
            {earlyAccess.teaser}
          </Typo>
          <Typo variant="text-s" color="grey-500" className="mt-s">
            {intl.formatMessage(COPY.publicFrom, { date: earlyAccess.publicFromLabel })}
          </Typo>
          <Button
            title={intl.formatMessage(COPY.readNow)}
            className="mt-s"
            onPress={() => openArticle({ url: earlyAccess.articleUrl, title: earlyAccess.title })}
          />
        </SectionCard>

        <View className="mt-m">
          <Overline label={intl.formatMessage(COPY.diary)} />
          <View className="mt-2xs">
            {diaries.map((entry) => (
              <DiaryRow key={entry.id} entry={entry} />
            ))}
          </View>
        </View>

        <SectionCard label={intl.formatMessage(COPY.letter)} tone="surface" className="mt-m">
          <Typo variant="headline-xs">{clubNewsletter.subject}</Typo>
          <Typo variant="text-s" color="grey-500" className="mt-4xs">
            {formatDateShortDe(clubNewsletter.date)}
          </Typo>
          {clubNewsletter.paragraphs.map((paragraph) => (
            <Typo key={paragraph.slice(0, 24)} variant="text-s" className="mt-s">
              {paragraph}
            </Typo>
          ))}
        </SectionCard>

        <SectionCard label={intl.formatMessage(COPY.qa)} className="mt-m">
          <Typo variant="headline-xs">{qa.title}</Typo>
          <Typo variant="text-s" color="on-canvas-muted" className="mt-2xs">
            {qa.description}
          </Typo>
          <Typo variant="text-s" color="accent" className="mt-s">
            {qa.deadlineLabel}
          </Typo>
        </SectionCard>

        <View className="mt-m">
          <Overline label={intl.formatMessage(COPY.events)} />
          {events.map((event) => (
            <Card key={event.id} className="mt-2xs">
              <Typo variant="headline-xs">{event.title}</Typo>
              <Typo variant="text-s" color="grey-500" className="mt-4xs">
                {formatDateShortDe(event.date)} · {event.location}
              </Typo>
              <Typo variant="text-s" color="on-canvas-muted" className="mt-2xs">
                {event.description}
              </Typo>
            </Card>
          ))}
        </View>

        <SectionCard label={intl.formatMessage(COPY.publisher)} tone="surface" className="mt-m">
          <Typo variant="headline-xs">{verlagPerk.title}</Typo>
          <Typo variant="text-s" color="on-canvas-muted" className="mt-2xs">
            {verlagPerk.description}
          </Typo>
          <Button
            title={intl.formatMessage(COPY.shop)}
            variant="outline"
            className="mt-s"
            onPress={() => openExternal(verlagPerk.shopUrl)}
          />
        </SectionCard>
      </ScrollView>
    </View>
  );
}

function DiaryRow({ entry }: { entry: DiaryEntry }) {
  const colors = useColors();
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={entry.title}
      onPress={() => router.push({ pathname: '/tagebuch/[id]', params: { id: entry.id } })}
      className="flex-row items-center border-b border-stroke py-s active:opacity-70"
    >
      <View className="flex-1 pr-s">
        <Overline label={entry.series} />
        <Typo variant="text-m" weight="bold" className="mt-4xs">
          {entry.title}
        </Typo>
        <Typo variant="text-s" color="on-canvas-muted" numberOfLines={2} className="mt-4xs">
          {entry.teaser}
        </Typo>
      </View>
      <Ionicons name="chevron-forward" size={16} color={colors['grey-500']} />
    </Pressable>
  );
}
