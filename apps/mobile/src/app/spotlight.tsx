import { defineMessages, useIntl } from 'react-intl';
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';

import type { SpotlightIssue } from '@correctiv/app-core/data/spotlight';
import { formatDateWeekday } from '@correctiv/app-core/lib/format';

import { Hairline, ScreenHeader, Typo } from '@/components/ui';
import { openExternal } from '@/lib/openExternal';
import { useLocale, useSpotlight } from '@/lib/store/core';
import { useColors } from '@/lib/theme';

/**
 * The two sentences the archive adds, in ENGLISH; the German ships in
 * `packages/catalogue/src/de/home.ts` (ADR 0026 §6) — the same namespace as the card
 * on Home, because they are the same feature seen from two places.
 *
 * `Spotlight` itself is a mark and carries no id, in the header and in the
 * headline; the issues are content.
 */
const COPY = defineMessages({
  lead: {
    id: 'home.spotlightLead',
    defaultMessage: 'The day in brief, every morning in the newsletter.',
  },
  offlineArchive: {
    id: 'home.spotlightOfflineArchive',
    defaultMessage: 'No connection. You are seeing saved issues from the end of the summer.',
  },
});

/**
 * The Spotlight archive, live.
 *
 * This screen used to carry the line "Beispielausgaben. Die verlinkten Recherchen
 * sind echt.", because the issues were modelled on the note that the archive was
 * not public. It is public: `wp/v2/newspack_nl_cpt` held 523 issues on 2026-09-01.
 * The twelve newest are what this shows, and the disclaimer only appears when the
 * app is actually falling back to its four bundled issues.
 */
export default function SpotlightScreen() {
  const intl = useIntl();
  const colors = useColors();
  const { issues, status } = useSpotlight();

  return (
    <View className="flex-1 bg-canvas">
      <ScreenHeader title="Spotlight" />
      <ScrollView
        className="flex-1"
        contentContainerClassName="px-m pt-m pb-2xl"
        showsVerticalScrollIndicator={false}
      >
        <Typo variant="headline-l">Spotlight</Typo>
        <Typo variant="text-m" color="on-canvas-muted" className="mt-2xs">
          {intl.formatMessage(COPY.lead)}
        </Typo>

        {status === 'offline' && (
          <Typo variant="text-s" color="grey-500" className="mt-2xs">
            {intl.formatMessage(COPY.offlineArchive)}
          </Typo>
        )}

        {status === 'loading' && issues.length === 0 && (
          <View className="py-2xl">
            <ActivityIndicator color={colors.accent} />
          </View>
        )}

        <View className="mt-s">
          {issues.map((issue) => (
            <IssueBlock key={issue.id} issue={issue} />
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

function IssueBlock({ issue }: { issue: SpotlightIssue }) {
  const locale = useLocale();
  return (
    <View>
      <Hairline className="mt-m" />
      <Pressable
        onPress={() => openExternal(issue.url)}
        accessibilityRole="link"
        accessibilityLabel={issue.subject}
        className="pt-m active:opacity-70"
      >
        <Typo variant="text-s" weight="bold" color="accent">
          {formatDateWeekday(issue.date, locale)}
        </Typo>
        <Typo variant="headline-xs" className="mt-4xs">
          {issue.subject}
        </Typo>
        {issue.teaser ? (
          <Typo variant="text-m" color="on-canvas-muted" className="mt-4xs">
            {issue.teaser}
          </Typo>
        ) : null}
      </Pressable>
    </View>
  );
}
