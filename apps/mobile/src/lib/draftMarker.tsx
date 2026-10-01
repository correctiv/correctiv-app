import { View } from 'react-native';
import { defineMessages, useIntl } from 'react-intl';

import { CATALOGUES } from '@correctiv/catalogue';

// Its own file and not the `@/components/ui` barrel: that barrel also exports
// `ScreenHeader`, which pulls in `expo-router`. This marker sits beside the router
// in `app/_layout.tsx` rather than under it, so nothing else in the app needs its
// module graph to widen just to draw one badge.
import { Badge } from '@/components/ui/Badge';
import { useLocale } from '@/lib/store/core';

import { useHomeLayoutOverrideActive } from './home/layout';
import { useHasPreviewStringsOverride } from './strings';

/**
 * One small, silent word for the two things the workbench may leave running in this
 * browser: `workbench:strings` (`lib/strings.ts`) and `workbench:home-layout`
 * (`lib/home/layout.ts`). A cold review of #259 and #261 found nothing on screen
 * saying so — the frame showed the edit, and so did `/app` opened raw on this
 * origin, indistinguishable from the shipped app to a screenshot or a glance.
 *
 * **Why here and not only in the workbench.** The workbench's own marker
 * (`apps/workbench/src/preview/ui/DraftMarker.tsx`) sits beside the device frame and
 * cannot reach a tab opened on `/app` directly, which is the other half of what the
 * review found. Both `workbench:strings` and `workbench:home-layout` are durable —
 * neither is cleared when the workbench tab closes, unlike `workbench:home-time` and
 * `workbench:locale`, which the address and a `pagehide` handler already clear
 * (`preview/Preview.tsx`) — so a link to the raw app, or a reload of a tab left open,
 * goes on showing the draft after nobody is watching it from the workbench at all.
 *
 * **Never on a phone**, and not because of a platform check: `useHasPreviewStringsOverride`
 * and `useHomeLayoutOverrideActive` both answer `false` wherever there is no
 * `window.localStorage` to read, which is every native build and every test run under
 * `jest-expo`. That is the same guard every override in `lib/` already relies on rather
 * than a `Platform.OS` branch of its own, so a phone never renders this and the
 * question of who runs at native cost never comes up.
 *
 * **Non-interactive.** A discard belongs to the tool that owns the key, and that is
 * the workbench's marker: this one only says a draft is showing, so that a reader —
 * or a developer who forgot which tab they left open — does not mistake it for the
 * published app.
 */
const COPY = defineMessages({
  active: {
    id: 'ui.previewDraft',
    defaultMessage: 'Preview draft, not the published app',
    description:
      'A small, non-interactive marker shown only on the web target, only while a workbench draft (an edited string or an edited home screen) is active in this browser. It never appears in a native build or in the published app with no draft set.',
  },
});

export function DraftMarker() {
  const intl = useIntl();
  const locale = useLocale();
  const stringsDraft = useHasPreviewStringsOverride(locale, CATALOGUES[locale]);
  const layoutDraft = useHomeLayoutOverrideActive();

  if (!stringsDraft && !layoutDraft) return null;

  return (
    <View
      testID="draft-marker"
      pointerEvents="none"
      style={{ position: 'absolute', top: 8, right: 8, zIndex: 50 }}
    >
      <Badge label={intl.formatMessage(COPY.active)} tone="emphasis" />
    </View>
  );
}
