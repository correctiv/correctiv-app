import {
  CircleDashed,
  CircleDot,
  CirclePause,
  CircleSlash2,
  FlaskConical,
  OctagonX,
  Sparkles,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { defineMessages, type IntlShape, type MessageDescriptor } from 'react-intl';

import {
  COUNTS,
  FEEDS,
  feedFigures,
  gapAvailable,
  MEASURED,
  MEASURED_ON,
  PROBES,
  QUESTIONS,
  SOURCES,
  UNUSED,
} from '../../content/sources.manifest';
import type {
  Feed,
  FeedCount,
  FeedNewest,
  Gap,
  Kind,
  SourceEntry,
  Status,
} from '../../content/sources.manifest';
import { Badge } from '../ui/kit/badge';
import { Segmented } from '../ui/kit/segmented';
import { Button } from '../ui/kit/button';
import { InfoTip } from '../ui/kit/info-tip';
import { useWorkbenchIntl } from '../i18n/Localisation';
import { cn } from '../lib/cn';
import { ageInWords, isStale, STALE_AFTER_DAYS } from '../lib/measured';
import { feedId } from '../lib/slug';
import { Slot } from '../shell/slots';
import { Page } from '../ui/Page';
import { Toc } from '../ui/Toc';
import { useSections } from '../ui/useSections';

type Severity = 'stale' | 'broken';
/** The five marks the board draws: three product states, two health overlays. */
type Mark = Status | Severity;
type GroupBy = 'state' | 'kind';

/**
 * A measured figure, so a date or a count is never mistaken for prose.
 *
 * It never wraps. A date broken across two lines in a narrow column reads as two
 * numbers, and every figure on this page is one somebody took by hand.
 */
const FIGURE = 'whitespace-nowrap font-mono tabular-nums';

/**
 * An identifier out of the repository: an endpoint, a module path, a slug.
 *
 * `wrap-anywhere` rather than `break-words`, because a module path is one long
 * token and a table column is sized by its longest one. Left to break only at the
 * hyphen, the "reads from" column claimed 318px it did not need and pushed the
 * disclosure button past the right edge of the scroll box.
 */
const CODE =
  'rounded-s border border-stroke bg-surface px-3xs py-4xs font-mono text-[0.8125rem] wrap-anywhere';

const LINK =
  'rounded-s underline decoration-accent underline-offset-2 hover:text-on-canvas-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent';

/** What a question chip adds to the kit's outline badge, which it otherwise is. */
const CHIP_LINK =
  'hover:border-accent hover:text-on-canvas-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent';

const SECTION_HEAD = 'text-headline-l font-semibold tracking-tight text-on-canvas';
/** A section's heading and the ⓘ beside it, which holds what used to be its lede. */
const HEAD_ROW = 'flex items-center gap-xs';
const SECTION_LEDE = 'mt-2xs max-w-content text-m text-on-canvas-muted';

/**
 * Everything this board says, in ENGLISH; the German that ships is
 * `src/i18n/catalogue/de/sources.ts`.
 *
 * **What is here is the board, and what is not here is the ledger.** The state
 * names, the kind names, the headings, the tiles, the legends, the column heads,
 * the badges and every summary sentence were written on this page and are here.
 * A row's name, its note, its endpoint and its file, every gap's label and note,
 * and all ten of the open editorial questions come out of
 * `content/sources.manifest.ts`, which
 * [ADR 0052](../../../../adr/0052-the-sites-own-words-follow-the-setting.md) §4
 * keeps in its own spelling, argument against and all: it is this site's ledger
 * of what the app reads, and a ledger is quoted rather than narrated. §4 names the
 * questions as the case against itself, so read that section before moving them.
 *
 * **Two English fragments used to arrive inside German sentences and both are
 * gone.** `{age}` came out of `src/lib/measured.ts` as English prose, so this
 * page read „gemessen (2 days ago)“; that function takes the formatter now.
 * `{posts}` and `{newest}` came out of `feedFigures()` as the English words
 * "every post", "none" and "unknown", and as a count grouped for one language;
 * the manifest hands out a finding and `saysCount` and `saysNewest` below word
 * it. A first version of this paragraph said both were deliberate and named
 * them as such on the descriptors, which a cold review caught in the same commit
 * that removed them.
 */
const COPY = defineMessages({
  stateLive: {
    id: 'sources.state.live',
    defaultMessage: 'Live',
    description:
      'The chip on a row fed by a real source that is delivering, the accessible name of the tile that filters for those, and the heading of that group in the table. home.timeline.live is the same word in the preview’s day track, where it marks the minute the frame is showing as the real clock.',
  },
  stateStale: {
    id: 'sources.state.stale',
    defaultMessage: 'Live, stale',
    description:
      'The chip on a live source that has stopped delivering. Both halves matter: the connection works, the content has not moved, and the row is still counted as live.',
  },
  stateBroken: {
    id: 'sources.state.broken',
    defaultMessage: 'Live, broken',
    description:
      'The chip on a live source that points at nothing: configured, reached, and answering with an empty set. Still counted as live, which is why the first word is there.',
  },
  stateSample: {
    id: 'sources.state.sample',
    defaultMessage: 'Sample',
    description:
      'The chip on a row fed by a checked-in file standing in for an API that does not exist yet. sources.group.sampleData is the longer form used as the tile’s name and the group’s heading, where there is room for it.',
  },
  stateNoSource: {
    id: 'sources.state.noSource',
    defaultMessage: 'No source',
    description:
      'The chip on a wanted feature with nothing to read at all, the accessible name of the tile that filters for those, and the heading of that group in the table.',
  },

  kindArticles: {
    id: 'sources.kind.articles',
    defaultMessage: 'Articles',
    description:
      'One of the eight content kinds, in the Kind column and as a group heading. This one is the app’s article feeds out of correctiv.org.',
  },
  kindNewsletter: {
    id: 'sources.kind.newsletter',
    defaultMessage: 'Newsletter',
    description: 'One of the eight content kinds: the newsletter archive.',
  },
  kindSearch: {
    id: 'sources.kind.search',
    defaultMessage: 'Search',
    description: 'One of the eight content kinds: what the app’s search reads.',
  },
  kindAudio: {
    id: 'sources.kind.audio',
    defaultMessage: 'Audio',
    description: 'One of the eight content kinds: podcasts and the live stream.',
  },
  kindVideo: {
    id: 'sources.kind.video',
    defaultMessage: 'Video',
    description: 'One of the eight content kinds: PeerTube and YouTube.',
  },
  kindCommunity: {
    id: 'sources.kind.community',
    defaultMessage: 'Community',
    description:
      'One of the eight content kinds: what members of the community contribute or take part in.',
  },
  kindClub: {
    id: 'sources.kind.club',
    defaultMessage: 'Club',
    description:
      'One of the eight content kinds: CORRECTIV’s membership club, which is a product of its own.',
  },
  kindDirectory: {
    id: 'sources.kind.directory',
    defaultMessage: 'Directory',
    description: 'One of the eight content kinds: a list of places, people or events.',
  },

  groupSampleData: {
    id: 'sources.group.sampleData',
    defaultMessage: 'Sample data',
    description:
      'The heading of the sample group in the table, and the name of the tile that filters for it. sources.state.sample is the shorter word the chip inside a row carries.',
  },
  groupRows: {
    id: 'sources.group.rows',
    defaultMessage: '{count, plural, one {# row} other {# rows}}',
    description:
      'The count beside a group heading while the filters hide nothing in it. {count} is how many rows that group has.',
  },
  groupRowsOf: {
    id: 'sources.group.rowsOf',
    defaultMessage: '{shown} of {total, plural, one {# row} other {# rows}}',
    description:
      'The count beside a group heading while the filters hide some of it. {shown} is how many rows are left and {total} how many the group has.',
  },
  groupSomeLive: {
    id: 'sources.group.some.live',
    defaultMessage: '{count} live',
    description:
      'Part of the breakdown after a group’s count, and only while the board is grouped by content kind, where one kind holds rows in several states. {count} is how many of the shown rows are live.',
  },
  groupSomeSample: {
    id: 'sources.group.some.sample',
    defaultMessage: '{count} sample',
    description:
      'Part of that same breakdown. {count} is how many of the shown rows are fed by sample data.',
  },
  groupSomeNoSource: {
    id: 'sources.group.some.noSource',
    defaultMessage: '{count} no source',
    description:
      'Part of that same breakdown. {count} is how many of the shown rows have no source at all.',
  },

  questionChip: {
    id: 'sources.question.chip',
    defaultMessage: 'Q{n}',
    description:
      'The short label of an open editorial question: the letter that stands for “question” and the question’s number. {n} is that number, counting from one, and it is also the circle beside the question itself further down the page. A translation may change the letter, and then both places change together, because both read this id.',
  },
  questionChipName: {
    id: 'sources.question.chipName',
    defaultMessage: ', open question {n}',
    description:
      'Read aloud after that short label, which would otherwise announce as a letter and a digit, and never drawn. {n} is the question’s number. The leading comma is a pause after the label.',
  },
  questionLink: {
    id: 'sources.question.link',
    defaultMessage: 'Open question {n}',
    description:
      'The link from a row, or from a finding card, down to the question that row raises. {n} is the question’s number.',
  },

  countEveryPost: {
    id: 'sources.count.everyPost',
    defaultMessage: 'every post',
    description:
      'What the run found for the one feed that has no category, because it carries every post the site publishes. Dropped into the middle of sources.feed.run and sources.findings.figures after the verb, so it is lower case and carries no full stop.',
  },
  countNone: {
    id: 'sources.count.none',
    defaultMessage: 'no posts',
    description:
      'What the run found for a feed whose category exists and holds nothing. Different from sources.count.unknown, which is a source that did not answer at all. Dropped in after the verb, so lower case.',
  },
  countUnknown: {
    id: 'sources.count.unknown',
    defaultMessage: 'no answer',
    description:
      'Where the count would be, for a feed whose category did not answer. It is a finding and not a missing value: sources.count.none is a category that answered and was empty. sources.newest.unknown says the same thing in the slot for the newest post’s day and reads the same in English. Dropped in after the verb, so lower case.',
  },
  newestNone: {
    id: 'sources.newest.none',
    defaultMessage: 'none',
    description:
      'Where the day of the newest post would be, for a feed that answered with an empty channel. Dropped in after “newest”, so lower case and no full stop.',
  },
  newestUnknown: {
    id: 'sources.newest.unknown',
    defaultMessage: 'no answer',
    description:
      'Where the day of the newest post would be, for a feed that did not answer. sources.count.unknown says the same thing in the slot for the number of posts and reads the same in English; they are two entries because one follows a verb and one follows the word “newest”.',
  },

  feedNewest: {
    id: 'sources.feed.newest',
    defaultMessage: 'newest: <f>{newest}</f>',
    description:
      'The second line of the Measured cell on an article feed’s row. {newest} is the day of the newest post in that feed, or sources.newest.none or sources.newest.unknown where the run could not say. The manifest reports the finding and saysNewest() words it, so this hole is filled in the reader’s own language. <f> draws it in monospace so it never wraps.',
  },
  feedRun: {
    id: 'sources.feed.run',
    defaultMessage:
      '{category}. The run of <f>{measured}</f> found {posts}, newest <f>{newest}</f>.',
    description:
      'The first line of an article feed’s detail. {category} is the feed’s category as the manifest writes it and is not translated. {measured} is the ISO day of the last run. {posts} is a number through the formatter or one of sources.count.*, and {newest} a day or one of sources.newest.*; the manifest reports the finding and this page words it. <f> draws a figure in monospace.',
  },
  feedUnmeasured: {
    id: 'sources.feed.unmeasured',
    defaultMessage:
      '<strong>Neither the feed nor its category answered in that run</strong>, so the figures above are unknown rather than zero. What a failed probe found is on its row in <code>apps/workbench/content/sources.measured.ts</code>.',
    description:
      'Printed in an article feed’s detail when the last run reached neither the feed nor the category behind it. <strong> carries the finding and <code> the generated file in this repository, which stays in its own spelling.',
  },
  feedConfigured: {
    id: 'sources.feed.configured',
    defaultMessage: 'Configured in <code>{module}</code>.',
    description:
      'Printed once, in the first article feed’s detail, naming where the seven feeds are configured. {module} is that file’s path in this repository and is not translated. <code> draws it in monospace.',
  },

  readsNone: {
    id: 'sources.reads.none',
    defaultMessage: 'none, no source named',
    description:
      'The Reads from cell of a row with neither an endpoint nor a module: a wanted feature nobody has pointed at anything yet. Lower case, because it completes the column head.',
  },
  standsIn: {
    id: 'sources.standsIn',
    defaultMessage: 'stands in for {what}',
    description:
      'The second line under a row’s name, where a sample file stands in for something real. {what} is what it stands in for, in the manifest’s own words, and is not translated.',
  },
  measuredUsed: {
    id: 'sources.measured.used',
    defaultMessage: '{used} of {available} used',
    description:
      'The Measured cell of a source the app reads only part of. {used} is how many of the thing the app reads and {available} how many exist.',
  },
  measuredReachable: {
    id: 'sources.measured.reachable',
    defaultMessage: 'reachable',
    description:
      'The Measured cell of a source that answered the last run but has no count to report. Lower case, because it completes the column head.',
  },
  measuredSilent: {
    id: 'sources.measured.silent',
    defaultMessage: 'did not answer',
    description:
      'The Measured cell of a source that did not answer the last run. Lower case, because it completes the column head; sources.flag.silent is the same finding as a badge in the Flags column and is capitalised.',
  },
  measuredNothing: {
    id: 'sources.measured.nothing',
    defaultMessage: 'nothing to measure',
    description:
      'The Measured cell of a row the run does not probe at all: a sample file, or a wanted feature. Lower case, because it completes the column head.',
  },

  flagUnused: {
    id: 'sources.flag.unused',
    defaultMessage: 'Unused, {unused} of {available}',
    description:
      'A badge on a row whose source carries more than the app reads. {unused} is how many are not read and {available} how many exist altogether.',
  },
  flagSilent: {
    id: 'sources.flag.silent',
    defaultMessage: 'Did not answer',
    description:
      'A badge on a row whose source did not answer the last run. sources.measured.silent is the same finding in the Measured cell of the same row, in lower case because it completes a column head there.',
  },
  flagInvented: {
    id: 'sources.flag.invented',
    defaultMessage: 'Invented',
    description:
      'A badge on the one sample file that stands in for nothing real: on screen it is a series that does not exist. The manifest’s own note is the finding; this is the word over it.',
  },
  flagMvp: {
    id: 'sources.flag.mvp',
    defaultMessage: 'MVP',
    description:
      'A badge saying this source is wanted for the first release. The three letters are what the team calls that scope out loud and are left as they are.',
  },
  flagNotMvp: {
    id: 'sources.flag.notMvp',
    defaultMessage: 'Not MVP',
    description: 'A badge saying this source is wanted, but not for the first release.',
  },

  eyebrow: {
    id: 'sources.eyebrow',
    defaultMessage: 'CORRECTIV community app · internal documentation',
    description:
      'The small line over the page heading, which says what site this is. decisions.eyebrow is the same line word for word over the decisions board, and the two are separate ids because each page owns its own header.',
  },
  title: {
    id: 'sources.title',
    defaultMessage: 'Sources status board',
    description:
      'The page’s heading. nav.sources is the same three words as the browser tab and the search palette carry for this page; shell.activity.sources is the shorter word the rail has room for.',
  },
  lede: {
    id: 'sources.lede',
    defaultMessage:
      'For every kind of content the app shows: is it live data, sample data standing in for an API that does not exist yet, or a wanted feature with nothing to read.',
    description:
      'The paragraph under the heading, which names the three states the board sorts by.',
  },

  measuredLabel: {
    id: 'sources.measured.label',
    defaultMessage: 'How these figures were measured',
    description:
      'The accessible name of the note under the lede, which is a block a screen reader announces as a group, and the visible label of the ⓘ inside it that opens sources.measured.how.',
  },
  measuredWhen: {
    id: 'sources.measured.when',
    defaultMessage:
      '<strong>Every figure on this page was measured against the live sources on <f>{measured}</f>, {age}.</strong>',
    description:
      'The first line of the note under the lede, always drawn: how fresh the figures are. {measured} is the ISO day of the last run; {age} is how long ago that was, worked out in the reader’s browser by src/lib/measured.ts. <strong> carries the whole line and <f> draws the day in monospace. How the run was taken is sources.measured.how, behind the ⓘ beside it.',
  },
  measuredHow: {
    id: 'sources.measured.how',
    defaultMessage:
      'The run was <code>apps/workbench/scripts/measure-sources.mjs</code> on {where}. {answered} of {probes, plural, one {# source} other {# sources}} answered, with a {seconds}-second timeout and {attempts, plural, one {# attempt} other {# attempts}} each. The browser rendering this page checked nothing and cannot: the RSS feeds send no CORS header, which is why this is a script and not a refresh button.',
    description:
      'Behind the ⓘ in that note, after sources.measured.when says which day. {where} is the machine the run was taken on, in the run’s own words; {answered} is how many sources answered and {probes} how many were tried; {seconds} is the per-request timeout and {attempts} how many tries each source got. <code> draws the script’s path in this repository.',
  },
  measuredStale: {
    id: 'sources.measured.stale',
    defaultMessage:
      'That is more than {days, plural, one {# day} other {# days}} ago, so the weekly run that keeps this page current has not landed in a quarter. The post counts and the newest-post dates below have almost certainly moved.',
    description:
      'Printed in that note only once the last run is old enough to distrust. {days} is the number of days this site treats as the limit, which is a quarter.',
  },
  measuredSilentSome: {
    id: 'sources.measured.silentSome',
    defaultMessage:
      '<strong>{count, plural, one {One source} other {# sources}} did not answer:</strong> {list}. That is a finding and not a failure — nothing in this repository turns a source being down into a red build.',
    description:
      'Printed in that note when at least one source did not answer. {count} is how many, and {list} names each of them with the reason the run recorded, in the script’s own words. They are named rather than merely counted, because “three sources did not answer” reads the same whether three feeds are down or the script probed nothing at all.',
  },
  measuredAllAnswered: {
    id: 'sources.measured.allAnswered',
    defaultMessage: 'Every source answered in that run, so nothing below is an unknown.',
    description: 'Printed in that note in place of the list, when every source answered.',
  },
  measuredNoReason: {
    id: 'sources.measured.noReason',
    defaultMessage: 'no reason recorded',
    description:
      'Stands inside that list where a source is marked as not having answered but the run wrote down no reason for it.',
  },

  showLegend: {
    id: 'sources.show.legend',
    defaultMessage: 'Show which rows',
    description:
      'Read aloud as the group name of the four filter tiles, and never drawn: the heading beside it is what a reader sees.',
  },
  showTitle: {
    id: 'sources.show.title',
    defaultMessage: 'Show',
    description:
      'The heading over the four filter tiles. decisions.show.title is the same word over the tiles of the decisions board.',
  },
  tileAll: {
    id: 'sources.tile.all',
    defaultMessage: 'All rows',
    description:
      'The first filter tile, which switches the state filter off. It is also the tile’s accessible name, because the card as a whole is the control.',
  },
  tileAllNote: {
    id: 'sources.tile.all.note',
    defaultMessage:
      '{rows, plural, one {# row} other {# rows}} over {entries, plural, one {# manifest entry} other {# manifest entries}}, with the article family drawn as its {feeds, plural, one {# feed} other {# feeds}}.',
    description:
      'The line under that tile, which explains why the board has more rows than the manifest has entries. {rows} is how many rows there are, {entries} how many entries the manifest has, and {feeds} how many article feeds the one article entry is drawn as.',
  },
  tileLiveNote: {
    id: 'sources.tile.live.note',
    defaultMessage:
      '{ok} reading as expected, {stale} stale, {broken} broken. The last two are the bad news below.',
    description:
      'The line under the Live tile. {ok} is how many live rows are delivering, {stale} how many have stopped, and {broken} how many point at nothing.',
  },
  tileSampleNote: {
    id: 'sources.tile.sample.note',
    defaultMessage:
      '{count, plural, one {# file} other {# files}} typed in the shape of the API that will replace them. On screen they look like live content.',
    description:
      'The line under the Sample data tile. {count} is how many checked-in files stand in for an API.',
  },
  tileNoSourceNote: {
    id: 'sources.tile.noSource.note',
    defaultMessage:
      '{count, plural, one {# wanted feature} other {# wanted features}} with nothing to read. {mvp} of them are MVP.',
    description:
      'The line under the No source tile. {count} is how many wanted features have no source at all, and {mvp} how many of those are wanted for the first release.',
  },

  findingsTitle: {
    id: 'sources.findings.title',
    defaultMessage: 'Bad news first',
    description: 'The heading over the cards for live feeds that have stopped or point at nothing.',
  },
  findingsLede: {
    id: 'sources.findings.lede',
    defaultMessage:
      'A sample file is honest about what it is. A live feed that has stopped, or points at nothing, is not, because the app presents it as content. {ailing} of the {feeds} article feeds {ailing, plural, one {is} other {are}} in that state.',
    description:
      'The line under that heading. {ailing} is how many article feeds are stale or broken and {feeds} how many there are altogether.',
  },
  findingsFigures: {
    id: 'sources.findings.figures',
    defaultMessage: '{category}: <f>{posts}</f>, newest <f>{newest}</f>.',
    description:
      'The figures on such a card. {category} is the feed’s category as the manifest writes it and is not translated; {posts} is a number through the formatter or one of sources.count.*, and {newest} a day or one of sources.newest.*. <f> draws each figure in monospace.',
  },
  findingsRest: {
    id: 'sources.findings.rest',
    defaultMessage:
      'The other {count, plural, one {# article feed was} other {# article feeds were}} reading as expected in the run of <f>{measured}</f>. A feed can be stale for a good reason, which is what the note on each card is for.',
    description:
      'The line under those cards. {count} is how many article feeds are healthy and {measured} the ISO day of the last run. <f> draws the day in monospace.',
  },
  row: {
    id: 'sources.row',
    defaultMessage: 'Row',
    description:
      'The link on a card down to that source’s row in the table, which it also opens. It is on the finding cards and on the unused cards both. decisions.careful.row is the same word on the decisions board’s cards.',
  },

  gapsTitle: {
    id: 'sources.gaps.title',
    defaultMessage: 'Connected but unused',
    description: 'The heading over the cards for sources the app reaches and reads only part of.',
  },
  gapsLede: {
    id: 'sources.gaps.lede',
    defaultMessage:
      '{count, plural, one {# source is} other {# sources are}} live and reachable, and the app reads a fraction of each. This is neither a broken source nor a missing one. It is a decision nobody has taken.',
    description: 'Behind the ⓘ beside that heading. {count} is how many such sources there are.',
  },
  gapsLegend: {
    id: 'sources.gaps.legend',
    defaultMessage: 'Filled dots are what the app shows.',
    description:
      'The line under that heading, and the legend of the row of small circles on each card, one per thing the source carries.',
  },
  gapUsed: {
    id: 'sources.gap.used',
    defaultMessage: '<big>{used}</big> of <f>{available}</f> used',
    description:
      'The count on such a card. {used} is how many of the thing the app reads and {available} how many exist, or the word for an unknown where the last run could not say. <big> draws the first figure large, <f> the second in monospace.',
  },
  gapUnknown: {
    id: 'sources.gap.unknown',
    defaultMessage: 'unknown',
    description:
      'Stands in for the number of things a source carries, on a card where the last run could not count them. Lower case, because it sits inside a sentence.',
  },

  boardTitle: {
    id: 'sources.board.title',
    defaultMessage: 'The board',
    description:
      'The heading over the table of every source. decisions.board.title is the same two words over the table on the decisions board.',
  },
  boardLede: {
    id: 'sources.board.lede',
    defaultMessage:
      'One row per source, per article feed, or per wanted source. A row expands to its full detail; nothing on this page is truncated. The state tiles above filter the board as well.',
    description: 'The paragraph under that heading, which says what a row holds.',
  },
  filter: {
    id: 'sources.filter',
    defaultMessage: 'Filter rows',
    description:
      'The label over the text field above the table. decisions.filter is the same shape of label over the decisions board’s field and reads “Filter records”.',
  },
  filterPlaceholder: {
    id: 'sources.filter.placeholder',
    defaultMessage: 'name, endpoint, file, question',
    description:
      'The placeholder in that field, naming four of the things the filter reads. It matches a row’s name, its endpoint, its module path, its note and the text of every question it raises.',
  },
  groupBy: {
    id: 'sources.groupBy',
    defaultMessage: 'Group by',
    description:
      'The legend over the two-way switch beside the filter, and drawn: it is the only labelled control in that bar.',
  },
  columnState: {
    id: 'sources.column.state',
    defaultMessage: 'State',
    description:
      'The first column head, over the chip saying whether a row is live, sample or without a source, and the first of the two ways to group the board. shell.section.state is the same word as the name of the preview’s state tool, which is the app’s Redux store rather than a source’s condition.',
  },
  groupByKind: {
    id: 'sources.groupBy.kind',
    defaultMessage: 'Content kind',
    description:
      'The second of the two ways to group the board: by what the source carries rather than by what condition it is in.',
  },
  columnKind: {
    id: 'sources.column.kind',
    defaultMessage: 'Kind',
    description:
      'The second column head, over what the source carries: articles, audio, video and the rest. It is the short form of sources.groupBy.kind, which has room for both words.',
  },
  columnSource: {
    id: 'sources.column.source',
    defaultMessage: 'Source',
    description:
      'The third column head, over the source’s own name and what it stands in for. shell.section.source is the same word as the name of the component view’s tool for where a component is written.',
  },
  columnReads: {
    id: 'sources.column.reads',
    defaultMessage: 'Reads from',
    description:
      'The fourth column head, over the endpoint the app calls and the file that configures it.',
  },
  columnMeasured: {
    id: 'sources.column.measured',
    defaultMessage: 'Measured',
    description:
      'The fifth column head, over what the last run found. The ISO day of that run is drawn under it.',
  },
  columnFlags: {
    id: 'sources.column.flags',
    defaultMessage: 'Flags',
    description:
      'The sixth column head, over the badges a row wears: a finding, a scope, and the questions it raises.',
  },
  only: {
    id: 'sources.only',
    defaultMessage: 'Only rows with a finding: stale, broken, unused, invented',
    description:
      'The checkbox beside the filter field. The four words after the colon are the four findings this board draws, each of which is also a badge or a chip on the row itself.',
  },
  expandAll: {
    id: 'sources.expandAll',
    defaultMessage: 'Expand all',
    description:
      'The button that opens every row’s detail at once. decisions.expandAll is the same two words on the decisions board.',
  },
  collapseAll: {
    id: 'sources.collapseAll',
    defaultMessage: 'Collapse all',
    description:
      'The button that closes every row’s detail at once. decisions.collapseAll is the same two words on the decisions board.',
  },
  showing: {
    id: 'sources.showing',
    defaultMessage: 'Showing {shown} of {total, plural, one {# row} other {# rows}}',
    description:
      'The live count beside the filters. {shown} is how many rows the filters leave and {total} how many rows the board has.',
  },
  caption: {
    id: 'sources.caption',
    defaultMessage:
      'Every content source the app reads, stands in for, or still wants. Figures from the run of <f>{measured}</f>.',
    description:
      'The table’s caption, drawn as a line above it. {measured} is the ISO day of the last run, and <f> draws it in monospace.',
  },
  details: {
    id: 'sources.details',
    defaultMessage: 'Details',
    description:
      'The button at the end of a row that opens its detail, and the name of the column those buttons sit in, which is read aloud and never drawn. decisions.details is the same word on the decisions board.',
  },
  hide: {
    id: 'sources.hide',
    defaultMessage: 'Hide',
    description:
      'What the Details button says while that row’s detail is open. decisions.hide is the same word on the decisions board.',
  },
  rowName: {
    id: 'sources.rowName',
    defaultMessage: ', {name}',
    description:
      'Read aloud after a Details button, which would otherwise announce as the bare word Details thirty times over, and never drawn. {name} is the row’s own name out of the manifest and is not translated. The leading comma is a pause after the visible word.',
  },

  questionsTitle: {
    id: 'sources.questions.title',
    defaultMessage:
      '{count, plural, one {# open editorial question} other {# open editorial questions}}',
    description:
      'The heading over the list of questions this board exists to get answered. {count} is how many there are.',
  },
  questionsLede: {
    id: 'sources.questions.lede',
    defaultMessage:
      'This page exists to get these answered. Each one is raised by a row above, and each row carries its question as a Q chip.',
    description:
      'The line under that heading. “Q chip” is the small badge on a row, whose label is sources.question.chip; a translation that changes the letter there changes it here too.',
  },

  footerLabel: {
    id: 'sources.footer.label',
    defaultMessage: 'Where this board comes from',
    description:
      'The footer’s one visible line, beside an ⓘ that opens the two paragraphs below. decisions.footer.label reads the same in English on the decisions board, which is a different board built out of different files.',
  },
  footerFiles: {
    id: 'sources.footer.files',
    defaultMessage:
      'Two files, and the split is the point. Every row, state and sentence above is read from <code>apps/workbench/content/sources.manifest.ts</code>, which a test checks against the core’s data directory: that is the argument, and it is written by hand. Every count, date and listener figure is read from <code>apps/workbench/content/sources.measured.ts</code>, which is generated and must not be edited.',
    description:
      'The first line of the footer, which says where the board comes from. Both <code> runs are paths in this repository and stay in their own spelling.',
  },
  footerRemeasure: {
    id: 'sources.footer.remeasure',
    defaultMessage:
      'To re-measure, run <code>node apps/workbench/scripts/measure-sources.mjs</code>. <code>.github/workflows/sources.yml</code> runs it weekly and opens a pull request when anything has moved. It reports and never gates: a source that is down, slow or has moved appears on this page and in that run’s summary, and fails nothing.',
    description:
      'The second line of the footer, which says how the figures are re-taken. The first <code> run is a command and the second a path in this repository; both stay in their own spelling.',
  },
});

/**
 * The runs drawn inside this page's sentences, at module scope.
 *
 * Beside the descriptors rather than inside the render, which is the shape
 * `ui/Settings.tsx` already uses: a component built during a render is remounted
 * on every one of them, and `react/no-unstable-nested-components` says so.
 */
const strong = (chunks: ReactNode[]) => (
  <strong className="font-semibold text-on-canvas">{chunks}</strong>
);

const code = (chunks: ReactNode[]) => <code className={CODE}>{chunks}</code>;

/** A measured figure inside a sentence: monospace, tabular, and never wrapped. */
const f = (chunks: ReactNode[]) => <span className={FIGURE}>{chunks}</span>;

/** The used half of an unused card's count, which is the figure the card is about. */
const big = (chunks: ReactNode[]) => (
  <span className={cn(FIGURE, 'text-l font-bold text-on-canvas')}>{chunks}</span>
);

interface StateLook {
  Icon: LucideIcon;
  /** What a reader sees and what a screen reader hears, the same words. */
  label: MessageDescriptor;
  /** The chip, which carries the weight: filled, outlined or dashed. */
  chip: string;
}

/**
 * The five marks, each distinguishable three ways over.
 *
 * The rule this page cannot break: a state is never carried by colour alone. The
 * six status colours the old stylesheet had were exactly what a reader with a
 * colour vision deficiency, or a printer, cannot be relied on to receive. So
 * every mark below has its own icon, its own written label, and its own weight of
 * chip, and the board still reads correctly in greyscale.
 *
 * The colours that remain are the palette's own roles, not values invented here.
 * `packages/design-tokens` decides them and the app consumes the same file, which
 * is why there is nowhere to fork one to. Red is the brand accent and marks the
 * one state that is actively wrong; club yellow marks the one that has merely
 * stopped; the neutral roles carry everything a reader is not meant to be alarmed
 * by. `text-white` on the red and `text-neutral-700` on the yellow are primitives
 * on purpose, because ink on a brand colour must not follow the scheme.
 *
 * The words are descriptors rather than strings, because a chip, the tile that
 * filters for it and the heading of its group in the table all have to say the
 * same thing in whichever language the site is set to, and this table is the one
 * place that decides what that is.
 */
const STATE_LOOK: Record<Mark, StateLook> = {
  live: {
    Icon: CircleDot,
    label: COPY.stateLive,
    /*
     * The one filled neutral, and the only state that gets weight without
     * colour. There is no green in the design tokens, and inventing one would
     * mean forking `tokens/theme.css`, which is kept byte-identical to upstream
     * so that a plain diff detects drift. Colour on this board marks the
     * exceptions, yellow for stale and red for broken, and thirteen green rows
     * would compete with the three that want attention. Inverting the neutral
     * says "this is real" as plainly, in both schemes, with the palette we have.
     */
    chip: 'border-transparent bg-on-canvas text-canvas',
  },
  stale: {
    Icon: CirclePause,
    label: COPY.stateStale,
    chip: 'border-transparent bg-accent-alternative text-neutral-700',
  },
  broken: {
    Icon: OctagonX,
    label: COPY.stateBroken,
    chip: 'border-transparent bg-accent text-white',
  },
  sample: {
    Icon: FlaskConical,
    label: COPY.stateSample,
    chip: 'border-stroke bg-surface text-on-canvas-muted',
  },
  'no-source': {
    Icon: CircleDashed,
    label: COPY.stateNoSource,
    chip: 'border-dashed border-stroke-strong bg-canvas text-on-canvas-muted',
  },
};

function StateMark({ mark, className }: { mark: Mark; className?: string }) {
  const intl = useWorkbenchIntl();
  const look = STATE_LOOK[mark];
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center gap-3xs whitespace-nowrap rounded-full border px-xs py-4xs text-s font-medium',
        look.chip,
        className,
      )}
    >
      <look.Icon aria-hidden="true" className="size-[0.875rem] shrink-0" />
      {intl.formatMessage(look.label)}
    </span>
  );
}

