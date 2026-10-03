import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { defineMessages, useIntl, type IntlShape, type MessageDescriptor } from 'react-intl';
import { ActivityIndicator, Pressable, View } from 'react-native';

import type { Instant } from '@correctiv/app-core/lib/berlin-time';
import type { HomeSection } from '@correctiv/app-core/lib/home-layout';
import { leadItem, ruleOf } from '@correctiv/app-core/lib/home-rules';
import {
  flagSet,
  itemCount,
  pinnedItem,
  resolveText,
  textOf,
} from '@correctiv/app-core/lib/home-settings';
import { callouts } from '@correctiv/app-core/data/callouts';
import { atlasStats } from '@correctiv/app-core/data/abriss-atlas';
import { claims } from '@correctiv/app-core/data/claims';
import { projectGroups, type Project } from '@correctiv/app-core/data/projects';
import { bonusMedia, type BonusMedia } from '@correctiv/app-core/data/backstage';
import type { PodcastSeries } from '@correctiv/app-core/data/podcasts';
import type { YoutubeKey } from '@correctiv/app-core/stores/media';
import type { Video } from '@correctiv/app-core/types/models';
import {
  screenTitleOf,
  type ConfigurableScreen,
  type ScreenWords,
} from '@correctiv/app-core/lib/screen-layout';
import { formatDateShort } from '@correctiv/app-core/lib/format';
import { quarterlyReport } from '@correctiv/app-core/data/quartalsbericht';
import type { NewsletterKey } from '@correctiv/app-core/stores/settings';
import type { Entitlement } from '@correctiv/app-core/types/models';

import { ArticleHero } from '@/components/feed/ArticleHero';
import { ArticleRow } from '@/components/feed/ArticleRow';
import { FaktencheckRail } from '@/components/feed/FaktencheckRail';
import { BackstageTeaser } from '@/components/home/BackstageTeaser';
import { CalloutTeaser } from '@/components/home/CalloutTeaser';
import { EarlyAccessCard } from '@/components/home/EarlyAccessCard';
import { ImpactFooter } from '@/components/home/ImpactFooter';
import { Masthead } from '@/components/home/Masthead';
import { MediathekReihe } from '@/components/home/MediathekReihe';
import { SpotlightBriefing } from '@/components/home/SpotlightBriefing';
import { ClubCard } from '@/components/profile/ClubCard';
import { NavCard } from '@/components/profile/NavCard';
import { SettingRow } from '@/components/profile/SettingRow';
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
  SplitRow,
  Typo,
} from '@/components/ui';
import {
  FACT_CHECK_CATEGORY,
  FACT_CHECK_COUNT,
  HEADER_DATE,
  HEADER_INTRO,
  HEADER_MARK,
  HEADER_SEARCH,
  HERO_CATEGORY,
  HERO_PIN,
  RESEARCH_CATEGORY,
  RESEARCH_COUNT,
  RESEARCH_TAG,
} from '@/lib/home/settings';
import { useLivePin, useRuleItems } from '@/lib/home/useRule';
import { projectTarget } from '@/lib/discover/target';
import { useFeed, useInvestigations } from '@/lib/feeds/useFeed';
import { TIER_LABELS } from '@/lib/membership/tierLabel';
import { openArticle } from '@/lib/openArticle';
import { openExternal } from '@/lib/openExternal';
import { openLink } from '@/lib/openLink';
import {
  useCoreActions,
  useLocale,
  usePodcastLibrary,
  useReachable,
  useSavedArticles,
  useSession,
  useSettings,
  useVideoChannel,
} from '@/lib/store/core';
import { sizes, useColors } from '@/lib/theme';

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
   * `ScreenHeaderModule` is the one that does.
   */
  readonly instant: Instant;
  /**
   * What the screen this placement is on is called, out of the same parsed document the
   * placement came from (ADR 0075 §5) — `null` when that document's title was refused.
   *
   * A parameter rather than a second read of the layout for the reason `instant` is one:
   * a block that fetched the words itself could draw a heading belonging to a document
   * other than the one that put it there. `ScreenHeaderModule` is the only module that
   * reads it, and it is on every module's props because the props are the seam and not a
   * list of who happens to use what.
   */
  readonly words: ScreenWords | null;
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

