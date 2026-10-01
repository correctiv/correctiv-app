import { defineMessages } from 'react-intl';

import { cn } from '../lib/cn';
import { chainLayout, standingWord, type ChainArc, type ChainNode } from './layout';
import {
  ARC,
  ArrowMarker,
  AXIS,
  BOLD,
  DiagramFigure,
  DRAWING,
  HALO,
  MONO,
  MUTED,
  NODE_INTACT,
  NODE_MOOT,
  NODE_QUIET,
  NODE_STRUCK,
  RULE,
  STRIKE,
  T11,
  T12,
  T13,
} from './shared';

import docs from 'virtual:docs';
import type { Standing } from '../../plugin/decisions.ts';

/**
 * Which decisions still stand, and which of their claims do not.
 *
 * Nothing here knows a record number. The records come from `virtual:docs`, which
 * is `plugin/decisions.ts` reading `adr/` at build time — the same source the
 * board at `/decisions` reads, so the picture and the table cannot disagree — and
 * `./layout.ts` turns them into coordinates. This file is the part that says what
 * a coordinate is drawn WITH, and `./layout.ts` carries the reasoning about how
 * the drawing grows.
 *
 * The caption and the list under it are generated for the same reason the drawing
 * is. They are not commentary on the picture, they are the picture said twice, and
 * the half that is typed is the half that goes stale: the old list described 0014
 * as struck by 0024 while the old drawing drew it intact, and the file carried a
 * comment explaining that the two disagreed on purpose. Both halves read one array
 * now, so there is no second place for that to happen.
 */
export const LAYOUT = chainLayout(docs.decisions, docs.strikes);
const SUMMARY = LAYOUT.summary;

/**
 * What this drawing is CALLED, in ENGLISH; the German that ships is
 * `src/i18n/catalogue/de/decisionsChain.ts`.
 *
 * **Two ids and not the drawing.** The picture, its legend, its caption and the
 * list under it are still literals in this file, which
 * `test/rendered-literals.test.ts` counts and ADR 0052 §1 puts in scope. They
 * are the hardest of the six to move and are left to a pass of their own: every
 * sentence under this drawing is assembled from the records at build time, so
 * translating it means turning `voidersSentence` and `join` into ICU rather than
 * into strings. The title and the lede are here because `diagrams/index.ts`
 * takes them, and the table of drawings had to speak one language or the other.
 *
 * Named rather than called `COPY` for the reason every drawing's block is:
 * another module imports it.
 */
export const DECISIONS_CHAIN_COPY = defineMessages({
  title: {
    id: 'decisionsChain.title',
    defaultMessage: 'Which decisions still stand, and which of their claims do not',
    description:
      'The drawing’s name, as the heading of its own page and on the card that opens it.',
  },
  lede: {
    id: 'decisionsChain.lede',
    defaultMessage:
      '{records} records, never rewritten. When a later decision makes an earlier claim false, the claim is struck through, and the later record names what it retired. Read a row to see whether a record still holds. Follow the arcs to see which record changed it.',
    description:
      'The paragraph under that heading. {records} is how many records adr/ holds, counted by the drawing’s own layout rather than typed. test/diagrams.test.ts holds it to that count, so the placeholder has to stay at the front of the sentence.',
  },
});

/** The ring that says how a record stands. Four marks, each named in the legend. */
const NODE_MARK: Record<Standing | 'quiet', string> = {
  stands: NODE_INTACT,
  'partly-struck': NODE_STRUCK,
  withdrawn: NODE_MOOT,
  quiet: NODE_QUIET,
};

function markOf(node: Pick<ChainNode, 'standing' | 'quiet'>): string {
  return NODE_MARK[node.quiet ? 'quiet' : node.standing];
}

/**
 * The drawing on its own, with no description attached by default.
 *
 * `alt` is off here and on in the figure, and that asymmetry is the point: the
 * description it names lives in the figure, so a drawing rendered by itself, as a
 * thumbnail on `/diagrams`, would be pointing at an element that is not on the
 * page.
 *
 * The size is an attribute rather than a `h-[985px]` class, because the height is
 * now a number this file computes and Tailwind compiles its arbitrary values from
 * the source text. A class built in a template literal is a class that was never
 * generated, which renders as a drawing with no height at all.
 */
