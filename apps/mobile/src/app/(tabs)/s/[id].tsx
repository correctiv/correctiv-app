import { useLocalSearchParams } from 'expo-router';

import NotFoundScreen from '@/app/+not-found';
import { Screen } from '@/components/ui';
import { resolveText } from '@correctiv/app-core/lib/home-settings';
import { screenTitleOf } from '@correctiv/app-core/lib/screen-layout';
import { tabReachable } from '@/lib/features';
import { useScreenLayout } from '@/lib/home/layout';
import { ScreenBlocks } from '@/lib/home/ScreenBlocks';
import { useDocumentTitle } from '@/lib/navigation/documentTitle';
import { useLocale, useReachable } from '@/lib/store/core';

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
 * A screen: one route for all of them, `/s/<id>`, so that a screen is a document and no
 * code ([ADR 0075](../../../../../../adr/0075-a-document-carries-its-own-words-and-a-screen-says-what-it-is-called.md)
 * §7, [ADR 0079](../../../../../../adr/0079-the-app-draws-its-tabs-from-the-layout.md)). Home
 * is one of them, drawn by the same lines as a screen made yesterday.
 *
 * It draws the document the way every screen is drawn (`ScreenBlocks`), as the root of its
 * tab: no back control, because a screen is reached from the bar, from "Mehr", a link or a
 * deep link, and what stands above it is the shell. **A screen nothing carries is
 * `+not-found`**, and so is one whose feature this build cannot reach, so a deleted screen
 * leaves an address that leads nowhere and not an empty page. What the heading says is the
 * document's own `screen-header` block, as everywhere.
 */
export default function ScreenRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const layout = useScreenLayout(id ?? '');
  const reachable = useReachable();
  const locale = useLocale();
  const title = screenTitleOf(layout?.words ?? null);
  useDocumentTitle(title === null ? '' : resolveText(title, locale));

  if (layout === null || id === undefined || !tabReachable(id, reachable)) {
    return <NotFoundScreen />;
  }
  return (
    <Screen>
      <ScreenBlocks screen={id} layout={layout} />
    </Screen>
  );
}
