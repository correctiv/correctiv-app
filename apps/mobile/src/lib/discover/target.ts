import type { Project } from '@correctiv/app-core/data/projects';

import type { ScreenLinker } from '@/lib/navigation/screenRoles';

export type ProjectTarget =
  /** Cross-link into another tab (CrowdNewsroom, Faktenforum, Abriss-Atlas). */
  | { kind: 'tab'; path: string }
  /** Purely external project — system browser. */
  | { kind: 'external'; url: string }
  /** A project or topic page inside this app. */
  | { kind: 'project'; id: string };

/**
 * What tapping a directory entry means — as a pure function, because two places
 * need the same answer: the screen that navigates, and the row that draws the
 * arrow. As two separate conditions they were two truths that could drift apart.
 *
 * A `tab` project whose screen the active layout does not carry falls through to the rules
 * below, rather than pointing at nothing.
 *
 * The order IS the decision: `tab` beats `url`, and a project with both a feed AND
 * a url (Salon5) stays inside the app — there the url is an extra source, not a
 * replacement for the project page with its feed and its own action.
 */
export function projectTarget(project: Project, link: ScreenLinker): ProjectTarget {
  const participate = project.tab === 'participate' ? link('participate') : null;
  if (participate !== null) return { kind: 'tab', path: participate };
  if (project.url && !project.feed) return { kind: 'external', url: project.url };
  return { kind: 'project', id: project.id };
}
