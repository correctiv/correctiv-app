import { Redirect } from 'expo-router';
import { defineMessages, useIntl } from 'react-intl';
import { View } from 'react-native';

import { Screen, Typo } from '@/components/ui';
import { useDocumentTitle } from '@/lib/navigation/documentTitle';
import { useTabBarDecision } from '@/lib/navigation/tabBar';
import { tabHref } from '@/lib/navigation/tabRoutes';

/** Everything a person reads on this page, in ENGLISH; the German that ships is `packages/catalogue/src/de/empty.ts`. */
const COPY = defineMessages({
  screenTitle: {
    id: 'empty.screenTitle',
    defaultMessage: 'Coming soon',
    description:
      'What the app says when its layout holds no screen yet. A heading on an otherwise empty page, so it has to stand alone.',
  },
});

/**
 * The start: the first screen of the layout's navigation
 * ([ADR 0078](../../../../../adr/0078-layouts-ship-and-demo.md) §5), or the empty state when
 * the layout has none.
 *
 * It is a redirect and not a screen, so that `/` is the address of whichever screen the
 * layout starts on and the onboarding, the not-found page and a launch all say "the start"
 * without knowing which it is. `replace`, which `<Redirect>` is: the start is not a place
 * one comes back to. The decision is reactive, so a layout that gains its first screen while
 * this page is open draws it.
 */
export default function Start() {
  const intl = useIntl();
  const { bar } = useTabBarDecision();
  useDocumentTitle(bar.start === null ? intl.formatMessage(COPY.screenTitle) : '');
  if (bar.start !== null) return <Redirect href={tabHref(bar.start) as never} />;
  return (
    <Screen scroll={false}>
      <View className="flex-1 items-center justify-center">
        <Typo variant="headline-l" className="text-center">
          {intl.formatMessage(COPY.screenTitle)}
        </Typo>
      </View>
    </Screen>
  );
}
