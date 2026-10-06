import { defineMessages, useIntl } from 'react-intl';
import { View } from 'react-native';

import { Screen, Typo } from '@/components/ui';
import { useDocumentTitle } from '@/lib/navigation/documentTitle';

/** Everything a person reads on this page, in ENGLISH; the German that ships is `packages/catalogue/src/de/empty.ts`. */
const COPY = defineMessages({
  screenTitle: {
    id: 'empty.screenTitle',
    defaultMessage: 'Coming soon',
    description:
      'What the app says when its layout holds no screen yet. A heading on an otherwise empty page, so it has to stand alone.',
  },
});

/** The start of a layout that holds no screen: a heading on an otherwise empty page. */
export function EmptyStart() {
  const intl = useIntl();
  useDocumentTitle(intl.formatMessage(COPY.screenTitle));
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
