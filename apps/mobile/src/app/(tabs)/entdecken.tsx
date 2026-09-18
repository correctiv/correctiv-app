import { router } from 'expo-router';
import { defineMessages, useIntl } from 'react-intl';
import { View } from 'react-native';

import { ProjectRow } from '@/components/discover/ProjectRow';
import { SearchEntry } from '@/components/discover/SearchEntry';
import { TopicRail } from '@/components/discover/TopicRail';
import { Overline, Screen, Typo } from '@/components/ui';
import { projectGroups, type Project } from '@correctiv/app-core/data/projects';
import { projectTarget } from '@/lib/discover/target';
import { openExternal } from '@/lib/openExternal';

/**
 * The tab's own name, in ENGLISH; the German that ships is
 * `src/i18n/catalogue/de/discover.ts`. Everything else on this screen is the
 * catalogue from `@correctiv/app-core/data/projects`, which is content.
 */
const COPY = defineMessages({
  screenTitle: {
    id: 'discover.title',
    defaultMessage: 'Discover',
    description:
      'The heading of the Discover screen. ui.tabDiscover is the same word on the tab bar, where it has far less room.',
  },
});

/**
 * Entdecken — the ordered directory of the ecosystem: the search entry point, the
 * topic rail, and the 7 project groups from the concept.
 *
 * The catalogue comes wholly from `@correctiv/app-core/data/projects`; this screen
 * only decides what a tap means.
 */
export default function EntdeckenScreen() {
  const intl = useIntl();
  return (
    <Screen>
      <Typo variant="headline-xl" className="mb-s">
        {intl.formatMessage(COPY.screenTitle)}
      </Typo>

      <SearchEntry onPress={() => router.push('/suche')} />

      <View className="mt-s">
        <TopicRail onOpenTopic={openProject} />
      </View>

      {projectGroups.map((group) => (
        <View key={group.id} className="mt-m">
          <Overline label={group.title} />
          <View className="mt-2xs">
            {group.projects.map((project) => (
              <ProjectRow key={project.id} project={project} onPress={openProjectCard} />
            ))}
          </View>
        </View>
      ))}
    </Screen>
  );
}

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
      openExternal(target.url);
      return;
    default:
      openProject(target.id);
  }
}
