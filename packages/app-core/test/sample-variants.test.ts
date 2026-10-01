import { describe, expect, it } from 'vitest';

import { floorFaults } from '@correctiv/prose-and-code';

import { articleSamples, type ArticleSampleName } from '../src/data/samples/articles';
import {
  calloutFieldSamples,
  type CalloutFieldSampleName,
} from '../src/data/samples/callout-fields';
import { calloutSamples, type CalloutSampleName } from '../src/data/samples/callouts';
import { claimSamples, type ClaimSampleName } from '../src/data/samples/claims';
import { diarySamples, type DiarySampleName } from '../src/data/samples/diaries';
import { SAMPLE_DOMAINS } from '../src/data/samples/domains';
import { podcastSamples, type PodcastSampleName } from '../src/data/samples/podcasts';
import { videoSamples, type VideoSampleName } from '../src/data/samples/videos';
import type { Callout, CalloutComponent } from '../src/data/callouts';
import type { Claim } from '../src/data/claims';
import type { DiaryEntry } from '../src/data/backstage';
import type { PodcastSeries } from '../src/data/podcasts';
import type { FeedItem, Video } from '../src/types/models';

/**
 * What a sample name promises, and what holds it there.
 *
 * A variant's name is an address — `callouts/closed` is what a picker puts in its
 * URL — so a name that does not describe its data is a lie that two people read
 * differently: the one who picked it and the one who drew it. The claim tables
 * below are therefore the test, and their TYPE is the mechanism: each is
 * `Record<Name, …>` over the literals of one domain, which is a compile error the
 * moment a variant is added without a line saying what it is for. A check that
 * can fail is worth more here than prose, and the prose is the `note` beside the
 * data.
 *
 * **A check reads as a list of what is WRONG**, so every claim is written the way
 * it would be said — `['no id', item.id.length === 0]`. A table written in the
 * positive (`holds`) reads as a list of what is right, which is the opposite of
 * what a failing run prints, and a check that reads backwards is a check nobody
 * trusts a month later.
 *
 * **What "stable name" is taken to mean here**, since nothing in this repository
 * can hold a name across releases: a name is kebab-case ASCII, unique within its
 * domain, spelled once, and read from one array by both lookups (`of` for a
 * caller in the repository, `find` for a name from outside). A RENAME is a
 * visible diff in this file, in the domain and in the registry, which is the most
 * this arrangement can promise and more than a comment would.
 *
 * **What none of it sees.** That a specimen is a good one: real where real data
 * was reachable, and honest about where it is invented. That is a question for
 * the person who wrote it, and no check here can hold them to more than what they
 * said.
 */

/**
 * The domains as handles that still know their model, which is what a claim table
 * is written against.
 *
 * A second list beside the registry, and held against it below: the registry
 * erases the payload type, which is the point of it, so a claim table has to
 * reach the typed object, and a domain that reaches the registry without a claim
 * table is caught in the first describe rather than by a type.
 */
const DOMAINS = [
  articleSamples,
  calloutFieldSamples,
  calloutSamples,
  claimSamples,
  diarySamples,
  podcastSamples,
  videoSamples,
] as const;

type Domain = (typeof DOMAINS)[number];

/** A kebab-case name in a URL, which is the only spelling a name may have. */
const NAME = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** The characters that would say a note had been written in German. */
const GERMAN = /[äöüßÄÖÜ„“]/;

/** One check on a specimen: what is wrong with it, and whether it is. */
type Check = readonly [what: string, wrong: boolean];

function faults(checks: readonly Check[]): string[] {
  return checks.filter(([, isWrong]) => isWrong).map(([what]) => what);
}

function isDate(value: string | null | undefined): boolean {
  return typeof value === 'string' && Number.isFinite(Date.parse(value));
}

/** Narrow an `unknown` payload, so a claim table can be written in the model's own words. */
function as<T>(data: unknown): T | null {
  return typeof data === 'object' && data !== null ? (data as T) : null;
}

/**
 * The per-domain claim tables, each keyed by that domain's own name literals.
 *
 * A row too many and a row too few are both compile errors, which is the whole
 * mechanism. `heldNames` says the same at runtime, because a type can be
 * satisfied by something that is not a table.
 */
