import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useIntl } from 'react-intl';
import { Pressable, View } from 'react-native';

import { MORE_TAB } from '@correctiv/app-core/lib/navigation';

import NotFoundScreen from '@/app/+not-found';
import { Card, Hairline, Screen, Typo } from '@/components/ui';
import { useTabs } from '@/lib/navigation/tabWords';
import { tabHref } from '@/lib/navigation/tabRoutes';
import { MORE_LABEL } from '@/lib/tabTargets';
import { useColors } from '@/lib/theme';

/**
 * Mehr, the tab that lists the screens the bar had no room for
 * ([ADR 0071](../../../../../adr/0071-screens-become-documents-and-the-tab-bar-becomes-one-too.md)
 * §5, [ADR 0078](../../../../../adr/0078-layouts-ship-and-demo.md) §5).
 *
 * An ordinary screen: a row opens its screen at `/s/<id>`, like every other. Two kinds of
 * row, in this order: the entries the navigation lists beyond what the bar holds, and the
 * screens the layout carries that the navigation does not list, which is how a screen is
 * taken off the bar without being lost. A row says what its screen's own document calls it
 * (ADR 0075 §3). **Where the bar has no "Mehr" this address leads nowhere**, as any
 * address does that nothing stands behind.
 */
export default function MehrScreen() {
  const intl = useIntl();
  const colors = useColors();
  const { bar, unlisted, words } = useTabs();
  if (!bar.tabs.includes(MORE_TAB)) return <NotFoundScreen />;
  const rows = [...bar.more, ...unlisted].map((id) => ({
    key: id,
    ...words[id]!,
    href: tabHref(id),
  }));
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
