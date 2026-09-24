/**
 * Every component in `src/components`, grouped by its folder, in the variants its
 * props allow.
 *
 * The list is written out rather than discovered. A `require.context` over the
 * folder would keep itself up to date and could not know what to pass a component
 * — and a gallery that renders `<ArticleHero>` with no item shows an empty box,
 * which is worse than no entry at all. The cost is that a new component does not
 * appear here on its own, and what carries that cost is a TYPE rather than a
 * test: `components.generated.ts` is the folder read as a union, this file is
 * held against it, and a component with no entry is a compile error.
 * `__tests__/gallery-catalogue.test.ts` keeps the union honest and checks the
 * handful of things a type cannot see. ADR 0031 is the ladder this climbed.
 *
 * Specimens are plain elements, built once at module scope. The frame renders each
 * of them twice, on `canvas` and on `surface`, so a colour that does not follow
 * the scheme is visible rather than merely wrong.
 */
import type { ReactNode } from 'react';
import { View } from 'react-native';

import { ProjectRow } from '@/components/discover/ProjectRow';
import { SampleHitRow } from '@/components/discover/SampleHitRow';
import { SearchEntry } from '@/components/discover/SearchEntry';
import { TopicRail } from '@/components/discover/TopicRail';
import { ArticleHero } from '@/components/feed/ArticleHero';
import { ArticleRow } from '@/components/feed/ArticleRow';
import { FaktencheckRail } from '@/components/feed/FaktencheckRail';
import { LoginGate } from '@/components/gate/LoginGate';
import { BackstageTeaser } from '@/components/home/BackstageTeaser';
import { CalloutTeaser } from '@/components/home/CalloutTeaser';
import { EarlyAccessCard } from '@/components/home/EarlyAccessCard';
import { HomeHeader } from '@/components/home/HomeHeader';
import { ImpactFooter } from '@/components/home/ImpactFooter';
import { MediathekReihe } from '@/components/home/MediathekReihe';
import { SpotlightBriefing } from '@/components/home/SpotlightBriefing';
import { KeyboardAvoiding } from '@/components/keyboard/KeyboardAvoiding';
import { EpisodeRow } from '@/components/media/EpisodeRow';
import { LiveBanner } from '@/components/media/LiveBanner';
import { MediaCard } from '@/components/media/MediaCard';
import { SeriesTile } from '@/components/media/SeriesTile';
import { VideoFrame } from '@/components/media/VideoFrame';
import { CalloutCard } from '@/components/participate/CalloutCard';
import { ClaimStatusTag } from '@/components/participate/ClaimStatusTag';
import { FormField } from '@/components/participate/FormField';
import { MiniPlayer } from '@/components/player/MiniPlayer';
import { ProgressBar } from '@/components/player/ProgressBar';
import { ClubCard } from '@/components/profile/ClubCard';
import { NavCard } from '@/components/profile/NavCard';
import { SettingRow } from '@/components/profile/SettingRow';
import { ReaderView } from '@/components/reader/ReaderView';
import { RecoveryScreen } from '@/components/recovery/RecoveryScreen';
// The bar itself, not the seam: on iOS and Android `ScreenHeader` configures the
// platform's stack header and draws nothing, and configuring one from inside a
// gallery card would set the options of the route the gallery is on (ADR 0030).
// What is drawn here is what `ScreenHeader` draws on web, which is the whole of
// what there is to look at.
import { ScreenHeaderBar } from '@/components/ui/ScreenHeaderBar';
import {
  Badge,
  Bleed,
  Button,
  Card,
  Chip,
  Hairline,
  Overline,
  Rail,
  SafeAreaView,
  ScaledText,
  ScaledTextInput,
  SplitRow,
  Screen,
  SectionCard,
  SectionHeader,
  Thumbnail,
  Typo,
} from '@/components/ui';
import { sizes, typography, type TypoVariant } from '@/lib/theme';

