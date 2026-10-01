import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import { ActivityIndicator, View } from 'react-native';

import type { Instant } from '@correctiv/app-core/lib/berlin-time';
import type { HomeSection } from '@correctiv/app-core/lib/home-layout';
import { itemCount, pinnedItem } from '@correctiv/app-core/lib/home-settings';
import { callouts } from '@correctiv/app-core/data/callouts';
import { pinnedArticle } from '@correctiv/app-core/data/home-pins';
import { atlasStats } from '@correctiv/app-core/data/abriss-atlas';
import { claims } from '@correctiv/app-core/data/claims';
import { projectGroups, type Project } from '@correctiv/app-core/data/projects';
import { bonusMedia, type BonusMedia } from '@correctiv/app-core/data/backstage';
import type { PodcastSeries } from '@correctiv/app-core/data/podcasts';
import type { YoutubeKey } from '@correctiv/app-core/stores/media';
import type { Video } from '@correctiv/app-core/types/models';
import type { ConfigurableScreen } from '@correctiv/app-core/lib/screen-layout';

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
import { ProjectRow } from '@/components/discover/ProjectRow';
import { SearchEntry } from '@/components/discover/SearchEntry';
import { TopicRail } from '@/components/discover/TopicRail';
import { EpisodeRow } from '@/components/media/EpisodeRow';
import { LiveBanner } from '@/components/media/LiveBanner';
import { MediaCard } from '@/components/media/MediaCard';
import { SeriesTile } from '@/components/media/SeriesTile';
import { playEpisode, togglePlay } from '@/lib/audio/player';
import { useEpisodeStatus } from '@/lib/audio/useAudio';
import { CalloutCard } from '@/components/participate/CalloutCard';
import {
  Button,
  Hairline,
  Overline,
  Rail,
  SectionCard,
  SectionHeader,
  Typo,
} from '@/components/ui';
import { FACT_CHECK_COUNT, HERO_PIN, RESEARCH_COUNT } from '@/lib/home/settings';
import { projectTarget } from '@/lib/discover/target';
import { useFeed } from '@/lib/feeds/useFeed';
import { openArticle } from '@/lib/openArticle';
import { openExternal } from '@/lib/openExternal';
import { openLink } from '@/lib/openLink';
import { useCoreActions, usePodcastLibrary, useReachable, useVideoChannel } from '@/lib/store/core';
import { useColors } from '@/lib/theme';

/**
 * Everything Home can draw, addressed by the name the layout document uses.
 *
 * This is the host's half of ADR 0036: the document says which places exist and in what
 * order, and this file says what a place named `spotlight-briefing` actually renders.
 * The screen (`app/(tabs)/index.tsx`) is then a loop, and the source order that used to
 * BE the layout is `@correctiv/app-core/data/layout/screens/home.json`.
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
  discoverTitle: {
    id: 'discover.title',
    defaultMessage: 'Discover',
    description:
      'The heading of the Discover screen. ui.tabDiscover is the same word on the tab bar, where it has far less room.',
  },
  liveSubtitle: {
    id: 'mediathek.liveSubtitle',
    defaultMessage: '24/7 from Bottrop, by young people for young people',
  },
  podcasts: { id: 'mediathek.podcasts', defaultMessage: 'Podcasts' },
  offlineEpisodes: {
    id: 'mediathek.offlineEpisodes',
    defaultMessage: 'No connection. You are seeing sample episodes.',
  },
  fromBackstage: { id: 'mediathek.fromBackstage', defaultMessage: 'From Backstage' },
  videosUnavailable: {
    id: 'mediathek.videosUnavailable',
    defaultMessage: 'Videos cannot be reached at the moment.',
  },
});

/**
 * The words of the participation tab, in ENGLISH; the German ships in
 * `packages/catalogue/src/de/participate.ts`. The three counters are ICU plurals rather
 * than a number glued to a noun, because both languages inflect the noun and the data
 * can reach one ("1 Behauptungen").
 */
