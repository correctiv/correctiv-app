/**
 * Every sample domain in the core, in one list, and nothing else.
 *
 * The registry is what answers "which specimens exist" without a caller knowing
 * which modules to import, and it is the list a picker walks. It carries ids and
 * names and no display words: a label is the workbench's own vocabulary and
 * lives in its catalogue, next to the rest of the words a person reads there
 * (ADR 0050, ADR 0052). A German label in here would be a second place to keep
 * it, and the one nobody edits.
 *
 * **A new domain is a line here and a test line there.** The list is sorted, so
 * the diff of a new domain is one line rather than a reordering, and
 * `test/sample-variants.test.ts` holds the registry against the domains it can
 * name — a domain that reaches the registry without a claim table is a specimen
 * nobody says what it is for, and the other way round is a claim about a domain
 * that is not there.
 */
import { articleSamples } from './articles';
import { calloutFieldSamples } from './callout-fields';
import { calloutSamples } from './callouts';
import { claimSamples } from './claims';
import { diarySamples } from './diaries';
import { podcastSamples } from './podcasts';
import { videoSamples } from './videos';
import { summarise, type SampleDomainSummary } from './variant';

export const SAMPLE_DOMAINS: readonly SampleDomainSummary[] = [
  summarise(articleSamples),
  summarise(calloutFieldSamples),
  summarise(calloutSamples),
  summarise(claimSamples),
  summarise(diarySamples),
  summarise(podcastSamples),
  summarise(videoSamples),
];
