import { Screen } from '@/components/ui';
import { bundledScreenLayout } from '@/lib/home/layout';
import { ScreenBlocks } from '@/lib/home/ScreenBlocks';

/**
 * Mediathek — everything audible and watchable: live radio, the Salon5 podcasts
 * (Castopod), two video channels and the club's Backstage bonus track.
 *
 * All four sources are live; only the Backstage bonus is sample data with bundled
 * audio, because it exists to show the club preview flow.
 *
 * **That order is `@correctiv/app-core/src/data/layout/screens/mediathek.json`** and this
 * screen is the loop that draws it, as Home is
 * ([ADR 0071](../../../../../adr/0071-screens-become-documents-and-the-tab-bar-becomes-one-too.md)
 * §1). What each block renders is `lib/home/modules.tsx`.
 */
export default function MediathekScreen() {
  return (
    <Screen>
      <ScreenBlocks screen="mediathek" layout={bundledScreenLayout('mediathek')} />
    </Screen>
  );
}
