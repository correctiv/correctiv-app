import { router } from 'expo-router';
import { defineMessages, useIntl, type IntlShape, type MessageDescriptor } from 'react-intl';
import { Pressable, View } from 'react-native';

import { ClubCard } from '@/components/profile/ClubCard';
import { NavCard } from '@/components/profile/NavCard';
import { SettingRow } from '@/components/profile/SettingRow';
import { Button, Hairline, Overline, Screen, SectionCard, SplitRow, Typo } from '@/components/ui';
import { formatDateShortDe } from '@correctiv/app-core/lib/format';
import type { NewsletterKey } from '@correctiv/app-core/stores/settings';
import type { Entitlement } from '@correctiv/app-core/types/models';
import { quarterlyReport } from '@correctiv/app-core/data/quartalsbericht';
import { useInvestigations } from '@/lib/feeds/useFeed';
import { TIER_LABELS } from '@/lib/membership/tierLabel';
import { openArticle } from '@/lib/openArticle';
import { openExternal } from '@/lib/openExternal';
import { useCoreActions, useSavedArticles, useSession, useSettings } from '@/lib/store/core';
import { sizes } from '@/lib/theme';

/**
 * Everything a person reads on the profile, in one place.
 *
 * The `defaultMessage` of each is ENGLISH and the German that ships is in
 * `packages/catalogue/src/de/profile.ts`, which is the shape ADR 0026 §6 decided and
 * `components/gate/LoginGate.tsx` set out. The tier names are NOT here: they name a
 * domain enum the door prints too, so they sit in `lib/membership/tierLabel.ts`.
 *
 * Two of these are the app's first ICU selections, and both were ternaries.
 */
const COPY = defineMessages({
  screenTitle: {
    id: 'profile.title',
    defaultMessage: 'Profile',
    description:
      'The heading of the profile screen. ui.tabProfile is the same word on the tab bar, where it has far less room.',
  },

  membershipSection: { id: 'profile.membership.section', defaultMessage: 'Your membership' },
  tierRow: { id: 'profile.membership.tier', defaultMessage: 'Tier' },
  sourceRow: { id: 'profile.membership.source', defaultMessage: 'Access through' },
  validUntilRow: { id: 'profile.membership.validUntil', defaultMessage: 'Runs until' },
  localAreasRow: { id: 'profile.membership.localAreas', defaultMessage: 'Local newsletters' },
  manageAccount: { id: 'profile.membership.manageAccount', defaultMessage: 'Manage account' },
  manageAccountNote: {
    id: 'profile.membership.note',
    defaultMessage:
      'You manage your contribution, your payment method and your data in your account on correctiv.org.',
  },

  impactSection: { id: 'profile.impact.section', defaultMessage: 'Your impact' },
  /**
   * The card's sentence when the entitlement carries no date, in two states.
   *
   * The clause about the list is a `select` INSIDE the message rather than a second
   * sentence appended to it: where it goes, and whether the language wants a colon
   * there at all, is the translator's question and not TypeScript's.
   */
  impactAnonymous: {
    id: 'profile.impact.anonymous',
    defaultMessage:
      'Your contribution makes these investigations possible.{articles, select, some { Among others, these:} other {}}',
    description:
      "The impact card's sentence when the membership carries no start date. {articles} is a choice and not a value: `some` when investigations are listed under the card, `other` when there are none. Where that clause goes, and whether the language wants a colon there at all, is the translator's decision.",
  },
  /**
   * The same sentence for somebody the app can count months for.
   *
   * A real ICU plural, not a ternary in disguise: German says "seit Kurzem" where
   * the count is one and "seit N Monaten" otherwise, so the `one` branch is a
   * PHRASE rather than a number, which is exactly what a plural form is for and
   * exactly what a second language would have had to undo. `months` is never
   * below 1 (see `impactLine`), so `one` is the short form and `other` counts.
   */
  impactSince: {
    id: 'profile.impact.since',
    defaultMessage:
      'You have been supporting CORRECTIV {months, plural, one {for a short while} other {for # months}}.{articles, select, some { Among others, these investigations were made possible:} other {}}',
    description:
      "The impact card's sentence when the membership's months can be counted. {months} is never below one, so the singular branch is the phrase for ‘not long’ and the plural branch counts. {articles} is a choice and not a value: `some` when investigations are listed under the card, `other` when there are none.",
  },

  areaSection: { id: 'profile.area.section', defaultMessage: 'Your area' },
  reportSubtitle: {
    id: 'profile.nav.reportSubtitle',
    defaultMessage: 'Where your contribution goes, broken down transparently.',
  },
  backstage: { id: 'profile.nav.backstage', defaultMessage: 'Your Backstage' },
  backstageSubtitle: {
    id: 'profile.nav.backstageSubtitle',
    defaultMessage: 'Diaries, bonus episodes, events',
  },
  saved: {
    id: 'profile.nav.saved',
    defaultMessage: 'Saved articles',
    description:
      'The row in the profile that leads to the saved articles. profile.saved.title is the same words as the heading of the screen it opens.',
  },
  /**
   * How full the saved list is, as one message with three cases.
   *
   * `=0` is a state and not a count, which is why it says something else entirely;
   * `one` and `other` are German's two plural forms and the app's first. A language
   * with more of them adds a branch here and changes no code.
   */
  savedCount: {
    id: 'profile.nav.savedCount',
    defaultMessage: '{count, plural, =0 {Nothing saved yet} one {# article} other {# articles}}',
    description:
      'The subtitle of the Saved articles row in the profile. {count} is how many articles are saved, and the zero case is a sentence rather than a number.',
  },
  settings: { id: 'profile.nav.settings', defaultMessage: 'App settings' },
  settingsSubtitle: {
    id: 'profile.nav.settingsSubtitle',
    defaultMessage: 'Notifications, text size, About CORRECTIV',
  },

  newsletterSection: { id: 'profile.newsletter.section', defaultMessage: 'Newsletter' },
  spotlight: {
    id: 'profile.newsletter.spotlight',
    defaultMessage: 'The most important stories, on weekday mornings',
  },
  spotlightCh: {
    id: 'profile.newsletter.spotlightCh',
    defaultMessage: 'Investigations from Switzerland',
  },
  klima: {
    id: 'profile.newsletter.klima',
    defaultMessage: 'The climate investigations of the week',
  },
});

