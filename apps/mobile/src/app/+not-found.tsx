import { router } from 'expo-router';
import { defineMessages, useIntl } from 'react-intl';
import { View } from 'react-native';

import { Button, Overline, Screen, Typo } from '@/components/ui';
import { useDocumentTitle } from '@/lib/navigation/documentTitle';

/**
 * Everything a person reads on this page, in ENGLISH; the German that ships is
 * `packages/catalogue/src/de/notFound.ts`.
 */
const COPY = defineMessages({
  screenTitle: { id: 'notFound.screenTitle', defaultMessage: 'Page not found' },
  overline: { id: 'notFound.overline', defaultMessage: 'Error 404' },
  headline: { id: 'notFound.headline', defaultMessage: 'This page does not exist' },
  lead: {
    id: 'notFound.lead',
    defaultMessage:
      'The link leads nowhere. The article may have been moved, or the address may be incomplete.',
  },
  home: { id: 'notFound.home', defaultMessage: 'To the home screen' },
});

/**
 * What an address that leads nowhere shows.
 *
 * Without this route expo-router falls back to its own "Unmatched Route" page:
 * English, dark, and with a link to the developer sitemap. That page was invisible
 * as long as the app was only installed — a deep link to a route that does not
 * exist is rare and the tour never hit one. On the web it is the site's 404 page,
 * so every mistyped or outdated address published anywhere lands here.
 *
 * `replace`, not push: a page that does not exist is not a place to come back to.
 */
export default function NotFoundScreen() {
  const intl = useIntl();
  // This is the web target's 404 page, so the tab is read more often here than
  // anywhere: every stale address published anywhere lands on it.
  useDocumentTitle(intl.formatMessage(COPY.screenTitle));
  return (
    <Screen scroll={false}>
      <View className="flex-1 items-center justify-center">
        <Overline label={intl.formatMessage(COPY.overline)} color="accent" />
        <Typo variant="headline-l" className="mt-2xs text-center">
          {intl.formatMessage(COPY.headline)}
        </Typo>
        <Typo variant="text-m" color="on-canvas-muted" className="mt-s text-center">
          {intl.formatMessage(COPY.lead)}
        </Typo>
        <Button
          title={intl.formatMessage(COPY.home)}
          className="mt-l self-center"
          onPress={() => {
            router.replace('/');
          }}
        />
      </View>
    </Screen>
  );
}