function heldNames<Name extends string, T>(
  domain: { variants: readonly { name: Name; data: T }[]; of(name: Name): T },
  claims: Record<Name, (data: T) => string[]>,
): string[] {
  const unclaimed = domain.variants
    .filter((variant) => !(variant.name in claims))
    .map((variant) => `${variant.name}: nothing says what this one is for`);
  const broken = domain.variants.flatMap((variant) =>
    (claims[variant.name]?.(variant.data) ?? []).map((fault) => `${variant.name}: ${fault}`),
  );
  return [...unclaimed, ...broken].sort();
}

/** What every article has to have whatever it is an example of. */
function articleFaults(item: FeedItem): string[] {
  return faults([
    ['no id', item.id.length === 0],
    ['url is not https', !item.url.startsWith('https://')],
    ['publishedAt does not parse', !isDate(item.publishedAt)],
    ['no teaser', item.teaser.length === 0],
  ]);
}

const ARTICLE_CLAIMS: Record<ArticleSampleName, (item: FeedItem) => string[]> = {
  lead: (item) => [
    ...articleFaults(item),
    ...faults([
      ['imageUrl is not a url', !(item.imageUrl ?? '').startsWith('https://')],
      ['no reading time', (item.readingMinutes ?? 0) <= 0],
    ]),
  ],
  'no-image': (item) => [
    ...articleFaults(item),
    ...faults([
      ['carries an image', item.imageUrl !== null],
      ['carries a reading time', item.readingMinutes !== undefined],
    ]),
  ],
  'factcheck-verdict': (item) => [
    ...articleFaults(item),
    ...faults([['is not a fact check', item.feed !== 'faktencheck']]),
  ],
  'factcheck-number': (item) => [
    ...articleFaults(item),
    ...faults([['is not a fact check', item.feed !== 'faktencheck']]),
  ],
  'long-title': (item) => [
    ...articleFaults(item),
    ...faults([
      ['is not a fact check', item.feed !== 'faktencheck'],
      // The card is `numberOfLines={4}`, and a rail card is 120 dp wide, so the
      // threshold is what makes it wrap there rather than on a tablet. A title
      // under it would pass the check while showing nothing.
      ['title is not long enough to wrap', item.title.length <= 80],
    ]),
  ],
};

function videoFaults(video: Video): string[] {
  return faults([
    ['no id', video.id.length === 0],
    ['url is not https', !video.url.startsWith('https://')],
    ['thumbnailUrl is not https', !video.thumbnailUrl.startsWith('https://')],
    ['publishedAt does not parse', !isDate(video.publishedAt)],
  ]);
}

const VIDEO_CLAIMS: Record<VideoSampleName, (video: Video) => string[]> = {
  peertube: (video) => [
    ...videoFaults(video),
    ...faults([
      ['source is not peertube', video.source !== 'peertube'],
      ['no duration', (video.durationSec ?? 0) <= 0],
      ['no view count', (video.views ?? 0) <= 0],
    ]),
  ],
  youtube: (video) => [
    ...videoFaults(video),
    ...faults([
      ['source is not youtube', video.source !== 'youtube'],
      ['carries a duration', video.durationSec !== undefined],
      ['carries a view count', video.views !== undefined],
    ]),
  ],
};

function calloutFaults(callout: Callout): string[] {
  return faults([
    ['no slug', callout.slug.length === 0],
    ['no title', callout.title.length === 0],
    ['starts does not parse', !isDate(callout.starts)],
    ['expires does not parse', callout.expires !== null && !isDate(callout.expires)],
    ['formSchema is not a list of slides', !Array.isArray(callout.formSchema.slides)],
  ]);
}

