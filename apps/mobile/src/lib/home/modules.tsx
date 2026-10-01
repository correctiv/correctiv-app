import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import { ActivityIndicator, View } from 'react-native';

import type { Instant } from '@correctiv/app-core/lib/berlin-time';
import type { HomeSection } from '@correctiv/app-core/lib/home-layout';
import { itemCount, pinnedItem } from '@correctiv/app-core/lib/home-settings';
import { callouts } from '@correctiv/app-core/data/callouts';
import { pinnedArticle } from '@correctiv/app-core/data/home-pins';

import { ArticleHero } from '@/components/feed/ArticleHero';
import { ArticleRow } from '@/components/feed/ArticleRow';
import { FaktencheckRail } from '@/components/feed/FaktencheckRail';
import { BackstageTeaser } from '@/components/home/BackstageTeaser';
import { CalloutTeaser } from '@/components/home/CalloutTeaser';
import { EarlyAccessCard } from '@/components/home/EarlyAccessCard';
import { HomeHeader } from '@/components/home/HomeHeader';
import { ImpactFooter } from '@/components/home/ImpactFooter';
import { MediathekReihe } from '@/components/home/MediathekReihe';
import { SpotlightBriefing } from '@/components/home/SpotlightBriefing';
import { Hairline, SectionHeader, Typo } from '@/components/ui';
import { FACT_CHECK_COUNT, HERO_PIN, RESEARCH_COUNT } from '@/lib/home/settings';
import { useFeed } from '@/lib/feeds/useFeed';
import { openArticle } from '@/lib/openArticle';
import { useColors } from '@/lib/theme';

/**
 * Everything Home can draw, addressed by the name the layout document uses.
 *
 * This is the host's half of ADR 0036: the document says which places exist and in what
 * order, and this file says what a place named `spotlight-briefing` actually renders.
 * The screen (`app/(tabs)/index.tsx`) is then a loop, and the source order that used to
 * BE the layout is `@correctiv/app-core/data/home.layout.json`.
 *
 * **The map is the app's vocabulary, so it is asserted in both directions.**
 * `__tests__/home-layout.test.tsx` fails if the document names a module with no entry
 * here, and fails if an entry here is named by no section — the second half is the one a
 * type cannot see, and it is what stops a module being written, forgotten and never
 * drawn.
 *
 * It sits in `lib/` rather than in `components/` deliberately. These are compositions of
 * this one screen, not components of the app: the gallery walks `src/components` and
 * would ask each of them for a catalogue entry and a specimen, and a specimen of
 * "the fact-check rail plus its heading" is the screen.
 */

/**
 * The words Home adds around the feeds, in ENGLISH; the German ships in
 * `packages/catalogue/src/de/home.ts` (ADR 0026 §6). Everything else on this screen belongs
 * to a card, and each card carries its own.
 *
 * The arrows stay out of the messages, and out of the call site too: `SectionHeader`
 * draws its own, because decoration on a link belongs to whoever draws the link.
 */
const COPY = defineMessages({
  offlineArticles: {
    id: 'home.offlineArticles',
    defaultMessage: 'No connection. You are seeing saved articles.',
  },
  latestResearch: { id: 'home.latestResearch', defaultMessage: 'Latest investigations' },
  factChecks: { id: 'home.factChecks', defaultMessage: 'Fact checks' },
  viewAll: { id: 'home.viewAll', defaultMessage: 'See all' },
  viewEverything: { id: 'home.viewEverything', defaultMessage: 'See everything' },
});

/** A mark, not a sentence: the shelf keeps its name in every language. */
const MEDIATHEK = 'Mediathek';

/**
 * The lifted position of the callout, by the id the document gives it.
 *
 * ADR 0036 §2 keeps both positions written in the screen and makes only the choice
 * between them data, and the two differ by more than order: above the hero the card
 * needs a bottom margin, because the hero runs edge to edge and has no top margin of its
 * own. The id is the document's stable address, so this is the thing to key that spacing
 * on — and `__tests__/home-layout.test.tsx` asserts the shipped document still carries
 * it, so renaming the section fails there rather than quietly loosening the gap.
 */
