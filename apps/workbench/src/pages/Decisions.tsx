import { CircleCheck, OctagonX, Strikethrough, TriangleAlert } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Fragment, useCallback, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { defineMessages, type IntlShape, type MessageDescriptor } from 'react-intl';

import docsModule from 'virtual:docs';

import type { DecisionRecord, Standing } from '../../plugin/decisions.ts';
import { useWorkbenchIntl } from '../i18n/Localisation';
import { cn } from '../lib/cn';
import { reasonFor, spaced } from '../lib/reason';
import { href } from '../router';
import { Slot } from '../shell/slots';
import { Badge } from '../ui/kit/badge';
import { Button } from '../ui/kit/button';
import { InfoTip } from '../ui/kit/info-tip';
import { Page } from '../ui/Page';
import { Toc } from '../ui/Toc';
import { useSections } from '../ui/useSections';

/**
 * A measured figure — a record number, a date, a count — never wrapped.
 *
 * The same rule as the sources board, for the same reason: a date broken across
 * two lines in a narrow column reads as two numbers.
 */
const FIGURE = 'whitespace-nowrap font-mono tabular-nums';

const LINK =
  'rounded-s underline decoration-accent underline-offset-2 hover:text-on-canvas-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent';

/** What a record chip adds to the kit's outline badge, which it otherwise is. */
const CHIP_LINK =
  'font-mono tabular-nums hover:border-accent hover:text-on-canvas-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent';

const SECTION_HEAD = 'text-headline-l font-semibold tracking-tight text-on-canvas';
/** A section's heading and the ⓘ beside it, which holds what used to be its lede. */
const HEAD_ROW = 'flex items-center gap-xs';

/**
 * Everything this board says, in ENGLISH; the German that ships is
 * `src/i18n/catalogue/de/decisions.ts`.
 *
 * **What is here is the board, and what is not here is the records.** Every
 * heading, legend, tile, column head, badge and sentence below was written on
 * this page. A record's title, its note out of the index, its caveats and the
 * clause under every strike are the ADRs' own words, read in at build time
 * through `virtual:docs`, and this site prints them as they are written
 * ([ADR 0052](../../../../adr/0052-the-sites-own-words-follow-the-setting.md) §1).
 * So a German reader gets a German board over English records, with the seam
 * running between what this page says and what it quotes.
 *
 * **The counts are ICU plurals and not `{n} claims`.** Every figure here is read
 * off `adr/` and can be one: a German reader meeting „1 Aussagen“ is the defect,
 * and so is an English reader meeting "1 of those strikes name". Where a whole
 * sentence changes number, both branches carry the whole sentence rather than a
 * fragment, because a translator answering a fragment cannot see the sentence it
 * lands in.
 */
