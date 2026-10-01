import { router } from 'expo-router';
import { defineMessages, useIntl } from 'react-intl';
import { View } from 'react-native';

import { CalloutCard } from '@/components/participate/CalloutCard';
import { Button, Overline, Screen, SectionCard, Typo } from '@/components/ui';
import { callouts, type Callout } from '@correctiv/app-core/data/callouts';
import { atlasStats } from '@correctiv/app-core/data/abriss-atlas';
import { claims } from '@correctiv/app-core/data/claims';
import { openExternal } from '@/lib/openExternal';

/** The fact-check desk's public tip line. */
const WHATSAPP_TIP = 'https://wa.me/4915142647500';

/**
 * Everything a person reads on this tab, in one place, with an ENGLISH
 * `defaultMessage`; the German that ships is `packages/catalogue/src/de/participate.ts`.
 *
 * The three counters are ICU plurals rather than a number glued to a noun. German
 * and English both inflect the noun, and the data can reach one: a fresh atlas
 * city or a single claim in review would otherwise read "1 Behauptungen".
 */
const COPY = defineMessages({
  screenTitle: {
    id: 'participate.title',
    defaultMessage: 'Take part',
    description:
      'The heading of the participation screen. ui.tabParticipate is the same word on the tab bar, where it has far less room, and three callout buttons say it too.',
  },
  lead: {
    id: 'participate.lead',
    defaultMessage:
      'Investigations are made with you. Your tips, your observations and your checks are what make them possible.',
  },
  activeCallouts: { id: 'participate.activeCallouts', defaultMessage: 'Open callouts' },
  forumHeading: { id: 'participate.forumHeading', defaultMessage: 'Checking claims together' },
  forumLead: {
    id: 'participate.forumLead',
    defaultMessage:
      'The community checks claims from around the web, guided by the newsroom. Right now {count, plural, one {one claim is} other {# claims are}} being worked on.',
    description:
      'The paragraph about the Faktenforum on the participation tab. {count} is how many claims the Faktenforum holds altogether, the finished ones included, not only the ones still open.',
  },
  forumAction: { id: 'participate.forumAction', defaultMessage: 'See the claims' },
  atlasHeading: { id: 'participate.atlasHeading', defaultMessage: 'Document demolitions' },
  atlasLead: {
    id: 'participate.atlasLead',
    defaultMessage:
      'Which buildings are disappearing? {reports, plural, one {One report} other {# reports}} from {cities, plural, one {one city} other {# cities}} in Germany and Switzerland.',
    description:
      'The paragraph about the demolition atlas on the participation tab. {reports} counts reports and {cities} the cities they come from.',
  },
  atlasAction: { id: 'participate.atlasAction', defaultMessage: 'See the atlas' },
  tipLabel: { id: 'participate.tipLabel', defaultMessage: 'Send a tip' },
  tipHeading: { id: 'participate.tipHeading', defaultMessage: 'Fact-check tip by WhatsApp' },
  tipLead: {
    id: 'participate.tipLead',
    defaultMessage: 'Seen a suspicious claim? Send it straight to the fact-checking desk.',
  },
  tipAction: { id: 'participate.tipAction', defaultMessage: 'Open WhatsApp' },
  communityNote: {
    id: 'participate.communityNote',
    defaultMessage:
      'In the community area you discuss investigations with other members, and soon in the app as well.',
  },
});

/**
 * The two group labels that are marks rather than words: the Faktenforum and the
 * Abriss-Atlas are named the same in every language, so they carry no id — the
 * exception `gate/LoginGate.tsx` makes for the wordmark, one level up.
 */
const FAKTENFORUM = 'Faktenforum';
const ABRISS_ATLAS = 'Abriss-Atlas';

/**
 * Mitmachen — the four ways in: CrowdNewsroom callouts, the Faktenforum, the
 * demolition atlas, and a tip by WhatsApp.
 *
 * Laid out after the design draft: one group label and one card with exactly one
 * button per area. A card rather than the icon row an earlier design used: it
 * carries the explanation better, and with four areas the space is worth it.
 */
export default function MitmachenScreen() {
  const intl = useIntl();

  return (
    <Screen>
      <Typo variant="headline-xl">{intl.formatMessage(COPY.screenTitle)}</Typo>
      <Typo variant="text-m" color="on-canvas-muted" className="mt-2xs">
        {intl.formatMessage(COPY.lead)}
      </Typo>

      <View className="mt-l">
        <Overline label={intl.formatMessage(COPY.activeCallouts)} />
        <View className="mt-2xs">
          {callouts.map((callout) => (
            <CalloutCard key={callout.slug} callout={callout} onPress={openCallout} />
          ))}
        </View>
      </View>

      <SectionCard label={FAKTENFORUM} tone="surface" className="mt-m">
        <Typo variant="headline-xs">{intl.formatMessage(COPY.forumHeading)}</Typo>
        <Typo variant="text-s" color="on-canvas-muted" className="mt-2xs">
          {intl.formatMessage(COPY.forumLead, { count: claims.length })}
        </Typo>
        <Button
          title={intl.formatMessage(COPY.forumAction)}
          variant="outline"
          onPress={() => router.push('/faktenforum')}
          className="mt-s"
        />
      </SectionCard>

      <SectionCard label={ABRISS_ATLAS} className="mt-m">
        <Typo variant="headline-xs">{intl.formatMessage(COPY.atlasHeading)}</Typo>
        <Typo variant="text-s" color="on-canvas-muted" className="mt-2xs">
          {intl.formatMessage(COPY.atlasLead, {
            reports: atlasStats.totalReports,
            cities: atlasStats.citiesCovered,
          })}
        </Typo>
        <Button
          title={intl.formatMessage(COPY.atlasAction)}
          variant="outline"
          onPress={() => router.push('/atlas')}
          className="mt-s"
        />
      </SectionCard>

      <SectionCard label={intl.formatMessage(COPY.tipLabel)} tone="surface" className="mt-m">
        <Typo variant="headline-xs">{intl.formatMessage(COPY.tipHeading)}</Typo>
        <Typo variant="text-s" color="on-canvas-muted" className="mt-2xs">
          {intl.formatMessage(COPY.tipLead)}
        </Typo>
        <Button
          title={intl.formatMessage(COPY.tipAction)}
          variant="outline"
          onPress={() => openExternal(WHATSAPP_TIP)}
          className="mt-s"
        />
      </SectionCard>

      <Typo variant="text-s" color="grey-500" className="mt-l">
        {intl.formatMessage(COPY.communityNote)}
      </Typo>
    </Screen>
  );
}

function openCallout(callout: Callout) {
  router.push({ pathname: '/aufruf/[slug]', params: { slug: callout.slug } });
}
