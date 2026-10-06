import { Screen } from '@/components/ui';
import { useScreenLayout } from '@/lib/home/layout';
import { ScreenBlocks } from '@/lib/home/ScreenBlocks';

/**
 * Mitmachen — the four ways in: CrowdNewsroom callouts, the Faktenforum, the
 * demolition atlas, and a tip by WhatsApp.
 *
 * **That order is `@correctiv/app-core/src/data/layouts/demo/screens/mitmachen.json`** and this
 * screen is the loop that draws it, as Home is
 * ([ADR 0071](../../../../../adr/0071-screens-become-documents-and-the-tab-bar-becomes-one-too.md)
 * §1). What each block renders, and its words, is `lib/home/modules.tsx`.
 */
export default function MitmachenScreen() {
  const layout = useScreenLayout('mitmachen');
  return (
    <Screen>
      <ScreenBlocks screen="mitmachen" layout={layout} />
    </Screen>
  );
}