/**
 * The manifest writes endpoints and file names in Markdown's backticks.
 *
 * It has to: the same sentences are read as prose in `SOURCES.md`, which is the
 * document of record. Printing them here as plain text would print the backticks
 * too, so they become the `code` element they were always standing for.
 *
 * Everything this touches is the manifest's own text, which ADR 0052 §4 keeps in
 * its own spelling, so nothing here passes through the catalogue.
 */
function prose(text: string): ReactNode[] {
  const parts = text.split('`');
  // Keyed by where the piece starts in the sentence, which is stable and unique
  // for a string that never changes between renders.
  let offset = 0;
  return parts.map((part, index) => {
    const key = offset;
    offset += part.length + 1;
    return index % 2 === 1 ? (
      <code className={CODE} key={key}>
        {part}
      </code>
    ) : (
      <Fragment key={key}>{part}</Fragment>
    );
  });
}

/** What the app carries, by the manifest's own key for it. */
const KIND_LABELS: Record<Kind, MessageDescriptor> = {
  articles: COPY.kindArticles,
  newsletter: COPY.kindNewsletter,
  search: COPY.kindSearch,
  audio: COPY.kindAudio,
  video: COPY.kindVideo,
  community: COPY.kindCommunity,
  club: COPY.kindClub,
  directory: COPY.kindDirectory,
};

