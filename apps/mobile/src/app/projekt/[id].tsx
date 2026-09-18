import { router, useLocalSearchParams } from 'expo-router';
import { defineMessages, useIntl, type MessageDescriptor } from 'react-intl';
import { ActivityIndicator, ScrollView, View } from 'react-native';

import { ArticleRow } from '@/components/feed/ArticleRow';
import { Button, Card, Hairline, SectionHeader, Typo } from '@/components/ui';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { interests } from '@correctiv/app-core/data/interests';
import { projectGroups, resolveProject, type Project } from '@correctiv/app-core/data/projects';
import type { FeedKey } from '@correctiv/app-core/types/models';
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
        <ScrollView
          className="flex-1"
          contentContainerClassName="px-m pt-m pb-2xl"
          showsVerticalScrollIndicator={false}
        >
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

          {project.feed ? <ProjectFeed feed={project.feed} /> : null}

          {project.teaserOnly && (
            <Card tone="surface" className="mt-m">
              <Typo variant="headline-xs">{intl.formatMessage(COPY.comingSoon)}</Typo>
              <Typo variant="text-s" color="on-canvas-muted" className="mt-4xs">
                {intl.formatMessage(COPY.comingSoonBody, { name: project.name })}
              </Typo>
            </Card>
          )}
        </ScrollView>
      )}
    </View>
  );
}

/**
 * Its own component, because `useFeed` is a hook: on a page without a feed it must
 * not be called conditionally.
 */
function ProjectFeed({ feed }: { feed: FeedKey }) {
  const intl = useIntl();
  const colors = useColors();
  const { data, loading, error } = useFeed(feed);
  const items = data?.slice(0, 12) ?? [];

  return (
    <View className="mt-l">
      <SectionHeader title={intl.formatMessage(COPY.latestPosts)} />

      {loading && items.length === 0 && (
        <View className="py-l">
          <ActivityIndicator color={colors.accent} />
        </View>
      )}

      {/* No silently endless spinner. With no network and no cache this says that
          nothing could be loaded. It stopped being the web target's normal case with
          ADR 0015: the REST API sends a CORS header, so a browser has a live path. */}
      {error && items.length === 0 && !loading && (
        <Typo variant="text-s" color="on-canvas-muted" className="mt-2xs">
          {intl.formatMessage(COPY.feedFailed)}
        </Typo>
      )}

      <View className="mt-2xs">
        {items.map((item, i) => (
          <View key={item.id}>
            {i > 0 && <Hairline />}
            <ArticleRow item={item} onPress={openArticle} />
          </View>
        ))}
      </View>
    </View>
  );
}