import type { ComponentId } from './components.generated';
import {
  ARTICLE,
  ARTICLE_BARE,
  CLAIMS,
  CROWDNEWSROOM,
  EMBED_URI,
  FACTCHECKS,
  FORM_FIELDS,
  LONG_ERROR,
  PROJECT,
  READER_HTML,
  SAMPLE_HITS,
  SERIES,
  SURVEY,
  VIDEO,
} from './fixtures';

/** Every handler in the gallery. Nothing here navigates or plays. */
const noop = () => {};
/** `onNavigate` must answer whether the embedded document may follow a link. */
const block = () => false;

export interface Specimen {
  /** What is varied, in the props' own words: `tone="club"`, `selected`. */
  label: string;
  node: ReactNode;
  /**
   * Boxed to this many dp. For a component that fills a screen, which would
   * otherwise collapse to nothing inside a scroll view or push the next entry
   * off the end of it.
   */
  height?: number;
  /**
   * Shown on `canvas` only, because the component paints its own page surface and
   * the second copy would say nothing.
   */
  ownSurface?: boolean;
}

export interface Entry {
  /** The component's exported name, which is also its file name. */
  name: string;
  /** One line, only where the specimen alone would mislead. */
  note?: string;
  /**
   * `readonly`, and so is `Folder['entries']`, because `LISTED` below is a
   * `const` assertion and a const-asserted array is a readonly tuple. That is
   * what keeps `'Typo'` a literal type instead of a `string`, which is the whole
   * mechanism: without the literals there is no union to hold against
   * `ComponentId`. Nothing reads these lists to write to them.
   */
  specimens: readonly Specimen[];
}

/**
 * One component's address, and the same string on both sides of the seam.
 *
 * The workbench's reference and this gallery are two views of one list, and a link
 * between them is only as good as the agreement on what a component is called.
 * `folder/name` is that agreement: it is what `src/components` already calls a
 * component, and it is what `?c=` carries in both directions.
 *
 * The platform suffix is deliberately not part of it. `ReaderView` and
 * `ReaderView.web` are one entry here, because the gallery draws whichever the
 * bundler picked, and asking for the other one is a question this page cannot
 * answer. Which is why the reference resolves the name to its own rows rather than
 * being handed one of their ids: it has two where this has one, and it knows that
 * and this does not (`pages/Components.tsx`, `useAskedFor`).
 */
export function componentId(folder: string, name: string): string {
  return `${folder}/${name}`;
}

export interface Folder {
  /** The directory under `src/components`. */
  folder: string;
  entries: readonly Entry[];
}

/**
 * A component that exists and deliberately has NO entry of its own.
 *
 * The parameter is constrained to `ComponentId`, which is the half that stops a
 * reason outliving the thing it is about: delete the component, run
 * `npm run component-ids`, and the excuse below stops compiling with the name of
 * what is gone. An `Exclude` on its own would quietly succeed.
 */
type NoEntryOfItsOwn<Id extends ComponentId> = Id;

/**
 * Read off the two `ScreenHeader` files and the import comment above: on iOS and
 * Android `ScreenHeader` configures the platform's stack header and draws nothing
 * (ADR 0030), and calling `Stack.Screen` from inside a gallery card would set the
 * options of the route the gallery is on. So the `ui/ScreenHeader` entry draws
 * THIS component, which is the whole of what there is to look at, and a second
 * entry would be the same picture under the name no screen asks for.
 */
type DrawnUnderScreenHeader = NoEntryOfItsOwn<'ui/ScreenHeaderBar'>;

/** Every component that must appear in `LISTED`. One exception, named above. */
type MustBeListed = Exclude<ComponentId, DrawnUnderScreenHeader>;

/** `folder/Name` for every entry, read off the catalogue's own type. */
type IdsOf<T extends readonly Folder[]> = {
  [I in keyof T]: `${T[I]['folder']}/${T[I]['entries'][number]['name']}`;
}[number];

