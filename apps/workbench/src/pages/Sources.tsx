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
import { Fragment, useCallback, useEffect, useState } from 'react';
import type { ReactNode } from 'react';

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
import type { Feed, Gap, Kind, SourceEntry, Status } from '../../content/sources.manifest';
import { Badge } from '../ui/kit/badge';
import { Segmented } from '../ui/kit/segmented';
import { Button } from '../ui/kit/button';
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
const SECTION_LEDE = 'mt-2xs max-w-content text-m text-on-canvas-muted';

interface StateLook {
  Icon: LucideIcon;
  /** What a reader sees and what a screen reader hears, the same words. */
  label: string;
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
 */
const STATE_LOOK: Record<Mark, StateLook> = {
  live: {
    Icon: CircleDot,
    label: 'Live',
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
    label: 'Live, stale',
    chip: 'border-transparent bg-accent-alternative text-neutral-700',
  },
  broken: {
    Icon: OctagonX,
    label: 'Live, broken',
    chip: 'border-transparent bg-accent text-white',
  },
  sample: {
    Icon: FlaskConical,
    label: 'Sample',
    chip: 'border-stroke bg-surface text-on-canvas-muted',
  },
  'no-source': {
    Icon: CircleDashed,
    label: 'No source',
    chip: 'border-dashed border-stroke-strong bg-canvas text-on-canvas-muted',
  },
};

function StateMark({ mark, className }: { mark: Mark; className?: string }) {
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
      {look.label}
    </span>
  );
}

