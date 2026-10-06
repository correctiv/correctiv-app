import { useLocalSearchParams } from 'expo-router';
import { ScrollView, View } from 'react-native';

import NotFoundScreen from '@/app/+not-found';
import { ContentColumn, ScreenHeader } from '@/components/ui';
import { resolveText } from '@correctiv/app-core/lib/home-settings';
import { screenTitleOf } from '@correctiv/app-core/lib/screen-layout';
import { useCustomScreenLayout } from '@/lib/home/layout';
import { ScreenBlocks } from '@/lib/home/ScreenBlocks';
import { useDocumentTitle } from '@/lib/navigation/documentTitle';
import { useLocale } from '@/lib/store/core';

/**
 * None are known at build time: an id arrives in a document the newsroom publishes after
 * the export, so there is no page to emit per screen, and a static host without rewrites
 * answers `/s/<id>` with its own 404. The route is for the app, where it resolves on the
 * client. Declared anyway because the web target requires it of every dynamic route
 * (`__tests__/web-target.test.ts`); measured 2026-10-06, the export then writes one
 * `s/[id].html` and no page per id.
 */
export function generateStaticParams(): { id: string }[] {
  return [];
}

/**
 * A screen the newsroom made: one route for all of them, `/s/<id>`, so that a new screen is
 * a document and no code
 * ([ADR 0075](../../../../../adr/0075-a-document-carries-its-own-words-and-a-screen-says-what-it-is-called.md)
 * §7).
 *
 * It draws the document the way the five built-in screens do (`ScreenBlocks`), under the
 * platform's back control, because a custom screen is not a tab and is reached from "Mehr",
 * a link or a deep link. **A screen the document does not carry is `+not-found`**, the page
 * every address that leads nowhere gets; what the heading says is the document's own
 * `screen-header` block, as everywhere.
 */
export default function CustomScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const layout = useCustomScreenLayout(id ?? '');
  const locale = useLocale();
  const title = screenTitleOf(layout?.words ?? null);
  useDocumentTitle(title === null ? '' : resolveText(title, locale));

  if (layout === null) return <NotFoundScreen />;
  return (
    <View className="flex-1 bg-canvas">
      <ScreenHeader title={title === null ? (id ?? '') : resolveText(title, locale)} />
      <ScrollView
        className="flex-1"
        contentContainerClassName="px-m pt-m pb-2xl"
        showsVerticalScrollIndicator={false}
      >
        <ContentColumn>
          <ScreenBlocks screen={id ?? ''} layout={layout} />
        </ContentColumn>
      </ScrollView>
    </View>
  );
}