const PARTICIPATE_COPY = defineMessages({
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

/** The fact-check desk's public tip line. */
const WHATSAPP_TIP = 'https://wa.me/4915142647500';

/**
 * Two group labels that are marks rather than words: the Faktenforum and the
 * Abriss-Atlas are named the same in every language, so they carry no id.
 */
const FAKTENFORUM = 'Faktenforum';
const ABRISS_ATLAS = 'Abriss-Atlas';

/** A mark, not a sentence: the shelf keeps its name in every language. */
const MEDIATHEK = 'Mediathek';

/**
 * More marks, for the Mediathek screen: the two video channels and the club shelf a bonus
 * track is filed under on the lock screen. A catalogue entry mapping FunFacts to FunFacts
 * is a line for a translator to wonder about.
 *
 * `CHANNEL_GESPRAECH` is the one string `__tests__/localisation-seam.test.ts` excuses by
 * name: a name gets no id, and it carries an umlaut.
 */
const CHANNEL_GESPRAECH = 'CORRECTIV im Gespräch';
const CHANNEL_FUNFACTS = 'FunFacts';
const BONUS_SHELF = 'Backstage · Club';

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
   * The screen this placement is on. Most blocks draw the same everywhere; a block that
   * is on two screens reads this where the second one differs (ADR 0071 §3), and the
   * fact-check rail's "see all" is the case: it leads to Entdecken, so on Entdecken it
   * would lead to itself.
   */
  readonly screen: ConfigurableScreen;
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

const FaktencheckRailModule: HomeModule = ({ section, screen }) => {
  const intl = useIntl();
  const faktenchecks = useFeed('faktencheck');
  const items = faktenchecks.data ?? [];
  if (items.length === 0) return null;
  return (
    <Place section={section} className="mt-l">
      <SectionHeader
        title={intl.formatMessage(COPY.factChecks)}
        className="mb-s"
        actionLabel={screen === 'entdecken' ? undefined : intl.formatMessage(COPY.viewAll)}
        onAction={screen === 'entdecken' ? undefined : () => router.push('/(tabs)/entdecken')}
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

/*
 * Entdecken's blocks. The screen was one function; each section of it is a place now, and
 * the margin each one carried moved from the element to its `Place`, so the page is the
 * same one with names on it.
 */

const DiscoverHeaderModule: HomeModule = ({ section }) => {
  const intl = useIntl();
  return (
    <Place section={section} className="mb-s">
      <Typo variant="headline-xl">{intl.formatMessage(COPY.discoverTitle)}</Typo>
    </Place>
  );
};

const SearchEntryModule: HomeModule = ({ section }) => (
  <Place section={section}>
    <SearchEntry onPress={() => router.push('/suche')} />
  </Place>
);

const TopicRailModule: HomeModule = ({ section }) => (
  <Place section={section} className="mt-s">
    <TopicRail onOpenTopic={openProject} />
  </Place>
);

/**
 * The seven groups of the ecosystem, as one block. A group is not a place of its own: the
 * catalogue (`data/projects`) is content, its order and its grouping are the editors' of
 * that file, and the layout document arranges screens, not catalogues.
 */
const ProjectDirectoryModule: HomeModule = ({ section }) => {
  const reachable = useReachable();
  return (
    <Place section={section}>
      {projectGroups.map((group) => {
        const projects = group.projects.filter(
          (project) => project.feature === undefined || reachable(project.feature),
        );
        if (projects.length === 0) return null;
        return (
          <View key={group.id} className="mt-m">
            <Overline label={group.title} />
            <View className="mt-2xs">
              {projects.map((project) => (
                <ProjectRow key={project.id} project={project} onPress={openProjectCard} />
              ))}
            </View>
          </View>
        );
      })}
    </Place>
  );
};

/*
 * Mitmachen's blocks. Same move as Entdecken's: the margin each section carried moved from
 * the element to its `Place`. Each gate that was an inline `reachable(...)` is the block's
 * entry in `MODULE_FEATURES` now.
 */

const ParticipateHeaderModule: HomeModule = ({ section }) => {
  const intl = useIntl();
  return (
    <Place section={section}>
      <Typo variant="headline-xl">{intl.formatMessage(PARTICIPATE_COPY.screenTitle)}</Typo>
      <Typo variant="text-m" color="on-canvas-muted" className="mt-2xs">
        {intl.formatMessage(PARTICIPATE_COPY.lead)}
      </Typo>
    </Place>
  );
};

const CalloutListModule: HomeModule = ({ section }) => {
  const intl = useIntl();
  return (
    <Place section={section} className="mt-l">
      <Overline label={intl.formatMessage(PARTICIPATE_COPY.activeCallouts)} />
      <View className="mt-2xs">
        {callouts.map((callout) => (
          <CalloutCard key={callout.slug} callout={callout} onPress={openCallout} />
        ))}
      </View>
    </Place>
  );
};

const FaktenforumCardModule: HomeModule = ({ section }) => {
  const intl = useIntl();
  return (
    <Place section={section} className="mt-m">
      <SectionCard label={FAKTENFORUM} tone="surface">
        <Typo variant="headline-xs">{intl.formatMessage(PARTICIPATE_COPY.forumHeading)}</Typo>
        <Typo variant="text-s" color="on-canvas-muted" className="mt-2xs">
          {intl.formatMessage(PARTICIPATE_COPY.forumLead, { count: claims.length })}
        </Typo>
        <Button
          title={intl.formatMessage(PARTICIPATE_COPY.forumAction)}
          variant="outline"
          onPress={() => router.push('/faktenforum')}
          className="mt-s"
        />
      </SectionCard>
    </Place>
  );
};

const AtlasCardModule: HomeModule = ({ section }) => {
  const intl = useIntl();
  return (
    <Place section={section} className="mt-m">
      <SectionCard label={ABRISS_ATLAS}>
        <Typo variant="headline-xs">{intl.formatMessage(PARTICIPATE_COPY.atlasHeading)}</Typo>
        <Typo variant="text-s" color="on-canvas-muted" className="mt-2xs">
          {intl.formatMessage(PARTICIPATE_COPY.atlasLead, {
            reports: atlasStats.totalReports,
            cities: atlasStats.citiesCovered,
          })}
        </Typo>
        <Button
          title={intl.formatMessage(PARTICIPATE_COPY.atlasAction)}
          variant="outline"
          onPress={() => router.push('/atlas')}
          className="mt-s"
        />
      </SectionCard>
    </Place>
  );
};

const TipCardModule: HomeModule = ({ section }) => {
  const intl = useIntl();
  return (
    <Place section={section} className="mt-m">
      <SectionCard label={intl.formatMessage(PARTICIPATE_COPY.tipLabel)} tone="surface">
        <Typo variant="headline-xs">{intl.formatMessage(PARTICIPATE_COPY.tipHeading)}</Typo>
        <Typo variant="text-s" color="on-canvas-muted" className="mt-2xs">
          {intl.formatMessage(PARTICIPATE_COPY.tipLead)}
        </Typo>
        <Button
          title={intl.formatMessage(PARTICIPATE_COPY.tipAction)}
          variant="outline"
          onPress={() => openExternal(WHATSAPP_TIP)}
          className="mt-s"
        />
      </SectionCard>
    </Place>
  );
};

const CommunityNoteModule: HomeModule = ({ section }) => {
  const intl = useIntl();
  return (
    <Place section={section} className="mt-l">
      <Typo variant="text-s" color="grey-500">
        {intl.formatMessage(PARTICIPATE_COPY.communityNote)}
      </Typo>
    </Place>
  );
};

function openProject(id: string) {
  router.push({ pathname: '/projekt/[id]', params: { id } });
}

/** Carries out what `projectTarget` decided — the decision itself lives there. */
function openProjectCard(project: Project) {
  const target = projectTarget(project);
  switch (target.kind) {
    case 'tab':
      router.push(target.path);
      return;
    case 'external':
      openLink(target.url);
      return;
    default:
      openProject(target.id);
  }
}

/*
 * Mediathek's blocks. The screen was one function; each section of it is a place now, and
 * the margin each one carried moved from the element to its `Place`. The `reachable(...)`
 * test each section made is `MODULE_FEATURES` now, applied by `ScreenBlocks`.
 */

const MediathekHeaderModule: HomeModule = ({ section }) => (
  <Place section={section} className="mb-s">
    <Typo variant="headline-xl">{MEDIATHEK}</Typo>
  </Place>
);

const LiveRadioBannerModule: HomeModule = ({ section }) => {
  const intl = useIntl();
  return (
    <Place section={section}>
      <LiveBanner subtitle={intl.formatMessage(COPY.liveSubtitle)} />
    </Place>
  );
};

const PodcastRailModule: HomeModule = ({ section }) => {
  const intl = useIntl();
  const podcasts = usePodcastLibrary();
  return (
    <Place section={section} className="mt-l">
      <SectionHeader title={intl.formatMessage(COPY.podcasts)} className="mb-s" />
      {podcasts.status === 'offline' && (
        <Typo variant="text-s" color="on-canvas-muted" className="mb-2xs">
          {intl.formatMessage(COPY.offlineEpisodes)}
        </Typo>
      )}
      <Rail>
        {podcasts.series.map((series) => (
          <SeriesTile key={series.id} series={series} onPress={openSeries} />
        ))}
      </Rail>
    </Place>
  );
};

function VideoRail({
  section,
  title,
  channel,
}: {
  section: HomeSection;
  title: string;
  channel: YoutubeKey;
}) {
  const intl = useIntl();
  const { videos, status } = useVideoChannel(channel);
  const actions = useCoreActions();

  const openVideo = (video: Video) => {
    // The core store owns the HLS resolution; the route reads it.
    void actions.video.play(video);
    router.push('/video');
  };

  return (
    <Place section={section} className="mt-l">
      <SectionHeader title={title} className="mb-s" />
      {status === 'error' && videos.length === 0 ? (
        <Typo variant="text-s" color="on-canvas-muted">
          {intl.formatMessage(COPY.videosUnavailable)}
        </Typo>
      ) : (
        <Rail>
          {videos.slice(0, 6).map((video) => (
            <MediaCard key={video.id} video={video} onPress={openVideo} />
          ))}
        </Rail>
      )}
    </Place>
  );
}

const GespraechRailModule: HomeModule = ({ section }) => (
  <VideoRail section={section} title={CHANNEL_GESPRAECH} channel="gespraech" />
);

const FunfactsRailModule: HomeModule = ({ section }) => (
  <VideoRail section={section} title={CHANNEL_FUNFACTS} channel="funfacts" />
);

const BonusAudioListModule: HomeModule = ({ section }) => {
  const intl = useIntl();
  return (
    <Place section={section} className="mt-l">
      <SectionHeader title={intl.formatMessage(COPY.fromBackstage)} />
      {/* No club label here: every row already carries the yellow Club badge, and a
        coral one above them said the same word twice in the wrong colour — coral
        is the journalism CTA, yellow is the club (see ui/Button.tsx). */}
      <View className="mt-2xs">
        {bonusMedia.map((bonus) => (
          <BonusRow key={bonus.id} bonus={bonus} />
        ))}
      </View>
    </Place>
  );
};

/**
 * The club's bonus audio, played in full. The 60-second preview this comment used to
 * describe was dropped on 2026-08-06 (ADR 0006), and the note that named the
 * distinction went with ADR 0018, since behind the door there is nobody on the other
 * side of it. The CLUB badge stays as a label.
 */
function BonusRow({ bonus }: { bonus: BonusMedia }) {
  const status = useEpisodeStatus(bonus.id);

  const track = {
    title: bonus.title,
    subtitle: BONUS_SHELF,
    url: bonus.source,
    episodeId: bonus.id,
  };

  return (
    <EpisodeRow
      episodeId={bonus.id}
      title={bonus.title}
      meta={bonus.durationLabel}
      club={bonus.club}
      onPress={() => {
        // If this episode is already loaded, the tap is play/pause, not a restart.
        if (status !== 'off') {
          togglePlay();
          return;
        }
        void playEpisode(track);
      }}
    />
  );
}

function openSeries(series: PodcastSeries) {
  router.push({ pathname: '/serie/[id]', params: { id: series.id } });
}

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
  'discover-header': DiscoverHeaderModule,
  'search-entry': SearchEntryModule,
  'topic-rail': TopicRailModule,
  'project-directory': ProjectDirectoryModule,
  'mediathek-header': MediathekHeaderModule,
  'live-radio-banner': LiveRadioBannerModule,
  'podcast-rail': PodcastRailModule,
  'gespraech-rail': GespraechRailModule,
  'funfacts-rail': FunfactsRailModule,
  'bonus-audio-list': BonusAudioListModule,
  'participate-header': ParticipateHeaderModule,
  'callout-list': CalloutListModule,
  'faktenforum-card': FaktenforumCardModule,
  'atlas-card': AtlasCardModule,
  'tip-card': TipCardModule,
  'community-note': CommunityNoteModule,
};
