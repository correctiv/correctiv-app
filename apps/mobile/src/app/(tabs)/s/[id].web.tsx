import { useLocalSearchParams } from 'expo-router';

import { ScreenView } from '@/lib/home/ScreenView';

/**
 * None are known at build time: an id arrives in a document the newsroom publishes after
 * the export, so there is no page to emit per screen, and a static host without rewrites
 * answers `/s/<id>` with its own 404. The route is for the app, where it resolves on the
 * client. Declared anyway because the web target requires it of every dynamic route
 * (`__tests__/web-target.test.ts`); measured 2026-10-06, the export then writes one
 * `s/[id].html` and no page per id.
 */
export function generateStaticParams(): { id: string }[] {
  return [];
}

/**
 * A screen: one route for all of them, `/s/<id>`, so that a screen is a document and no
 * code ([ADR 0075](../../../../../../adr/0075-a-document-carries-its-own-words-and-a-screen-says-what-it-is-called.md)
 * §7, [ADR 0079](../../../../../../adr/0079-the-app-draws-its-tabs-from-the-layout.md)). Home
 * is one of them, drawn by the same lines as a screen made yesterday (`ScreenView`).
 *
 * The web's route: on iOS and Android the system's tab bar takes its triggers by route name,
 * so a screen there is a slot and `/s/<id>` is `app/s/[id].native.tsx`
 * ([ADR 0081](../../../../../../adr/0081-the-system-tab-bar-returns-and-is-decided-at-start.md)).
 */
export default function ScreenRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <ScreenView id={id} />;
}
