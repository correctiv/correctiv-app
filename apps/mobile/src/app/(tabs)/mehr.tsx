import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useIntl } from 'react-intl';
import { Pressable, View } from 'react-native';

import { resolveText } from '@correctiv/app-core/lib/home-settings';
import { screenTabLabelOf } from '@correctiv/app-core/lib/screen-layout';

import { Card, Hairline, Screen, Typo } from '@/components/ui';
import { customScreenLayout, useCustomScreenIds } from '@/lib/home/layout';
import { tabBar } from '@/lib/navigation/tabBar';
import { iconOf, useTabWords } from '@/lib/navigation/tabWords';
import { useLocale } from '@/lib/store/core';
import { MORE_LABEL } from '@/lib/tabTargets';
import { useColors } from '@/lib/theme';

/**
 * Mehr, the tab that lists the destinations the bar had no room for
 * ([ADR 0071](../../../../../adr/0071-screens-become-documents-and-the-tab-bar-becomes-one-too.md)
 * §5).
 *
 * The system's own overflow is not used, so this is an ordinary screen. A row opens its
 * destination by route: the destination is a hidden tab, and navigating to it switches
 * to it without a button of its own in the bar.
 *
 * **Below those, the screens the newsroom made** (ADR 0075 §7): every custom screen the
 * document carries, by its own tab label and icon, opening `/s/<id>`. A screen the
 * document does not carry has no row, because the list is made of the screens that
 * resolve.
 */
export default function MehrScreen() {
  const intl = useIntl();
  const colors = useColors();
  const { bar } = tabBar();
  // A row says what its screen's own document calls it (ADR 0075 §3): a screen off the
  // bar keeps its name, and this list is one of the two places that reads it.
  const words = useTabWords();
  const locale = useLocale();
  const custom = useCustomScreenIds().flatMap((id) => {
    const screenWords = customScreenLayout(id)?.words ?? null;
    const label = screenTabLabelOf(screenWords);
    return label === null
      ? []
      : [{ id, label: resolveText(label, locale), icon: iconOf(screenWords?.icon) }];
  });
  const rows = [
    ...bar.more.map((route) => ({
      key: route,
      ...words[route]!,
      href: `/(tabs)/${route}`,
    })),
    ...custom.map(({ id, label, icon }) => ({ key: `s/${id}`, label, icon, href: `/s/${id}` })),
  ];
  return (
    <Screen>
      <Typo variant="headline-xl">{intl.formatMessage(MORE_LABEL)}</Typo>
      <Card className="mt-m">
        {rows.map(({ key, label, icon, href }, index) => {
          return (
            <View key={key}>
              {index > 0 ? <Hairline /> : null}
              <Pressable
                accessibilityRole="link"
                accessibilityLabel={label}
                onPress={() => router.navigate(href as never)}
                className="flex-row items-center py-s active:opacity-80"
              >
                <Ionicons name={icon.ionicon.inactive} size={24} color={colors['on-canvas']} />
                <Typo variant="text-m" className="ml-s flex-1">
                  {label}
                </Typo>
                <Ionicons name="chevron-forward" size={18} color={colors['on-canvas-muted']} />
              </Pressable>
            </View>
          );
        })}
      </Card>
    </Screen>
  );
}