const COPY = defineMessages({
  eyebrow: {
    id: 'decisions.eyebrow',
    defaultMessage: 'CORRECTIV community app · internal documentation',
    description:
      'The small line over the page heading, which says what site this is. sources.eyebrow is the same line word for word over the sources board, and the two are separate ids because each page owns its own header.',
  },
  title: {
    id: 'decisions.title',
    defaultMessage: 'Decision records',
    description:
      'The page’s heading. nav.decisions is the same two words as the browser tab and the search palette carry for this page; shell.activity.decisions is the shorter word the rail has room for.',
  },
  lede: {
    id: 'decisions.lede',
    defaultMessage:
      'The choices this repository argued rather than assumed, and which of them still hold. A record says <em>why</em>. <architecture>The architecture</architecture> says what the thing is.',
    description:
      'The paragraph under the heading. <em> emphasises one word and <architecture> is the link to /architecture, which is the repository’s ARCHITECTURE.md rendered on this site.',
  },

  ruleLabel: {
    id: 'decisions.rule.label',
    defaultMessage: 'How an expired claim is marked',
    description:
      'The visible label of the ⓘ under the lede, which opens the four paragraphs of the rule and its counts.',
  },
  ruleNever: {
    id: 'decisions.rule.never',
    defaultMessage:
      '<strong>A record is never rewritten to look right later.</strong> When a later decision makes a claim <em>false</em>, the claim is struck through where it stands. One short reason says what voided it, with a link to the record that did. The argument around it stays as it was, because the reasoning is what is worth keeping.',
    description:
      'The first paragraph behind that ⓘ, and this repository’s rule for its own records in one sentence. <strong> carries the rule itself and <em> the one word the rule turns on.',
  },
  ruleStruck: {
    id: 'decisions.rule.struck',
    defaultMessage:
      'So <f>{struck}</f> {struck, plural, one {claim is} other {claims are}} struck across these <f>{records}</f> records, and a record with a struck claim still stands. That is the rule working, not a fault. This board makes it visible. In the documents themselves, you would have to open all {records}.',
    description:
      'The second paragraph of that note. {struck} is how many claims are struck through across every record, {records} how many records there are; both are counted out of adr/ at build time. <f> draws a figure in monospace so it is never mistaken for prose.',
  },
  ruleUnattributed: {
    id: 'decisions.rule.unattributed',
    defaultMessage:
      '{count, plural, one {<f>#</f> of those strikes names no later record. A new measurement or a later section of the same record struck it. So there is no arrow to draw, and its reason is all there is to say.} other {<f>#</f> of those strikes name no later record. A new measurement or a later section of the same record struck them. So there is no arrow to draw, and their reason is all there is to say.}} A row shows that reason under its title, cut to one sentence. The detail below has all of them in full.',
    description:
      'The third paragraph of that note. {count} is how many struck claims name no record with a higher number, so the board has no edge to draw for them. <f> draws the figure in monospace. Both branches carry the whole first half of the paragraph, because the pronouns after the count change with it.',
  },
  ruleClauseless: {
    id: 'decisions.rule.clauseless',
    defaultMessage:
      '{count, plural, one {<f>#</f> of them has no reason attached. The reason was in the paragraph after the strike, or a second strike beside it took it, and the board cannot match either automatically. That row says so, and the record itself has the answer.} other {<f>#</f> of them have no reason attached. The reason was in the paragraph after the strike, or a second strike beside it took it, and the board cannot match either automatically. Those rows say so, and the record itself has the answer.}}',
    description:
      'The fourth paragraph of that note, drawn only while {count} is above zero. {count} is how many struck claims have no clause after them at all, which is a smaller set than the strikes naming no record. <f> draws the figure in monospace.',
  },

  showLegend: {
    id: 'decisions.show.legend',
    defaultMessage: 'Show which records',
    description:
      'Read aloud as the group name of the four filter tiles, and never drawn: the heading beside it is what a reader sees.',
  },
  showTitle: {
    id: 'decisions.show.title',
    defaultMessage: 'Show',
    description:
      'The heading over the four filter tiles. sources.show.title is the same word over the tiles of the sources board.',
  },
  tileAll: {
    id: 'decisions.tile.all',
    defaultMessage: 'All records',
    description:
      'The first filter tile, which switches the standing filter off. It is also the tile’s accessible name, because the card as a whole is the control.',
  },
  tileAllNote: {
    id: 'decisions.tile.all.note',
    defaultMessage: 'Written between <f>{from}</f> and <f>{to}</f>, in the order they were taken.',
    description:
      'The line under that tile. {from} is the ISO day of the oldest record and {to} of the newest, both read out of adr/. <f> draws each day in monospace so it never wraps.',
  },

  standingStands: {
    id: 'decisions.standing.stands',
    defaultMessage: 'Stands',
    description:
      'The chip on a record nothing has struck, and the accessible name of the tile that filters for those. It means the record is still true as written.',
  },
  standingStandsMeaning: {
    id: 'decisions.standing.stands.meaning',
    defaultMessage: 'Nothing in them has been made false since they were written.',
    description: 'The line under the Stands tile, which says what that standing means.',
  },
  standingPartly: {
    id: 'decisions.standing.partly',
    defaultMessage: 'Partly struck',
    description:
      'The chip on a record whose decision holds but which carries at least one struck claim, and the accessible name of the tile that filters for those.',
  },
  standingPartlyMeaning: {
    id: 'decisions.standing.partly.meaning',
    defaultMessage:
      'The decision holds. Claims inside it do not, and are struck where they stand rather than rewritten.',
    description: 'The line under the Partly struck tile, which says what that standing means.',
  },
  standingWithdrawn: {
    id: 'decisions.standing.withdrawn',
    defaultMessage: 'No longer stands',
    description:
      'The chip on a record whose own status line is struck through, and the accessible name of the tile that filters for those. It is the one standing a reader could act on and be wrong.',
  },
  standingWithdrawnMeaning: {
    id: 'decisions.standing.withdrawn.meaning',
    defaultMessage: 'The status line itself is struck through. Read the record as history.',
    description: 'The line under the No longer stands tile, which says what that standing means.',
  },

  whyWithdrawn: {
    id: 'decisions.reason.withdrawn',
    defaultMessage: 'Why it no longer stands:',
    description:
      'Read aloud before the one line of reason under a withdrawn record’s title, and never drawn. Without it the line is a fragment of a document and a screen reader gets no warning that the row has changed subject. decisions.reason.struck is the same announcement on a record that merely carries a struck claim.',
  },
  whyStruck: {
    id: 'decisions.reason.struck',
    defaultMessage: 'Why it was struck:',
    description:
      'Read aloud before the one line of reason under the title of a record carrying a struck claim, and never drawn. decisions.reason.withdrawn is the same announcement on a record whose own status line is struck through.',
  },

  recordName: {
    id: 'decisions.recordName',
    defaultMessage: ', ADR {number}, {title}',
    description:
      'Read aloud after a control that would otherwise announce as a bare number or as the word Details, and never drawn. {number} is the record’s four-digit number and {title} its own English title out of adr/, which is not translated. The leading comma is a pause: the visible text comes first.',
  },

  carefulTitle: {
    id: 'decisions.careful.title',
    defaultMessage: 'Read these with care',
    description:
      'The heading over the cards for records a reader would be wrong to take at face value.',
  },
  carefulLede: {
    id: 'decisions.careful.lede',
    defaultMessage:
      '{careful, plural, one {<f>#</f> record} other {<f>#</f> records}} where the record and the repository are not the same story: {withdrawn, plural, one {one whose own status line is struck through} other {# whose own status lines are struck through}}, and {rest, plural, one {one that decided something} other {# that decided something}} the index says is not built, or not checked on every platform. Everything else on this board was carried out.',
    description:
      'The line under that heading. {careful} is how many such records there are, {withdrawn} how many of them have a struck status line, and {rest} how many carry a caveat out of the index instead. All three are counted out of adr/. <f> draws the first figure in monospace.',
  },
  carefulRow: {
    id: 'decisions.careful.row',
    defaultMessage: 'Row',
    description:
      'The link on such a card down to that record’s row in the table, which it also opens. sources.row is the same word on the sources board’s cards.',
  },
  carefulRead: {
    id: 'decisions.careful.read',
    defaultMessage: 'Read the record',
    description: 'The link on such a card out to the record itself, rendered on this site.',
  },

  boardTitle: {
    id: 'decisions.board.title',
    defaultMessage: 'The board',
    description:
      'The heading over the table of every record. sources.board.title is the same two words over the table on the sources board.',
  },
  boardLede: {
    id: 'decisions.board.lede',
    defaultMessage:
      'One row per record, oldest first. If a record has struck claims, the reason appears under its title, cut to one sentence. Open a row to see the index’s summary, every struck claim with its full reason, and which records struck it or were struck by it. Nothing in the detail is cut short. The tiles above filter this list too.',
    description: 'The paragraph under that heading, which says what a row holds.',
  },
  filter: {
    id: 'decisions.filter',
    defaultMessage: 'Filter records',
    description:
      'The label over the text field above the table. sources.filter is the same shape of label over the sources board’s field and reads “Filter rows”.',
  },
  filterPlaceholder: {
    id: 'decisions.filter.placeholder',
    defaultMessage: 'number, title, or a claim',
    description:
      'The placeholder in that field, naming the three things the filter reads. It matches a record’s number, its title, its status, the index’s sentence and the text of every struck claim and clause.',
  },
  only: {
    id: 'decisions.only',
    defaultMessage: 'Only what is not built or not checked',
    description:
      'The checkbox beside that field. It keeps the records whose own index entry says the decision was not carried out, or was not verified on every platform.',
  },
  expandAll: {
    id: 'decisions.expandAll',
    defaultMessage: 'Expand all',
    description:
      'The button that opens every row’s detail at once. sources.expandAll is the same two words on the sources board.',
  },
  collapseAll: {
    id: 'decisions.collapseAll',
    defaultMessage: 'Collapse all',
    description:
      'The button that closes every row’s detail at once. sources.collapseAll is the same two words on the sources board.',
  },
  showing: {
    id: 'decisions.showing',
    defaultMessage: 'Showing {shown} of {total, plural, one {# record} other {# records}}',
    description:
      'The live count beside the filters. {shown} is how many rows the filters leave and {total} how many records there are altogether.',
  },
  caption: {
    id: 'decisions.caption',
    defaultMessage:
      'Every architecture decision record in <code>adr/</code>, with what has since been struck inside it.',
    description:
      'The table’s caption, drawn as a line above it. <code> holds the directory in this repository the records are read out of, which stays in its own spelling.',
  },

  columnStanding: {
    id: 'decisions.column.standing',
    defaultMessage: 'Standing',
    description:
      'The first column head: whether the record still stands, carries a struck claim, or has been withdrawn.',
  },
  columnRecord: {
    id: 'decisions.column.record',
    defaultMessage: 'Record',
    description: 'The second column head, over each record’s number and the day it was written.',
  },
  columnDecision: {
    id: 'decisions.column.decision',
    defaultMessage: 'Decision',
    description:
      'The third column head, over each record’s own title, its caveats and the one line saying why something in it is no longer true.',
  },
  columnStruck: {
    id: 'decisions.column.struck',
    defaultMessage: 'Struck claims',
    description:
      'The fourth column head, over how many claims are struck in that record and which later records struck them.',
  },
  details: {
    id: 'decisions.details',
    defaultMessage: 'Details',
    description:
      'The button at the end of a row that opens its detail, and the name of the column those buttons sit in, which is read aloud and never drawn. sources.details is the same word on the sources board.',
  },
  hide: {
    id: 'decisions.hide',
    defaultMessage: 'Hide',
    description:
      'What the Details button says while that row’s detail is open. sources.hide is the same word on the sources board.',
  },

  struckNone: {
    id: 'decisions.struck.none',
    defaultMessage: 'none',
    description:
      'The Struck claims cell of a record nothing has been struck in. Lower case, because it completes the column head rather than starting a sentence.',
  },
  struckCount: {
    id: 'decisions.struck.count',
    defaultMessage: '{count, plural, one {<n>#</n><w>claim</w>} other {<n>#</n><w>claims</w>}}',
    description:
      'The count in the Struck claims cell, drawn only where {count} is above one: a single strike says nothing the standing chip has not already said. <n> draws the figure and <w> the word after it, which is why the two are tagged apart.',
  },
  struckBy: {
    id: 'decisions.struck.by',
    defaultMessage: 'by',
    description:
      'Introduces the chips of the later records that struck something in this one, in the Struck claims cell. Lower case and mid-sentence: the chips finish the line.',
  },
  struckFinding: {
    id: 'decisions.struck.finding',
    defaultMessage: 'a later finding',
    description:
      'Stands where those chips would be, on the commonest case: a strike whose clause names no record, so there is nothing to link to. Deliberately not “by no later record”, which reads as missing data about the majority of the strikes on this board.',
  },

  detailIndex: {
    id: 'decisions.detail.index',
    defaultMessage: 'The index says:',
    description:
      'Introduces the sentence adr/README.md writes about this record, inside the row’s detail. The sentence itself is the repository’s and is printed as it is written.',
  },
  detailStruck: {
    id: 'decisions.detail.struck',
    defaultMessage: '{count, plural, one {One claim is struck:} other {# claims are struck:}}',
    description:
      'Introduces the list of struck claims inside the row’s detail. {count} is how many claims are struck in this record.',
  },
  detailNoClause: {
    id: 'decisions.detail.noClause',
    defaultMessage: 'No reason follows this strike. The record explains it in the text around it.',
    description:
      'Stands under a struck claim that has no clause after it, so that the gap reads as a fact about the record rather than as a parser that failed. The reason is in the paragraph after the strike, or was taken by a second strike beside it.',
  },
  detailVoids: {
    id: 'decisions.detail.voids',
    defaultMessage: '{count, plural, one {It struck a claim in} other {It struck claims in}}',
    description:
      'Introduces the chips of the records this one struck something in, inside the row’s detail. {count} is how many records those are, and it is not drawn: the chips that follow are the list.',
  },
  detailRead: {
    id: 'decisions.detail.read',
    defaultMessage: 'Read ADR {number}',
    description:
      'The link out of the row’s detail to the record itself, rendered on this site. {number} is the record’s four-digit number. “ADR” is what this repository calls these documents and is left in its own spelling.',
  },

  footerLabel: {
    id: 'decisions.footer.label',
    defaultMessage: 'Where this board comes from',
    description:
      'The footer’s one visible line, beside an ⓘ that opens the two paragraphs below. sources.footer.label reads the same in English on the sources board, which is a different board built out of different files.',
  },
  footerBuild: {
    id: 'decisions.footer.build',
    defaultMessage:
      'Every row, count and link above is read from the records themselves when the site is built. The workbench keeps no copy, so this board cannot disagree with <code>adr/</code>. If it cannot read a record, the site does not build.',
    description:
      'The first line of the footer, which says where the board comes from. <code> holds the directory in this repository, which stays in its own spelling.',
  },
  footerNotes: {
    id: 'decisions.footer.notes',
    defaultMessage:
      'The index these sentences come from is published in full at <notes>Decisions, the notes</notes>. It also has what a table cannot hold: notes for readers of the older records, and the rule above in full.',
    description:
      'The second line of the footer. <notes> is the link to /decisions-notes, and the words inside it are this site’s name for that page. The document behind it is adr/README.md and stays English.',
  },
});