/**
 * The manifest writes endpoints and file names in Markdown's backticks.
 *
 * It has to: the same sentences are read as prose in `SOURCES.md`, which is the
 * document of record. Printing them here as plain text would print the backticks
 * too, so they become the `code` element they were always standing for.
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

const KIND_LABEL: Record<Kind, string> = {
  articles: 'Articles',
  newsletter: 'Newsletter',
  search: 'Search',
  audio: 'Audio',
  video: 'Video',
  community: 'Community',
  club: 'Club',
  directory: 'Directory',
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

const STATE_GROUPS: { key: Status; label: string; word: string }[] = [
  { key: 'live', label: 'Live', word: 'live' },
  { key: 'sample', label: 'Sample data', word: 'sample' },
  { key: 'no-source', label: 'No source', word: 'no source' },
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

function questionChips(numbers: number[]): ReactNode {
  return numbers.map((n) => (
    <Badge asChild variant="outline" className={CHIP_LINK} key={n}>
      <a href={`#q${n}`}>
        Q{n}
        <span className="sr-only">, open question {n}</span>
      </a>
    </Badge>
  ));
}

function questionLinks(numbers: number[]): ReactNode {
  if (numbers.length === 0) return null;
  return (
    <p className="flex flex-wrap gap-sm text-m">
      {numbers.map((n) => (
        <a className={LINK} href={`#q${n}`} key={n}>
          Open question {n}
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

function feedRow(feed: Feed, index: number, family: SourceEntry): BoardRow {
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
        <span className={FIGURE}>{figures.posts}</span>
        <span className="block text-s text-on-canvas-muted">
          newest: <span className={FIGURE}>{figures.newest}</span>
        </span>
      </>
    ),
    chips: (
      <>
        {severity && <StateMark mark={severity} />}
        {questionChips(questions)}
      </>
    ),
    detail: (
      <>
        <p>
          {feed.category}. The run of <span className={FIGURE}>{MEASURED_ON}</span> found{' '}
          {figures.posts}, newest <span className={FIGURE}>{figures.newest}</span>.
        </p>
        {!figures.measured && (
          <p>
            <strong className="font-semibold text-on-canvas">
              Neither the feed nor its category answered in that run
            </strong>
            , so the figures above are unknown rather than zero. What a failed probe found is on its
            row in <code className={CODE}>apps/workbench/content/sources.measured.ts</code>.
          </p>
        )}
        {feed.note && <p>{prose(feed.note)}</p>}
        {/* The family note holds for all seven feeds, so it sits on the first, where the group starts. */}
        {index === 0 && <p>{prose(family.note)}</p>}
        {index === 0 && family.module && (
          <p>
            Configured in <code className={CODE}>{family.module}</code>.
          </p>
        )}
        {questionLinks(questions)}
      </>
    ),
    text: [
      feed.label,
      feed.category,
      figures.posts,
      figures.newest,
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

function readsCell(entry: SourceEntry): ReactNode {
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
  return <span className="text-on-canvas-muted">none, no source named</span>;
}

function sourceRow(entry: SourceEntry): BoardRow {
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
    sub: entry.standsIn ? `stands in for ${entry.standsIn}` : undefined,
    attention: gap !== undefined || invented,
    questions,
    reads: readsCell(entry),
    measured:
      gap && available !== undefined ? (
        <span className={FIGURE}>
          {gap.used} of {available} used
        </span>
      ) : probe?.ok === true && probe.posts !== undefined ? (
        <span className={FIGURE}>{probe.posts.toLocaleString('en-GB')}</span>
      ) : probe !== undefined ? (
        <span className="text-on-canvas-muted">{probe.ok ? 'reachable' : 'did not answer'}</span>
      ) : (
        <span className="text-on-canvas-muted">nothing to measure</span>
      ),
    chips: (
      <>
        {gap && available !== undefined && (
          <Badge variant="outline">
            <CircleSlash2 aria-hidden="true" className="size-[0.875rem] shrink-0" />
            Unused, {available - gap.used} of {available}
          </Badge>
        )}
        {probe?.ok === false && (
          <Badge variant="outline">
            <OctagonX aria-hidden="true" className="size-[0.875rem] shrink-0" />
            Did not answer
          </Badge>
        )}
        {invented && (
          <Badge>
            <Sparkles aria-hidden="true" className="size-[0.875rem] shrink-0" />
            Invented
          </Badge>
        )}
        {entry.mvp !== undefined && (
          <Badge variant={entry.mvp ? 'default' : 'outline'}>{entry.mvp ? 'MVP' : 'Not MVP'}</Badge>
        )}
        {questionChips(questions)}
      </>
    ),
    detail: (
      <>
        <p>{prose(entry.note)}</p>
        {gap && <p>{prose(gap.note)}</p>}
        {questionLinks(questions)}
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

/** Every row on the board, in the manifest's own order, with the feeds spread in place. */
const ROWS: BoardRow[] = SOURCES.flatMap((entry) =>
  entry === ARTICLE_FAMILY
    ? FEEDS.map((feed, index) => feedRow(feed, index, entry))
    : [sourceRow(entry)],
);

const ROW_BY_ID = new Map(ROWS.map((row) => [row.id, row]));
/** What did not answer in the run this page is built from, named rather than counted. */
const SILENT = MEASURED.probes.filter((probe) => !probe.ok);
const ANSWERED = MEASURED.probes.length - SILENT.length;
const AILING = FEEDS.filter((feed) => feed.health !== 'healthy');
const LIVE_ROWS = ROWS.filter((row) => row.status === 'live').length;
const MVP_WANTED = SOURCES.filter((s) => s.status === 'no-source' && s.mvp).length;

/** The mark a row wears: its health if it has one, otherwise its state. */
function markOf(row: BoardRow): Mark {
  return row.severity ?? row.status;
}

/** The count beside a group heading, and, when grouping by kind, what it is made of. */
function groupMeta(members: BoardRow[], shown: BoardRow[], by: GroupBy): string {
  const base =
    shown.length === members.length
      ? `${members.length} ${members.length === 1 ? 'row' : 'rows'}`
      : `${shown.length} of ${members.length} rows`;
  if (by === 'state' || shown.length === 0) return base;

  const parts = STATE_GROUPS.map((group) => ({
    n: shown.filter((row) => row.status === group.key).length,
    word: group.word,
  }))
    .filter((part) => part.n > 0)
    .map((part) => `${part.n} ${part.word}`);
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
 */
export function Sources() {
  const [stateFilter, setStateFilter] = useState<'all' | Status>('all');
  const [query, setQuery] = useState('');
  const [attentionOnly, setAttentionOnly] = useState(false);
  const [groupBy, setGroupBy] = useState<GroupBy>('state');
  const [open, setOpen] = useState<ReadonlySet<string>>(() => new Set());
  const sections = useSections('/sources', true);

  const revealRow = useCallback((rowId: string) => {
    const row = ROW_BY_ID.get(rowId);
    if (!row) return;

    setOpen((current) => new Set(current).add(rowId));
    // Each filter is cleared only if it is the one hiding the target, so a reader
    // who arrives by link keeps as much of their own view as still shows the row.
    setStateFilter((current) => (current === 'all' || current === row.status ? current : 'all'));
    setAttentionOnly((current) => (current && !row.attention ? false : current));
    setQuery((current) =>
      current.trim() === '' || row.text.includes(current.trim().toLowerCase()) ? current : '',
    );
  }, []);

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
  const visible = ROWS.filter((row) => {
    if (stateFilter !== 'all' && row.status !== stateFilter) return false;
    if (attentionOnly && !row.attention) return false;
    if (needle !== '' && !row.text.includes(needle)) return false;
    return true;
  });
  const visibleIds = new Set(visible.map((row) => row.id));

  const groups: { key: string; label: string }[] =
    groupBy === 'state'
      ? STATE_GROUPS.map((group) => ({ key: group.key, label: group.label }))
      : KIND_ORDER.map((kind) => ({ key: kind, label: KIND_LABEL[kind] }));

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
              CORRECTIV community app · internal documentation
            </p>
            <h1 className="mt-2xs text-headline-xxl font-bold leading-tight tracking-tight">
              Sources status board
            </h1>
            <p className="mt-s max-w-content text-l leading-normal text-on-canvas-muted">
              For every kind of content the app shows: is it live data, sample data standing in for
              an API that does not exist yet, or a wanted feature with nothing to read.
            </p>

            <div
              role="note"
              aria-label="How these figures were measured"
              className="mt-m max-w-content space-y-xs rounded-md border border-stroke border-l-2 border-l-accent bg-surface p-sm text-m text-on-canvas-muted"
            >
              <p>
                <strong className="font-semibold text-on-canvas">
                  Every figure on this page was measured against the live sources on{' '}
                  <span className={FIGURE}>{MEASURED_ON}</span>, {ageInWords(MEASURED_ON)}
                </strong>
                , by <code className={CODE}>apps/workbench/scripts/measure-sources.mjs</code> on{' '}
                {MEASURED.where}. {ANSWERED} of {MEASURED.probes.length} sources answered, with a{' '}
                {MEASURED.timeoutMs / 1000}-second timeout and {MEASURED.attempts} attempts each.
                The browser rendering this page checked nothing and cannot: the RSS feeds send no
                CORS header, which is why this is a script and not a refresh button.
              </p>
              {/*
              The age is worked out in the browser, not at build time. This page is
              published and then sits there, and a figure nobody has questioned for
              a quarter looks exactly like one taken this morning.
            */}
              {isStale(MEASURED_ON) && (
                <p className="font-semibold text-on-canvas">
                  That is more than {STALE_AFTER_DAYS} days ago, so the weekly run that keeps this
                  page current has not landed in a quarter. The post counts and the newest-post
                  dates below have almost certainly moved.
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
                  <strong className="font-semibold text-on-canvas">
                    {SILENT.length === 1 ? 'One source' : `${SILENT.length} sources`} did not
                    answer:
                  </strong>{' '}
                  {SILENT.map(
                    (probe) => `${probe.id} (${probe.reason ?? 'no reason recorded'})`,
                  ).join('; ')}
                  . That is a finding and not a failure — nothing in this repository turns a source
                  being down into a red build.
                </p>
              ) : (
                <p>Every source answered in that run, so nothing below is an unknown.</p>
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
            <legend className="sr-only">Show which rows</legend>
            <h2 id="h-show" className={SECTION_HEAD}>
              Show
            </h2>
            <div className="mt-s grid gap-xs sm:grid-cols-2 xl:grid-cols-4">
              <Tile
                value="all"
                name="All rows"
                count={ROWS.length}
                checked={stateFilter === 'all'}
                onSelect={() => setStateFilter('all')}
              >
                {ROWS.length} rows over {SOURCES.length} manifest entries, with the article family
                drawn as its {FEEDS.length} feeds.
              </Tile>

              <Tile
                value="live"
                name="Live"
                mark="live"
                count={LIVE_ROWS}
                checked={stateFilter === 'live'}
                onSelect={() => setStateFilter('live')}
              >
                {LIVE_ROWS - COUNTS.stale - COUNTS.broken} reading as expected, {COUNTS.stale}{' '}
                stale, {COUNTS.broken} broken. The last two are the bad news below.
              </Tile>

              <Tile
                value="sample"
                name="Sample data"
                mark="sample"
                count={COUNTS.sample}
                checked={stateFilter === 'sample'}
                onSelect={() => setStateFilter('sample')}
              >
                {COUNTS.sample} files typed in the shape of the API that will replace them. On
                screen they look like live content.
              </Tile>

              <Tile
                value="no-source"
                name="No source"
                mark="no-source"
                count={COUNTS.noSource}
                checked={stateFilter === 'no-source'}
                onSelect={() => setStateFilter('no-source')}
              >
                {COUNTS.noSource} wanted features with nothing to read. {MVP_WANTED} of them are
                MVP.
              </Tile>
            </div>
          </fieldset>

          <section className="min-w-0" aria-labelledby="h-findings">
            <h2 id="h-findings" className={SECTION_HEAD}>
              Bad news first
            </h2>
            <p className={SECTION_LEDE}>
              A sample file is honest about what it is. A live feed that has stopped, or points at
              nothing, is not, because the app presents it as content. {AILING.length} of the{' '}
              {FEEDS.length} article feeds are in that state.
            </p>

            <ul className="mt-s grid gap-xs lg:grid-cols-3">
              {AILING.map((feed) => {
                const rowId = `row-${feedId(feed.label)}`;
                const row = ROW_BY_ID.get(rowId);
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
                      <span className="font-semibold text-on-canvas">{feed.label}</span>
                    </p>
                    <p className="text-m text-on-canvas-muted">
                      {feed.category}: <span className={FIGURE}>{feedFigures(feed).posts}</span>,
                      newest <span className={FIGURE}>{feedFigures(feed).newest}</span>.
                    </p>
                    {feed.note && <p className="text-m text-on-canvas-muted">{prose(feed.note)}</p>}
                    <p className="mt-auto flex flex-wrap gap-sm pt-2xs text-m">
                      {row && (
                        <a className={LINK} href={`#${rowId}`} onClick={() => revealRow(rowId)}>
                          Row
                        </a>
                      )}
                      {(row?.questions ?? []).map((n) => (
                        <a className={LINK} href={`#q${n}`} key={n}>
                          Open question {n}
                        </a>
                      ))}
                    </p>
                  </li>
                );
              })}
            </ul>

            <p className="mt-s max-w-content text-m text-on-canvas-muted">
              The other {FEEDS.length - AILING.length} article feeds were reading as expected in the
              run of <span className={FIGURE}>{MEASURED_ON}</span>. A feed can be stale for a good
              reason, which is what the note on each card is for.
            </p>
          </section>

          <section className="min-w-0" aria-labelledby="h-gaps">
            <h2 id="h-gaps" className={SECTION_HEAD}>
              Connected but unused
            </h2>
            <p className={SECTION_LEDE}>
              {UNUSED.length} sources are live and reachable, and the app reads a fraction of each.
              This is neither a broken source nor a missing one. It is a decision nobody has taken.
              Filled dots are what the app shows.
            </p>

            <ul className="mt-s grid gap-xs sm:grid-cols-2 xl:grid-cols-4">
              {UNUSED.map((gap) => {
                const sourceId = SOURCE_BY_GAP.get(gap.label);
                const available = gapAvailable(gap);
                return (
                  <li
                    key={gap.label}
                    className="flex min-w-0 flex-col gap-2xs rounded-md border border-stroke bg-surface p-sm"
                  >
                    <p className="font-semibold text-on-canvas">{gap.label}</p>
                    <p className="text-m text-on-canvas-muted">
                      <span className={cn(FIGURE, 'text-l font-bold text-on-canvas')}>
                        {gap.used}
                      </span>{' '}
                      of <span className={FIGURE}>{available ?? 'unknown'}</span> used
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
                            Row
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
            <h2 id="h-board" className={SECTION_HEAD}>
              The board
            </h2>
            <p className={SECTION_LEDE}>
              One row per source, per article feed, or per wanted source. A row expands to its full
              detail; nothing on this page is truncated. The state tiles above filter the board as
              well.
            </p>

            <div className="mt-s flex flex-wrap items-end gap-sm rounded-md border border-stroke bg-surface p-s">
              <div className="min-w-0 flex-1 basis-[16rem]">
                <label
                  htmlFor="sources-query"
                  className="mb-3xs block text-s font-medium text-on-canvas-muted"
                >
                  Filter rows
                </label>
                <input
                  type="search"
                  id="sources-query"
                  placeholder="name, endpoint, file, question"
                  autoComplete="off"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  className="h-[2.25rem] w-full rounded-md border border-stroke bg-canvas px-xs text-m text-on-canvas placeholder:text-on-canvas-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                />
              </div>

              <Segmented
                name="group"
                legend="Group by"
                showLegend
                className="min-w-0"
                value={groupBy}
                options={[
                  { value: 'state', label: 'State' },
                  { value: 'kind', label: 'Content kind' },
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
                Only rows with a finding: stale, broken, unused, invented
              </label>

              <div className="flex items-center gap-2xs">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setOpen(new Set(ROWS.map((row) => row.id)))}
                >
                  Expand all
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setOpen(new Set())}
                >
                  Collapse all
                </Button>
              </div>

              <output className="text-m tabular-nums text-on-canvas-muted">
                Showing {visible.length} of {ROWS.length} rows
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
              <table className="w-full min-w-[44rem] border-collapse text-left">
                <caption className="border-b border-stroke bg-surface px-s py-xs text-left text-s text-on-canvas-muted">
                  Every content source the app reads, stands in for, or still wants. Figures from
                  the run of <span className={FIGURE}>{MEASURED_ON}</span>.
                </caption>
                <thead>
                  <tr className="border-b border-stroke-strong">
                    {/* The width on "Reads from" is a preference, not a rule: auto
                      table layout honours it only where there is room. It is here
                      because that column holds the module paths, and without it
                      the spare width lands on the source names and the paths break
                      mid-word. */}
                    {[
                      { head: 'State' },
                      { head: 'Kind' },
                      { head: 'Source' },
                      { head: 'Reads from', width: 'w-[17rem]' },
                    ].map((column) => (
                      <th
                        key={column.head}
                        scope="col"
                        className={cn(
                          'px-s py-xs text-s font-semibold uppercase tracking-wider text-on-canvas-muted',
                          column.width,
                        )}
                      >
                        {column.head}
                      </th>
                    ))}
                    <th
                      scope="col"
                      className="px-s py-xs text-s font-semibold uppercase tracking-wider text-on-canvas-muted"
                    >
                      Measured
                      <span className={cn(FIGURE, 'block font-normal normal-case')}>
                        {MEASURED_ON}
                      </span>
                    </th>
                    <th
                      scope="col"
                      className="px-s py-xs text-s font-semibold uppercase tracking-wider text-on-canvas-muted"
                    >
                      Flags
                    </th>
                    <th scope="col" className="px-s py-xs">
                      <span className="sr-only">Details</span>
                    </th>
                  </tr>
                </thead>

                {groups.map((group) => {
                  const members = ROWS.filter(
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
                            {groupMeta(members, shown, groupBy)}
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
                                {KIND_LABEL[row.kind]}
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
                                  {isOpen ? 'Hide' : 'Details'}
                                  {/* Thirty of these on the page, and a reader
                                    listing its controls heard "Details" thirty
                                    times. The row's own name is what tells them
                                    apart, so it goes in the accessible name and
                                    stays out of the visible one. */}
                                  <span className="sr-only">, {row.name}</span>
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
            <h2 id="h-questions" className={SECTION_HEAD}>
              {COUNTS.questions} open editorial questions
            </h2>
            <p className={SECTION_LEDE}>
              This page exists to get these answered. Each one is raised by a row above, and each
              row carries its question as a Q chip.
            </p>

            <ol className="mt-s space-y-xs">
              {QUESTIONS.map((question, index) => {
                const n = index + 1;
                const raisedBy = ROWS.filter((row) => row.questions.includes(n));
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
                      Q{n}
                    </span>
                    <div className="min-w-0">
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

          <footer className="min-w-0 space-y-xs border-t border-stroke pt-sm text-m text-on-canvas-muted">
            <p className="max-w-content">
              Two files, and the split is the point. Every row, state and sentence above is read
              from <code className={CODE}>apps/workbench/content/sources.manifest.ts</code>, which a
              test checks against the core&apos;s data directory: that is the argument, and it is
              written by hand. Every count, date and listener figure is read from{' '}
              <code className={CODE}>apps/workbench/content/sources.measured.ts</code>, which is
              generated and must not be edited.
            </p>
            <p className="max-w-content">
              To re-measure, run{' '}
              <code className={CODE}>node apps/workbench/scripts/measure-sources.mjs</code>.{' '}
              <code className={CODE}>.github/workflows/sources.yml</code> runs it weekly and opens a
              pull request when anything has moved. It reports and never gates: a source that is
              down, slow or has moved appears on this page and in that run&apos;s summary, and fails
              nothing.
            </p>
          </footer>
        </div>
      </Page>
    </>
  );
}
