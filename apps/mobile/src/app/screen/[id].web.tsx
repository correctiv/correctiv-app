import NotFoundScreen from '@/app/+not-found';

/** None: the web opens a screen at `/s/<id>` (`(tabs)/s/[id].web.tsx`), and this address is the phone's. */
export function generateStaticParams(): { id: string }[] {
  return [];
}

export default function ScreenRoute() {
  return <NotFoundScreen />;
}
