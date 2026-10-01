import type { FactcheckRating } from '../articles/types';

/**
 * Faktenforum claims — SAMPLE in the Hasura/GraphQL response shape
 * ({ data: { claims: [...] } }) used by the real Faktenforum backend
 * (https://github.com/correctiv/faktenforum), so phase 3 only swaps the
 * data layer. Content modeled on real checked claims.
 */

export type ClaimStatus = 'submitted' | 'checking' | 'checked';

export interface ClaimSource {
  url: string;
  archiveUrl?: string;
  credibility: 'hoch' | 'mittel' | 'niedrig';
  note?: string;
}

export interface Claim {
  id: string;
  shortId: string;
  quote: string;
  synopsis: string;
  status: ClaimStatus;
  /** Same vocabulary as an article's verdict — one fact-check language app-wide. */
  rating?: FactcheckRating;
  submittedAt: string;
  sources: ClaimSource[];
}

/** Mirrors the GraphQL response shape: { data: { claims: [...] } } */
export const claimsResponse = {
  data: {
    claims: [
      {
        id: 'claim-001',
        shortId: 'FF-2418',
        quote: 'Ein Video zeigt, wie die US-Botschaft in Kiew im Mai 2026 evakuiert wird.',
        synopsis:
          'Das Bild stammt nicht aus Kiew und ist KI-generiert. Metadaten und Bildfehler belegen die Fälschung.',
        status: 'checked',
        rating: 'falsch',
        submittedAt: '2026-06-10T14:22:00+02:00',
        sources: [
          {
            url: 'https://correctiv.org/faktencheck/2026/06/12/usa-botschaft-in-kiew-wurde-nicht-evakuiert-grok-und-community-notes-liegen-bei-ki-fake-falsch/',
            credibility: 'hoch',
            note: 'CORRECTIV.Faktencheck',
          },
        ],
      },
      {
        id: 'claim-002',
        shortId: 'FF-2417',
        quote: 'Ein Pfizer-Dokument belegt 80 Prozent Fehlgeburten bei geimpften Schwangeren.',
        synopsis:
          'Die Zahl beruht auf einer falschen Lesart eines Berichts; die Behauptung kursiert seit 2022 immer wieder.',
        status: 'checked',
        rating: 'falsch',
        submittedAt: '2026-06-08T09:10:00+02:00',
        sources: [
          {
            url: 'https://correctiv.org/faktencheck/2026/06/08/coronavirus-pfizer-dokument-belegt-keine-80-prozent-fehlgeburten-bei-geimpften-schwangeren-covid-19/',
            credibility: 'hoch',
            note: 'CORRECTIV.Faktencheck',
          },
        ],
      },
      {
        id: 'claim-003',
        shortId: 'FF-2423',
        quote: 'Supermärkte dürfen ab Juli keine Bargeldzahlungen über 50 Euro mehr annehmen.',
        synopsis:
          'Mehrere Nutzer:innen haben den Claim eingereicht; die Community trägt Quellen zusammen.',
        status: 'checking',
        submittedAt: '2026-06-11T19:45:00+02:00',
        sources: [
          {
            url: 'https://example.social/post/839221',
            credibility: 'niedrig',
            note: 'Ursprungspost',
          },
        ],
      },
      {
        id: 'claim-004',
        shortId: 'FF-2424',
        quote: 'Die Bundesregierung plant eine Pflicht zur digitalen Brieftasche ab 2027.',
        synopsis: 'Frisch eingereicht, noch keine Prüfung gestartet.',
        status: 'submitted',
        submittedAt: '2026-06-12T08:05:00+02:00',
        sources: [],
      },
      {
        id: 'claim-005',
        shortId: 'FF-2410',
        quote: 'Ein Foto zeigt eine in der Ukraine aus Trümmern gerettete Katze.',
        synopsis: 'Das Foto stammt aus den USA und hat keinen Ukraine-Bezug.',
        status: 'checked',
        rating: 'falsch',
        submittedAt: '2026-06-05T11:30:00+02:00',
        sources: [
          {
            url: 'https://correctiv.org/faktencheck/2026/06/09/kein-ukraine-bezug-foto-von-geretteter-katze-ist-aus-den-usa/',
            credibility: 'hoch',
            note: 'CORRECTIV.Faktencheck',
          },
        ],
      },
      {
        id: 'claim-006',
        shortId: 'FF-2405',
        quote: 'Ein Fotovergleich aus Sydney beweist, dass der Meeresspiegel nicht steigt.',
        synopsis:
          'Zwei Fotos vom selben Felsen sagen nichts über globale Pegel aus; Messdaten zeigen den Anstieg auch in Sydney.',
        status: 'checked',
        rating: 'fehlender-kontext',
        submittedAt: '2026-05-28T16:00:00+02:00',
        sources: [
          {
            url: 'https://correctiv.org/faktencheck/2026/05/29/meeresspiegel-steigt-auch-in-sydney-fotovergleich-sagt-nichts-aus/',
            credibility: 'hoch',
            note: 'CORRECTIV.Faktencheck',
          },
        ],
      },
    ] as Claim[],
  },
};

export const claims = claimsResponse.data.claims;
