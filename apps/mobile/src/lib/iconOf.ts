import { SCREEN_ICON_FALLBACK } from '@correctiv/app-core/lib/screen-layout';

import { SCREEN_ICONS, type ScreenIcon } from '@/lib/screenIcons';

/**
 * The icon a key names, or the fallback.
 *
 * **The app's table and not the core's `screenIconOf`**, which answers the same
 * question with plain strings: the names a phone draws have to be the platforms' own
 * types or a name that does not exist on one of them is a blank tab rather than a
 * compile error (`lib/screenIcons.ts`). `Object.hasOwn` for the reason the core gives
 * at the same lookup — this takes words somebody may have built by hand, and
 * `constructor` is not an icon.
 */
export function iconOf(key: string | undefined): ScreenIcon {
  if (key !== undefined && Object.hasOwn(SCREEN_ICONS, key)) return SCREEN_ICONS[key]!;
  return SCREEN_ICONS[SCREEN_ICON_FALLBACK]!;
}