/**
 * The top of a screen: its name, or the mark in place of it, and whatever the document
 * asks for beside them.
 *
 * **One block where there were four** (ADR 0075 §6). `home-header`, `discover-header`,
 * `mediathek-header` and `participate-header` each printed one screen's name out of the
 * catalogue, which is why each was bound to its screen: "Mediathek" at the top of Home
 * was a heading that lied about where the reader was. This one reads the name out of the
 * document of the screen it is standing on, so it cannot lie, and `SCREEN_BOUND_BLOCKS`
 * went with the lie it was there to prevent.
 *
 * **What the four differed in is the settings and nothing else**, which is the test that
 * this is one block rather than four with a shared name: Home's mark and date, Mitmachen's
 * introduction under the title, and the plain title Entdecken and Mediathek draw. The five
 * bundled documents therefore render exactly as they did, byte for byte, which is ADR 0075
 * §6's own condition on this change.
 *
 * **The spacing is the renderer's** (ADR 0036 §1): a title on its own keeps the gap under
 * it that the block below expects, and a title that is followed by something of its own —
 * an introduction, the search — takes the gap from that instead. The newsroom chooses what
 * the header says, not what it is worth in pixels.
 */
const ScreenHeaderModule: HomeModule = ({ section, words, instant }) => {
  const locale = useLocale();
  const title = screenTitleOf(words);
  const intro = textOf(section.settings, HEADER_INTRO);
  const search = flagSet(section.settings, HEADER_SEARCH);
  const field = search ? (
    <View className="mt-s">
      <SearchEntry onPress={() => router.push('/suche')} />
    </View>
  ) : null;

  if (flagSet(section.settings, HEADER_MARK)) {
    return (
      <Place section={section}>
        <Masthead instant={instant} date={flagSet(section.settings, HEADER_DATE)} />
        {field}
      </Place>
    );
  }

  // A screen whose document carries no readable title has no heading to draw and no word
  // to put in its place: ADR 0039 §6's smallest possible loss is this place and not the
  // screen under it.
  if (title === null) return null;

  return (
    <Place section={section} className={intro === null && !search ? 'mb-s' : undefined}>
      <Typo variant="headline-xl">{resolveText(title, locale)}</Typo>
      {intro !== null && (
        <Typo variant="text-m" color="on-canvas-muted" className="mt-2xs">
          {resolveText(intro, locale)}
        </Typo>
      )}
      {field}
    </Place>
  );
};

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
  const plain = useFeed('recherchen').data ?? undefined;
  const pin = pinnedItem(section.settings, HERO_PIN);
  const rule = ruleOf(section.settings, { category: HERO_CATEGORY });
  const ruled = useRuleItems('recherchen', rule, plain);
  const hero = leadItem(pin, ruled, useLivePin(pin));
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
  const rule = ruleOf(section.settings, { category: RESEARCH_CATEGORY, tag: RESEARCH_TAG });
  const neueste =
    useRuleItems('recherchen', rule, useFeed('recherchen').data ?? undefined)?.slice(
      1,
      1 + under,
    ) ?? [];
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
  const rule = ruleOf(section.settings, { category: FACT_CHECK_CATEGORY });
  const items = useRuleItems('faktencheck', rule, useFeed('faktencheck').data ?? undefined) ?? [];
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

