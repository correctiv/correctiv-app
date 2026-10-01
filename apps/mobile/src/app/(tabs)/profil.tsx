import { useIntl, defineMessages } from 'react-intl';

import { Screen, Typo } from '@/components/ui';
import { bundledScreenLayout } from '@/lib/home/layout';
import { ScreenBlocks } from '@/lib/home/ScreenBlocks';

/** The heading of the fixed frame, in ENGLISH; the German that ships is `packages/catalogue/src/de/profile.ts`. */
const COPY = defineMessages({
  screenTitle: {
    id: 'profile.title',
    defaultMessage: 'Profile',
    description:
      'The heading of the profile screen. ui.tabProfile is the same word on the tab bar, where it has far less room.',
  },
});

/**
 * Profil — membership, impact, report, backstage, saved articles, newsletters,
 * settings.
 *
 * **The frame is fixed and the content is a document.** The heading stays here; the
 * blocks under it are `@correctiv/app-core/src/data/layout/screens/profil.json` drawn by
 * the loop Home uses ([ADR 0071](../../../../../adr/0071-screens-become-documents-and-the-tab-bar-becomes-one-too.md)
 * §1). Sign-in is the door's (`components/gate/LoginGate.tsx`), and the settings are
 * their own route, reached from the last row of the area block. What each block renders,
 * and its words, is `lib/home/modules.tsx`.
 *
 * Since the door (ADR 0016) there is no guest here: whoever renders this screen signed in
 * with an entitlement that includes the app. The app offers no payment functions (ADR 0020).
 */
export default function ProfilScreen() {
  const intl = useIntl();
  return (
    <Screen>
      <Typo variant="headline-xl">{intl.formatMessage(COPY.screenTitle)}</Typo>
      <ScreenBlocks screen="profil" layout={bundledScreenLayout('profil')} />
    </Screen>
  );
}