/**
 * The runs drawn inside this page's sentences, at module scope.
 *
 * Beside the descriptors rather than inside the render, which is the shape
 * `ui/Settings.tsx` already uses: a component built during a render is remounted
 * on every one of them, and `react/no-unstable-nested-components` says so.
 */
const em = (chunks: ReactNode[]) => <em>{chunks}</em>;

const strong = (chunks: ReactNode[]) => (
  <strong className="font-semibold text-on-canvas">{chunks}</strong>
);

const code = (chunks: ReactNode[]) => <code className="font-mono">{chunks}</code>;

/** A measured figure inside a sentence: monospace, tabular, and never wrapped. */
const f = (chunks: ReactNode[]) => <span className={FIGURE}>{chunks}</span>;

const architecture = (chunks: ReactNode[]) => (
  <a className={LINK} href={href('/architecture')}>
    {chunks}
  </a>
);

const notes = (chunks: ReactNode[]) => (
  <a className={LINK} href={href('/decisions-notes')}>
    {chunks}
  </a>
);

/** The two halves of the Struck claims count, which carry different weights. */
const n = (chunks: ReactNode[]) => (
  <span className={cn(FIGURE, 'font-semibold text-on-canvas')}>{chunks}</span>
);

const w = (chunks: ReactNode[]) => (
  <span className="ml-3xs text-s text-on-canvas-muted">{chunks}</span>
);

