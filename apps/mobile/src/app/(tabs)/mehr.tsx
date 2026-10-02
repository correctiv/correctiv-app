import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useIntl } from 'react-intl';
import { Pressable, View } from 'react-native';

import { Card, Hairline, Screen, Typo } from '@/components/ui';
import { tabBar } from '@/lib/navigation/tabBar';
import { useTabWords } from '@/lib/navigation/tabWords';
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
 */
export default function MehrScreen() {
  const intl = useIntl();
  const colors = useColors();
  const { bar } = tabBar();
  // A row says what its screen's own document calls it (ADR 0075 §3): a screen off the
  // bar keeps its name, and this list is one of the two places that reads it.
  const words = useTabWords();
  return (
    <Screen>
      <Typo variant="headline-xl">{intl.formatMessage(MORE_LABEL)}</Typo>
      <Card className="mt-m">
        {bar.more.map((route, index) => {
          const { label, icon } = words[route]!;
          return (
            <View key={route}>
              {index > 0 ? <Hairline /> : null}
              <Pressable
                accessibilityRole="link"
                accessibilityLabel={label}
                onPress={() => router.navigate(`/(tabs)/${route}` as never)}
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
