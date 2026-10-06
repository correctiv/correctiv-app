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
 * What every route that draws a screen draws: `/s/<id>` and, on iOS and Android, the slot of
 * the system's tab bar that holds it ([ADR 0081](../../../../adr/0081-the-system-tab-bar-returns-and-is-decided-at-start.md)).
 * One body, so a screen is the same lines wherever it is reached from.
 *
 * It draws the document the way every screen is drawn (`ScreenBlocks`), as the root of its
 * tab: no back control. **A screen nothing carries is `+not-found`**, and so is one whose
 * feature this build cannot reach, so a deleted screen leaves an address that leads nowhere
 * and not an empty page. What the heading says is the document's own `screen-header` block.
 */
export function ScreenView({ id }: { id: string | undefined }) {
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
