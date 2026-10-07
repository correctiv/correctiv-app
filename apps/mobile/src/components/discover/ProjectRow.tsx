import { Ionicons } from '@expo/vector-icons';
import { Pressable, View } from 'react-native';

import { Typo } from '@/components/ui';
import type { Project } from '@correctiv/app-core/data/projects';
import { useColors } from '@/lib/theme';

/**
 * One row in the directory: name, a two-line teaser, a chevron on the right.
 *
 * Hairline-separated rows rather than cards, as in the design draft
 * (DiscoverScreen.dc.html): with 17 entries across 7 groups a list simply reads
 * better than 17 grey boxes.
 */
export function ProjectRow({
  project,
  external,
  onPress,
}: {
  project: Project;
  /** Whether the row leaves the app, which `projectTarget` decides. */
  external: boolean;
  onPress: (project: Project) => void;
}) {
  const colors = useColors();
  return (
    <Pressable
      onPress={() => onPress(project)}
      accessibilityRole="link"
      accessibilityLabel={project.name}
      className="flex-row items-center border-b border-stroke py-s active:opacity-70"
    >
      <View className="flex-1 pr-s">
        <Typo variant="text-m" weight="bold">
          {project.name}
        </Typo>
        <Typo variant="text-s" color="on-canvas-muted" numberOfLines={2} className="mt-4xs">
          {project.description}
        </Typo>
      </View>
      <Ionicons
        name={external ? 'open-outline' : 'chevron-forward'}
        size={16}
        color={colors['grey-500']}
      />
    </Pressable>
  );
}