const RECORDS: DecisionRecord[] = docsModule.decisions;
const BY_NUMBER = new Map(RECORDS.map((record) => [record.number, record]));

/**
 * The one line of *why* each row carries, computed once rather than per render.
 *
 * `src/lib/reason.ts` holds the rule and `test/reason.test.ts` holds it to the
 * records. A row without a strike, and without a struck status line, has no entry
 * here and draws no line.
 *
 * Every word of it is the record's own: the clause as the ADR wrote it, or the
 * index's sentence for a withdrawn record. Nothing here passes through the
 * catalogue, which is ADR 0052 §1's line rather than an omission.
 */
const REASONS = new Map(RECORDS.map((record) => [record.number, reasonFor(record)]));

interface StandingLook {
  Icon: LucideIcon;
  /** What a reader sees and what a screen reader hears, the same words. */
  label: MessageDescriptor;
  /** The chip, which carries the weight: filled, outlined, coloured. */
  chip: string;
  /** What this state means, once, for the tile and the legend. */
  meaning: MessageDescriptor;
}

/**
 * The three standings, each distinguishable three ways over.
 *
 * Icon, written label and weight of chip, so the board reads in greyscale and to
 * a reader who receives no colour — the sources board's rule, kept here because
 * it is the same board's house style and the same accessibility argument.
 *
 * The weights say what the states are worth. `stands` is filled, the way the
 * sources board fills `live`: it is the plain positive, and there is no green in
 * the design tokens to spend on it. `partly-struck` is outlined and quiet on
 * purpose, although it is half the set — a struck claim is this repository's
 * discipline working, not damage, and sixteen alarming chips would say the
 * opposite of what is true. Red is spent once, on the one record whose own status
 * line is struck through, because that is the only row here a reader could act on
 * and be wrong.
 *
 * The two words are descriptors rather than strings, because the chip and the
 * tile beside it have to say the same thing in whichever language the site is
 * set to, and this table is the one place that decides what that is.
 */
const STANDING_LOOK: Record<Standing, StandingLook> = {
  stands: {
    Icon: CircleCheck,
    label: COPY.standingStands,
    chip: 'border-transparent bg-on-canvas text-canvas',
    meaning: COPY.standingStandsMeaning,
  },
  'partly-struck': {
    Icon: Strikethrough,
    label: COPY.standingPartly,
    chip: 'border-stroke bg-surface text-on-canvas-muted',
    meaning: COPY.standingPartlyMeaning,
  },
  withdrawn: {
    Icon: OctagonX,
    label: COPY.standingWithdrawn,
    chip: 'border-transparent bg-accent text-white',
    meaning: COPY.standingWithdrawnMeaning,
  },
};

const ORDER: Standing[] = ['stands', 'partly-struck', 'withdrawn'];