const CALLOUT_CLAIMS: Record<CalloutSampleName, (callout: Callout) => string[]> = {
  open: (callout) => [
    ...calloutFaults(callout),
    ...faults([
      ['is not open', callout.status !== 'open'],
      ['carries a deadline', callout.expires !== null],
      ['has no form', callout.formSchema.slides.length === 0],
    ]),
  ],
  survey: (callout) => [
    ...calloutFaults(callout),
    ...faults([['is not a survey', callout.kind !== 'survey']]),
  ],
  expiring: (callout) => [
    ...calloutFaults(callout),
    ...faults([
      ['is not open', callout.status !== 'open'],
      ['deadline is not in the future', Date.parse(callout.expires ?? '') <= Date.now()],
    ]),
  ],
  closed: (callout) => [
    ...calloutFaults(callout),
    ...faults([
      ['is still open', callout.status !== 'ended'],
      ['deadline is not in the past', Date.parse(callout.expires ?? '') >= Date.now()],
    ]),
  ],
  empty: (callout) => [
    ...calloutFaults(callout),
    ...faults([
      ['has responses', callout.responseCount !== 0],
      ['has a form', callout.formSchema.slides.length !== 0],
      ['has an introduction', callout.intro.length !== 0],
      ['carries an image', callout.image !== null],
    ]),
  ],
  'long-text': (callout) => [
    ...calloutFaults(callout),
    ...faults([
      ['title is not long enough to wrap', callout.title.length <= 100],
      ['excerpt is not long enough to clamp', callout.excerpt.length <= 150],
    ]),
  ],
};

function claimFaults(claim: Claim): string[] {
  return faults([
    ['no id', claim.id.length === 0],
    ['no shortId', claim.shortId.length === 0],
    ['submittedAt does not parse', !isDate(claim.submittedAt)],
    ['sources is not a list', !Array.isArray(claim.sources)],
  ]);
}

const CLAIM_CLAIMS: Record<ClaimSampleName, (claim: Claim) => string[]> = {
  submitted: (claim) => [
    ...claimFaults(claim),
    ...faults([
      ['is not submitted', claim.status !== 'submitted'],
      ['carries a verdict', claim.rating !== undefined],
    ]),
  ],
  checking: (claim) => [
    ...claimFaults(claim),
    ...faults([
      ['is not being checked', claim.status !== 'checking'],
      ['carries a verdict', claim.rating !== undefined],
      ['has no source', claim.sources.length === 0],
    ]),
  ],
  checked: (claim) => [
    ...claimFaults(claim),
    ...faults([
      ['is not checked', claim.status !== 'checked'],
      ['carries no verdict', claim.rating === undefined],
    ]),
  ],
  'checked-unrated': (claim) => [
    ...claimFaults(claim),
    ...faults([
      ['is not checked', claim.status !== 'checked'],
      ['carries a verdict', claim.rating !== undefined],
    ]),
  ],
};

function seriesFaults(series: PodcastSeries): string[] {
  return faults([
    ['no id', series.id.length === 0],
    ['no title', series.title.length === 0],
    ['no publisher', series.publisher.length === 0],
    ['no description', series.description.length === 0],
    ['episodes is not a list', !Array.isArray(series.episodes)],
  ]);
}

const PODCAST_CLAIMS: Record<PodcastSampleName, (series: PodcastSeries) => string[]> = {
  default: (series) => [
    ...seriesFaults(series),
    ...faults([
      ['has no episode', series.episodes.length === 0],
      ['carries a cover', series.imageUrl !== undefined && series.imageUrl !== null],
    ]),
  ],
  'no-episodes': (series) => [
    ...seriesFaults(series),
    ...faults([['has an episode', series.episodes.length !== 0]]),
  ],
  'long-text': (series) => [
    ...seriesFaults(series),
    ...faults([
      ['title is not long enough to wrap', series.title.length <= 80],
      ['description is not long enough to wrap', series.description.length <= 100],
    ]),
  ],
};

function diaryFaults(entry: DiaryEntry): string[] {
  return faults([
    ['no id', entry.id.length === 0],
    ['no series', entry.series.length === 0],
    ['no title', entry.title.length === 0],
    ['no teaser', entry.teaser.length === 0],
    ['date does not parse', !isDate(entry.date)],
    ['body is not a list', !Array.isArray(entry.body)],
  ]);
}

const DIARY_CLAIMS: Record<DiarySampleName, (entry: DiaryEntry) => string[]> = {
  current: (entry) => [
    ...diaryFaults(entry),
    ...faults([['has no body', entry.body.length === 0]]),
  ],
  'no-body': (entry) => [
    ...diaryFaults(entry),
    ...faults([['has a body', entry.body.length !== 0]]),
  ],
};