export function DecisionsChainDrawing({ alt = false }: { alt?: boolean } = {}) {
  return (
    <svg
      viewBox={`0 0 ${LAYOUT.width} ${LAYOUT.height}`}
      width={LAYOUT.width}
      height={LAYOUT.height}
      className={cn(DRAWING, 'block max-w-none')}
      aria-labelledby="d2-title"
      aria-describedby={alt ? 'd2-alt' : undefined}
    >
      {/*
        No count and no range in here. The records are a growing set, a number
        written into a title is not, and the lede beside the drawing already reads
        the count rather than being told it.
      */}
      <title id="d2-title">
        The architecture decision records in order on one axis, with an arc from each record to the
        earlier record whose claim it struck
      </title>
      <defs>
        <ArrowMarker id="d2-arrow" />
      </defs>

      <text x={LAYOUT.arcX} y={LAYOUT.headerY} textAnchor="end" className={cn(T11, MUTED)}>
        a later record strikes a claim in an earlier one
      </text>
      <text x={LAYOUT.numberX} y={LAYOUT.headerY} className={cn(T11, MUTED)}>
        record
      </text>
      <text x={LAYOUT.titleX} y={LAYOUT.headerY} className={cn(T11, MUTED)}>
        title
      </text>
      <text x={LAYOUT.rightX} y={LAYOUT.headerY} textAnchor="end" className={cn(T11, MUTED)}>
        struck by
      </text>

      <line
        x1={LAYOUT.axisX}
        y1={LAYOUT.axis.top}
        x2={LAYOUT.axisX}
        y2={LAYOUT.axis.bottom}
        className={AXIS}
      />

      <g className={ARC}>
        {LAYOUT.arcs.map((arc) => (
          <path key={arcKey(arc)} d={arc.path} markerEnd="url(#d2-arrow)" />
        ))}
      </g>

      <g className={T13}>
        {LAYOUT.nodes.map((node) => (
          <Rung key={node.number} node={node} />
        ))}
      </g>

      <line
        x1={LAYOUT.marginX}
        y1={LAYOUT.ruleY}
        x2={LAYOUT.rightX}
        y2={LAYOUT.ruleY}
        className={RULE}
      />
      <g className={T12}>
        {LAYOUT.legend.map((item) => (
          <g key={item.text}>
            {item.kind === 'node' && (
              <circle
                cx={LAYOUT.marginX + 20}
                cy={item.y}
                r={item.mark === 'quiet' ? 3.5 : 8}
                className={NODE_MARK[item.mark ?? 'stands']}
              />
            )}
            {item.kind === 'arc' && (
              <line
                x1={LAYOUT.marginX}
                y1={item.y}
                x2={LAYOUT.marginX + 56}
                y2={item.y}
                className={ARC}
                markerEnd="url(#d2-arrow)"
              />
            )}
            <text x={item.kind === 'note' ? LAYOUT.marginX : LAYOUT.marginX + 68} y={item.y}>
              {item.text}
            </text>
          </g>
        ))}
      </g>
    </svg>
  );
}

/** One record's rung: its mark on the axis, its number, its title, its voiders. */
function Rung({ node }: { node: ChainNode }) {
  return (
    <>
      <circle cx={LAYOUT.axisX} cy={node.y} r={node.radius} className={markOf(node)} />
      <text
        x={LAYOUT.numberX}
        y={node.y}
        className={cn(MONO, node.quiet ? T12 : BOLD, node.quiet ? MUTED : undefined)}
      >
        {node.number}
      </text>
      {node.label !== '' && (
        <text
          x={LAYOUT.titleX}
          y={node.y}
          className={node.standing === 'withdrawn' ? STRIKE : undefined}
        >
          {node.label}
        </text>
      )}
      {node.struckByText !== '' && (
        <text x={LAYOUT.rightX} y={node.y} textAnchor="end" className={cn(MONO, T12, MUTED, HALO)}>
          {node.struckByText}
        </text>
      )}
    </>
  );
}

function arcKey(arc: ChainArc): string {
  return `${arc.by}-${arc.of}`;
}

/**
 * What the list says after a record's standing: who struck a claim in it.
 *
 * Empty for a record nothing struck, which is why the caller joins it with a
 * comma rather than writing one. The second branch is the record whose claims
 * were struck with no later record named in the clause, and it has to say so:
 * `plugin/decisions.ts` keeps the reasons that shape can arise, and a list entry
 * reading "partly struck." with nothing after it reads as a parser that gave up.
 */