const TipCardModule: HomeModule = ({ section, screen }) => {
  const intl = useIntl();
  return (
    <Place section={section} className={screen === 'home' ? 'mt-l' : 'mt-m'}>
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

/*
 * Words and tables the profile's blocks share, moved from the screen unchanged.
 */

const PROFILE_COPY = defineMessages({
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
 * `PROFILE_COPY.manageAccount` and never an invitation to raise a contribution; the button form
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
  { key: 'spotlight', label: 'Spotlight', description: PROFILE_COPY.spotlight },
  { key: 'spotlightCh', label: 'Spotlight Schweiz', description: PROFILE_COPY.spotlightCh },
  { key: 'klima', label: 'Klima', description: PROFILE_COPY.klima },
];

/** How many investigations the impact card names. */
const PROFILE_IMPACT_COUNT = 3;

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
  if (!memberSince) return intl.formatMessage(PROFILE_COPY.impactAnonymous, { articles });
  const months = Math.max(
    1,
    Math.round((Date.now() - new Date(memberSince).getTime()) / (30 * 864e5)),
  );
  return intl.formatMessage(PROFILE_COPY.impactSince, { months, articles });
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
function MembershipRow({ label, value }: { label: string; value: string }) {
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

/*
 * The profile's blocks. The screen keeps its heading and draws these in the document's
 * order; the margin each section carried moved from the element to its `Place`. The
 * Settings row is not a block of its own because it is the last row of the list the area
 * block draws, and splitting one list in two would change its pixels.
 */

const ProfileClubCardModule: HomeModule = ({ section }) => {
  const intl = useIntl();
  const { account, entitlement } = useSession();
  return (
    <Place section={section}>
      <ClubCard
        name={account?.name ?? ''}
        tierLabel={intl.formatMessage(TIER_LABELS[entitlement?.tier ?? 'paid'])}
        memberSince={entitlement?.memberSince ?? null}
      />
    </Place>
  );
};

const ProfileMembershipModule: HomeModule = ({ section }) => {
  const intl = useIntl();
  const locale = useLocale();
  const { entitlement } = useSession();
  const tierLabel = intl.formatMessage(TIER_LABELS[entitlement?.tier ?? 'paid']);
  return (
    <Place section={section} className="mt-l">
      <SectionCard label={intl.formatMessage(PROFILE_COPY.membershipSection)}>
        <MembershipRow label={intl.formatMessage(PROFILE_COPY.tierRow)} value={tierLabel} />
        {entitlement?.source && (
          <>
            <Hairline className="my-2xs" />
            <MembershipRow
              label={intl.formatMessage(PROFILE_COPY.sourceRow)}
              value={intl.formatMessage(SOURCE_LABELS[entitlement.source])}
            />
          </>
        )}
        {entitlement?.validUntil && (
          <>
            <Hairline className="my-2xs" />
            <MembershipRow
              label={intl.formatMessage(PROFILE_COPY.validUntilRow)}
              value={formatDateShort(entitlement.validUntil, locale)}
            />
          </>
        )}
        {entitlement && entitlement.localAreas.length > 0 && (
          <>
            <Hairline className="my-2xs" />
            <MembershipRow
              label={intl.formatMessage(PROFILE_COPY.localAreasRow)}
              value={entitlement.localAreas.join(', ')}
            />
          </>
        )}
        <Button
          title={intl.formatMessage(PROFILE_COPY.manageAccount)}
          variant="secondary"
          fullWidth
          onPress={() => openExternal(ACCOUNT_URL)}
          className="mt-s"
        />
        <Typo variant="text-s" color="on-canvas-muted" className="mt-s">
          {intl.formatMessage(PROFILE_COPY.manageAccountNote)}
        </Typo>
      </SectionCard>
    </Place>
  );
};

const ProfileImpactModule: HomeModule = ({ section }) => {
  const intl = useIntl();
  const { entitlement } = useSession();
  /**
   * The impact card's investigations come through the store, not out of the generated
   * bundle (`web-target.test.ts` keeps the direct import from coming back). That
   * `recherchen` also carries fact checks is the core's to know.
   */
  const impactArticles = useInvestigations(PROFILE_IMPACT_COUNT);
  return (
    <Place section={section} className="mt-m">
      <SectionCard label={intl.formatMessage(PROFILE_COPY.impactSection)} tone="surface">
        <Typo variant="text-m">
          {impactLine(intl, entitlement?.memberSince ?? null, impactArticles.length > 0)}
        </Typo>
        {/*
          A LINK, not a paragraph that happens to be tappable: the Pressable carries the
          role, the name and the press state; the Typo keeps the type.
        */}
        {impactArticles.map((article) => (
          <Pressable
            key={article.url}
            onPress={() => openArticle(article)}
            accessibilityRole="link"
            accessibilityLabel={article.title}
            className="mt-s justify-center active:opacity-70"
            /*
             * One line of `text-m` is 23 dp, and these are stacked directly under one
             * another, which is the arrangement a thumb lands between (#102); the box
             * can grow because the gap between them is a margin.
             */
            style={{ minHeight: sizes.tapTarget }}
          >
            <Typo variant="text-m" weight="semibold" numberOfLines={2}>
              {article.title}
            </Typo>
          </Pressable>
        ))}
      </SectionCard>
    </Place>
  );
};

const ProfileAreaModule: HomeModule = ({ section }) => {
  const intl = useIntl();
  const reachable = useReachable();
  const saved = useSavedArticles();
  return (
    <Place section={section} className="mt-m">
      <Overline label={intl.formatMessage(PROFILE_COPY.areaSection)} />
      <View className="mt-2xs">
        {reachable('quarterly-report') && (
          <NavCard
            icon="document-text-outline"
            title={quarterlyReport.quarter}
            subtitle={intl.formatMessage(PROFILE_COPY.reportSubtitle)}
            club
            onPress={() => router.push('/bericht')}
          />
        )}
        {reachable('early-access') && (
          <NavCard
            icon="sparkles-outline"
            title={intl.formatMessage(PROFILE_COPY.backstage)}
            subtitle={intl.formatMessage(PROFILE_COPY.backstageSubtitle)}
            club
            onPress={() => router.push('/backstage')}
          />
        )}
        {reachable('saved') && (
          <NavCard
            icon="bookmark-outline"
            title={intl.formatMessage(PROFILE_COPY.saved)}
            subtitle={intl.formatMessage(PROFILE_COPY.savedCount, { count: saved.length })}
            onPress={() => router.push('/gespeichert')}
          />
        )}
        <NavCard
          icon="settings-outline"
          title={intl.formatMessage(PROFILE_COPY.settings)}
          subtitle={intl.formatMessage(PROFILE_COPY.settingsSubtitle)}
          onPress={() => router.push('/einstellungen')}
        />
      </View>
    </Place>
  );
};

const ProfileNewsletterModule: HomeModule = ({ section }) => {
  const intl = useIntl();
  const actions = useCoreActions();
  const settings = useSettings();
  return (
    <Place section={section} className="mt-m">
      <SectionCard label={intl.formatMessage(PROFILE_COPY.newsletterSection)}>
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
    </Place>
  );
};

/** Module name, as the document writes it, to the thing that draws it. */
export const HOME_MODULES: Readonly<Record<string, HomeModule>> = {
  'screen-header': ScreenHeaderModule,
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
  'search-entry': SearchEntryModule,
  'topic-rail': TopicRailModule,
  'project-directory': ProjectDirectoryModule,
  'live-radio-banner': LiveRadioBannerModule,
  'podcast-rail': PodcastRailModule,
  'gespraech-rail': GespraechRailModule,
  'funfacts-rail': FunfactsRailModule,
  'bonus-audio-list': BonusAudioListModule,
  'callout-list': CalloutListModule,
  'faktenforum-card': FaktenforumCardModule,
  'atlas-card': AtlasCardModule,
  'tip-card': TipCardModule,
  'community-note': CommunityNoteModule,
  'profile-club-card': ProfileClubCardModule,
  'profile-membership': ProfileMembershipModule,
  'profile-impact': ProfileImpactModule,
  'profile-area': ProfileAreaModule,
  'profile-newsletter': ProfileNewsletterModule,
};