/**
 * Where "Konto verwalten" goes, and why it is a constant rather than a literal.
 *
 * The address is provisional. beabee will own the account page and does not have one
 * yet, so this points at the only page the app knows. What the link may SAY, and how
 * it may LOOK, is the part with rules behind it: outside the US a link to one's own
 * site needs Apple's External Link Account Entitlement, which permits managing an
 * account, forbids naming a price, and wants the link formatted as a plain text link
 * that names the domain, shown behind Apple's own interstitial sheet. So the label is
 * `COPY.manageAccount` and never an invitation to raise a contribution; the button form
 * and the missing sheet are open together with the address, and ADR 0020 records all
 * three. Separate from
 * the door's own link, which is an upgrade offer to somebody who has no access, so
 * that the two can be decided apart.
 */
const ACCOUNT_URL = 'https://correctiv.org/unterstuetzen/';

/**
 * Why the app is open, in the reader's words. Mirrors `EntitlementSource`.
 *
 * Typed as the record rather than left to inference, so a fourth source fails to
 * compile here instead of leaving this row blank.
 */
const SOURCE_LABELS: Record<NonNullable<Entitlement['source']>, MessageDescriptor> = defineMessages(
  {
    paid: { id: 'profile.source.paid', defaultMessage: 'your contribution' },
    'local-bundle': { id: 'profile.source.localBundle', defaultMessage: 'your local subscription' },
    trial: { id: 'profile.source.trial', defaultMessage: 'your trial' },
  },
);

/**
 * The three newsletters from the concept. State lives in the core store, so a
 * choice survives a restart.
 *
 * A newsletter's NAME is its name in every language — the same exception the door
 * makes for the wordmark — so only the line under it is a message.
 */
const NEWSLETTERS: Array<{ key: NewsletterKey; label: string; description: MessageDescriptor }> = [
  { key: 'spotlight', label: 'Spotlight', description: COPY.spotlight },
  { key: 'spotlightCh', label: 'Spotlight Schweiz', description: COPY.spotlightCh },
  { key: 'klima', label: 'Klima', description: COPY.klima },
];

/** How many investigations the impact card names. */
const IMPACT_COUNT = 3;