export const LIFTED_CALLOUT = 'callout-lifted';

/** The address a section gets in the rendered tree, for tests and for the workbench. */
export const placeTestID = (id: string): string => `home-section-${id}`;

/*
 * The settings below come from `settings.ts` beside this file by name, and the default
 * each one carries comes with it. ADR 0039 §4 puts the TABLE in the core, because the
 * parser has to refuse a key a module does not understand and refusing means knowing;
 * ADR 0045 §9 puts the DECLARATION here, because a module and its settings are one thing
 * to write and one thing to read, and `scripts/generate-home-settings.mjs` carries the
 * one into the other. What it buys HERE is that "five investigations under the lead" is
 * not a number in this file AND a number the editor has to repeat to show what happens
 * when nobody has chosen.
 */

export interface HomeModuleProps {
  readonly section: HomeSection;
  /**
   * The instant the fold drew this render at — the screen's `useHomeInstant(layout)`,
   * passed down rather than re-read, so that a module reading the time agrees with the
   * one that decided whether it appears at all (#254). Most modules have no use for it;
   * `HomeHeaderModule` is the one that does.
   */
  readonly instant: Instant;
}

/** A renderer for one place. Returns null when it has nothing to show. */
export type HomeModule = (props: HomeModuleProps) => ReactNode;

/**
 * One place's root element, carrying the section's id and the spacing above it.
 *
 * The spacing is the renderer's rather than the document's, because a margin is not
 * something the newsroom edits (ADR 0036 §1) and because this wrapper is the `<View
 * className="mt-l">` the screen already had around most of these blocks — the same node,
 * now with a name.
 */
function Place({
  section,
  className,
  children,
}: {
  section: HomeSection;
  className?: string;
  children: ReactNode;
}) {
  return (
    <View testID={placeTestID(section.id)} className={className}>
      {children}
    </View>
  );
}

function openCallout(entry: { slug: string }): void {
  router.push({ pathname: '/aufruf/[slug]', params: { slug: entry.slug } });
}

const HomeHeaderModule: HomeModule = ({ section, instant }) => (
  <Place section={section}>
    <HomeHeader instant={instant} />
  </Place>
);

/**
 * What the screen says about its own feeds: a line when the articles came out of the
 * bundle, a spinner while the first load is in flight.
 *
 * Not an editorial place, and in the document anyway, because the document is the whole
 * order of the screen. A place left out of it would be one the editor cannot see, and
 * this one sits between the header and the lifted callout.
 */
const FeedStatusModule: HomeModule = ({ section }) => {
  const intl = useIntl();
  const colors = useColors();
  const recherchen = useFeed('recherchen');
  const faktenchecks = useFeed('faktencheck');

  const offline = recherchen.offline || faktenchecks.offline;
  const loading = recherchen.loading && !recherchen.data;
  if (!offline && !loading) return null;

  return (
    <Place section={section}>
      {offline && (
        <Typo variant="text-s" color="on-canvas-muted" className="mt-2xs">
          {intl.formatMessage(COPY.offlineArticles)}
        </Typo>
      )}
      {loading && (
        <View className="py-2xl">
          <ActivityIndicator color={colors.accent} />
        </View>
      )}
    </Place>
  );
};

/**
 * The lead article: the one that is pinned, or the newest, in that order.
 *
 * Three rungs and each one is a decision that has already been recorded. The live feed
 * first, because a pinned article the feed carries should be drawn with what the feed
 * knows about it today rather than with a copy that ages. Then `data/home-pins.ts`, the
 * sample list an editor picked from, so a pin outside today's feed page still draws.
 * Then the rule — ADR 0036 §8's "a pinned item that has vanished falls back to the
 * place's rule", which is what stops an unpublished article leaving a hole where the
 * lead belongs.
 */