function voidersSentence(node: ChainNode): string {
  const parts = node.struckBy.map((s) => (s.claims > 1 ? `${s.by} (${s.claims} claims)` : s.by));
  if (parts.length === 0) {
    if (node.unattributed === 0) return '';
    const claims = node.unattributed === 1 ? '1 claim' : `${node.unattributed} claims`;
    return `${claims} struck with no later record named`;
  }
  return `struck by ${join(parts)}`;
}

function join(parts: string[]): string {
  if (parts.length < 2) return parts.join('');
  return `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;
}

/**
 * Which decisions still stand, and which of their claims do not.
 *
 * The list under it is not a caption, it is the page for anyone who cannot use
 * the drawing, and `aria-describedby` points at it, which is why the ids here
 * have to stay as they are.
 */
export function DecisionsChain({ alt = true }: { alt?: boolean }) {
  const quiet = LAYOUT.nodes.filter((node) => node.quiet);
  const loud = LAYOUT.nodes.filter((node) => !node.quiet);

  return (
    <DiagramFigure
      number={2}
      altId="d2-alt"
      alt={alt}
      drawing={<DecisionsChainDrawing alt={alt} />}
      caption={
        <>
          <strong>A record is amended, never rewritten, so its history is a set of arcs.</strong>{' '}
          {SUMMARY.records} records on the axis and {SUMMARY.arcs} arcs between them:{' '}
          {SUMMARY.stands} stand with nothing in them made false, {SUMMARY.partlyStruck} are
          accepted with claims struck in place, and {SUMMARY.withdrawn} no longer stands. Every arc
          comes from a record&apos;s own clause naming the record that struck it, so the drawing
          states nothing the records do not.{' '}
          {SUMMARY.busiest && (
            <>
              {SUMMARY.busiest.number} strikes the most, {SUMMARY.busiest.count} records.{' '}
            </>
          )}
          {SUMMARY.mostAmended && (
            <>
              {SUMMARY.mostAmended.number} is the most amended, struck by{' '}
              {SUMMARY.mostAmended.count} records.{' '}
            </>
          )}
          {SUMMARY.heaviest && (
            <>
              The heaviest single arc is {SUMMARY.heaviest.by}&apos;s {SUMMARY.heaviest.claims}{' '}
              claims in {SUMMARY.heaviest.of}.{' '}
            </>
          )}
          Two things are deliberately absent, both of them in the drawing this replaced: the
          relations recorded only in the index&apos;s prose, and the corrections that landed in{' '}
          <code>ARCHITECTURE.md</code> and in code comments. Neither can be derived from a record,
          and a living document is rewritten in place rather than annotated, so there is nothing
          left in it to read.
        </>
      }
    >
      <p>
        Every record in <code>adr/</code>, in number order, with its standing and both ends of the
        retirement graph. This list and the drawing are generated from one array, so they cannot
        disagree.
      </p>
      <ul>
        {quiet.length > 0 && (
          <li>
            {quiet.map((node) => node.number).join(', ')}: nothing recorded either way. They stand,
            they struck no claim in another record, and no record has struck one in them.
          </li>
        )}
        {loud.map((node) => {
          // A full stop after the title and not a colon: several titles in
          // `adr/` carry a colon of their own, and a record whose heading ends
          // "measured, not adopted yet: no longer stands" is two of them in one
          // sentence.
          const voiders = voidersSentence(node);
          return (
            <li key={node.number}>
              {node.number} {node.standing === 'withdrawn' ? <s>{node.title}</s> : node.title}.{' '}
              {standingWord(node.standing)}
              {voiders === '' ? '' : `, ${voiders}`}
              {node.voids.length > 0 && `. Strikes ${join(node.voids)}`}.
            </li>
          );
        })}
      </ul>
      <p>
        A struck claim is this repository&apos;s discipline working rather than damage: the record
        is left standing and the claim is struck where it stands, so {SUMMARY.partlyStruck} of{' '}
        {SUMMARY.records} carry one. Only the{' '}
        {SUMMARY.withdrawn === 1 ? 'one record' : `${SUMMARY.withdrawn} records`} whose own status
        line is struck through should be read as history.
      </p>
    </DiagramFigure>
  );
}