function StandingMark({ standing, className }: { standing: Standing; className?: string }) {
  const intl = useWorkbenchIntl();
  const look = STANDING_LOOK[standing];
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
 * The caveat a row wears under its title: `iOS unrun`, `not built`.
 *
 * Club yellow, the palette role the sources board gives to a thing that has
 * stopped rather than broken, and deliberately not a second status pill: the
 * status is a decision about what to do, and this is a fact about the world that
 * the decision has not changed. `text-neutral-700` on the yellow is a primitive on
 * purpose, because ink on a brand colour must not follow the scheme.
 *
 * The words are the index's own, out of `adr/README.md`, so they are printed as
 * they are written and never translated.
 */
function Caveat({ text }: { text: string }) {
  return (
    <span className="inline-flex items-center gap-3xs rounded-s bg-accent-alternative px-3xs py-4xs text-s font-medium text-neutral-700">
      <TriangleAlert aria-hidden="true" className="size-[0.875rem] shrink-0" />
      {text}
    </span>
  );
}

/**
 * The row's one line of *why*, under the title it belongs to.
 *
 * Under the TITLE, and not in the `Struck claims` column where the count it
 * answers stands. That column is `w-[13rem]` and the median clause in `adr/` is
 * 212 characters: put one there and the row is six lines tall and the column is a
 * paragraph in a 13rem gutter. The wider argument is the same one either way — a
 * reason belongs beside the decision it is about, and that column is the ledger
 * of who struck what rather than a place to read.
 *
 * `line-clamp-1` and not `truncate`: text that refuses to wrap reports its whole
 * string as the cell's minimum width, and the table then grows until the page
 * scrolls sideways. `max-w-content` caps what the cell asks for from the other
 * end, so one long clause cannot take the column off the shorter rows.
 *
 * The icon is the row's own standing icon, so the line reads as the strike's and
 * not as a second subtitle for the record. The full clause, and every other one,
 * is in the detail, which is truncated nowhere.
 */
function Reason({ record }: { record: DecisionRecord }) {
  const intl = useWorkbenchIntl();
  const reason = REASONS.get(record.number);
  if (!reason) return null;
  const { Icon } = STANDING_LOOK[record.standing];

  return (
    <p className="mt-3xs flex max-w-content items-start gap-3xs text-s leading-normal text-on-canvas-muted">
      <Icon aria-hidden="true" className="mt-[0.15rem] size-[0.875rem] shrink-0" />
      <span className="line-clamp-1 min-w-0">
        {/* The line is a fragment of a document without this, and a screen reader
          gets it with no warning that the row has changed subject. The space is
          outside the message, because trailing whitespace inside one is a thing a
          translator drops without noticing. */}
        <span className="sr-only">
          {intl.formatMessage(
            record.standing === 'withdrawn' ? COPY.whyWithdrawn : COPY.whyStruck,
          )}{' '}
        </span>
        {reason.lead !== '' && (
          <>
            <s>{reason.lead}</s>
            {spaced(reason.text) ? ' ' : ''}
          </>
        )}
        {reason.text}
      </span>
    </p>
  );
}

/** A record number as a chip that jumps to its row. */
function recordChips(
  numbers: string[],
  reveal: (number: string) => void,
  intl: IntlShape,
): ReactNode {
  return numbers.map((number) => (
    <Badge asChild variant="outline" className={CHIP_LINK} key={number}>
      <a href={`#rec-${number}`} onClick={() => reveal(number)}>
        {number}
        <span className="sr-only">
          {intl.formatMessage(COPY.recordName, {
            number,
            title: BY_NUMBER.get(number)?.title ?? '',
          })}
        </span>
      </a>
    </Badge>
  ));
}

/** Lower-cased haystack for the text filter: everything a reader might type. */
function haystack(record: DecisionRecord): string {
  return [
    record.number,
    record.title,
    record.date,
    record.status,
    record.note,
    ...record.caveats,
    ...record.struck.flatMap((claim) => [claim.claim, claim.clause]),
    ...record.voidedBy,
    ...record.voids,
  ]
    .join(' ')
    .toLowerCase();
}

const TEXT = new Map(RECORDS.map((record) => [record.number, haystack(record)]));

const COUNT: Record<Standing | 'all', number> = {
  all: RECORDS.length,
  stands: RECORDS.filter((r) => r.standing === 'stands').length,
  'partly-struck': RECORDS.filter((r) => r.standing === 'partly-struck').length,
  withdrawn: RECORDS.filter((r) => r.standing === 'withdrawn').length,
};

const STRUCK = RECORDS.reduce((total, record) => total + record.struck.length, 0);
/**
 * Struck claims whose clause names no later record.
 *
 * Printed on the page rather than hidden, because it is the honest limit of the
 * graph below: those claims were struck by a re-measurement, or by a later section
 * of the same record, and no amount of parsing turns that into an edge. The clause
 * still says which, and the row's detail prints it.
 */
const UNATTRIBUTED = RECORDS.reduce(
  (total, record) =>
    total +
    record.struck.filter((claim) => claim.by.every((number) => number <= record.number)).length,
  0,
);
/**
 * Strikes with no clause after them at all, which is a smaller set than the one
 * above and a different fault.
 *
 * An unattributed strike has a reason and no arrow. These have no reason on the
 * page either, because of where the reason was written: in the paragraph after the
 * strike, or in a clause that a second strike standing beside it took for itself.
 * Counted and named rather than left out, because a claim printed with nothing
 * under it reads as a parser that failed. `plugin/decisions.ts` holds the list of
 * records this is still true of, so the number can only fall.
 */
const CLAUSELESS = RECORDS.reduce(
  (total, record) => total + record.struck.filter((claim) => claim.clause === '').length,
  0,
);

/** The records a reader would be wrong to take at face value, in number order. */
const CAREFUL = RECORDS.filter(
  (record) => record.standing === 'withdrawn' || record.caveats.length > 0,
);

interface TileProps {
  value: 'all' | Standing;
  /** Repeats the heading word for word, so what is heard and what is read agree. */
  name: string;
  count: number;
  checked: boolean;
  onSelect: () => void;
  standing?: Standing;
  children: ReactNode;
}

/**
 * One filter tile, which is a radio wearing a card.
 *
 * The same control as the sources board, and the `aria-label` does the same real
 * work: the label is the whole card, so without it the radio announces as its own
 * count and its own summary, which is a paragraph where a name belongs.
 */
function Tile({ value, name, count, checked, onSelect, standing, children }: TileProps) {
  return (
    <label className="min-w-0" aria-label={name}>
      <input
        type="radio"
        name="standing"
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
          {standing ? (
            <StandingMark standing={standing} />
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
 * The decisions board: which records still hold, which carry dead claims, and who
 * killed them.
 *
 * The three questions are the ones this repository's ADR discipline creates and no
 * generic document viewer can answer. A record is never rewritten to look right in
 * hindsight: a claim a later decision made false is struck through where it stands,
 * with one clause naming what voided it. That makes the strikes content, and until
 * this page existed every one of them was invisible unless you opened the file.
 *
 * Every figure, chip, count and edge here is read out of `adr/*.md` at build time
 * by `plugin/decisions.ts`, which throws rather than hand over an empty set. The
 * workbench holds no copy of any record, so the board cannot disagree with them.
 *
 * What a row deliberately does not carry: the index's sentence about the record
 * (it runs to fifty words on some rows and would make the board three lines tall,
 * and the one exception is the withdrawn record, where that sentence is the reason
 * and the row is the place a reader needs it), the records this one voided claims
 * in (every such edge is another row's incoming edge, so drawing both would draw
 * the graph twice), and the record's own status word where it is the usual
 * `accepted`. All three are in the detail.
 */
export function Decisions() {
  const intl = useWorkbenchIntl();
  const [standing, setStanding] = useState<'all' | Standing>('all');
  const [query, setQuery] = useState('');
  const [caveatOnly, setCaveatOnly] = useState(false);
  const [open, setOpen] = useState<ReadonlySet<string>>(() => new Set());
  const sections = useSections('/decisions', true);

  const reveal = useCallback((number: string) => {
    const record = BY_NUMBER.get(number);
    if (!record) return;

    setOpen((current) => new Set(current).add(number));
    // Each filter is cleared only if it is the one hiding the target, so a reader
    // who arrives by link keeps as much of their own view as still shows the row.
    setStanding((current) => (current === 'all' || current === record.standing ? current : 'all'));
    setCaveatOnly((current) => (current && record.caveats.length === 0 ? false : current));
    setQuery((current) =>
      current.trim() === '' || (TEXT.get(number) ?? '').includes(current.trim().toLowerCase())
        ? current
        : '',
    );
  }, []);

  // A reader can arrive on a row anchor from another page, or from a reload.
  useEffect(() => {
    const hash = window.location.hash;
    if (hash.startsWith('#rec-')) reveal(hash.slice('#rec-'.length));
  }, [reveal]);

  const toggle = (number: string) =>
    setOpen((current) => {
      const next = new Set(current);
      if (!next.delete(number)) next.add(number);
      return next;
    });

  const needle = query.trim().toLowerCase();
  const visible = RECORDS.filter((record) => {
    if (standing !== 'all' && record.standing !== standing) return false;
    if (caveatOnly && record.caveats.length === 0) return false;
    if (needle !== '' && !(TEXT.get(record.number) ?? '').includes(needle)) return false;
    return true;
  });
  const shown = new Set(visible.map((record) => record.number));

  return (
    <>
      <Slot id="contents">
        <Toc headings={sections} />
      </Slot>

      <Page className="text-m">
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
              {/* `intl.formatMessage` and never `<FormattedMessage>`: that component
                  reads react-intl's own context, which the app's provider shadows
                  inside an `AppHost`. `test/i18n.test.ts` fails on one, and
                  `i18n/Localisation.tsx` carries the measurement. */}
              {intl.formatMessage(COPY.lede, { em, architecture })}
            </p>

            {/*
              The rule and its counts, behind one ⓘ under the lede. They are how to read
              a strike, and a strike on the board already says what voided it.
            */}
            <div className="mt-s">
              <InfoTip about={intl.formatMessage(COPY.ruleLabel)} showLabel>
                <p>{intl.formatMessage(COPY.ruleNever, { strong, em })}</p>
                <p>
                  {intl.formatMessage(COPY.ruleStruck, {
                    struck: STRUCK,
                    records: RECORDS.length,
                    f,
                  })}
                </p>
                <p>{intl.formatMessage(COPY.ruleUnattributed, { count: UNATTRIBUTED, f })}</p>
                {CLAUSELESS > 0 && (
                  <p>{intl.formatMessage(COPY.ruleClauseless, { count: CLAUSELESS, f })}</p>
                )}
              </InfoTip>
            </div>
          </header>

          {/*
            A heading beside the legend, not instead of it. The legend names the
            group for the browser; the heading is what puts this block in the
            outline. Both, for the same reason as on the sources board.
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
                count={COUNT.all}
                checked={standing === 'all'}
                onSelect={() => setStanding('all')}
              >
                {intl.formatMessage(COPY.tileAllNote, {
                  from: RECORDS[0].date,
                  to: RECORDS[RECORDS.length - 1].date,
                  f,
                })}
              </Tile>

              {ORDER.map((key) => (
                <Tile
                  key={key}
                  value={key}
                  name={intl.formatMessage(STANDING_LOOK[key].label)}
                  standing={key}
                  count={COUNT[key]}
                  checked={standing === key}
                  onSelect={() => setStanding(key)}
                >
                  {intl.formatMessage(STANDING_LOOK[key].meaning)}
                </Tile>
              ))}
            </div>
          </fieldset>

          <section className="min-w-0" aria-labelledby="h-careful">
            <div className={HEAD_ROW}>
              <h2 id="h-careful" className={SECTION_HEAD}>
                {intl.formatMessage(COPY.carefulTitle)}
              </h2>
              <InfoTip about={intl.formatMessage(COPY.carefulTitle)}>
                <p>
                  {/* Three counts and not one sentence with "one" typed into it. The
                      withdrawn record has been the only one for as long as this page
                      has existed, and a second would have left the sentence saying
                      otherwise with nothing going red. */}
                  {intl.formatMessage(COPY.carefulLede, {
                    careful: CAREFUL.length,
                    withdrawn: COUNT.withdrawn,
                    rest: CAREFUL.length - COUNT.withdrawn,
                    f,
                  })}
                </p>
              </InfoTip>
            </div>

            <ul className="mt-s grid gap-xs lg:grid-cols-3">
              {CAREFUL.map((record) => (
                <li
                  key={record.number}
                  className={cn(
                    'flex min-w-0 flex-col gap-xs rounded-md border border-stroke border-l-2 bg-surface p-sm',
                    record.standing === 'withdrawn'
                      ? 'border-l-accent'
                      : 'border-l-accent-alternative',
                  )}
                >
                  <p className="flex flex-wrap items-center gap-xs">
                    {record.standing === 'withdrawn' ? (
                      <StandingMark standing="withdrawn" />
                    ) : (
                      record.caveats.map((caveat) => <Caveat key={caveat} text={caveat} />)
                    )}
                    <span className={cn(FIGURE, 'font-semibold text-on-canvas')}>
                      {record.number}
                    </span>
                  </p>
                  {/* The record's own title and the index's own sentence about it,
                      both printed as the repository wrote them. */}
                  <p className="font-medium text-on-canvas">{record.title}</p>
                  <p className="text-m text-on-canvas-muted">{record.note}</p>
                  <p className="mt-auto flex flex-wrap gap-sm pt-2xs text-m">
                    <a
                      className={LINK}
                      href={`#rec-${record.number}`}
                      onClick={() => reveal(record.number)}
                    >
                      {intl.formatMessage(COPY.carefulRow)}
                    </a>
                    <a className={LINK} href={href(record.route)}>
                      {intl.formatMessage(COPY.carefulRead)}
                    </a>
                  </p>
                </li>
              ))}
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
                  htmlFor="decisions-query"
                  className="mb-3xs block text-s font-medium text-on-canvas-muted"
                >
                  {intl.formatMessage(COPY.filter)}
                </label>
                <input
                  type="search"
                  id="decisions-query"
                  placeholder={intl.formatMessage(COPY.filterPlaceholder)}
                  autoComplete="off"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  className="h-[2.25rem] w-full rounded-md border border-stroke bg-canvas px-xs text-m text-on-canvas placeholder:text-on-canvas-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                />
              </div>

              <label className="flex items-center gap-xs text-m text-on-canvas-muted">
                <input
                  type="checkbox"
                  checked={caveatOnly}
                  onChange={(event) => setCaveatOnly(event.target.checked)}
                  className="size-[1rem] accent-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                />
                {intl.formatMessage(COPY.only)}
              </label>

              <div className="flex items-center gap-2xs">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setOpen(new Set(RECORDS.map((record) => record.number)))}
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
                {intl.formatMessage(COPY.showing, {
                  shown: visible.length,
                  total: RECORDS.length,
                })}
              </output>
            </div>

            {/*
              The board scrolls inside this box, and two classes here are
              load-bearing for the same two reasons they are on the sources board:
              `min-w-0` or a flex child refuses to shrink below its content and the
              page scrolls sideways, and `relative` or the `sr-only` spans in the
              cells resolve against the page and reach out past the clip with
              nothing visible out there.
            */}
            <div className="relative mt-s min-w-0 overflow-x-auto rounded-md border border-stroke">
              {/*
                `min-w-[56rem]`, raised from `40rem` for issue #173. Auto table
                layout does not treat a column's `w-[13rem]` as a floor: below the
                table's own content minimum — measured at 756px, because the
                widest cell is a record's chips laid out on one line — every
                column sits on ITS OWN minimum instead, and `Struck claims`
                collapses to under half its declared width. Each chip then wraps
                to a row of its own, so a record with several strikes grows a row
                past 200px tall, mostly off the right edge of this box at a narrow
                window: a screenshot of the visible half reads as empty space.
                Forcing the table wider than its own content minimum is what lets
                the declared width apply again; the box above still scrolls, so
                the page itself never does.

                A German column head is longer than an English one, and this width
                is the table's content minimum rather than a sum of its columns, so
                the widths below still apply and the box still scrolls.
              */}
              <table className="w-full min-w-[56rem] border-collapse text-left">
                <caption className="border-b border-stroke bg-surface px-s py-xs text-left text-s text-on-canvas-muted">
                  {intl.formatMessage(COPY.caption, { code })}
                </caption>
                <thead>
                  <tr className="border-b border-stroke-strong">
                    {[
                      { head: COPY.columnStanding },
                      { head: COPY.columnRecord, width: 'w-[7rem]' },
                      { head: COPY.columnDecision },
                      { head: COPY.columnStruck, width: 'w-[13rem]' },
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
                    <th scope="col" className="px-s py-xs">
                      <span className="sr-only">{intl.formatMessage(COPY.details)}</span>
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {RECORDS.map((record) => {
                    const isVisible = shown.has(record.number);
                    const isOpen = open.has(record.number);
                    return (
                      <Fragment key={record.number}>
                        <tr
                          id={`rec-${record.number}`}
                          hidden={!isVisible}
                          className={cn(
                            'align-top target:bg-surface',
                            isOpen ? 'bg-surface' : 'border-b border-stroke',
                          )}
                        >
                          <td
                            className={cn(
                              'border-l-2 px-s py-xs',
                              record.standing === 'withdrawn'
                                ? 'border-l-accent'
                                : record.caveats.length > 0
                                  ? 'border-l-accent-alternative'
                                  : 'border-l-transparent',
                            )}
                          >
                            <StandingMark standing={record.standing} />
                          </td>
                          <td className="px-s py-xs">
                            <span className={cn(FIGURE, 'block font-semibold text-on-canvas')}>
                              {record.number}
                            </span>
                            <span className={cn(FIGURE, 'block text-s text-on-canvas-muted')}>
                              {record.date}
                            </span>
                          </td>
                          <td className="min-w-0 px-s py-xs">
                            <a
                              className={cn(LINK, 'font-medium text-on-canvas')}
                              href={href(record.route)}
                            >
                              {record.title}
                            </a>
                            {(record.caveats.length > 0 || record.status !== 'accepted') && (
                              <span className="mt-3xs flex flex-wrap items-center gap-2xs">
                                {record.caveats.map((caveat) => (
                                  <Caveat key={caveat} text={caveat} />
                                ))}
                                {/* The status word only where it is not the usual
                                  one. Thirty rows reading "accepted" beside a chip
                                  that already says the record stands is a column
                                  of noise; three rows saying something else are
                                  the fact worth carrying. It is the record's own
                                  word and is printed as the record writes it. */}
                                {record.status !== 'accepted' && (
                                  <Badge variant="outline">{record.status}</Badge>
                                )}
                              </span>
                            )}
                            <Reason record={record} />
                          </td>
                          <td className="px-s py-xs">
                            {record.struck.length === 0 ? (
                              <span className="text-on-canvas-muted">
                                {intl.formatMessage(COPY.struckNone)}
                              </span>
                            ) : (
                              <>
                                {/* The count, but not where it is 1. "1 claim"
                                  says nothing a reader did not already get from
                                  the standing chip, and the row now says why
                                  instead — which is issue #166's point, kept
                                  under its own rule that a fuller row drops the
                                  number rather than stacking both. The message
                                  carries its singular anyway, because a branch
                                  nothing reaches today is one a translator can
                                  still be asked for. */}
                                {record.struck.length > 1 &&
                                  intl.formatMessage(COPY.struckCount, {
                                    count: record.struck.length,
                                    n,
                                    w,
                                  })}
                                <span
                                  className={cn(
                                    'flex flex-wrap items-center gap-2xs',
                                    record.struck.length > 1 && 'mt-3xs',
                                  )}
                                >
                                  <span className="text-s text-on-canvas-muted">
                                    {intl.formatMessage(COPY.struckBy)}
                                  </span>
                                  {record.voidedBy.length > 0 ? (
                                    recordChips(record.voidedBy, reveal, intl)
                                  ) : (
                                    /* Not "by no later record". These are most of
                                      the strikes on the board — the note above
                                      counts them, out of the records rather than
                                      from a number typed here — and reporting the
                                      commonest case as an absence made the one
                                      thing that IS known about them, the clause
                                      now under the title, read as missing data.
                                      What is true of all of them is that something
                                      later found it out, and that the finding is
                                      not a record with a number. */
                                    <span className="text-s text-on-canvas-muted">
                                      {intl.formatMessage(COPY.struckFinding)}
                                    </span>
                                  )}
                                </span>
                              </>
                            )}
                          </td>
                          <td className="px-s py-xs text-right">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              aria-expanded={isOpen}
                              aria-controls={`det-${record.number}`}
                              onClick={() => toggle(record.number)}
                            >
                              {intl.formatMessage(isOpen ? COPY.hide : COPY.details)}
                              {/* Thirty-three of these, and a reader listing the
                                page's controls heard "Details" thirty-three
                                times. The record is what tells them apart. */}
                              <span className="sr-only">
                                {intl.formatMessage(COPY.recordName, {
                                  number: record.number,
                                  title: record.title,
                                })}
                              </span>
                            </Button>
                          </td>
                        </tr>
                        <tr
                          id={`det-${record.number}`}
                          hidden={!isVisible || !isOpen}
                          className="border-b border-stroke bg-surface"
                        >
                          <td colSpan={5} className="px-s pb-sm pt-0">
                            <div className="max-w-content space-y-sm text-m leading-normal text-on-canvas-muted">
                              <p>
                                <span className="text-on-canvas">
                                  {intl.formatMessage(COPY.detailIndex)}
                                </span>{' '}
                                {record.note}
                              </p>

                              {record.struck.length > 0 && (
                                <div>
                                  <p className="text-on-canvas">
                                    {intl.formatMessage(COPY.detailStruck, {
                                      count: record.struck.length,
                                    })}
                                  </p>
                                  <ul className="mt-2xs space-y-2xs">
                                    {/* Keyed by the claim AND its clause: the
                                      claim alone is not unique. ADR 0006 strikes
                                      the bare word `AsyncStorage` in two cells of
                                      one table, and React drew one of them and
                                      dropped the other. The two clauses differ,
                                      which is the only thing that tells the cells
                                      apart in the record either.

                                      Both are the record's own words and are
                                      printed as it writes them. */}
                                    {record.struck.map((claim) => (
                                      <li
                                        key={`${claim.claim}|${claim.clause}`}
                                        className="border-l-2 border-stroke-strong pl-s"
                                      >
                                        <s className="text-on-canvas-muted">{claim.claim}</s>
                                        {claim.clause !== '' && (
                                          <span className="block text-on-canvas">
                                            {claim.clause}
                                          </span>
                                        )}
                                        {claim.clause === '' && (
                                          /* A strike whose reason is in the
                                             following paragraph, which no parsing
                                             recovers. Said plainly rather than
                                             left as a claim with nothing after it,
                                             which reads as a parser that failed. */
                                          <span className="block text-s text-on-canvas-muted">
                                            {intl.formatMessage(COPY.detailNoClause)}
                                          </span>
                                        )}
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}

                              {record.voids.length > 0 && (
                                <p className="flex flex-wrap items-center gap-2xs">
                                  <span className="text-on-canvas">
                                    {intl.formatMessage(COPY.detailVoids, {
                                      count: record.voids.length,
                                    })}
                                  </span>
                                  {recordChips(record.voids, reveal, intl)}
                                </p>
                              )}

                              <p>
                                <a className={LINK} href={href(record.route)}>
                                  {intl.formatMessage(COPY.detailRead, { number: record.number })}
                                </a>
                              </p>
                            </div>
                          </td>
                        </tr>
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          <footer className="min-w-0 border-t border-stroke pt-sm">
            <InfoTip about={intl.formatMessage(COPY.footerLabel)} showLabel side="top">
              <p>{intl.formatMessage(COPY.footerBuild, { code })}</p>
              <p>{intl.formatMessage(COPY.footerNotes, { notes })}</p>
            </InfoTip>
          </footer>
        </div>
      </Page>
    </>
  );
}
