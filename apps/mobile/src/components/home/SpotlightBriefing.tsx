import { defineMessages, useIntl } from 'react-intl';
import { Pressable, View } from 'react-native';

import type { SpotlightIssue } from '@correctiv/app-core/data/spotlight';
import { formatDateShortDe } from '@correctiv/app-core/lib/format';

import { Card, Hairline, Overline, SplitRow, Typo } from '@/components/ui';
import { openExternal } from '@/lib/openExternal';
import { useSpotlight } from '@/lib/store/core';
import { sizes } from '@/lib/theme';

/**
 * The card's own words, in ENGLISH; the German ships in
 * `packages/catalogue/src/de/home.ts` (ADR 0026 §6). `Spotlight` is the overline and
 * is a mark, so it carries no id.
 *
 * The link says its words twice, once seen and once spoken, and they differ: the
 * eye has the overline beside it and needs no more than `allIssues`, a screen
 * reader arrives at the control alone and is told which issues. Two messages,
 * deliberately — and the arrow is decoration and stays out of both.
 */
const COPY = defineMessages({
  allIssues: { id: 'home.allIssues', defaultMessage: 'All issues' },
  allSpotlightIssues: {
    id: 'home.allSpotlightIssues',
    defaultMessage: 'All Spotlight issues',
  },
  offline: {
    id: 'home.spotlightOffline',
    defaultMessage: 'No connection. You are seeing saved issues.',
  },
});

/**
 * Spotlight on Home: the last three issues, by date and subject.
 *
 * The draft's card was an agenda of one morning, "06:58" beside a headline, and
 * this component rendered exactly that off invented data. The archive turns out to
 * be public (`wp/v2/newspack_nl_cpt`, 523 issues), and a real issue has no timed
 * entries: it is one subject and one lead. So the card is still a scannable index
 * with a small bold label on the left, and the label is now a date instead of a
 * clock. Three real days beat five invented hours.
 *
 * Tapping opens the issue on correctiv.org rather than in the reader, because a
 * newsletter's body is the sent email, tables and masthead GIF included. See
 * `data/spotlight.ts`.
 */
export function SpotlightBriefing({ onOpenArchive }: { onOpenArchive: () => void }) {
  const intl = useIntl();
  const { recent, status } = useSpotlight(3);

  // Nothing to show and nothing said: the card would be an empty box. The first
  // load resolves from the seed at worst, so this is the very first paint only.
  if (recent.length === 0) return null;

  return (
    <Card tone="surface">
      <SplitRow>
        <Overline label="Spotlight" color="on-canvas" />
        <Pressable
          onPress={onOpenArchive}
          accessibilityRole="link"
          accessibilityLabel={intl.formatMessage(COPY.allSpotlightIssues)}
          className="justify-center active:opacity-60"
          /*
           * 21 dp of link with an 8 dp slop around it before #102. The row is
           * centred rather than bottom-aligned, so the box is too, and the card's
           * header grows around the words instead of moving them.
           */
          style={{ minHeight: sizes.tapTarget }}
        >
          <Typo variant="text-s" weight="bold" color="accent">
            {intl.formatMessage(COPY.allIssues)} →
          </Typo>
        </Pressable>
      </SplitRow>

      {recent.map((issue) => (
        <IssueRow key={issue.id} issue={issue} />
      ))}

      {status === 'offline' && (
        <Typo variant="text-s" color="grey-500" className="mt-s">
          {intl.formatMessage(COPY.offline)}
        </Typo>
      )}
    </Card>
  );
}

function IssueRow({ issue }: { issue: SpotlightIssue }) {
  return (
    <View>
      {/* A hairline above every row, including the first — it separates the
          index from its own header, as in the draft. */}
      <Hairline className="mt-s" />
      <Pressable
        onPress={() => openExternal(issue.url)}
        accessibilityRole="link"
        accessibilityLabel={issue.subject}
        className="flex-row gap-s pt-s active:opacity-70"
        /*
         * A date and a subject on one line: 35 dp, and three of them stacked in the
         * card, which is the shape a thumb misses (#102). The row keeps React
         * Native's own `stretch`, so the words stay at the top where they were and
         * the nine dp arrive underneath them. `minHeight` and not `height`, so a
         * two-line subject still makes its own room.
         */
        style={{ minHeight: sizes.tapTarget }}
      >
        <Typo variant="text-s" weight="bold" color="on-canvas-muted">
          {formatDateShortDe(issue.date)}
        </Typo>
        <Typo variant="text-m" numberOfLines={2} className="flex-1">
          {issue.subject}
        </Typo>
      </Pressable>
    </View>
  );
}
