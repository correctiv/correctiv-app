/**
 * Callout variants — the awkward cases of `data/callouts.ts`, named.
 *
 * The shipped three are the data every screen renders: a survey, a
 * CrowdNewsroom, and one with a deadline already behind it. What none of them has
 * is the case a component has to survive — a callout that is about to close, one
 * that has, one with nothing in it at all, one whose title runs over three lines
 * on a card that clamps its excerpt to two.
 *
 * **Two of the six are built from a shipped callout rather than written out**, and
 * the reason is the date. `klimaanpassung-vor-ort` is the only shipped callout
 * with an `expires`, and it expired on 2026-07-31: copying that date into a
 * variant named `expiring` would make the name false the next day and turn the
 * variant into a lie in an address. So the two dated variants move the deadline
 * and say so. `data/backstage.ts` computes its dates the same way, for the same
 * reason.
 *
 * **There is no `with-image` / `no-image` pair here**, which the platform's
 * design list asks for, and the reason is a fact about the code: nothing reads
 * `Callout.image`. Measured on 2026-10-01 by reading every `image` access under
 * `apps/mobile/src` and `packages/app-core/src` — the two hits are the platform
 * port's own `content.image()`, and neither is a callout. Every shipped callout
 * carries `image: null`, so the "no image" case is already the shape of the whole
 * set, and a variant that varied it would be a specimen of nothing. The day a
 * component draws it, the pair belongs here and the argument above with it.
 *
 * Nothing here changes what the app renders: `data/callouts.ts` still holds the
 * three callouts, in the order the screens read them.
 */
import { callouts, type Callout } from '../callouts';

import { sampleDomain, variant } from './variant';

/**
 * An ISO timestamp `days` from now, as a calendar day rather than a moment.
 *
 * The offset shift is the usual one, so the day printed is the day's rather than
 * UTC's — a deadline read at 23:59 in a day that is already tomorrow in UTC is
 * off by one, and a specimen whose date is off by one contradicts its own name.
 * The clock is fixed at `+02:00` because these specimens are German; the same
 * trade `data/backstage.ts` makes, for the same reason.
 */
function inDays(days: number): string {
  const when = new Date(Date.now() + days * 86_400_000);
  const local = new Date(when.getTime() + when.getTimezoneOffset() * 60_000);
  return `${local.toISOString().slice(0, 10)}T23:59:00+02:00`;
}

/**
 * The first shipped callout that is what a variant is built from, found by what
 * it is rather than by where it stands in the array.
 *
 * An index is one edit of `data/callouts.ts` away from naming the wrong callout,
 * and the claim tables in `test/sample-variants.test.ts` would then report a
 * specimen that contradicts its own name — which is the failure this directory
 * exists to make impossible to miss. Two shipped callouts are CrowdNewsrooms, so
 * this takes the first rather than insisting on one, and the gallery's own
 * `kind="crowdnewsroom"` specimen is likewise the first.
 */
function firstThat(what: string, matches: (callout: Callout) => boolean): Callout {
  const found = callouts.find(matches);
  if (found === undefined) throw new Error(`no shipped callout ${what}`);
  return found;
}

const survey = firstThat('is a survey', (callout) => callout.kind === 'survey');
const crowdnewsroom = firstThat(
  'is a crowdnewsroom',
  (callout) => callout.kind === 'crowdnewsroom',
);
/** The only shipped callout with a deadline, and therefore the base for both dated variants. */
const dated = firstThat('carries a deadline', (callout) => callout.expires !== null);

/**
 * The variants, in the order a picker should offer them: the two the app ships
 * and every screen draws first, then the cases, then the extremes.
 */
const CALLOUT_VARIANTS = [
  variant(
    'open',
    'The shipped CrowdNewsroom callout: open, no deadline, a form with three slides.',
    crowdnewsroom,
  ),
  variant(
    'survey',
    'The shipped survey, which is the other kind and gets the quieter button.',
    survey,
  ),
  variant(
    'expiring',
    'Open with the deadline three days out. The countdown and the "closes soon" wording are this case.',
    { ...dated, expires: inDays(3) },
  ),
  variant(
    'closed',
    'Ended, with the deadline behind it. A closed callout is the one a home module must skip, and `lib/home/modules.tsx` picks the first open one.',
    { ...dated, status: 'ended' as const, expires: inDays(-9) },
  ),
  variant(
    'empty',
    'Announced and not yet filled: no responses, no form, no introduction, no image. The progress bar at its floor and the counter in its plural.',
    {
      slug: 'in-vorbereitung',
      kind: 'crowdnewsroom',
      title: 'Die nächste Recherche startet bald',
      excerpt:
        'Die Fragen laufen noch durch die Redaktion. Hier erscheint der Aufruf, sobald er steht.',
      intro: [],
      image: null,
      starts: inDays(-2),
      expires: null,
      status: 'open',
      responseCount: 0,
      whoAsks: 'Das CORRECTIV-Team, Redaktionsleitung',
      dataUse: 'Es werden noch keine Daten erhoben.',
      formSchema: { slides: [] },
    },
  ),
  variant(
    'long-text',
    'A title over three lines and an excerpt over five, against a card that clamps both.',
    {
      slug: 'ausfuendliche-fragenstellung',
      kind: 'crowdnewsroom',
      title:
        'Ausführliche Fragenstellung: Wie viele Ihrer Mitgliederinnen arbeiten in Pflege, und was wäre der erste Schritt, der wirklich hilft?',
      excerpt:
        'Diese Fragenstellung ist bewässert lang, weil sie in der Kartenansicht auf zwei Zeilen gekürzt wird und der Rest über mehrere Zeilen läuft, bis die Zeile umbricht und die Karte ihre Höhe ändert.',
      intro: [
        'Der erste Absatz einer einleitenden Liste steht hier und läuft über mehrere Zeilen, damit die Karte etwas zu umbrechen hat, das nicht die Überschrift ist.',
        'Der zweite Absatz folgt ihm, weil eine Liste mit einem Eintrag kein Umbruchverhalten zeigt.',
      ],
      image: null,
      starts: inDays(-30),
      expires: inDays(30),
      status: 'open',
      responseCount: 412,
      whoAsks: 'CORRECTIV-Pflegerecherche',
      dataUse: 'Ortsangaben werden nur auf Gemeindeebene ausgewertet und veröffentlicht.',
      formSchema: {
        slides: [
          {
            id: 'beruf',
            title: 'In welchem Bereich arbeiten Sie?',
            components: [
              {
                key: 'bereich',
                type: 'selectboxes',
                label: 'Welche dieser Bereiche kommt für Sie in Frage?',
                required: true,
                values: [
                  { label: 'Pflege', value: 'pflege' },
                  { label: 'Betreuung', value: 'betreuung' },
                  { label: 'Hauswirtschaft', value: 'hauswirtschaft' },
                ],
              },
            ],
          },
        ],
      },
    },
  ),
] as const satisfies readonly { name: string; note: string; data: Callout }[];

export const calloutSamples = sampleDomain('callouts', CALLOUT_VARIANTS);

/** Every name the callout domain has, as literals. */
export type CalloutSampleName = (typeof CALLOUT_VARIANTS)[number]['name'];