const KIND_ORDER: Kind[] = [
  'articles',
  'newsletter',
  'search',
  'audio',
  'video',
  'community',
  'club',
  'directory',
];

/**
 * The three product states as groups in the table.
 *
 * `label` heads the group and `some` is the same state inside the breakdown a
 * kind-grouped heading carries, where it is a count and a word rather than a
 * name. Two descriptors and not one, because "Live" and "13 live" are one word
 * in English and are a name and a phrase in a language with cases.
 */
const STATE_GROUPS: { key: Status; label: MessageDescriptor; some: MessageDescriptor }[] = [
  { key: 'live', label: COPY.stateLive, some: COPY.groupSomeLive },
  { key: 'sample', label: COPY.groupSampleData, some: COPY.groupSomeSample },
  { key: 'no-source', label: COPY.stateNoSource, some: COPY.groupSomeNoSource },
];

/**
 * The entry every article feed belongs to.
 *
 * `SOURCES` models the seven feeds as one thing, because they are one endpoint
 * read by category id. The board draws one row per feed, because a feed is what
 * stops delivering, and a row that says "articles: live" would hide the two that
 * are not. Found by shape rather than by id, so renaming the entry cannot quietly
 * turn seven rows back into one.
 */
const ARTICLE_FAMILY = SOURCES.find((s) => s.kind === 'articles' && s.status === 'live');

