/**
 * Diary variants — the Backstage domain's model.
 *
 * Backstage is several models in one file (`data/backstage.ts` holds the early
 * access card, the diary, the bonus media, the events, the newsletter and the
 * publisher's perk), so "a Backstage variant" is a question about which model. It
 * is the diary: it is the one a screen takes as a whole (`app/tagebuch/[id].tsx`
 * is handed a `DiaryEntry` and nothing else), and the one the home teaser leads
 * with. The other two have no such screen — `EarlyAccessCard` draws no props at
 * all, and the bonus row is a list the teaser truncates — so a variant of either
 * would be a specimen of a component that reads the file itself, and there would
 * be nothing to draw it with.
 *
 * `current` is the entry the shipped teaser leads with. `no-body` is the case a
 * diary has on the day its teaser goes out and the write-up has not: an entry
 * with a title, a date and nothing to read, which is a screen that has to say so
 * rather than render a page of whitespace.
 */
import { diaries, type DiaryEntry } from '../backstage';

import { sampleDomain, variant } from './variant';

const DIARY_VARIANTS = [
  variant(
    'current',
    'The third week of the pensionskassen diary, which is the entry the home teaser leads with today.',
    diaries[0],
  ),
  variant(
    'no-body',
    'A teaser with no write-up behind it. The empty state a diary screen has to have.',
    {
      id: 'diary-ohne-text',
      series: 'Pensionskassen-Recherche',
      title: 'Woche 4: Die Antwort der Aufsichtsbehörde',
      teaser:
        'Die Behörde hat geantwortet. Was darin steht, lesen Sie hier, sobald es geschrieben ist.',
      date: new Date(Date.now() - 86_400_000).toISOString(),
      body: [],
    },
  ),
] as const satisfies readonly { name: string; note: string; data: DiaryEntry }[];

export const diarySamples = sampleDomain('diaries', DIARY_VARIANTS);

/** Every name the diaries domain has, as literals. */
export type DiarySampleName = (typeof DIARY_VARIANTS)[number]['name'];
