import { usePathname, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useWindowDimensions, View } from 'react-native';

import { sizes } from '@/lib/theme';
import { railShift } from './ContentColumn';
import { NavRail } from './NavRail';
import HomeScreen from '@/app/(tabs)/index';
import EntdeckenScreen from '@/app/(tabs)/entdecken';
import MediathekScreen from '@/app/(tabs)/mediathek';
import MitmachenScreen from '@/app/(tabs)/mitmachen';
import ProfilScreen from '@/app/(tabs)/profil';

/**
 * The five tab screens, in tab order, keyed by route name.
 *
 * All five mount eagerly — the same model `NativeTabs` uses on phone (ADR 0013).
 * The rail drives which one is visible; the rest are hidden with `display: 'none'`.
 */
const SCREENS = {
  index: HomeScreen,
  entdecken: EntdeckenScreen,
  mediathek: MediathekScreen,
  mitmachen: MitmachenScreen,
  profil: ProfilScreen,
} as const;

const TAB_NAMES = Object.keys(SCREENS) as (keyof typeof SCREENS)[];

/**
 * The tablet layout: a left rail beside the active screen.
 *
 * The rail is absolutely positioned in the left gutter so the reading column
 * stays centred in the WINDOW (via `ContentColumn`'s `self-center`), not in
 * the narrower space beside the rail. At 834 px the gutter is 107 px and the
 * rail is 88 px, so the two never overlap; from 768 to 795 px the gutter is
 * narrower than the rail, and the screens move right by `railShift`.
 */
export function TabletLayout() {
  const pathname = usePathname();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  const active = TAB_NAMES.find((name) => pathname.endsWith(name)) ?? 'index';

  return (
    <View className="flex-1">
      <View className="absolute left-0 top-0 bottom-0" style={{ width: sizes.railWidth }}>
        <NavRail active={active} onSelect={(name) => router.navigate(name === 'index' ? '/' : `/${name}`)} insets={insets} />
      </View>
      <View className="flex-1" style={{ paddingLeft: railShift(width) }}>
        {TAB_NAMES.map((name) => {
          const Screen = SCREENS[name];
          return (
            <View
              key={name}
              className="flex-1"
              style={{ display: name === active ? 'flex' : 'none' }}
            >
              <Screen />
            </View>
          );
        })}
      </View>
    </View>
  );
}