/**
 * Which row each partly-used source in `UNUSED` belongs beside.
 *
 * The manifest names that source in prose ("Castopod shows") and names the same
 * source by id in `SOURCES`, and nothing joins the two. The name is the join.
 * Deriving it beats typing the four pairs out, because a typed pair is a second
 * place to be wrong and the manifest exists so there is only one.
 *
 * What the source is called comes first and its note only after, because a note
 * can name another source: the YouTube entry mentions PeerTube, and a single pass
 * over both hands the PeerTube figures to the YouTube row. A source already
 * claimed is out of the running for the same reason.
 */
const GAP_PAIRS: { gap: Gap; sourceId: string }[] = [];
for (const gap of UNUSED) {
  const word = gap.label.toLowerCase().split(' ')[0];
  const claimed = new Set(GAP_PAIRS.map((pair) => pair.sourceId));
  const live = SOURCES.filter((s) => s.status === 'live' && !claimed.has(s.id));
  const entry =
    live.find((s) => [s.id, s.label, s.endpoint ?? ''].join(' ').toLowerCase().includes(word)) ??
    live.find((s) => s.note.toLowerCase().includes(word));
  if (entry) GAP_PAIRS.push({ gap, sourceId: entry.id });
}
const GAP_BY_SOURCE = new Map(GAP_PAIRS.map((pair) => [pair.sourceId, pair.gap]));
const SOURCE_BY_GAP = new Map(GAP_PAIRS.map((pair) => [pair.gap.label, pair.sourceId]));

