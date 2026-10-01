/**
 * Discover directory — the CORRECTIV ecosystem ordered into 7 groups
 * (per concept). Live projects reference feed keys; external ones deep-link.
 */
import type { FeedKey } from '../types/models';
import { interests } from './interests';

export interface Project {
  id: string;
  name: string;
  description: string;
  /** live feed on correctiv.org */
  feed?: FeedKey;
  /** external target */
  url?: string;
  /** project-specific action on the project page */
  action?: 'whatsapp-tip' | 'radio' | 'local-network';
  /** no content yet — show a teaser instead of an empty list */
  teaserOnly?: boolean;
  /** in-app cross link */
  tab?: 'participate';
  /** The feature that gates this entry (ADR 0072 §5). Absent means always reachable. */
  feature?: string;
}

export interface ProjectGroup {
  id: string;
  title: string;
  projects: Project[];
}

export const projectGroups: ProjectGroup[] = [
  {
    id: 'recherchieren',
    title: 'Recherchieren',
    projects: [
      {
        id: 'recherchen',
        name: 'Recherchen',
        description: 'Investigative Recherchen für die Gesellschaft.',
        feed: 'recherchen',
      },
      {
        id: 'faktencheck',
        name: 'CORRECTIV.Faktencheck',
        description: 'Desinformation aufdecken, Behauptungen prüfen.',
        feed: 'faktencheck',
        action: 'whatsapp-tip',
      },
      {
        id: 'schweiz',
        name: 'CORRECTIV.Schweiz',
        description: 'Recherchen aus und für die Schweiz.',
        feed: 'schweiz',
      },
      {
        id: 'lokal',
        feature: 'feed-lokal',
        name: 'CORRECTIV.Lokal',
        description: 'Netzwerk für Lokaljournalismus in ganz Deutschland.',
        feed: 'lokal',
        action: 'local-network',
      },
      {
        id: 'klima',
        name: 'Klima',
        description: 'Die Klimakrise und ihre Folgen, datenbasiert recherchiert.',
        feed: 'klima',
      },
      {
        id: 'europe',
        feature: 'feed-europe',
        name: 'CORRECTIV.Europe',
        description: 'Grenzüberschreitende Recherchen in Europa, bald mit eigenem Feed.',
        teaserOnly: true,
      },
    ],
  },
  {
    id: 'junge-formate',
    title: 'Junge Formate',
    projects: [
      {
        id: 'salon5',
        feature: 'feed-salon5',
        name: 'Salon5',
        description: 'Die Jugendredaktion: Radio, Podcasts und mehr aus Bottrop.',
        feed: 'salon5',
        action: 'radio',
      },
      {
        id: 'funfacts',
        name: 'FunFacts',
        description: 'Wissen kurz und überprüfbar, bekannt von TikTok und YouTube.',
        url: 'https://www.youtube.com/@funfacts',
      },
    ],
  },
  {
    id: 'mitmachen',
    title: 'Mitmachen',
    projects: [
      {
        id: 'crowdnewsroom',
        feature: 'callouts',
        name: 'CrowdNewsroom',
        description: 'Gemeinsam recherchieren, Ihre Hinweise zählen.',
        tab: 'participate',
      },
      {
        id: 'faktenforum',
        feature: 'faktenforum',
        name: 'Faktenforum',
        description: 'Die Community prüft Behauptungen.',
        tab: 'participate',
      },
      {
        id: 'abriss-atlas',
        feature: 'abriss-atlas',
        name: 'Abriss-Atlas',
        description: 'Abrisse dokumentieren in DE und CH.',
        tab: 'participate',
      },
    ],
  },
  {
    id: 'lernen',
    title: 'Lernen',
    projects: [
      {
        id: 'reporterfabrik',
        name: 'Reporterfabrik',
        description: 'Die Journalismusschule für alle, mit Workshops und Webinaren.',
        url: 'https://reporterfabrik.org',
      },
      {
        id: 'reporter4you',
        name: 'Reporter4You',
        description: 'Medienbildung für Schulen.',
        url: 'https://reporter4you.de',
      },
    ],
  },
  {
    id: 'werkzeuge',
    title: 'Datenbanken & Werkzeuge',
    projects: [
      {
        id: 'sunlight',
        name: 'Sunlight',
        description: 'Lobbyismus und Einflussnahme transparent gemacht.',
        url: 'https://correctiv.org/sunlight',
      },
      {
        id: 'nsdap-kartei',
        name: 'NSDAP-Mitgliederkartei',
        description: 'Historische Datenbank zur NS-Mitgliedschaft.',
        url: 'https://correctiv.org',
      },
    ],
  },
  {
    id: 'verlag',
    title: 'Verlag & Bühne',
    projects: [
      {
        id: 'shop',
        name: 'CORRECTIV Shop & Verlag',
        description: 'Bücher und Bookzines aus dem Recherchezentrum.',
        url: 'https://shop.correctiv.org',
      },
      {
        id: 'theater',
        name: 'Theater',
        description: 'Recherchen auf der Bühne erleben.',
        url: 'https://correctiv.org',
      },
    ],
  },
  {
    id: 'exil',
    title: 'Exile-Medien',
    projects: [
      {
        id: 'radio-sakharov',
        name: 'Radio Sakharov',
        description: 'Unabhängige Stimmen für Belarus und Russland.',
        url: 'https://radiosakharov.org',
      },
      {
        id: 'oezgueruez',
        name: 'Özgürüz',
        description: 'Unabhängiger Journalismus auf Türkisch.',
        url: 'https://ozguruz1.org',
      },
    ],
  },
];

/**
 * The project behind an id — what a route like `/projekt/<id>` needs.
 *
 * TWO id spaces arrive here, and that is deliberate: real project ids from
 * `projectGroups`, and topic ids from `interests` (the chip rail on Entdecken,
 * which offers every interest that has a feed). They OVERLAP — `klima`, `lokal`
 * and `schweiz` exist in both — and the project always wins, because its page
 * is strictly the richer one: own description, own action, no invented copy.
 *
 * That is a deliberate change. The earlier implementation built a synthetic topic
 * page for every chip, so it showed "Alle Beiträge zum Thema Klima." where a real
 * project description existed. Only interests WITHOUT a project of the same id
 * still get the synthetic page.
 */
export function resolveProject(id: string): Project | null {
  for (const group of projectGroups) {
    const project = group.projects.find((p) => p.id === id);
    if (project) return project;
  }

  // A topic without its own project page: build one from the interest. Only
  // interests with a feed can produce a page — there would be nothing to show.
  const topic = interests.find((i) => i.id === id && i.feed);
  if (!topic) return null;
  return {
    id: topic.id,
    name: topic.label,
    description: `Alle Beiträge zum Thema ${topic.label}.`,
    feed: topic.feed,
  };
}
