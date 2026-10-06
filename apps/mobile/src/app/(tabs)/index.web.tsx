import { Redirect } from 'expo-router';

import { EmptyStart } from '@/lib/navigation/EmptyStart';
import { useTabBarDecision } from '@/lib/navigation/tabBar';
import { tabHref } from '@/lib/navigation/tabRoutes';

/**
 * The start: the first screen of the layout's navigation
 * ([ADR 0078](../../../../../adr/0078-layouts-ship-and-demo.md) §5), or the empty state when
 * the layout has none.
 *
 * It is a redirect and not a screen, so that `/` is the address of whichever screen the
 * layout starts on and the onboarding, the not-found page and a launch all say "the start"
 * without knowing which it is. `replace`, which `<Redirect>` is: the start is not a place
 * one comes back to. The decision is reactive, so a layout that gains its first screen while
 * this page is open draws it.
 */
export default function Start() {
  const { bar } = useTabBarDecision();
  if (bar.start !== null) return <Redirect href={tabHref(bar.start) as never} />;
  return <EmptyStart />;
}
