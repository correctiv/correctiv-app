import NotFoundScreen from '@/app/+not-found';

/**
 * The base of `[id].web.tsx`, which the router requires for every platform file. On iOS and
 * Android a screen opened by id is `/screen/<id>` (`lib/navigation/screenHref.ts`), and this
 * file would be a route of the system's tab bar that nothing declares and nothing can reach.
 */
export function generateStaticParams(): { id: string }[] {
  return [];
}

export default function ScreenRoute() {
  return <NotFoundScreen />;
}
