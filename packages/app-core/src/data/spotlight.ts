/**
 * The Spotlight newsletter.
 *
 * This file used to hold invented issues, with the note "the newsletter archive
 * is not public". That was wrong, and it took one request to find out: the
 * archive is a public WordPress post type, `wp/v2/newspack_nl_cpt`, and on
 * 2026-09-01 it held 523 issues with title, date, teaser, link and full text.
 * `services/spotlight.service.ts` reads it, `stores/spotlight.ts` holds it, and
 * what is left here is the type plus four real issues as the offline seed.
 *
 * **The shape changed with the source, and the app shows less as a result.** The
 * invented issues had an agenda of timed items ("06:58 KI-Fake zur US-Botschaft"),
 * which read well and does not exist: a Spotlight issue is one subject and one
 * lead, not a list of stamped entries. So an issue is now what an issue is. The
 * briefing on Home lists the last few days by subject rather than one day by the
 * hour, which is a different card for the same purpose and the only one the data
 * supports.
 *
 * **An issue opens in the reader.** This file used to say it could not: the archive's
 * `content.rendered` was taken for "the sent email", table layout and a GIF masthead,
 * and an issue linked out to the browser. Measured on 2026-10-01 it is nothing of the
 * kind: no `<table>`, the same block markup as the issue's page, headed by the
 * masthead as a plain figure. `wp/v2/posts?slug=` does not know the post type, so
 * `fetchWpArticle` asks `newspack_nl_cpt` for a `/spotlight-newsletter/` link, which
 * works in the browser build too; correctiv.org sends no CORS header for the page
 * itself. When that fails, the page scrape still has a body, because the extractors
 * fall back to `entry-content` for a page without `detail__content`. Without both,
 * the reader showed its error state for every issue.
 */

/** One issue of the newsletter, as the archive publishes it. */
export interface SpotlightIssue {
  id: string;
  /** ISO-8601. Sent in the morning, so the date is the issue. */
  date: string;
  /** The issue's title, which is also its email subject. */
  subject: string;
  /** The lead, plain text. */
  teaser: string;
  /** The issue on correctiv.org. */
  url: string;
  /**
   * The issue's social image. Often the newsletter's standing masthead GIF rather
   * than a picture of the story, so a screen should treat it as decoration and
   * never as the illustration of a headline.
   */
  imageUrl?: string | null;
}

/**
 * The last-resort seed: four real issues from 2026-08-27 to 2026-08-31.
 *
 * Real, so that a reader who never reaches the network still sees what Spotlight
 * is. Their links are real too, which means they need a connection to open —
 * unlike the article seed, an issue is not bundled.
 */
export const spotlightIssues: SpotlightIssue[] = [
  {
    id: 'nl-287579',
    date: '2026-08-31T16:43:00.000Z',
    subject: 'Gefährliches Spiel mit der Zukunft',
    teaser:
      'Kommt die AfD in Sachsen-Anhalt an die Regierung, wird das massiv Menschen schaden. Aber auch der Wirtschaft, und dem Klima.',
    url: 'https://correctiv.org/spotlight-newsletter/gefaehrliches-spiel-mit-der-zukunft/',
    imageUrl: 'https://correctiv.org/wp-content/uploads/2026/08/HC_CORRECTIV_Hitzesommer.jpg',
  },
  {
    id: 'nl-287314',
    date: '2026-08-29T06:15:00.000Z',
    subject: '„Da platzt mir die Hutschnur!“',
    teaser:
      'Rechtsradikal? Egal. Die AfD verharmlost ihre Nähe zum extremistischen Vorfeld. Das kommt offenbar gut an.',
    url: 'https://correctiv.org/spotlight-newsletter/da-platzt-mir-die-hutschnur/',
    imageUrl: null,
  },
  {
    id: 'nl-287223',
    date: '2026-08-28T16:30:32.000Z',
    subject: 'Verlernen die Kinder das Lernen?',
    teaser: 'Es ist eine riesige Herausforderung für Schulen: Wie soll man mit KI umgehen?',
    url: 'https://correctiv.org/spotlight-newsletter/verlernen-die-kinder-das-lernen/',
    imageUrl: 'https://correctiv.org/wp-content/uploads/2026/08/113018943-scaled.jpg',
  },
  {
    id: 'nl-287083',
    date: '2026-08-27T16:47:51.000Z',
    subject: '43 %, überschätzen Umfragen die AfD?',
    teaser:
      'Die AfD liegt in Umfragen zur Landtagswahl in Sachsen-Anhalt bei über 40 Prozent und spekuliert auf eine eigene Regierungsmehrheit. Wie zuverlässig sind solche Umfragen?',
    url: 'https://correctiv.org/spotlight-newsletter/43-ueberschaetzen-umfragen-die-afd/',
    imageUrl: null,
  },
];
