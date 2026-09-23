import { useMemo } from 'react';

import { readerOf } from '@correctiv/app-core/lib/home-audience';
import { sectionsAtInstant } from '@correctiv/app-core/lib/home-layout';

import { Screen } from '@/components/ui';
import { useHomeInstant } from '@/lib/home/clock';
import { useHomeLayout } from '@/lib/home/layout';
import { HOME_MODULES } from '@/lib/home/modules';
import { useSession } from '@/lib/store/core';

/**
 * Home — a curated cross-section of the ecosystem, in the draft's order: lead research,
 * today's briefing, the club's early access, the latest research, fact checks, one open
 * callout, the media row, backstage, and a quiet thank-you.
 *
 * **That order is no longer written here.** It is
 * `@correctiv/app-core/src/data/home.layout.json`, an ordered list of sections each
 * naming a module, and this screen is the loop that draws them
 * ([ADR 0036](../../../../../adr/0036-the-home-screen-becomes-data.md)). What each module
 * renders is `lib/home/modules.tsx`; which of them appear right now is
 * `sectionsAtInstant`, which folds the document up to this instant and drops what is
 * hidden in it.
 *
 * `useHomeLayout` rather than a read, because the document may be replaced while this
 * screen is on it: §4's stored copy is a key in the app's own storage, and the
 * workbench's editor writes it. `lib/home/layout.ts` is where that seam is argued.
 *
 * **What the clock decides is which STATE of that document this is.** The document is a
 * day — places, plus a list of moments each carrying only what changes at it — and
 * `sectionsAtInstant` folds it up to an instant, the day's minute in Berlin first and then
 * whichever editions are running ([ADR 0039](../../../../../adr/0039-the-home-screen-is-a-day-not-a-timetable.md),
 * [ADR 0059](../../../../../adr/0059-the-day-gets-a-date-and-the-newsroom-plans-in-editions.md) §4).
 * So the callout still has two sections and is still rendered exactly once in one of two
 * places; what says which is two moments in the document rather than a daypart named on
 * each section. `useHomeInstant` is where that instant comes from, and the reason it is a
 * hook rather than `Date.now()` on render. A module the document names and this host
 * cannot draw was dropped when the document was read, with a report; the `?? null` below
 * is the second net and not the mechanism.
 *
 * **And whose screen it is.** The fold takes the reader as its third parameter
 * ([ADR 0060](../../../../../adr/0060-a-block-says-when-it-appears-and-an-editor-says-for-whom.md)
 * §4): the audiences the signed-in entitlement is in, answered by the core's one file that
 * knows what an audience means. A filter on what Home leads with and never a lock; every
 * route stays as open as the door made it.
 *
 * LIVE from the feeds: hero, "Neueste Recherchen", the fact-check rail and the FunFacts
 * tile. Sample data: briefing, early access, callout, backstage — each one exists to
 * show a flow the feeds cannot supply.
 */
export default function HomeScreen() {
  const layout = useHomeLayout();
  const { entitlement } = useSession();
  const reader = useMemo(() => readerOf(entitlement), [entitlement]);
  const sections = sectionsAtInstant(layout, useHomeInstant(layout), reader);

  return (
    <Screen>
      {sections.map((section) => {
        const Module = HOME_MODULES[section.module];
        return Module ? <Module key={section.id} section={section} /> : null;
      })}
    </Screen>
  );
}
