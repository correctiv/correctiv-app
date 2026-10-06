import { Ionicons } from '@expo/vector-icons';
import { Pressable, View } from 'react-native';

import { Typo } from '@/components/ui';
import type { SearchSample } from '@correctiv/app-core/data/search-samples';
import { useColors } from '@/lib/theme';
import { screenHref } from '@/lib/navigation/screenHref';

type IoniconName = keyof typeof Ionicons.glyphMap;

const ICON: Record<SearchSample['kind'], IoniconName> = {
  podcast: 'headset-outline',
  callout: 'megaphone-outline',
  backstage: 'sparkles-outline',
  verlag: 'book-outline',
  projekt: 'compass-outline',
};

/** The tabs a hit can jump to. */
type TabPath = string;

/**
 * Where a non-article hit leads, or `null` when it has no place in this app.
 *
 * Books (`verlag`) have no screen, so they stay deliberately inert rather than
 * tappable-and-dead, which is what an earlier design shipped. Visibly untouchable
 * beats apparently broken.
 */
export function sampleTarget(kind: SearchSample['kind']): TabPath | null {
  switch (kind) {
    case 'podcast':
      return screenHref('mediathek');
    case 'callout':
      return screenHref('mitmachen');
    case 'backstage':
      return screenHref('profil');
    default:
      return null;
  }
}

/**
 * A search hit from the projects (podcasts, callouts, backstage, publishing) — the
 * material that is not in the RSS feeds. An icon plus two lines.
 */
export function SampleHitRow({ hit, onPress }: { hit: SearchSample; onPress?: () => void }) {
  const colors = useColors();
  const row = (
    <View className="flex-row items-center border-b border-stroke py-s">
      <Ionicons name={ICON[hit.kind]} size={20} color={colors['on-canvas-muted']} />
      <View className="ml-s flex-1">
        <Typo variant="text-m" weight="bold" numberOfLines={2}>
          {hit.title}
        </Typo>
        <Typo variant="text-s" color="grey-500" className="mt-4xs">
          {hit.subtitle}
        </Typo>
      </View>
      {onPress && <Ionicons name="chevron-forward" size={16} color={colors['grey-500']} />}
    </View>
  );

  if (!onPress) return row;
  return (
    <Pressable onPress={onPress} accessibilityRole="link" className="active:opacity-70">
      {row}
    </Pressable>
  );
}