const FIELD_CLAIMS: Record<CalloutFieldSampleName, (field: CalloutComponent) => string[]> = {
  radio: (field) =>
    faults([
      ['no key', field.key.length === 0],
      ['no label', field.label.length === 0],
      ['is not a radio', field.type !== 'radio'],
      ['has fewer than two values', (field.values ?? []).length < 2],
    ]),
  selectboxes: (field) =>
    faults([
      ['no key', field.key.length === 0],
      ['no label', field.label.length === 0],
      ['is not a set of boxes', field.type !== 'selectboxes'],
      ['has fewer than two values', (field.values ?? []).length < 2],
    ]),
  textfield: (field) =>
    faults([
      ['no key', field.key.length === 0],
      ['no label', field.label.length === 0],
      ['is not a text field', field.type !== 'textfield'],
      ['has no placeholder', (field.placeholder ?? '').length === 0],
    ]),
  textarea: (field) =>
    faults([
      ['no key', field.key.length === 0],
      ['no label', field.label.length === 0],
      ['is not a text area', field.type !== 'textarea'],
      ['has no placeholder', (field.placeholder ?? '').length === 0],
    ]),
  file: (field) =>
    faults([
      ['no key', field.key.length === 0],
      ['no label', field.label.length === 0],
      ['is not a file', field.type !== 'file'],
      ['offers values', field.values !== undefined],
    ]),
};

/** One row per domain, so a failure names the domain as well as the variant. */
const HELD: { domain: Domain; faults: string[] }[] = [
  { domain: articleSamples, faults: heldNames(articleSamples, ARTICLE_CLAIMS) },
  { domain: calloutFieldSamples, faults: heldNames(calloutFieldSamples, FIELD_CLAIMS) },
  { domain: calloutSamples, faults: heldNames(calloutSamples, CALLOUT_CLAIMS) },
  { domain: claimSamples, faults: heldNames(claimSamples, CLAIM_CLAIMS) },
  { domain: diarySamples, faults: heldNames(diarySamples, DIARY_CLAIMS) },
  { domain: podcastSamples, faults: heldNames(podcastSamples, PODCAST_CLAIMS) },
  { domain: videoSamples, faults: heldNames(videoSamples, VIDEO_CLAIMS) },
];

describe('the sample domains are the ones the registry lists', () => {
  it('reads the registry and the domains it is checking', () => {
    // Every assertion below is over a walk of lists rather than over a value, so a
    // rename of `SAMPLE_DOMAINS` or of a module empties one of them instead of
    // breaking it — and an empty list makes each pass with nothing to say. This
    // is the floor under both.
    expect(
      floorFaults({
        'domains in the registry': { found: SAMPLE_DOMAINS.length, atLeast: 5 },
        'variants across them': {
          found: SAMPLE_DOMAINS.reduce((n, domain) => n + domain.variants.length, 0),
          atLeast: 20,
        },
      }),
    ).toEqual([]);
  });

  it('lists every domain, and lists nothing twice', () => {
    // The registry is what a picker enumerates, so a domain missing from it is
    // unreachable and a domain in it twice is offered twice. The claim tables
    // cannot see either: they are held against the list above.
    const ids = SAMPLE_DOMAINS.map((domain) => domain.id);
    const missing = DOMAINS.map((domain) => domain.id).filter((id) => !ids.includes(id));
    const extra = ids.filter((id) => !DOMAINS.some((domain) => domain.id === id));
    const twice = ids.filter((id, index) => ids.indexOf(id) !== index);

    expect({ missing: missing.sort(), extra: extra.sort(), twice: twice.sort() }).toEqual({
      missing: [],
      extra: [],
      twice: [],
    });
  });

  it('is sorted, so adding a domain is one line of diff', () => {
    const ids = SAMPLE_DOMAINS.map((domain) => domain.id);
    expect(ids).toEqual([...ids].sort());
  });
});