interface BoardRow {
  /** The anchor a finding, a gap or a question links to. */
  id: string;
  detailId: string;
  status: Status;
  kind: Kind;
  name: string;
  sub?: string;
  /** Only a live source can have one, and it is what marks the row. */
  severity?: Severity;
  /** Carries a finding: stale, broken, unused or invented. */
  attention: boolean;
  questions: number[];
  reads: ReactNode;
  measured: ReactNode;
  chips: ReactNode;
  detail: ReactNode;
  /** Lower-cased haystack for the text filter. */
  text: string;
}

function questionChips(numbers: number[], intl: IntlShape): ReactNode {
  return numbers.map((n) => (
    <Badge asChild variant="outline" className={CHIP_LINK} key={n}>
      <a href={`#q${n}`}>
        {intl.formatMessage(COPY.questionChip, { n })}
        <span className="sr-only">{intl.formatMessage(COPY.questionChipName, { n })}</span>
      </a>
    </Badge>
  ));
}

function questionLinks(numbers: number[], intl: IntlShape): ReactNode {
  if (numbers.length === 0) return null;
  return (
    <p className="flex flex-wrap gap-sm text-m">
      {numbers.map((n) => (
        <a className={LINK} href={`#q${n}`} key={n}>
          {intl.formatMessage(COPY.questionLink, { n })}
        </a>
      ))}
    </p>
  );
}

/**
 * The questions a single feed raises, out of the ones the family carries.
 *
 * Handing all of the family's questions to all seven feeds would tell a reader
 * that the healthy five raise the Europe question too. A question names the feed
 * it is about, in the same word the manifest uses for that feed, so the naming is
 * the link and no pairing has to be typed here.
 */
function feedQuestions(feed: Feed, family: SourceEntry): number[] {
  const name = (feed.label.split('.').pop() ?? feed.label).toLowerCase();
  return (family.questions ?? []).filter((n) => QUESTIONS[n - 1].toLowerCase().includes(name));
}

function feedRow(feed: Feed, index: number, family: SourceEntry, intl: IntlShape): BoardRow {
  const key = feedId(feed.label);
  const severity: Severity | undefined = feed.health === 'healthy' ? undefined : feed.health;
  const questions = feedQuestions(feed, family);
  const figures = feedFigures(feed);

  return {
    id: `row-${key}`,
    detailId: `det-${key}`,
    status: 'live',
    kind: 'articles',
    name: feed.label,
    sub: feed.category,
    severity,
    attention: severity !== undefined,
    questions,
    reads: <code className={CODE}>{family.endpoint}</code>,
    measured: (
      <>
        <span className={FIGURE}>{saysCount(intl, figures.posts)}</span>
        <span className="block text-s text-on-canvas-muted">
          {intl.formatMessage(COPY.feedNewest, { newest: saysNewest(intl, figures.newest), f })}
        </span>
      </>
    ),
    chips: (
      <>
        {severity && <StateMark mark={severity} />}
        {questionChips(questions, intl)}
      </>
    ),
    detail: (
      <>
        <p>
          {intl.formatMessage(COPY.feedRun, {
            category: feed.category,
            measured: MEASURED_ON,
            posts: saysCount(intl, figures.posts),
            newest: saysNewest(intl, figures.newest),
            f,
          })}
        </p>
        {!figures.measured && <p>{intl.formatMessage(COPY.feedUnmeasured, { strong, code })}</p>}
        {feed.note && <p>{prose(feed.note)}</p>}
        {/* The family note holds for all seven feeds, so it sits on the first, where the group starts. */}
        {index === 0 && <p>{prose(family.note)}</p>}
        {index === 0 && family.module && (
          <p>{intl.formatMessage(COPY.feedConfigured, { module: family.module, code })}</p>
        )}
        {questionLinks(questions, intl)}
      </>
    ),
    text: [
      feed.label,
      feed.category,
      saysCount(intl, figures.posts),
      saysNewest(intl, figures.newest),
      feed.health,
      family.endpoint ?? '',
      family.module ?? '',
      family.note,
      feed.note ?? '',
      ...questions.map((n) => QUESTIONS[n - 1]),
      'articles',
    ]
      .join(' ')
      .toLowerCase(),
  };
}

function readsCell(entry: SourceEntry, intl: IntlShape): ReactNode {
  if (entry.endpoint) {
    return (
      <>
        <code className={CODE}>{entry.endpoint}</code>
        {entry.module && (
          <span className="mt-3xs block">
            <code className={CODE}>{entry.module}</code>
          </span>
        )}
      </>
    );
  }
  if (entry.module) return <code className={CODE}>{entry.module}</code>;
  return <span className="text-on-canvas-muted">{intl.formatMessage(COPY.readsNone)}</span>;
}

function sourceRow(entry: SourceEntry, intl: IntlShape): BoardRow {
  const gap = GAP_BY_SOURCE.get(entry.id);
  /*
   * How many of the thing exist, and `undefined` when the last run could not say.
   * Drawn as "unknown" rather than as zero: a source that did not answer and a
   * source with nothing on it are different findings, and a dot chart of length
   * zero would state the second while meaning the first.
   */
  const available = gap ? gapAvailable(gap) : undefined;
  const probe = entry.probe ? PROBES.get(entry.probe) : undefined;
  // The one sample that stands in for nothing real says so in its own note, and
  // that sentence is the whole finding: on screen it is a series that does not exist.
  const invented = entry.status === 'sample' && /\binvents\b/i.test(entry.note);
  const questions = entry.questions ?? [];

  return {
    id: `row-${entry.id}`,
    detailId: `det-${entry.id}`,
    status: entry.status,
    kind: entry.kind,
    name: entry.label,
    sub: entry.standsIn ? intl.formatMessage(COPY.standsIn, { what: entry.standsIn }) : undefined,
    attention: gap !== undefined || invented,
    questions,
    reads: readsCell(entry, intl),
    measured:
      gap && available !== undefined ? (
        <span className={FIGURE}>
          {intl.formatMessage(COPY.measuredUsed, { used: gap.used, available })}
        </span>
      ) : probe?.ok === true && probe.posts !== undefined ? (
        // `intl.formatNumber` and not `toLocaleString('en-GB')`: the grouping
        // separator belongs to the reader's language, and this page has two.
        <span className={FIGURE}>{intl.formatNumber(probe.posts)}</span>
      ) : probe !== undefined ? (
        <span className="text-on-canvas-muted">
          {intl.formatMessage(probe.ok ? COPY.measuredReachable : COPY.measuredSilent)}
        </span>
      ) : (
        <span className="text-on-canvas-muted">{intl.formatMessage(COPY.measuredNothing)}</span>
      ),
    chips: (
      <>
        {gap && available !== undefined && (
          <Badge variant="outline">
            <CircleSlash2 aria-hidden="true" className="size-[0.875rem] shrink-0" />
            {intl.formatMessage(COPY.flagUnused, { unused: available - gap.used, available })}
          </Badge>
        )}
        {probe?.ok === false && (
          <Badge variant="outline">
            <OctagonX aria-hidden="true" className="size-[0.875rem] shrink-0" />
            {intl.formatMessage(COPY.flagSilent)}
          </Badge>
        )}
        {invented && (
          <Badge>
            <Sparkles aria-hidden="true" className="size-[0.875rem] shrink-0" />
            {intl.formatMessage(COPY.flagInvented)}
          </Badge>
        )}
        {entry.mvp !== undefined && (
          <Badge variant={entry.mvp ? 'default' : 'outline'}>
            {intl.formatMessage(entry.mvp ? COPY.flagMvp : COPY.flagNotMvp)}
          </Badge>
        )}
        {questionChips(questions, intl)}
      </>
    ),
    detail: (
      <>
        <p>{prose(entry.note)}</p>
        {gap && <p>{prose(gap.note)}</p>}
        {questionLinks(questions, intl)}
      </>
    ),
    text: [
      entry.id,
      entry.label,
      entry.kind,
      entry.status,
      entry.endpoint ?? '',
      entry.module ?? '',
      entry.standsIn ?? '',
      entry.note,
      gap?.note ?? '',
      gap ? 'unused' : '',
      invented ? 'invented' : '',
      entry.mvp ? 'mvp' : '',
      ...questions.map((n) => QUESTIONS[n - 1]),
    ]
      .join(' ')
      .toLowerCase(),
  };
}

/** What did not answer in the run this page is built from, named rather than counted. */
const SILENT = MEASURED.probes.filter((probe) => !probe.ok);
const ANSWERED = MEASURED.probes.length - SILENT.length;
const AILING = FEEDS.filter((feed) => feed.health !== 'healthy');
const MVP_WANTED = SOURCES.filter((s) => s.status === 'no-source' && s.mvp).length;

/** The mark a row wears: its health if it has one, otherwise its state. */
function markOf(row: BoardRow): Mark {
  return row.severity ?? row.status;
}

/** The count beside a group heading, and, when grouping by kind, what it is made of. */
function groupMeta(members: BoardRow[], shown: BoardRow[], by: GroupBy, intl: IntlShape): string {
  const base =
    shown.length === members.length
      ? intl.formatMessage(COPY.groupRows, { count: members.length })
      : intl.formatMessage(COPY.groupRowsOf, { shown: shown.length, total: members.length });
  if (by === 'state' || shown.length === 0) return base;

  const parts = STATE_GROUPS.map((group) => ({
    n: shown.filter((row) => row.status === group.key).length,
    some: group.some,
  }))
    .filter((part) => part.n > 0)
    .map((part) => intl.formatMessage(part.some, { count: part.n }));
  return `${base} · ${parts.join(', ')}`;
}

interface TileProps {
  value: 'all' | Status;
  /** Repeats the heading word for word, so what is heard and what is read agree. */
  name: string;
  count: number;
  checked: boolean;
  onSelect: () => void;
  mark?: Mark;
  children: ReactNode;
}