/** A visible block, for the components whose own size is zero. */
const filler = (label: string) => (
  <View className="items-center justify-center bg-accent" style={{ height: 56 }}>
    <Typo variant="text-s" color="always-light">
      {label}
    </Typo>
  </View>
);

const TYPO_VARIANTS = Object.keys(typography) as TypoVariant[];

/**
 * The catalogue as written, with every `folder:` and `name:` still a literal type.
 *
 * `as const` is what keeps them literal; `satisfies` is what keeps the shape
 * checked, including the excess-property check on each entry that a plain
 * annotation used to do — `notes:` for `note:` is still an error here. The two
 * together are what let `IdsOf` read the addresses back out of the type.
 */
const LISTED = [
  {
    folder: 'ui',
    entries: [
      {
        name: 'Typo',
        note: 'Every variant in typography.css, then the colour and weight axes on their own.',
        specimens: [
          ...TYPO_VARIANTS.map((variant) => ({
            label: `variant="${variant}"`,
            node: <Typo variant={variant}>Wem gehört die Stadt</Typo>,
          })),
          {
            label: 'color="on-canvas-muted"',
            node: (
              <Typo variant="text-m" color="on-canvas-muted">
                Gedämpfter Text
              </Typo>
            ),
          },
          {
            label: 'color="accent"',
            node: (
              <Typo variant="text-m" color="accent">
                Akzentfarbe
              </Typo>
            ),
          },
          {
            label: 'weight="bold" and family="serif"',
            node: (
              <Typo variant="text-m" weight="bold" family="serif">
                Serif, fett
              </Typo>
            ),
          },
          {
            label: 'color="always-light" on bg-accent',
            node: (
              <View className="bg-accent p-s">
                <Typo variant="text-m" color="always-light">
                  Weiß auf der Markenfarbe, in beiden Schemata
                </Typo>
              </View>
            ),
          },
        ],
      },
      {
        name: 'Button',
        specimens: [
          ...(['primary', 'secondary', 'outline', 'club'] as const).map((variant) => ({
            label: `variant="${variant}"`,
            node: <Button title="Jetzt mitmachen" variant={variant} onPress={noop} />,
          })),
          {
            label: 'variant="onEmphasis", on bg-accent',
            node: (
              <View className="bg-accent p-s">
                <Button title="Mitglied werden" variant="onEmphasis" onPress={noop} />
              </View>
            ),
          },
          { label: 'disabled', node: <Button title="Gesperrt" disabled onPress={noop} /> },
          {
            label: 'fullWidth',
            node: <Button title="Über die ganze Breite" fullWidth onPress={noop} />,
          },
        ],
      },
      {
        name: 'Badge',
        specimens: (['emphasis', 'club', 'neutral', 'live'] as const).map((tone) => ({
          label: `tone="${tone}"`,
          node: <Badge label={tone === 'live' ? 'Live' : 'Projekt'} tone={tone} />,
        })),
      },
      {
        name: 'Chip',
        specimens: [
          { label: 'default', node: <Chip label="Klima" onPress={noop} /> },
          { label: 'selected', node: <Chip label="Klima" selected onPress={noop} /> },
        ],
      },
      {
        name: 'Card',
        specimens: (['outline', 'surface'] as const).map((tone) => ({
          label: `tone="${tone}"`,
          node: (
            <Card tone={tone}>
              <Typo variant="text-m">Inhalt der Karte</Typo>
            </Card>
          ),
        })),
      },
      {
        name: 'Overline',
        specimens: [
          { label: 'default', node: <Overline label="Junge Formate" /> },
          { label: 'color="accent"', node: <Overline label="Faktencheck" color="accent" /> },
          {
            // The one unbounded label the app passes this component: a WordPress
            // `post::topline`, written by an editor. Here because the component is
            // one line now and this is the specimen that shows what that costs.
            label: 'a kicker longer than the line',
            node: <Overline label="Recherche zu Pflegeheimen in Nordrhein-Westfalen" />,
          },
        ],
      },
      {
        name: 'SectionHeader',
        specimens: [
          { label: 'title only', node: <SectionHeader title="Aus dem Backstage" /> },
          {
            label: 'with actionLabel',
            node: <SectionHeader title="Aus dem Backstage" actionLabel="Alles" onAction={noop} />,
          },
        ],
      },
      {
        name: 'SectionCard',
        note: 'The group label over one card, which four screens are a stack of. Named on 2026-09-10; ADR 0021 records the sixteen call sites that used to write it out.',
        specimens: [
          {
            label: 'default, tone="outline"',
            node: (
              <SectionCard label="Konto">
                <Typo variant="text-m">alex.beispiel@example.org</Typo>
              </SectionCard>
            ),
          },
          {
            label: 'tone="surface"',
            node: (
              <SectionCard label="Benachrichtigungen" tone="surface">
                <Typo variant="text-m">Push-Mitteilungen</Typo>
              </SectionCard>
            ),
          },
        ],
      },
      {
        name: 'SplitRow',
        note: 'A two-sided row that keeps its gap and may wrap. `justify-between` distributes what is LEFT OVER, so a row written with it alone is correct exactly while there is room left over — at a 200 % system font scale there is none, and the two sides touch (#158).',
        specimens: [
          {
            label: 'room to spare',
            node: (
              <SplitRow>
                <Typo variant="text-s">SPOTLIGHT</Typo>
                <Typo variant="text-s" color="accent">
                  Alle Ausgaben
                </Typo>
              </SplitRow>
            ),
          },
          {
            label: 'no room left, so it wraps',
            node: (
              <View style={{ width: 150 }}>
                <SplitRow>
                  <Typo variant="text-s">Passwort vergessen?</Typo>
                  <Typo variant="text-s" color="accent">
                    Mitglied werden
                  </Typo>
                </SplitRow>
              </View>
            ),
          },
        ],
      },
      {
        name: 'Hairline',
        note: 'One dp in `stroke`. Visible against both surfaces, which is the point of it.',
        specimens: [{ label: 'default', node: <Hairline /> }],
      },
      {
        name: 'ScaledText',
        note: 'The Text under Typo, Button, Badge and Chip: it applies the app text size (ADR 0033). Following the system it is a plain Text; with a size chosen in the settings, it draws at that size in place of the system one.',
        specimens: [
          {
            label: 'text-m, unstyled otherwise',
            node: <ScaledText style={typography['text-m']}>ScaledText</ScaledText>,
          },
        ],
      },
      {
        name: 'ScaledTextInput',
        note: 'The same for a field: the four text fields render this rather than TextInput.',
        specimens: [
          {
            label: 'text-m, empty',
            node: <ScaledTextInput placeholder="ScaledTextInput" style={typography['text-m']} />,
          },
        ],
      },
      {
        name: 'Rail',
        specimens: (['xs', 's'] as const).map((gap) => ({
          label: `gap="${gap}"`,
          node: (
            <Rail gap={gap}>
              {['Klima', 'Lokal', 'Faktenchecks', 'Russland', 'Gesundheit'].map((label) => (
                <Chip key={label} label={label} onPress={noop} />
              ))}
            </Rail>
          ),
        })),
      },
      {
        name: 'Bleed',
        note: 'Escapes the screen padding. Here the red block runs wider than the label above it.',
        specimens: [{ label: 'default', node: <Bleed>{filler('edge to edge')}</Bleed> }],
      },
      {
        name: 'Thumbnail',
        specimens: [
          {
            label: 'aspectRatio={16 / 9}, no uri',
            node: <Thumbnail aspectRatio={16 / 9} />,
          },
          {
            label: 'aspectRatio={1}, icon="mic-outline"',
            node: (
              <View style={{ width: sizes.railTile }}>
                <Thumbnail aspectRatio={1} icon="mic-outline" />
              </View>
            ),
          },
          {
            label: 'uri that cannot load, with an overlay',
            node: (
              <Thumbnail
                aspectRatio={16 / 9}
                uri="https://example.invalid/missing.jpg"
                overlay={<Badge label="Video" tone="emphasis" />}
              />
            ),
          },
        ],
      },
      {
        name: 'Screen',
        note: 'The page scaffold. Boxed here; in the app it fills the window.',
        specimens: [
          {
            label: 'scroll (default)',
            height: 160,
            ownSurface: true,
            node: (
              <Screen>
                <Typo variant="headline-m">Scrollender Inhalt</Typo>
                <Typo variant="text-m" className="mt-s">
                  Mit der voreingestellten Polsterung px-m.
                </Typo>
              </Screen>
            ),
          },
          {
            label: 'scroll={false} noPadding',
            height: 160,
            ownSurface: true,
            node: (
              <Screen scroll={false} noPadding>
                {filler('noPadding')}
              </Screen>
            ),
          },
        ],
      },
      {
        name: 'ScreenHeader',
        note: 'The bar it draws on web, and on the two screens that keep the bar everywhere. On iOS and Android it configures the platform’s stack header instead and draws nothing (ADR 0030).',
        specimens: [
          {
            label: 'default',
            height: 72,
            ownSurface: true,
            node: <ScreenHeaderBar onBack={noop} />,
          },
          {
            label: 'backLabel="Abbrechen"',
            height: 72,
            ownSurface: true,
            node: <ScreenHeaderBar backLabel="Abbrechen" onBack={noop} />,
          },
          {
            label: 'with children, so back shrinks to the chevron',
            height: 72,
            ownSurface: true,
            node: (
              <ScreenHeaderBar onBack={noop}>
                <SearchEntry onPress={noop} />
              </ScreenHeaderBar>
            ),
          },
        ],
      },
      {
        name: 'SafeAreaView',
        note: 'react-native-safe-area-context, wrapped so a className reaches it. In the frame the inset is zero.',
        specimens: [
          {
            label: "edges={['top']}",
            height: 80,
            ownSurface: true,
            node: (
              <SafeAreaView edges={['top']} className="flex-1 bg-surface">
                <Typo variant="text-s" className="p-s">
                  Inside the safe area
                </Typo>
              </SafeAreaView>
            ),
          },
        ],
      },
    ],
  },
  {
    folder: 'feed',
    entries: [
      {
        name: 'ArticleHero',
        note: 'The lead item. Reads the reading time off the item, and falls back to a fetch when it is missing.',
        specimens: [
          {
            label: 'with image and readingMinutes',
            node: <ArticleHero item={ARTICLE} onPress={noop} />,
          },
          { label: 'imageUrl: null', node: <ArticleHero item={ARTICLE_BARE} onPress={noop} /> },
        ],
      },
      {
        name: 'ArticleRow',
        specimens: [
          { label: 'default', node: <ArticleRow item={ARTICLE} onPress={noop} /> },
          {
            label: 'long title, no image',
            node: <ArticleRow item={ARTICLE_BARE} onPress={noop} />,
          },
        ],
      },
      {
        name: 'FaktencheckRail',
        specimens: [
          { label: 'three items', node: <FaktencheckRail items={FACTCHECKS} onPress={noop} /> },
          { label: 'items={[]}', node: <FaktencheckRail items={[]} onPress={noop} /> },
        ],
      },
    ],
  },
  {
    folder: 'home',
    entries: [
      {
        name: 'HomeHeader',
        specimens: [{ label: 'default', node: <HomeHeader instant={Date.now()} /> }],
      },
      {
        name: 'SpotlightBriefing',
        note: 'Loads the newsletter archive on first render, so this entry makes a request.',
        specimens: [{ label: 'default', node: <SpotlightBriefing onOpenArchive={noop} /> }],
      },
      {
        name: 'MediathekReihe',
        note: 'Loads a video channel on first render, so this entry makes a request.',
        specimens: [{ label: 'default', node: <MediathekReihe onOpenMediathek={noop} /> }],
      },
      {
        name: 'BackstageTeaser',
        specimens: [
          {
            label: 'default',
            node: <BackstageTeaser onOpenDiary={noop} onOpenBackstage={noop} />,
          },
        ],
      },
      {
        name: 'CalloutTeaser',
        specimens: [
          {
            label: 'kind="crowdnewsroom"',
            node: <CalloutTeaser callout={CROWDNEWSROOM} onPress={noop} />,
          },
          { label: 'kind="survey"', node: <CalloutTeaser callout={SURVEY} onPress={noop} /> },
        ],
      },
      {
        name: 'EarlyAccessCard',
        specimens: [
          { label: 'onPress', node: <EarlyAccessCard onPress={noop} /> },
          { label: 'without onPress', node: <EarlyAccessCard /> },
        ],
      },
      { name: 'ImpactFooter', specimens: [{ label: 'default', node: <ImpactFooter /> }] },
    ],
  },
  {
    folder: 'discover',
    entries: [
      {
        name: 'SearchEntry',
        specimens: [{ label: 'default', node: <SearchEntry onPress={noop} /> }],
      },
      {
        name: 'TopicRail',
        specimens: [{ label: 'default', node: <TopicRail onOpenTopic={noop} /> }],
      },
      {
        name: 'ProjectRow',
        specimens: [{ label: 'default', node: <ProjectRow project={PROJECT} onPress={noop} /> }],
      },
      {
        name: 'SampleHitRow',
        note: 'One row per kind, which is what picks the icon.',
        specimens: [
          ...SAMPLE_HITS.map((hit) => ({
            label: `kind="${hit.kind}"`,
            node: <SampleHitRow hit={hit} onPress={noop} />,
          })),
          {
            label: 'without onPress, so no chevron and no link role',
            node: <SampleHitRow hit={SAMPLE_HITS[0]} />,
          },
        ],
      },
    ],
  },
  {
    folder: 'media',
    entries: [
      {
        name: 'LiveBanner',
        note: 'Asks the station what is on air, so this entry makes a request.',
        specimens: [
          { label: 'default subtitle', node: <LiveBanner /> },
          { label: 'subtitle', node: <LiveBanner subtitle="Sondersendung aus Bottrop" /> },
          {
            // The case the component's one-line declaration is about: a stream
            // announces titles nobody chose, and this is one the station really
            // sent. It is here rather than in prose because the line is the only
            // place in the app where the text is neither ours nor a person's.
            label: 'subtitle, a title with no break in it',
            node: <LiveBanner subtitle="20260901_Gamescom_Laberpocast_Sophie_Amelie" />,
          },
        ],
      },
      {
        name: 'MediaCard',
        specimens: [
          {
            label: 'default',
            node: (
              <View style={{ width: sizes.railCardMedia }}>
                <MediaCard video={VIDEO} onPress={noop} />
              </View>
            ),
          },
        ],
      },
      {
        name: 'SeriesTile',
        specimens: [{ label: 'default', node: <SeriesTile series={SERIES} onPress={noop} /> }],
      },
      {
        name: 'EpisodeRow',
        specimens: [
          {
            label: 'default',
            node: (
              <EpisodeRow
                episodeId="gallery-ep-1"
                title="Pausenbrot, Folge 214"
                meta="12. August · 8 Min"
                onPress={noop}
              />
            ),
          },
          {
            label: 'club',
            node: (
              <EpisodeRow
                episodeId="gallery-ep-2"
                title="Nur für Mitglieder mit Beitrag"
                meta="3. August · 22 Min"
                club
                onPress={noop}
              />
            ),
          },
        ],
      },
      {
        name: 'VideoFrame',
        note: 'A foreign embed: an iframe on web, a WebView on native. This entry loads YouTube.',
        specimens: [
          {
            label: 'uri',
            height: 200,
            ownSurface: true,
            node: <VideoFrame uri={EMBED_URI} className="flex-1" />,
          },
        ],
      },
    ],
  },
  {
    folder: 'participate',
    entries: [
      {
        name: 'CalloutCard',
        specimens: [
          {
            label: 'kind="crowdnewsroom"',
            node: <CalloutCard callout={CROWDNEWSROOM} onPress={noop} />,
          },
          { label: 'kind="survey"', node: <CalloutCard callout={SURVEY} onPress={noop} /> },
        ],
      },
      {
        name: 'ClaimStatusTag',
        specimens: CLAIMS.map((claim) => ({
          label: `status="${claim.status}"`,
          node: <ClaimStatusTag claim={claim} />,
        })),
      },
      {
        name: 'FormField',
        note: 'One field per component type in the callout schema. Nothing here submits.',
        specimens: FORM_FIELDS.map((component) => ({
          label: `type="${component.type}"`,
          node: (
            <FormField
              component={component}
              choice={component.type === 'radio' ? ['taeglich'] : []}
              text={component.type === 'textarea' ? 'Mehr Lokales.' : ''}
              fileAttached={false}
              onSelect={noop}
              onText={noop}
              onToggleFile={noop}
            />
          ),
        })),
      },
    ],
  },
  {
    folder: 'player',
    entries: [
      {
        name: 'ProgressBar',
        specimens: [
          {
            label: 'at the start',
            node: <ProgressBar positionSec={0} durationSec={600} onSeek={noop} />,
          },
          {
            label: 'part way through',
            node: <ProgressBar positionSec={252} durationSec={600} onSeek={noop} />,
          },
          {
            label: 'durationSec={0}, before anything is known',
            node: <ProgressBar positionSec={0} durationSec={0} onSeek={noop} />,
          },
        ],
      },
      {
        name: 'MiniPlayer',
        note: 'Draws nothing unless something is playing, so an empty box here is correct.',
        specimens: [{ label: 'default', node: <MiniPlayer /> }],
      },
    ],
  },
  {
    folder: 'profile',
    entries: [
      {
        name: 'ClubCard',
        specimens: [
          {
            label: 'with memberSince',
            node: (
              <ClubCard
                name="Alex Beispiel"
                tierLabel="Mitglied mit Beitrag"
                memberSince="2026-03-04T09:12:00.000Z"
              />
            ),
          },
          {
            label: 'memberSince={null}',
            node: <ClubCard name="Alex Beispiel" tierLabel="Testphase" memberSince={null} />,
          },
        ],
      },
      {
        name: 'NavCard',
        specimens: [
          {
            label: 'default',
            node: (
              <NavCard
                icon="bookmark-outline"
                title="Gespeichert"
                subtitle="Artikel für später"
                onPress={noop}
              />
            ),
          },
          {
            label: 'club',
            node: (
              <NavCard
                icon="ticket-outline"
                title="Backstage"
                subtitle="Nur für Mitglieder"
                club
                onPress={noop}
              />
            ),
          },
        ],
      },
      {
        name: 'SettingRow',
        note: 'The switch reads two different props for its thumb on web; see TROUBLESHOOTING.md.',
        specimens: [
          {
            label: 'value={false}',
            node: <SettingRow label="Push-Nachrichten" value={false} onValueChange={noop} />,
          },
          {
            label: 'value with description',
            node: (
              <SettingRow
                label="Spotlight"
                description="Der Newsletter, jeden Freitag."
                value
                onValueChange={noop}
              />
            ),
          },
        ],
      },
    ],
  },
  {
    folder: 'reader',
    entries: [
      {
        name: 'ReaderView',
        note: 'A sandboxed document: an iframe on web, a WebView on native.',
        specimens: [
          {
            label: 'html',
            height: 220,
            ownSurface: true,
            node: <ReaderView html={READER_HTML} onNavigate={block} onScroll={noop} />,
          },
        ],
      },
    ],
  },
  {
    folder: 'gate',
    entries: [
      {
        name: 'LoginGate',
        note: 'The door, which the root layout draws instead of the router. Boxed here.',
        specimens: [{ label: 'signed out', height: 420, ownSurface: true, node: <LoginGate /> }],
      },
    ],
  },
  {
    folder: 'recovery',
    entries: [
      {
        name: 'RecoveryScreen',
        // The only place anybody looks at this screen on purpose. In the app it
        // appears when a render has already failed, so nobody chooses to see it and
        // nobody notices when it drifts out of the scheme.
        note: 'What the error boundary shows. The app draws it only after a render failed.',
        specimens: [
          {
            label: 'a thrown Error',
            height: 460,
            ownSurface: true,
            node: (
              <RecoveryScreen
                detail="TypeError: Cannot read properties of undefined"
                onRetry={noop}
              />
            ),
          },
          {
            // The bounded case the screen's own markup is about: four lines, then
            // the retry button has to stay on screen.
            label: 'a message longer than the box',
            height: 460,
            ownSurface: true,
            node: <RecoveryScreen detail={LONG_ERROR} onRetry={noop} />,
          },
        ],
      },
    ],
  },
  {
    folder: 'keyboard',
    entries: [
      {
        name: 'KeyboardAvoiding',
        // There is nothing to look at, and that is worth an entry rather than an
        // exception: the gallery draws its specimens with no keyboard open, and
        // everything this component does happens while one is. The note points at
        // where the argument is written down instead.
        note: 'A layout wrapper with no appearance of its own: it pads its bottom while a software keyboard is open, which no still picture can show. The component file carries the reasoning.',
        specimens: [
          {
            label: 'around a box',
            node: <KeyboardAvoiding>{filler('KeyboardAvoiding')}</KeyboardAvoiding>,
          },
        ],
      },
    ],
  },
] as const satisfies readonly Folder[];

