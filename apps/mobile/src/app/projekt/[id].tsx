import { router, useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import { defineMessages, useIntl, type MessageDescriptor } from 'react-intl';
import {
  ActivityIndicator,
  FlatList,
  ScrollView,
  View,
  type ListRenderItemInfo,
} from 'react-native';

import { ArticleRow } from '@/components/feed/ArticleRow';
import { Button, Card, Hairline, SectionHeader, Typo } from '@/components/ui';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { interests } from '@correctiv/app-core/data/interests';
import { projectGroups, resolveProject, type Project } from '@correctiv/app-core/data/projects';
import type { FeedEnd } from '@correctiv/app-core/stores/feeds';
import type { FeedItem, FeedKey } from '@correctiv/app-core/types/models';
import { useFeed } from '@/lib/feeds/useFeed';
import { openArticle } from '@/lib/openArticle';
import { openExternal } from '@/lib/openExternal';
import { useColors } from '@/lib/theme';

/**
 * Everything this screen says, in ENGLISH; the German ships in
 * `packages/catalogue/src/de/project.ts` (ADR 0026 §6). The project's name and
 * description are content from `@correctiv/app-core/data/projects`.
 *
 * `unknownId` carries the German quotation marks INSIDE the message rather than
 * around it in the markup: they are part of the sentence, and a language that
 * quotes differently should get its own pair.
 */
const COPY = defineMessages({
  screenTitle: { id: 'project.screenTitle', defaultMessage: 'Project' },
  notFound: { id: 'project.notFound', defaultMessage: 'This project does not exist' },
  unknownId: {
    id: 'project.unknownId',
    defaultMessage: 'Unknown identifier "{id}".',
    description:
      'Shown when the project screen is opened with an identifier no project has. {id} is that identifier, unchanged, in quotation marks. Three other screens say the same under `claim.unknownId`, `diary.unknownId` and `series.unknownId`.',
  },
  noId: {
    id: 'project.noId',
    defaultMessage: 'No identifier was passed.',
    description:
      'Shown when the project screen is opened with no identifier at all. Four other screens say the same thing under callout.detail.noSlug, claim.noId, diary.noId and series.noId.',
  },
  comingSoon: { id: 'project.comingSoon', defaultMessage: 'Coming soon' },
  comingSoonBody: {
    id: 'project.comingSoonBody',
    defaultMessage:
      '{name} is just starting. The first pieces appear here as soon as they are published.',
    description: "Shown on a project that has published nothing yet. {name} is the project's name.",
  },
  latestPosts: { id: 'project.latestPosts', defaultMessage: 'Latest pieces' },
  feedFailed: { id: 'project.feedFailed', defaultMessage: 'The pieces could not be loaded.' },
  loadMore: { id: 'project.loadMore', defaultMessage: 'Load more' },
  loadMoreWhileLoading: {
    id: 'project.loadMoreWhileLoading',
    defaultMessage: 'Loading more…',
    description:
      'The label of the button that loads the next page, while that page is on its way. Read instead of the button\'s own label, because a button that keeps saying "Load more" while it does nothing is a control that has stopped answering.',
  },
  endOfFeed: {
    id: 'project.endOfFeed',
    defaultMessage: 'That is everything published so far.',
  },
  tipWhatsapp: { id: 'project.tipWhatsapp', defaultMessage: 'Send a tip on WhatsApp' },
  listenRadio: { id: 'project.listenRadio', defaultMessage: 'Listen to Salon5 Radio' },
  joinLocalNetwork: { id: 'project.joinLocalNetwork', defaultMessage: 'Join the local network' },
});

/**
 * The project's own action — label and target in one place.
 *
 * The label is a descriptor and not a string, because this table is module scope
 * and cannot call a hook; the screen formats it where it draws the button. The
 * three descriptors come from `COPY` above rather than being written out here:
 * `@formatjs/cli` extracts from `defineMessages` and from nothing else, so a
 * descriptor spelled as a bare object literal in this table would have no English
 * side at all — measured, it extracted to zero and
 * `__tests__/localisation-seam.test.ts` named all three.
 */
const ACTIONS: Record<
  NonNullable<Project['action']>,
  { label: MessageDescriptor; run: () => void }
> = {
  'whatsapp-tip': {
    label: COPY.tipWhatsapp,
    // The fact-check desk's real tip number.
    run: () => openExternal('https://wa.me/4915142647500'),
  },
  radio: {
    label: COPY.listenRadio,
    // The live stream belongs to the player, and that is ONE app-wide singleton
    // (expo-audio). A second player here would be a second state for the same
    // playback — hence only the jump into the Mediathek.
    run: () => router.push('/(tabs)/mediathek'),
  },
  'local-network': {
    label: COPY.joinLocalNetwork,
    run: () => openExternal('https://correctiv.org/lokal/'),
  },
};

/**
 * Every id this route can serve — for the static web export.
 *
 * Without it only `projekt/[id].html` is emitted, and a static host (GitHub Pages,
 * no rewrites) answers /projekt/klima with a 404. Verified: before this function
 * that was exactly the case. Native is unaffected — there are no URLs there, only
 * the router.
 *
 * The namespace is the one `resolveProject` resolves: projects plus topics that
 * have a feed. A Set, because `klima`, `lokal` and `schweiz` appear in both.
 */
export function generateStaticParams(): { id: string }[] {
  const ids = new Set([
    ...projectGroups.flatMap((group) => group.projects.map((project) => project.id)),
    ...interests.filter((topic) => topic.feed).map((topic) => topic.id),
  ]);
  return [...ids].map((id) => ({ id }));
}

/**
 * One template for every project and topic page: head, the project's own action,
 * live feed.
 *
 * `id` arrives from the directory or from the topic rail — `resolveProject` in the
 * core knows both namespaces (and documents why the project wins).
 *
 * The design draft separates a short badge from a long title in the head; the data
 * carries only a `name`, and showing both would print the same string twice. Hence
 * title plus description here.
 */
export default function ProjektScreen() {
  const intl = useIntl();
  const { id } = useLocalSearchParams<{ id: string }>();
  const project = resolveProject(id ?? '');
  const action = project?.action ? ACTIONS[project.action] : null;

  return (
    <View className="flex-1 bg-canvas">
      <ScreenHeader title={intl.formatMessage(COPY.screenTitle)} />

      {!project ? (
        <View className="flex-1 items-center justify-center px-m">
          <Typo variant="headline-s" className="text-center">
            {intl.formatMessage(COPY.notFound)}
          </Typo>
          <Typo variant="text-m" color="on-canvas-muted" className="mt-2xs text-center">
            {id ? intl.formatMessage(COPY.unknownId, { id }) : intl.formatMessage(COPY.noId)}
          </Typo>
        </View>
      ) : (
        <ProjectBody project={project} action={action} />
      )}
    </View>
  );
}

/**
 * A project's head: name, description, its own action.
 *
 * Its own component so that both bodies below can hand the same element to their
 * scroller — a `ListHeaderComponent` and a `ScrollView` child are two different
 * positions, and the head is the one thing that does not care which it is in.
 */
function ProjectHead({ project, action }: { project: Project; action: ScreenAction }) {
  const intl = useIntl();
  return (
    <View>
      <Typo variant="headline-l">{project.name}</Typo>
      <Typo variant="text-m" color="on-canvas-muted" className="mt-2xs">
        {project.description}
      </Typo>

      {action && (
        <Button
          title={intl.formatMessage(action.label)}
          variant="outline"
          onPress={action.run}
          className="mt-s"
        />
      )}
    </View>
  );
}

type ScreenAction = { label: MessageDescriptor; run: () => void } | null;

/**
 * The teaser card, for a project that has published nothing yet.
 *
 * A component rather than an element in a constant, because its sentence is a
 * message and formatting one needs a hook.
 */
function TeaserCard({ project }: { project: Project }) {
  const intl = useIntl();
  return (
    <Card tone="surface" className="mt-m">
      <Typo variant="headline-xs">{intl.formatMessage(COPY.comingSoon)}</Typo>
      <Typo variant="text-s" color="on-canvas-muted" className="mt-4xs">
        {intl.formatMessage(COPY.comingSoonBody, { name: project.name })}
      </Typo>
    </Card>
  );
}

/**
 * A project page: the head, the feed, and the teaser.
 *
 * **Two bodies, and the reason is a hook.** `useFeed` may not be called
 * conditionally, and 19 of the 26 projects have no feed at all, so a page without
 * one cannot ask. It also has nothing to virtualize — a head and a card fit on any
 * screen — so it keeps a `ScrollView` and the page with a feed is the one that
 * gets a list. Both draw the same head, so the two agree on the head by sharing
 * it rather than by two copies that have to be kept in step.
 */
function ProjectBody({ project, action }: { project: Project; action: ScreenAction }) {
  return project.feed ? (
    <ProjectFeed feed={project.feed} project={project} action={action} />
  ) : (
    <ScrollView
      className="flex-1"
      contentContainerClassName="px-m pt-m pb-2xl"
      showsVerticalScrollIndicator={false}
    >
      <ProjectHead project={project} action={action} />
      {project.teaserOnly && <TeaserCard project={project} />}
    </ScrollView>
  );
}

/**
 * The section heading above the rows.
 *
 * **`mb-2xs` and not the wrapper the old screen had.** The rows sat in
 * `<View className="mt-2xs">`, and that wrapper went when the page's scroller became
 * the list. The gap belongs to the heading now, because the heading is the last thing
 * above the rows: put it on a row and the first row carries spacing it does not own,
 * and a `ListEmptyComponent` would be a row with the heading's gap under it.
 */
function FeedHeading() {
  const intl = useIntl();
  return (
    <View className="mt-l mb-2xs">
      <SectionHeader title={intl.formatMessage(COPY.latestPosts)} />
    </View>
  );
}

function FeedSpinner() {
  const colors = useColors();
  return (
    <View className="py-l">
      <ActivityIndicator color={colors.accent} />
    </View>
  );
}

/**
 * No silently endless spinner. With no network and no cache this says that nothing
 * could be loaded. It stopped being the web target's normal case with ADR 0015: the
 * REST API sends a CORS header, so a browser has a live path.
 */
function FeedFailed() {
  const intl = useIntl();
  return (
    <Typo variant="text-s" color="on-canvas-muted" className="mt-2xs">
      {intl.formatMessage(COPY.feedFailed)}
    </Typo>
  );
}

/**
 * The foot of the feed: the button, or the sentence that says there is nothing more.
 *
 * **A button and not `onEndReached`.** Scrolling to the end and finding the next
 * page already there is a faster screen, and it is also a page fetched for a
 * reader who was looking at the last row rather than at the end of the list, with
 * no way to see that it happened or to stop it. The button costs one tap and says
 * what it will do.
 *
 * Silent while `end` is `unknown`: a warm start or the offline snapshot has rows
 * and no answer, and the sentence would state a fact the app never learned.
 */
function FeedFoot({
  end,
  loadingMore,
  items,
  onLoadMore,
}: {
  end: FeedEnd;
  loadingMore: boolean;
  items: number;
  onLoadMore: () => void;
}) {
  const intl = useIntl();
  if (items === 0 || end === 'unknown') return null;
  if (end === 'end') {
    return (
      <Typo variant="text-s" color="on-canvas-muted" className="mt-s mb-2xs">
        {intl.formatMessage(COPY.endOfFeed)}
      </Typo>
    );
  }
  return (
    <View className="mt-s">
      <Button
        title={intl.formatMessage(loadingMore ? COPY.loadMoreWhileLoading : COPY.loadMore)}
        variant="outline"
        onPress={onLoadMore}
        disabled={loadingMore}
        fullWidth
      />
    </View>
  );
}

/**
 * A `FlatList` where the page used to hold a `ScrollView` with the rows mapped into
 * it, because the cap came off and an unbounded list is what ADR 0012 virtualizes,
 * and a list inside that scroller is the nesting it argues against.
 */
function ProjectFeed({
  feed,
  project,
  action,
}: {
  feed: FeedKey;
  project: Project;
  action: ScreenAction;
}) {
  const { data, loading, error, end, loadingMore, loadMore } = useFeed(feed);
  const items = useMemo(() => data ?? [], [data]);

  return (
    <FlatList
      className="flex-1"
      data={items}
      keyExtractor={keyExtractor}
      renderItem={renderItem}
      contentContainerClassName="px-m pt-m pb-2xl"
      showsVerticalScrollIndicator={false}
      ListHeaderComponent={
        <View>
          <ProjectHead project={project} action={action} />
          <FeedHeading />
          {loading && items.length === 0 && <FeedSpinner />}
          {error && items.length === 0 && !loading && <FeedFailed />}
        </View>
      }
      ListFooterComponent={
        <View>
          <FeedFoot
            end={end}
            loadingMore={loadingMore}
            items={items.length}
            onLoadMore={loadMore}
          />
          {/* Below the rows, where it always was on this page. No project sets
              `feed` and `teaserOnly` together today, and the type still allows it,
              so the two bodies cannot disagree about what a project with a feed
              draws. */}
          {project.teaserOnly && <TeaserCard project={project} />}
        </View>
      }
      // A separator between rows rather than a hairline drawn by each row: one
      // fewer node per row, and the first row cannot grow one by forgetting.
      ItemSeparatorComponent={Hairline}
    />
  );
}

const keyExtractor = (item: FeedItem) => item.id;

function renderItem({ item }: ListRenderItemInfo<FeedItem>) {
  return <ArticleRow item={item} onPress={openArticle} />;
}
