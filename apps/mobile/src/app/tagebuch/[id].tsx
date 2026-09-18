import { useLocalSearchParams } from 'expo-router';
import { defineMessages, useIntl } from 'react-intl';
import { ScrollView, View } from 'react-native';

import { Overline, ScreenHeader, Typo } from '@/components/ui';
import { diaries } from '@correctiv/app-core/data/backstage';
import { formatDateShortDe } from '@correctiv/app-core/lib/format';

/**
 * Everything this screen says, in ENGLISH; the German ships in
 * `packages/catalogue/src/de/diary.ts` (ADR 0026 §6). The entry itself is content
 * from `@correctiv/app-core/data/backstage`.
 *
 * `unknownId` carries the German quotation marks INSIDE the message rather than
 * around it in the markup: they are part of the sentence, and a language that
 * quotes differently should get its own pair.
 */
const COPY = defineMessages({
  screenTitle: {
    id: 'diary.screenTitle',
    defaultMessage: 'Research diary',
    description:
      "The diary route's name. On the web target it is the browser tab's title; on iOS and Android the header does not draw it. `backstage.diaryLabel` is the same words as the group heading over the diary entries on the Backstage screen.",
  },
  notFound: { id: 'diary.notFound', defaultMessage: 'This entry does not exist' },
  unknownId: {
    id: 'diary.unknownId',
    defaultMessage: 'Unknown identifier "{id}".',
    description:
      'Shown when the diary screen is opened with an identifier no entry has. {id} is that identifier, unchanged, in quotation marks. Three other screens say the same under `claim.unknownId`, `project.unknownId` and `series.unknownId`.',
  },
  noId: {
    id: 'diary.noId',
    defaultMessage: 'No identifier was passed.',
    description:
      'Shown when the diary screen is opened with no identifier at all. Four other screens say the same thing under callout.detail.noSlug, claim.noId, project.noId and series.noId.',
  },
});

/** The diary entries are fixed — one file per entry in the static export. */
export function generateStaticParams(): { id: string }[] {
  return diaries.map((entry) => ({ id: entry.id }));
}

/** One research-diary entry: series, title, date, body copy. */
export default function TagebuchScreen() {
  const intl = useIntl();
  const { id } = useLocalSearchParams<{ id: string }>();
  const entry = diaries.find((d) => d.id === id) ?? null;

  return (
    <View className="flex-1 bg-canvas">
      <ScreenHeader title={intl.formatMessage(COPY.screenTitle)} />

      {!entry ? (
        <View className="flex-1 items-center justify-center px-m">
          <Typo variant="headline-s" className="text-center">
            {intl.formatMessage(COPY.notFound)}
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
          <Overline label={entry.series} color="accent" />
          <Typo variant="headline-l" className="mt-2xs">
            {entry.title}
          </Typo>
          <Typo variant="text-s" color="grey-500" className="mt-2xs">
            {formatDateShortDe(entry.date)}
          </Typo>

          {entry.body.map((paragraph) => (
            <Typo key={paragraph.slice(0, 24)} variant="text-article" className="mt-s">
              {paragraph}
            </Typo>
          ))}
        </ScrollView>
      )}
    </View>
  );
}