/**
 * Profil — membership, impact, report, backstage, saved articles, newsletters,
 * settings.
 *
 * Every section used to hang on `isMember`, with a second copy for a guest. Since
 * the door (ADR 0016) there is no guest here: whoever renders this screen signed in
 * with an entitlement that includes the app. The branches are gone with ADR 0018,
 * and what identifies the reader now comes from the session rather than from the
 * simulated club lever.
 *
 * The membership section used to set a contribution: an amount, an interval, and a
 * pause switch. It is a reading of the answer now, with one link out, because the app
 * offers no payment functions (ADR 0020).
 */
export default function ProfilScreen() {
  const actions = useCoreActions();
  const session = useSession();
  const settings = useSettings();
  const saved = useSavedArticles();
  const intl = useIntl();
  const entitlement = session.entitlement;

  /**
   * The impact card's investigations come through the store, not out of the
   * generated bundle. Reading `offlineBundle.generated` here imported the whole
   * 6000-line module into this route independently of the `ContentBundle` port, and
   * evaluated the pick once at module scope, so the list could never go live. The
   * feed cascade answers from the network first and falls back to the same bundle
   * through the port, which is the arrangement every other list in the app has had
   * since ADR 0015. `web-target.test.ts` keeps the direct import from coming back.
   *
   * That `recherchen` is the site-wide stream and carries fact checks too is the
   * core's to know: this screen asks for investigations and gets them.
   */
  const impactArticles = useInvestigations(IMPACT_COUNT);

  const tierLabel = intl.formatMessage(TIER_LABELS[entitlement?.tier ?? 'paid']);

  return (
    <Screen>
      <Typo variant="headline-xl">{intl.formatMessage(COPY.screenTitle)}</Typo>

      <ClubCard
        name={session.account?.name ?? ''}
        tierLabel={tierLabel}
        memberSince={entitlement?.memberSince ?? null}
      />

      <SectionCard label={intl.formatMessage(COPY.membershipSection)} className="mt-l">
        <Row label={intl.formatMessage(COPY.tierRow)} value={tierLabel} />
        {entitlement?.source && (
          <>
            <Hairline className="my-2xs" />
            <Row
              label={intl.formatMessage(COPY.sourceRow)}
              value={intl.formatMessage(SOURCE_LABELS[entitlement.source])}
            />
          </>
        )}
        {entitlement?.validUntil && (
          <>
            <Hairline className="my-2xs" />
            <Row
              label={intl.formatMessage(COPY.validUntilRow)}
              value={formatDateShortDe(entitlement.validUntil)}
            />
          </>
        )}
        {entitlement && entitlement.localAreas.length > 0 && (
          <>
            <Hairline className="my-2xs" />
            <Row
              label={intl.formatMessage(COPY.localAreasRow)}
              value={entitlement.localAreas.join(', ')}
            />
          </>
        )}
        <Button
          title={intl.formatMessage(COPY.manageAccount)}
          variant="secondary"
          fullWidth
          onPress={() => openExternal(ACCOUNT_URL)}
          className="mt-s"
        />
        <Typo variant="text-s" color="on-canvas-muted" className="mt-s">
          {intl.formatMessage(COPY.manageAccountNote)}
        </Typo>
      </SectionCard>

      <SectionCard label={intl.formatMessage(COPY.impactSection)} tone="surface" className="mt-m">
        <Typo variant="text-m">
          {impactLine(intl, entitlement?.memberSince ?? null, impactArticles.length > 0)}
        </Typo>
        {/*
          A LINK, not a paragraph that happens to be tappable. `<Typo onPress>`
          opens the reader, and MEASURED in the render tree it carried no
          `accessibilityRole` and no `accessibilityLabel` — so TalkBack and
          VoiceOver read the headline out with nothing to say it can be opened,
          and a tap gave no feedback. The `Pressable` carries the role, the name
          and the press state; the `Typo` keeps the type.
        */}
        {impactArticles.map((article) => (
          <Pressable
            key={article.url}
            onPress={() => openArticle(article)}
            accessibilityRole="link"
            accessibilityLabel={article.title}
            className="mt-s justify-center active:opacity-70"
            /*
             * One line of `text-m` is 23 dp, and these are stacked directly under
             * one another in the card, which is the arrangement a thumb lands
             * between (#102). No slop rectangle would have been safe here for that
             * reason; the box can grow because the gap between them is a margin.
             */
            style={{ minHeight: sizes.tapTarget }}
          >
            <Typo variant="text-m" weight="semibold" numberOfLines={2}>
              {article.title}
            </Typo>
          </Pressable>
        ))}
      </SectionCard>

      <View className="mt-m">
        <Overline label={intl.formatMessage(COPY.areaSection)} />
        <View className="mt-2xs">
          <NavCard
            icon="document-text-outline"
            title={quarterlyReport.quarter}
            subtitle={intl.formatMessage(COPY.reportSubtitle)}
            club
            onPress={() => router.push('/bericht')}
          />
          <NavCard
            icon="sparkles-outline"
            title={intl.formatMessage(COPY.backstage)}
            subtitle={intl.formatMessage(COPY.backstageSubtitle)}
            club
            onPress={() => router.push('/backstage')}
          />
          <NavCard
            icon="bookmark-outline"
            title={intl.formatMessage(COPY.saved)}
            subtitle={intl.formatMessage(COPY.savedCount, { count: saved.length })}
            onPress={() => router.push('/gespeichert')}
          />
          <NavCard
            icon="settings-outline"
            title={intl.formatMessage(COPY.settings)}
            subtitle={intl.formatMessage(COPY.settingsSubtitle)}
            onPress={() => router.push('/einstellungen')}
          />
        </View>
      </View>

      <SectionCard label={intl.formatMessage(COPY.newsletterSection)} className="mt-m">
        {NEWSLETTERS.map((newsletter, i) => (
          <View key={newsletter.key}>
            {i > 0 && <Hairline className="my-2xs" />}
            <SettingRow
              label={newsletter.label}
              description={intl.formatMessage(newsletter.description)}
              value={settings.newsletter[newsletter.key]}
              onValueChange={(value) => actions.settings.setNewsletter(newsletter.key, value)}
            />
          </View>
        ))}
      </SectionCard>
    </Screen>
  );
}

