import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useIntl } from 'react-intl';
import { Pressable, View } from 'react-native';

import { Card, Hairline, Screen, Typo } from '@/components/ui';
import { tabBar } from '@/lib/navigation/tabBar';
import { TAB_TARGETS } from '@/lib/tabTargets';
import { useColors } from '@/lib/theme';

/**
 * Mehr, the tab that lists the destinations the bar had no room for
 * ([ADR 0071](../../../../../adr/0071-screens-become-documents-and-the-tab-bar-becomes-one-too.md)
 * §5).
 *
 * The system's own overflow is not used, so this is an ordinary screen. A row opens its
 * destination by route: the destination is a hidden tab, and navigating to it switches
 * to it without a button of its own in the bar.
 */
export default function MehrScreen() {
  const intl = useIntl();
  const colors = useColors();
  const { bar } = tabBar();
  return (
    <Screen>
      <Typo variant="headline-xl">{intl.formatMessage(TAB_TARGETS['mehr']!.label)}</Typo>
      <Card className="mt-m">
        {bar.more.map((route, index) => {
          const target = TAB_TARGETS[route]!;
          const label = intl.formatMessage(target.label);
          return (
            <View key={route}>
              {index > 0 ? <Hairline /> : null}
              <Pressable
                accessibilityRole="link"
                accessibilityLabel={label}
                onPress={() => router.navigate(`/(tabs)/${route}` as never)}
                className="flex-row items-center py-s active:opacity-80"
              >
                <Ionicons name={target.ionicon.inactive} size={24} color={colors['on-canvas']} />
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
