import { Screen } from '@/components/ui';
import { bundledScreenLayout } from '@/lib/home/layout';
import { ScreenBlocks } from '@/lib/home/ScreenBlocks';

/**
 * Entdecken — the ordered directory of the ecosystem: the search entry point, the
 * topic rail, and the 7 project groups from the concept.
 *
 * **That order is `@correctiv/app-core/src/data/layout/screens/entdecken.json`** and this
 * screen is the loop that draws it, as Home is
 * ([ADR 0071](../../../../../adr/0071-screens-become-documents-and-the-tab-bar-becomes-one-too.md)
 * §1). What each block renders is `lib/home/modules.tsx`; the catalogue under it comes
 * wholly from `@correctiv/app-core/data/projects`, which is content.
 */
export default function EntdeckenScreen() {
  return (
    <Screen>
      <ScreenBlocks screen="entdecken" layout={bundledScreenLayout('entdecken')} />
    </Screen>
  );
}