/**
 * How long they have been aboard — rough, but never "for 0 months".
 *
 * Tolerates a missing date, because one is reachable: an entitlement persisted by a
 * build before `memberSince` existed hydrates without it and is kept until the next
 * sign-in (see `Entitlement.memberSince`). An empty card is worse than a sentence
 * that does not count months.
 *
 * `hasArticles` exists because the list is loaded rather than bundled at module
 * scope: for the moment before the feed answers there is nothing to introduce, and
 * a sentence ending in a colon over an empty card reads as a defect. It reaches the
 * message as a `select` argument rather than as a choice between two ids, so the
 * clause it turns on stays inside the sentence it belongs to.
 *
 * Takes the `IntlShape` rather than calling the hook, because it is not a component
 * and the two states it answers for are the caller's to know.
 */
function impactLine(intl: IntlShape, memberSince: string | null, hasArticles: boolean): string {
  const articles = hasArticles ? 'some' : 'none';
  if (!memberSince) return intl.formatMessage(COPY.impactAnonymous, { articles });
  const months = Math.max(
    1,
    Math.round((Date.now() - new Date(memberSince).getTime()) / (30 * 864e5)),
  );
  return intl.formatMessage(COPY.impactSince, { months, articles });
}

/**
 * One label/value line in the membership card.
 *
 * `shrink text-right` is the guard against a value wider than the whole row, and
 * not a way of keeping it on the label's line: `SplitRow` wraps, and a flex line
 * breaks before anything on it is shrunk. At 200 % system font this card reads
 * with "Stufe" over its value, left aligned, and "Zugang über" beside its own,
 * right aligned, because only the first one is too long for the row — one card,
 * two readings, both whole. Photographed in both appearance settings as
 * `screens/evidence/158-membership-rows-at-200-light.webp` and its dark twin;
 * `ui/SplitRow`'s docblock carries the argument.
 */
function Row({ label, value }: { label: string; value: string }) {
  return (
    <SplitRow align="baseline">
      <Typo variant="text-m" color="on-canvas-muted">
        {label}
      </Typo>
      <Typo variant="text-m" weight="semibold" className="shrink text-right">
        {value}
      </Typo>
    </SplitRow>
  );
}