/**
 * One filter tile, which is a radio wearing a card.
 *
 * The label is the whole card, so the `aria-label` is doing real work: without it
 * the radio would announce as its own count and its own three-clause summary,
 * which is a paragraph where a name belongs. The figures stay on screen as
 * evidence for a reader who can see them.
 */
function Tile({ value, name, count, checked, onSelect, mark, children }: TileProps) {
  return (
    <label className="min-w-0" aria-label={name}>
      <input
        type="radio"
        name="state"
        value={value}
        checked={checked}
        onChange={onSelect}
        className="peer sr-only"
      />
      <span
        className={cn(
          'flex h-full cursor-pointer flex-col gap-2xs rounded-md border p-s transition-colors',
          'peer-focus-visible:ring-2 peer-focus-visible:ring-accent',
          checked ? 'border-accent bg-surface' : 'border-stroke bg-canvas hover:bg-surface',
        )}
      >
        <span className="flex items-center gap-xs">
          {mark ? (
            <StateMark mark={mark} />
          ) : (
            <span className="text-m font-medium text-on-canvas">{name}</span>
          )}
        </span>
        <span
          aria-hidden="true"
          className={cn(
            'text-headline-xxl leading-tighter tabular-nums',
            checked ? 'font-bold text-on-canvas' : 'font-semibold text-on-canvas-muted',
          )}
        >
          {count}
        </span>
        <span className="text-s leading-normal text-on-canvas-muted">{children}</span>
      </span>
    </label>
  );
}

/**
 * The sources status board: what the app reads, what it stands in for, what it wants.
 *
 * Every figure, row, flag and question on the page is read out of
 * `content/sources.manifest.ts`, which a test checks against the core's data
 * directory. Nothing here is typed twice, because the failure this page exists to
 * prevent is the one where the website and the code quietly disagree and the
 * website is the confident one.
 *
 * The board draws more rows than manifest entries: the article feeds each get
 * their own row, since a feed is the thing that goes stale, and one row
 * reading "articles: live" would hide the two that have stopped.
 *
 * Filtering is React state rather than a class on the DOM, so the group counts,
 * the row count and the disclosures cannot drift out of step with what is on
 * screen. The one behaviour worth naming: following a link into a row clears
 * whichever filter would have hidden it, because a link that lands on nothing is
 * worse than no link.
 *
 * **The rows are built here and no longer at module scope.** A cell holds this
 * site's own words as well as the manifest's, so building one needs the
 * formatter, and the formatter is a hook. The work is the same work, done once
 * per language rather than once per module load.
 */
/**
 * The run's finding for a feed, in words.
 *
 * `content/sources.manifest.ts` hands out the finding and not the sentence. A
 * count goes through the formatter, so its digits are grouped the way the
 * reader's language groups them and not the way a locale pinned in a ledger
 * grouped them; the other three answers are words and are messages. That file's
 * own header carries the measurement and what it is and is not a fact about.
 */
function saysCount(intl: IntlShape, count: FeedCount): string {
  // A switch and not a fall-through, so that a fifth kind is a typecheck error
  // here rather than a row silently reading „keine Antwort“.
  switch (count.kind) {
    case 'count':
      return intl.formatNumber(count.posts);
    case 'everyPost':
      return intl.formatMessage(COPY.countEveryPost);
    case 'none':
      return intl.formatMessage(COPY.countNone);
    case 'unknown':
      return intl.formatMessage(COPY.countUnknown);
  }
}

/**
 * The same for the day of the newest post, which is a day or one of two words.
 *
 * Its own two ids rather than the count's, because the slots are different
 * sentences: one follows a verb and one follows the word "newest". Sharing them
 * gave "The run found unknown", which is not a sentence in either language.
 */
function saysNewest(intl: IntlShape, newest: FeedNewest): string {
  switch (newest.kind) {
    case 'day':
      return newest.day;
    case 'none':
      return intl.formatMessage(COPY.newestNone);
    case 'unknown':
      return intl.formatMessage(COPY.newestUnknown);
  }
}