describe('every sample name is an address', () => {
  it('is kebab-case, and so is every domain id', () => {
    const badlyNamed = [
      ...SAMPLE_DOMAINS.map((domain) => (NAME.test(domain.id) ? null : `domain ${domain.id}`)),
      ...SAMPLE_DOMAINS.flatMap((domain) =>
        domain.variants
          .filter((variant) => !NAME.test(variant.name))
          .map((variant) => `${domain.id}/${variant.name}`),
      ),
    ].filter((name): name is string => name !== null);

    expect(badlyNamed.sort()).toEqual([]);
  });

  it('is used once within its domain', () => {
    // Two specimens under one name is one the second picker cannot choose, and a
    // union of names would fold them into one without saying so.
    const twice = SAMPLE_DOMAINS.flatMap((domain) => {
      const names = domain.variants.map((variant) => variant.name);
      return names
        .filter((name, index) => names.indexOf(name) !== index)
        .map((name) => `${domain.id}/${name}`);
    });

    expect(twice.sort()).toEqual([]);
  });

  it('says in one line what its specimen is for, in English', () => {
    // The note is the one field here that is not content: a developer reads it,
    // and the German catalogue does not carry words a developer reads. Content is
    // exempt from that rule by path (ADR 0026 §6), a note is not, so the rule is
    // asserted here for the one field that carries it.
    const silent = SAMPLE_DOMAINS.flatMap((domain) =>
      domain.variants
        .filter((variant) => variant.note.trim().length === 0 || GERMAN.test(variant.note))
        .map((variant) => `${domain.id}/${variant.name}`),
    );

    expect(silent.sort()).toEqual([]);
  });
});

describe('every sample variant is reachable both ways', () => {
  it('resolves through the domain and through the registry', () => {
    // Two lookups, one array: `of` for a caller in the repository, which throws
    // on a name that is not there, and `find` for a name from outside, which
    // answers nothing. They cannot part, and this is what says so.
    const unreachable = SAMPLE_DOMAINS.flatMap((domain) =>
      domain.variants.flatMap((variant) => {
        const found = domain.find(variant.name);
        if (found === undefined)
          return [`${domain.id}/${variant.name}: the registry cannot find it`];
        return found.data === variant.data
          ? []
          : [`${domain.id}/${variant.name}: two different data`];
      }),
    );

    expect(unreachable.sort()).toEqual([]);
  });

  it('throws rather than resolving to nothing, and answers nothing to a name from outside', () => {
    // The net, made to fail. Both halves are about a name that is NOT there, and
    // neither is exercised by any specimen in the repository, so without these
    // two lines the two lookups could be anything at all.
    expect(() => articleSamples.of('nope' as ArticleSampleName)).toThrow(/articles\/nope/);
    expect(SAMPLE_DOMAINS[0].find('nope')).toBeUndefined();
  });

  it('takes a name from its own domain and no other', () => {
    // The half of "a name is a closed set" a test cannot hold, so it is written
    // out rather than asserted: `articleSamples.of('survey')` and
    // `calloutSamples.of('lead')` are both compile errors, because each domain's
    // `of` takes the union of that domain's own names. If a domain were emptied,
    // its `Name` would become `never` and this line would stop compiling rather
    // than pass vacuously — which is what the floor above cannot see.
    const name: ArticleSampleName = 'lead';
    expect(articleSamples.of(name).feed).toBe('recherchen');
  });
});

describe('every sample variant holds its name', () => {
  it('is a specimen of what its name says', () => {
    // The substance: one claim per name, checked against the data. A failing row
    // names the variant and what about it is untrue, so the fix is in the domain
    // module rather than in this file.
    expect(
      HELD.flatMap(({ domain, faults: found }) =>
        found.map((fault) => `${domain.id}/${fault}`),
      ).sort(),
    ).toEqual([]);
  });

  it('narrows a payload that is not the model before it reads a field', () => {
    // `as<T>()` is what lets a claim table be written in the model's own words
    // over an `unknown` payload, and this is the half of it that is a check: a
    // table reading a field of a payload that is not there would throw rather
    // than report, which is the failure mode worth showing once.
    expect(as<Callout>(null)).toBeNull();
    expect(as<Callout>({ slug: 'x' })?.slug).toBe('x');
  });
});