const ArticleHeroModule: HomeModule = ({ section }) => {
  const newest = useFeed('recherchen').data;
  const pin = pinnedItem(section.settings, HERO_PIN);
  const hero =
    (pin === null ? null : (newest?.find((item) => item.url === pin) ?? pinnedArticle(pin))) ??
    newest?.[0];
  if (!hero) return null;
  return (
    <Place section={section}>
      <ArticleHero item={hero} onPress={openArticle} />
    </Place>
  );
};

const SpotlightBriefingModule: HomeModule = ({ section }) => (
  <Place section={section} className="mt-l">
    <SpotlightBriefing onOpenArchive={() => router.push('/spotlight')} />
  </Place>
);

const EarlyAccessModule: HomeModule = ({ section }) => (
  <Place section={section} className="mt-l">
    <EarlyAccessCard onPress={() => router.push('/backstage')} />
  </Place>
);

const LatestResearchModule: HomeModule = ({ section }) => {
  const intl = useIntl();
  const under = itemCount(section.settings, RESEARCH_COUNT);
  const neueste = useFeed('recherchen').data?.slice(1, 1 + under) ?? [];
  if (neueste.length === 0) return null;
  return (
    <Place section={section} className="mt-l">
      <SectionHeader title={intl.formatMessage(COPY.latestResearch)} />
      <View className="mt-2xs">
        {neueste.map((item, i) => (
          <View key={item.id}>
            {i > 0 && <Hairline />}
            <ArticleRow item={item} onPress={openArticle} />
          </View>
        ))}
      </View>
    </Place>
  );
};

const FaktencheckRailModule: HomeModule = ({ section }) => {
  const intl = useIntl();
  const faktenchecks = useFeed('faktencheck');
  const items = faktenchecks.data ?? [];
  if (items.length === 0) return null;
  return (
    <Place section={section} className="mt-l">
      <SectionHeader
        title={intl.formatMessage(COPY.factChecks)}
        className="mb-s"
        actionLabel={intl.formatMessage(COPY.viewAll)}
        onAction={() => router.push('/(tabs)/entdecken')}
      />
      <FaktencheckRail
        items={items.slice(0, itemCount(section.settings, FACT_CHECK_COUNT))}
        onPress={openArticle}
      />
    </Place>
  );
};

const CalloutTeaserModule: HomeModule = ({ section }) => {
  const callout = callouts.find((entry) => entry.status === 'open');
  if (!callout) return null;
  return (
    <Place section={section} className={section.id === LIFTED_CALLOUT ? 'mt-s mb-m' : 'mt-l'}>
      <CalloutTeaser callout={callout} onPress={openCallout} />
    </Place>
  );
};

const MediathekModule: HomeModule = ({ section }) => {
  const intl = useIntl();
  return (
    <Place section={section} className="mt-l">
      <SectionHeader
        title={MEDIATHEK}
        className="mb-s"
        actionLabel={intl.formatMessage(COPY.viewEverything)}
        onAction={() => router.push('/(tabs)/mediathek')}
      />
      <MediathekReihe onOpenMediathek={() => router.push('/(tabs)/mediathek')} />
    </Place>
  );
};

const BackstageModule: HomeModule = ({ section }) => (
  <Place section={section} className="mt-l">
    <BackstageTeaser
      onOpenDiary={(id) => router.push({ pathname: '/tagebuch/[id]', params: { id } })}
      onOpenBackstage={() => router.push('/backstage')}
    />
  </Place>
);

const ImpactFooterModule: HomeModule = ({ section }) => (
  <Place section={section}>
    <ImpactFooter />
  </Place>
);

/** Module name, as the document writes it, to the thing that draws it. */
export const HOME_MODULES: Readonly<Record<string, HomeModule>> = {
  'home-header': HomeHeaderModule,
  'feed-status': FeedStatusModule,
  'article-hero': ArticleHeroModule,
  'spotlight-briefing': SpotlightBriefingModule,
  'early-access-card': EarlyAccessModule,
  'latest-research': LatestResearchModule,
  'faktencheck-rail': FaktencheckRailModule,
  'callout-teaser': CalloutTeaserModule,
  'mediathek-reihe': MediathekModule,
  'backstage-teaser': BackstageModule,
  'impact-footer': ImpactFooterModule,
};