export function Sources() {
  const intl = useWorkbenchIntl();
  const [stateFilter, setStateFilter] = useState<'all' | Status>('all');
  const [query, setQuery] = useState('');
  const [attentionOnly, setAttentionOnly] = useState(false);
  const [groupBy, setGroupBy] = useState<GroupBy>('state');
  const [open, setOpen] = useState<ReadonlySet<string>>(() => new Set());
  const sections = useSections('/sources', true);

  /** Every row on the board, in the manifest's own order, with the feeds spread in place. */
  const { rows, byId, liveRows } = useMemo(() => {
    const built: BoardRow[] = SOURCES.flatMap((entry) =>
      entry === ARTICLE_FAMILY
        ? FEEDS.map((feed, index) => feedRow(feed, index, entry, intl))
        : [sourceRow(entry, intl)],
    );
    return {
      rows: built,
      byId: new Map(built.map((row) => [row.id, row])),
      liveRows: built.filter((row) => row.status === 'live').length,
    };
  }, [intl]);

  const revealRow = useCallback(
    (rowId: string) => {
      const row = byId.get(rowId);
      if (!row) return;

      setOpen((current) => new Set(current).add(rowId));
      // Each filter is cleared only if it is the one hiding the target, so a reader
      // who arrives by link keeps as much of their own view as still shows the row.
      setStateFilter((current) => (current === 'all' || current === row.status ? current : 'all'));
      setAttentionOnly((current) => (current && !row.attention ? false : current));
      setQuery((current) =>
        current.trim() === '' || row.text.includes(current.trim().toLowerCase()) ? current : '',
      );
    },
    [byId],
  );

  // A reader can arrive on a row anchor from another page, or from a reload.
  useEffect(() => {
    const hash = window.location.hash;
    if (hash.startsWith('#row-')) revealRow(hash.slice(1));
  }, [revealRow]);

  const toggle = (rowId: string) =>
    setOpen((current) => {
      const next = new Set(current);
      if (!next.delete(rowId)) next.add(rowId);
      return next;
    });

  const needle = query.trim().toLowerCase();
  const visible = rows.filter((row) => {
    if (stateFilter !== 'all' && row.status !== stateFilter) return false;
    if (attentionOnly && !row.attention) return false;
    if (needle !== '' && !row.text.includes(needle)) return false;
    return true;
  });
  const visibleIds = new Set(visible.map((row) => row.id));

  const groups: { key: string; label: string }[] =
    groupBy === 'state'
      ? STATE_GROUPS.map((group) => ({
          key: group.key,
          label: intl.formatMessage(group.label),
        }))
      : KIND_ORDER.map((kind) => ({ key: kind, label: intl.formatMessage(KIND_LABELS[kind]) }));

  return (
    <>
      <Slot id="contents">
        <Toc headings={sections} />
      </Slot>

      <Page className="text-m">
        {/* No cap of its own any more: the page shell is the column, and the board
          is seven columns wide with a file path in one of them. Prose inside
          still takes `max-w-content`, so nothing here is read at this width. */}
        <div className="flex min-w-0 flex-col gap-2xl">
          <header className="min-w-0">
            <p className="text-s uppercase tracking-wider text-on-canvas-muted">
              {intl.formatMessage(COPY.eyebrow)}
            </p>
            {/* `hyphens-auto`, because German compounds a heading into one word and
                the largest type on the site has no room for it: „Entscheidungs-
                protokolle" is 23 characters and pushed the whole page sideways at
                500px, measured on 2026-09-18, where the English wrapped and did
                not. The browser hyphenates by `<html lang>`, which `i18n/language.ts`
                keeps on the language being rendered, so this works because that does.
                `break-words` is the fallback for a language it has no patterns for. */}
            <h1 className="mt-2xs text-headline-xxl font-bold leading-tight tracking-tight hyphens-auto break-words">
              {intl.formatMessage(COPY.title)}
            </h1>
            <p className="mt-s max-w-content text-l leading-normal text-on-canvas-muted">
              {intl.formatMessage(COPY.lede)}
            </p>

            <div
              role="note"
              aria-label={intl.formatMessage(COPY.measuredLabel)}
              className="mt-m max-w-content space-y-xs rounded-md border border-stroke border-l-2 border-l-accent bg-surface p-sm text-m text-on-canvas-muted"
            >
              {/*
              The day of the run and how long ago it was stay on the page: they are how
              fresh everything below is, and the day comes out of `sources.measured.ts`
              rather than being typed anywhere. How the run was taken is background and
              waits behind the ⓘ. What else stays is what a reader acts on: a run too old
              to trust, and the sources that did not answer.
            */}
              <p>
                {/* `intl.formatMessage` and never `<FormattedMessage>`: that
                    component reads react-intl's own context, which the app's
                    provider shadows inside an `AppHost`. `test/i18n.test.ts`
                    fails on one, and `i18n/Localisation.tsx` carries the
                    measurement. */}
                {intl.formatMessage(COPY.measuredWhen, {
                  measured: MEASURED_ON,
                  age: ageInWords(intl, MEASURED_ON),
                  strong,
                  f,
                })}
              </p>
              <InfoTip about={intl.formatMessage(COPY.measuredLabel)} showLabel>
                <p>
                  {intl.formatMessage(COPY.measuredHow, {
                    where: MEASURED.where,
                    answered: ANSWERED,
                    probes: MEASURED.probes.length,
                    seconds: MEASURED.timeoutMs / 1000,
                    attempts: MEASURED.attempts,
                    code,
                  })}
                </p>
              </InfoTip>
              {/*
              The age is worked out in the browser, not at build time. This page is
              published and then sits there, and a figure nobody has questioned for
              a quarter looks exactly like one taken this morning.
            */}
              {isStale(MEASURED_ON) && (
                <p className="font-semibold text-on-canvas">
                  {intl.formatMessage(COPY.measuredStale, { days: STALE_AFTER_DAYS })}
                </p>
              )}
              {/*
              Named, never merely counted. A note that says "three sources did not
              answer" is the same sentence whether three feeds are down or the
              script probed nothing at all, and the second is the failure worth
              seeing.
            */}
              {SILENT.length > 0 ? (
                <p>
                  {intl.formatMessage(COPY.measuredSilentSome, {
                    count: SILENT.length,
                    list: SILENT.map(
                      (probe) =>
                        `${probe.id} (${probe.reason ?? intl.formatMessage(COPY.measuredNoReason)})`,
                    ).join('; '),
                    strong,
                  })}
                </p>
              ) : (
                <p>{intl.formatMessage(COPY.measuredAllAnswered)}</p>
              )}
            </div>
          </header>

          {/*
          A heading beside the legend, not instead of it. The legend names the
          group for the browser and the group needs one; the heading is what puts
          this block in the outline, which it was not in while it was painted at
          heading size and was not a heading.
        */}
          <fieldset className="min-w-0" aria-labelledby="h-show">
            <legend className="sr-only">{intl.formatMessage(COPY.showLegend)}</legend>
            <h2 id="h-show" className={SECTION_HEAD}>
              {intl.formatMessage(COPY.showTitle)}
            </h2>
            <div className="mt-s grid gap-xs sm:grid-cols-2 xl:grid-cols-4">
              <Tile
                value="all"
                name={intl.formatMessage(COPY.tileAll)}
                count={rows.length}
                checked={stateFilter === 'all'}
                onSelect={() => setStateFilter('all')}
              >
                {intl.formatMessage(COPY.tileAllNote, {
                  rows: rows.length,
                  entries: SOURCES.length,
                  feeds: FEEDS.length,
                })}
              </Tile>

              <Tile
                value="live"
                name={intl.formatMessage(COPY.stateLive)}
                mark="live"
                count={liveRows}
                checked={stateFilter === 'live'}
                onSelect={() => setStateFilter('live')}
              >
                {intl.formatMessage(COPY.tileLiveNote, {
                  ok: liveRows - COUNTS.stale - COUNTS.broken,
                  stale: COUNTS.stale,
                  broken: COUNTS.broken,
                })}
              </Tile>

              <Tile
                value="sample"
                name={intl.formatMessage(COPY.groupSampleData)}
                mark="sample"
                count={COUNTS.sample}
                checked={stateFilter === 'sample'}
                onSelect={() => setStateFilter('sample')}
              >
                {intl.formatMessage(COPY.tileSampleNote, { count: COUNTS.sample })}
              </Tile>

              <Tile
                value="no-source"
                name={intl.formatMessage(COPY.stateNoSource)}
                mark="no-source"
                count={COUNTS.noSource}
                checked={stateFilter === 'no-source'}
                onSelect={() => setStateFilter('no-source')}
              >
                {intl.formatMessage(COPY.tileNoSourceNote, {
                  count: COUNTS.noSource,
                  mvp: MVP_WANTED,
                })}
              </Tile>
            </div>
          </fieldset>

          <section className="min-w-0" aria-labelledby="h-findings">
            <div className={HEAD_ROW}>
              <h2 id="h-findings" className={SECTION_HEAD}>
                {intl.formatMessage(COPY.findingsTitle)}
              </h2>
              <InfoTip about={intl.formatMessage(COPY.findingsTitle)}>
                <p>
                  {intl.formatMessage(COPY.findingsLede, {
                    ailing: AILING.length,
                    feeds: FEEDS.length,
                  })}
                </p>
              </InfoTip>
            </div>

            <ul className="mt-s grid gap-xs lg:grid-cols-3">
              {AILING.map((feed) => {
                const rowId = `row-${feedId(feed.label)}`;
                const row = byId.get(rowId);
                const severity: Severity = feed.health === 'broken' ? 'broken' : 'stale';
                return (
                  <li
                    key={feed.label}
                    className={cn(
                      'flex min-w-0 flex-col gap-xs rounded-md border border-stroke border-l-2 bg-surface p-sm',
                      severity === 'broken' ? 'border-l-accent' : 'border-l-accent-alternative',
                    )}
                  >
                    <p className="flex flex-wrap items-center gap-xs">
                      <StateMark mark={severity} />
                      {/* The feed's own name, out of the manifest. */}
                      <span className="font-semibold text-on-canvas">{feed.label}</span>
                    </p>
                    <p className="text-m text-on-canvas-muted">
                      {intl.formatMessage(COPY.findingsFigures, {
                        category: feed.category,
                        posts: saysCount(intl, feedFigures(feed).posts),
                        newest: saysNewest(intl, feedFigures(feed).newest),
                        f,
                      })}
                    </p>
                    {feed.note && <p className="text-m text-on-canvas-muted">{prose(feed.note)}</p>}
                    <p className="mt-auto flex flex-wrap gap-sm pt-2xs text-m">
                      {row && (
                        <a className={LINK} href={`#${rowId}`} onClick={() => revealRow(rowId)}>
                          {intl.formatMessage(COPY.row)}
                        </a>
                      )}
                      {(row?.questions ?? []).map((n) => (
                        <a className={LINK} href={`#q${n}`} key={n}>
                          {intl.formatMessage(COPY.questionLink, { n })}
                        </a>
                      ))}
                    </p>
                  </li>
                );
              })}
            </ul>

            <p className="mt-s max-w-content text-m text-on-canvas-muted">
              {intl.formatMessage(COPY.findingsRest, {
                count: FEEDS.length - AILING.length,
                measured: MEASURED_ON,
                f,
              })}
            </p>
          </section>

          <section className="min-w-0" aria-labelledby="h-gaps">
            <div className={HEAD_ROW}>
              <h2 id="h-gaps" className={SECTION_HEAD}>
                {intl.formatMessage(COPY.gapsTitle)}
              </h2>
              <InfoTip about={intl.formatMessage(COPY.gapsTitle)}>
                <p>{intl.formatMessage(COPY.gapsLede, { count: UNUSED.length })}</p>
              </InfoTip>
            </div>
            {/* The one sentence of the old lede a reader needs to read the cards at all. */}
            <p className={SECTION_LEDE}>{intl.formatMessage(COPY.gapsLegend)}</p>

            <ul className="mt-s grid gap-xs sm:grid-cols-2 xl:grid-cols-4">
              {UNUSED.map((gap) => {
                const sourceId = SOURCE_BY_GAP.get(gap.label);
                const available = gapAvailable(gap);
                return (
                  <li
                    key={gap.label}
                    className="flex min-w-0 flex-col gap-2xs rounded-md border border-stroke bg-surface p-sm"
                  >
                    {/* The gap's own label, out of the manifest. */}
                    <p className="font-semibold text-on-canvas">{gap.label}</p>
                    <p className="text-m text-on-canvas-muted">
                      {intl.formatMessage(COPY.gapUsed, {
                        used: gap.used,
                        available: available ?? intl.formatMessage(COPY.gapUnknown),
                        big,
                        f,
                      })}
                    </p>
                    {available !== undefined && (
                      <div className="flex flex-wrap gap-3xs py-3xs" aria-hidden="true">
                        {Array.from({ length: available }, (_, index) => (
                          <span
                            key={index}
                            className={cn(
                              'size-[0.5rem] rounded-full border',
                              index < gap.used
                                ? 'border-on-canvas bg-on-canvas'
                                : 'border-stroke-strong bg-canvas',
                            )}
                          />
                        ))}
                      </div>
                    )}
                    <p className="text-s leading-normal text-on-canvas-muted">
                      {prose(gap.note)}
                      {sourceId && (
                        <>
                          {' '}
                          <a
                            className={LINK}
                            href={`#row-${sourceId}`}
                            onClick={() => revealRow(`row-${sourceId}`)}
                          >
                            {intl.formatMessage(COPY.row)}
                          </a>
                        </>
                      )}
                    </p>
                  </li>
                );
              })}
            </ul>
          </section>

          <section className="min-w-0" aria-labelledby="h-board">
            <div className={HEAD_ROW}>
              <h2 id="h-board" className={SECTION_HEAD}>
                {intl.formatMessage(COPY.boardTitle)}
              </h2>
              <InfoTip about={intl.formatMessage(COPY.boardTitle)}>
                <p>{intl.formatMessage(COPY.boardLede)}</p>
              </InfoTip>
            </div>

            <div className="mt-s flex flex-wrap items-end gap-sm rounded-md border border-stroke bg-surface p-s">
              <div className="min-w-0 flex-1 basis-[16rem]">
                <label
                  htmlFor="sources-query"
                  className="mb-3xs block text-s font-medium text-on-canvas-muted"
                >
                  {intl.formatMessage(COPY.filter)}
                </label>
                <input
                  type="search"
                  id="sources-query"
                  placeholder={intl.formatMessage(COPY.filterPlaceholder)}
                  autoComplete="off"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  className="h-[2.25rem] w-full rounded-md border border-stroke bg-canvas px-xs text-m text-on-canvas placeholder:text-on-canvas-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                />
              </div>

              <Segmented
                name="group"
                legend={intl.formatMessage(COPY.groupBy)}
                showLegend
                className="min-w-0"
                value={groupBy}
                options={[
                  { value: 'state', label: intl.formatMessage(COPY.columnState) },
                  { value: 'kind', label: intl.formatMessage(COPY.groupByKind) },
                ]}
                onChange={(value) => setGroupBy(value as GroupBy)}
              />

              <label className="flex items-center gap-xs text-m text-on-canvas-muted">
                <input
                  type="checkbox"
                  checked={attentionOnly}
                  onChange={(event) => setAttentionOnly(event.target.checked)}
                  className="size-[1rem] accent-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                />
                {intl.formatMessage(COPY.only)}
              </label>

              <div className="flex items-center gap-2xs">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setOpen(new Set(rows.map((row) => row.id)))}
                >
                  {intl.formatMessage(COPY.expandAll)}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setOpen(new Set())}
                >
                  {intl.formatMessage(COPY.collapseAll)}
                </Button>
              </div>

              <output className="text-m tabular-nums text-on-canvas-muted">
                {intl.formatMessage(COPY.showing, { shown: visible.length, total: rows.length })}
              </output>
            </div>

            {/*
            The board is wider than the rail leaves, so it scrolls inside this box.
            Two classes here are load-bearing and neither is obvious.

            `min-w-0`, on this box and on every ancestor up to `main`: a flex child
            refuses to shrink below its content without it, which is the fault that
            made this page scroll sideways before.

            `relative`, because the cells hold `sr-only` spans, which are absolutely
            positioned, and with no positioned ancestor their containing block is
            the page: they sit at their static position hundreds of pixels into a
            table this box clips, and although the table is clipped the spans are
            not. The page then scrolls sideways by their reach with nothing visible
            out there. Measured at a 1024px window: the box scrolled its 936px table
            inside 719px correctly and the window still scrolled 105px. This is the
            second time that has happened here, and `relative` on the box is what
            stops it: a positioned ancestor is what the spans then resolve against.
          */}
            <div className="relative mt-s min-w-0 overflow-x-auto rounded-md border border-stroke">
              {/*
                `min-w-[70rem]`, raised from `44rem` for issue #173, the sibling of
                the bug this file's own comment measured above: the table's content
                minimum was already 936px, past `44rem` (704px), so that class did
                nothing and every column, "Reads from" included, sat on its own
                minimum rather than the widths declared below. A row wrapped its
                module path across several lines and grew past 129px tall, mostly
                scrolled out of this box at a narrow window, which reads as an
                empty row rather than a wrapped one. `70rem` matches the table's
                own preferred width — what it already draws at a window wide
                enough to give it room — so a row is 84.5px tall at every width
                measured, narrow included, and the box above is what scrolls.

                A German column head is longer than an English one, and this width
                is the table's own preferred width rather than a sum of its
                columns, so the one declared width below still applies and the box
                still scrolls.
              */}
              <table className="w-full min-w-[70rem] border-collapse text-left">
                <caption className="border-b border-stroke bg-surface px-s py-xs text-left text-s text-on-canvas-muted">
                  {intl.formatMessage(COPY.caption, { measured: MEASURED_ON, f })}
                </caption>
                <thead>
                  <tr className="border-b border-stroke-strong">
                    {/* The width on "Reads from" is a preference, not a rule: auto
                      table layout honours it only where there is room. It is here
                      because that column holds the module paths, and without it
                      the spare width lands on the source names and the paths break
                      mid-word. */}
                    {[
                      { head: COPY.columnState },
                      { head: COPY.columnKind },
                      { head: COPY.columnSource },
                      { head: COPY.columnReads, width: 'w-[17rem]' },
                    ].map((column) => (
                      <th
                        key={column.head.id}
                        scope="col"
                        className={cn(
                          'px-s py-xs text-s font-semibold uppercase tracking-wider text-on-canvas-muted',
                          column.width,
                        )}
                      >
                        {intl.formatMessage(column.head)}
                      </th>
                    ))}
                    <th
                      scope="col"
                      className="px-s py-xs text-s font-semibold uppercase tracking-wider text-on-canvas-muted"
                    >
                      {intl.formatMessage(COPY.columnMeasured)}
                      <span className={cn(FIGURE, 'block font-normal normal-case')}>
                        {MEASURED_ON}
                      </span>
                    </th>
                    <th
                      scope="col"
                      className="px-s py-xs text-s font-semibold uppercase tracking-wider text-on-canvas-muted"
                    >
                      {intl.formatMessage(COPY.columnFlags)}
                    </th>
                    <th scope="col" className="px-s py-xs">
                      <span className="sr-only">{intl.formatMessage(COPY.details)}</span>
                    </th>
                  </tr>
                </thead>

                {groups.map((group) => {
                  const members = rows.filter(
                    (row) => (groupBy === 'state' ? row.status : row.kind) === group.key,
                  );
                  if (members.length === 0) return null;
                  const shown = members.filter((row) => visibleIds.has(row.id));

                  return (
                    <tbody key={group.key} hidden={shown.length === 0}>
                      <tr>
                        <th
                          scope="rowgroup"
                          colSpan={7}
                          className="border-y border-stroke bg-surface px-s py-2xs text-m font-semibold text-on-canvas"
                        >
                          {group.label}
                          <span className="ml-xs font-normal text-s text-on-canvas-muted">
                            {groupMeta(members, shown, groupBy, intl)}
                          </span>
                        </th>
                      </tr>
                      {members.map((row) => {
                        const isVisible = visibleIds.has(row.id);
                        const isOpen = open.has(row.id);
                        return (
                          <Fragment key={row.id}>
                            <tr
                              id={row.id}
                              hidden={!isVisible}
                              className={cn(
                                'align-top target:bg-surface',
                                isOpen ? 'bg-surface' : 'border-b border-stroke',
                              )}
                            >
                              <td
                                className={cn(
                                  'px-s py-xs border-l-2',
                                  row.severity === 'broken'
                                    ? 'border-l-accent'
                                    : row.severity === 'stale'
                                      ? 'border-l-accent-alternative'
                                      : 'border-l-transparent',
                                )}
                              >
                                <StateMark mark={markOf(row)} />
                              </td>
                              <td className="whitespace-nowrap px-s py-xs text-m text-on-canvas-muted">
                                {intl.formatMessage(KIND_LABELS[row.kind])}
                              </td>
                              <td className="min-w-0 px-s py-xs">
                                <span className="block font-medium text-on-canvas">{row.name}</span>
                                {row.sub && (
                                  <span className="block text-s text-on-canvas-muted">
                                    {row.sub}
                                  </span>
                                )}
                              </td>
                              <td className="min-w-0 px-s py-xs">{row.reads}</td>
                              <td className="px-s py-xs">{row.measured}</td>
                              <td className="px-s py-xs">
                                <div className="flex flex-wrap items-center gap-2xs">
                                  {row.chips}
                                </div>
                              </td>
                              <td className="px-s py-xs text-right">
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  aria-expanded={isOpen}
                                  aria-controls={row.detailId}
                                  onClick={() => toggle(row.id)}
                                >
                                  {intl.formatMessage(isOpen ? COPY.hide : COPY.details)}
                                  {/* Thirty of these on the page, and a reader
                                    listing its controls heard "Details" thirty
                                    times. The row's own name is what tells them
                                    apart, so it goes in the accessible name and
                                    stays out of the visible one. */}
                                  <span className="sr-only">
                                    {intl.formatMessage(COPY.rowName, { name: row.name })}
                                  </span>
                                </Button>
                              </td>
                            </tr>
                            <tr
                              id={row.detailId}
                              hidden={!isVisible || !isOpen}
                              className="border-b border-stroke bg-surface"
                            >
                              <td colSpan={7} className="px-s pb-sm pt-0">
                                <div className="max-w-content space-y-xs text-m leading-normal text-on-canvas-muted">
                                  {row.detail}
                                </div>
                              </td>
                            </tr>
                          </Fragment>
                        );
                      })}
                    </tbody>
                  );
                })}
              </table>
            </div>
          </section>

          <section className="min-w-0" aria-labelledby="h-questions">
            <div className={HEAD_ROW}>
              <h2 id="h-questions" className={SECTION_HEAD}>
                {intl.formatMessage(COPY.questionsTitle, { count: COUNTS.questions })}
              </h2>
              <InfoTip about={intl.formatMessage(COPY.questionsTitle, { count: COUNTS.questions })}>
                <p>{intl.formatMessage(COPY.questionsLede)}</p>
              </InfoTip>
            </div>

            <ol className="mt-s space-y-xs">
              {QUESTIONS.map((question, index) => {
                const n = index + 1;
                const raisedBy = rows.filter((row) => row.questions.includes(n));
                return (
                  <li
                    id={`q${n}`}
                    key={question}
                    className="flex min-w-0 gap-s rounded-md border border-stroke bg-surface p-sm target:border-accent"
                  >
                    <span
                      className={cn(
                        FIGURE,
                        'flex size-[1.75rem] shrink-0 items-center justify-center rounded-full border border-stroke-strong text-s font-semibold text-on-canvas',
                      )}
                    >
                      {intl.formatMessage(COPY.questionChip, { n })}
                    </span>
                    <div className="min-w-0">
                      {/* The question itself, out of the manifest. ADR 0052 §4
                          names these as the case against its own exception and
                          leaves them English for now. */}
                      <p className="text-m leading-normal text-on-canvas">{prose(question)}</p>
                      <p className="mt-2xs flex flex-wrap gap-sm text-m">
                        {raisedBy.map((row) => (
                          <a
                            className={LINK}
                            href={`#${row.id}`}
                            key={row.id}
                            onClick={() => revealRow(row.id)}
                          >
                            {row.name}
                          </a>
                        ))}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ol>
          </section>

          <footer className="min-w-0 border-t border-stroke pt-sm">
            <InfoTip about={intl.formatMessage(COPY.footerLabel)} showLabel side="top">
              <p>{intl.formatMessage(COPY.footerFiles, { code })}</p>
              <p>{intl.formatMessage(COPY.footerRemeasure, { code })}</p>
            </InfoTip>
          </footer>
        </div>
      </Page>
    </>
  );
}
