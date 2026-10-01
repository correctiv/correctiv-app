import { useMemo } from 'react';

import { readerOf } from '@correctiv/app-core/lib/home-audience';
import { sectionsAtInstant, type HomeLayout } from '@correctiv/app-core/lib/home-layout';
import type { ConfigurableScreen } from '@correctiv/app-core/lib/screen-layout';

import { MODULE_FEATURES } from '@/lib/features';
import { useHomeInstant } from '@/lib/home/clock';
import { HOME_MODULES } from '@/lib/home/modules';
import { useReachable, useSession } from '@/lib/store/core';

/**
 * The loop every configurable screen is: fold the document up to this instant for this
 * reader, leave out what this build cannot reach, and draw what is left.
 *
 * It was the body of `app/(tabs)/index.tsx`. A screen that is a document is this and
 * nothing else (ADR 0071 §1), so it lives once; the screen decides WHICH document, since
 * Home's can be replaced while it is on screen and the others' cannot yet
 * (`bundledScreenLayout`), and wraps the result in its `Screen`.
 *
 * `reachable` drops a block of a feature this build cannot reach without a trace: the
 * document stays valid, so the same file is right in the preview (ADR 0072 §5).
 */
export function ScreenBlocks({
  screen,
  layout,
}: {
  screen: ConfigurableScreen;
  layout: HomeLayout;
}) {
  const { entitlement } = useSession();
  const reader = useMemo(() => readerOf(entitlement), [entitlement]);
  const instant = useHomeInstant(layout);
  const reachable = useReachable();
  const sections = sectionsAtInstant(layout, instant, reader).filter((section) => {
    const gate = MODULE_FEATURES[section.module];
    return gate === undefined || reachable(gate.feature);
  });

  return (
    <>
      {sections.map((section) => {
        const Module = HOME_MODULES[section.module];
        return Module ? (
          <Module key={section.id} section={section} instant={instant} screen={screen} />
        ) : null;
      })}
    </>
  );
}