/**
 * **Nothing is forgotten, and it is a compile error rather than a test.**
 *
 * Three claims, each written as a type parameter whose DEFAULT must be `never`.
 * When one is not, TypeScript reports the offending address by name on the line
 * of the claim it broke — which is the point: the failure has to say which rule
 * broke and about what, or it is a red build somebody widens.
 *
 * `ComponentId` is generated from `src/components` by
 * `scripts/generate-component-ids.mjs`, so the closed set these are checked
 * against is the folder itself rather than a list anybody maintains. Forgetting
 * to regenerate it is the one hole left, and it is the drift check in
 * `__tests__/gallery-catalogue.test.ts` (ADR 0031, mechanism 2).
 *
 * What none of them can see: a component listed TWICE, which a union of
 * addresses silently folds into one, and every fact about `src/components` that
 * is not the set of addresses. Those stay in the test, and it says so at itself.
 */
type EveryComponentHasAnEntry<Missing extends never = Exclude<MustBeListed, IdsOf<typeof LISTED>>> =
  Missing;
/** Catches a deleted component, a renamed one, and an entry under the wrong folder. */
type EveryEntryHasAComponent<Stale extends never = Exclude<IdsOf<typeof LISTED>, ComponentId>> =
  Stale;
/** An excuse for a component that now has an entry is a leftover, not a rule. */
type NoExcusedComponentIsListed<
  Both extends never = Extract<IdsOf<typeof LISTED>, DrawnUnderScreenHeader>,
> = Both;

/**
 * The catalogue the gallery and the workbench read.
 *
 * Spread rather than aliased: `LISTED` is a readonly tuple and both readers type
 * against `Folder[]` — `Gallery.tsx`'s `shown()` returns one. The copy is twelve
 * references at module scope and buys the literal types above.
 */
export const CATALOGUE: Folder[] = [...LISTED];

/**
 * Exported so that the three claims above are not dead code.
 *
 * They are proofs rather than types anybody uses, and oxlint's `no-unused-vars`
 * is an ERROR on an unreferenced type alias — so without this line the check that
 * makes the catalogue complete is itself the thing a lint fix deletes. Nothing
 * imports them, and nothing should.
 */
export type { EveryComponentHasAnEntry, EveryEntryHasAComponent, NoExcusedComponentIsListed };
