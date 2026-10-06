import { Redirect, useLocalSearchParams } from 'expo-router';

import { slotRoute } from '@correctiv/app-core/lib/navigation';

import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { ScreenView } from '@/lib/home/ScreenView';
import { startDecision } from '@/lib/navigation/tabBar';

/**
 * A screen reached by its id on iOS and Android: a deep link, a link from a block, or a
 * row of "Mehr" ([ADR 0081](../../../../adr/0081-the-system-tab-bar-returns-and-is-decided-at-start.md)).
 *
 * The system's tab bar takes its triggers by route name, so a screen on the bar is a slot
 * under `(tabs)` and this address sends there (`replace`, which `<Redirect>` is: the address
 * is not a place one comes back to). **Any other screen is pushed over the tabs** with the
 * platform's back control, which is what a screen behind "Mehr" always was on a phone, and a
 * screen nothing carries is `+not-found` as it is everywhere.
 *
 * The web has no such address (`[id].web.tsx` is not-found): it opens a screen at `/s/<id>`
 * inside the drawn shell. There is no static export of a page per id, as
 * `(tabs)/s/[id].web.tsx` says.
 */
export function generateStaticParams(): { id: string }[] {
  return [];
}

export default function ScreenRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const route = slotRoute(startDecision().bar, id);
  if (route !== null) return <Redirect href={route === 'index' ? '/' : (`/${route}` as never)} />;
  return (
    <>
      <ScreenHeader title="" />
      <ScreenView id={id} />
    </>
  );
}
