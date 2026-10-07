import { useSyncExternalStore } from 'react';

import { screenLayout, subscribeToLayout } from '@/lib/home/layout';

import { screenHref } from './screenHref';
import { SCREEN_ROLES, type ScreenLinker, type ScreenRole } from './screenRoles';

/**
 * Where a role's screen is opened, or null when the active layout does not carry it.
 *
 * A link to a screen nobody published leads nowhere, so the caller leaves the link out
 * instead (the same rule as `ScreenLinkModule`, ADR 0039 §6).
 */
export const screenLink: ScreenLinker = (role) => {
  const id = SCREEN_ROLES[role];
  return screenLayout(id) === null ? null : screenHref(id);
};

/** `screenLink` for one role, redrawn when a layout lands that adds or removes the screen. */
export function useScreenLink(role: ScreenRole): string | null {
  const snapshot = () => screenLink(role);
  return useSyncExternalStore(subscribeToLayout, snapshot, snapshot);
}

const ROLES = Object.keys(SCREEN_ROLES) as ScreenRole[];

/** `screenLink` for code that asks about several roles, with the same redraw. */
export function useScreenLinker(): ScreenLinker {
  const snapshot = () => ROLES.map((role) => screenLink(role) ?? '').join('|');
  useSyncExternalStore(subscribeToLayout, snapshot, snapshot);
  return screenLink;
}
