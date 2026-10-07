/**
 * The screens other screens point at, by the part they play. A link from a block or a project
 * to "the Mediathek" names a role here and nothing else: which screen id answers it is this
 * one table, and `screenLink` leaves the link out when the active layout has no such screen.
 *
 * Kept free of imports so the pure routing decisions (`projectTarget`, `sampleTarget`) can
 * name a role without reaching the layout, which would close a cycle through the home modules.
 */
export const SCREEN_ROLES = {
  discover: 'entdecken',
  media: 'mediathek',
  participate: 'mitmachen',
  profile: 'profil',
} as const;

export type ScreenRole = keyof typeof SCREEN_ROLES;

/** An address for a role, or null when the active layout holds no such screen. */
export type ScreenLinker = (role: ScreenRole) => string | null;
