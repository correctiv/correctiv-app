import type { DecisionRecord, Standing, Strike } from '../../plugin/decisions.ts';

/**
 * Where every mark of the decisions drawing goes, computed from the records.
 *
 * The drawing used to be a picture. Every node, every arc and every label was
 * typed, it drew 0001 through 0023, and the lede above it read the record count
 * off `virtual:docs` and said thirty-six — so the diagram about how this
 * repository keeps its decisions straight was thirteen records stale, and every
 * check was green. That is the failure `AGENTS.md` describes under "Facts that
 * expire", sitting inside the picture of the discipline that exists to prevent it.
 *
 * So this file holds no record number, no title and no coordinate that belongs to
 * a particular record. It takes what `plugin/decisions.ts` derived from `adr/` and
 * returns positions. A record is drawn because it exists; an arc is drawn because
 * a clause in a record names the record that struck it. Adding a record to `adr/`
 * is the whole of adding it to the drawing.
 *
 * WHAT IS NOT DRAWN, and why, because both were in the old picture:
 *
 *   THE INDEX'S OWN RELATIONS. Three arcs came from prose in `adr/README.md`'s
 *   last column — 0002 moot since 0007, 0005 amended by 0006 and carried out by
 *   0007 — because no record before 0009 had a section naming what it retired.
 *   The obvious derivation is "a record number in a row's note", and it is wrong:
 *   ADR 0034's row ends "is the prerequisite 0033 names", which that rule reads
 *   as 0033 striking a claim in 0034. A drawing generated from a rule that
 *   invents an edge is worse than one missing three, and the notes are on
 *   `/decisions` as prose, which is what they are. 0002 has an arc regardless —
 *   its own status line names 0027.
 *
 *   THE LIVING DOCUMENTS. A column on the right held `ARCHITECTURE.md`,
 *   `README.md` and "code comments" with edges into them. A living document is
 *   rewritten in place rather than annotated, so nothing durable records which
 *   decision corrected it: the old column's figures — one claim in eighteen
 *   places, four code comments — were read out of the records' prose by a person,
 *   and `README.md` carries no struck claim at all today although the drawing
 *   still pointed at it. Keeping a hand-typed column inside a generated drawing
 *   would rebuild exactly the defect this file removes.
 */

/**
 * The coordinate space, which is also the size the drawing asks for.
 *
 * HOW THIS GROWS, which is the question a fixed 1100×985 with twenty-three rungs
 * could not answer. Height is linear in the record count and width is bounded:
 *
 *   The axis is the record sequence, and that sequence is the one ordering the
 *   drawing is about. Splitting it into columns to save height would put 0019 and
 *   0020 in different columns — the graph's densest region is 0016 to 0020, and a
 *   split lands somewhere arbitrary inside it. Measured on today's set, about
 *   half the arcs span any two-column split, and each of those turns from a
 *   nested arc into a horizontal run across the gap. Vertical is also the
 *   direction a web page already scrolls; width is what the reader pays for
 *   immediately, inside a box that scrolls sideways.
 *
 *   So the rungs stay on one axis at a fixed pitch and the height follows: about
 *   1.2 screens today, about 1.6 at fifty records. What does NOT follow is the
 *   width. The arcs are packed into lanes by overlap, and the number of lanes is
 *   the depth of the deepest tangle rather than the length of the list, so the
 *   gutter stops widening once the graph stops getting more knotted. `LANE_STEP`
 *   is a maximum and the real step divides whatever gutter there is, so the
 *   drawing cannot grow an arc off its own left edge however many lanes it needs.
 */
const WIDTH = 1100;

/** The axis, and the gutter to its left that the arcs bulge into. */
const AXIS_X = 300;
const MARGIN = 40;
/** Where an arc meets the axis, clear of the node circles sitting on it. */
const ARC_X = AXIS_X - 12;
/** How far apart two nested arcs sit, at most. Less when the gutter is full. */
const LANE_STEP = 22;
/** Vertical clearance between two arcs sharing a lane, so neither rides the other. */
const LANE_CLEARANCE = 7;

/**
 * One rung to the next.
 *
 * Twenty-six against thirteen-pixel labels is a line height of two, which is what
 * the old drawing's thirty-four bought at the twenty-three rungs it drew and could
 * not go on affording as the set grew.
 */
const PITCH = 26;
const FIRST_RUNG = 76;
const HEADER_Y = 40;

const NUMBER_X = AXIS_X + 20;
const TITLE_X = NUMBER_X + 52;
/** The right edge, which the struck-by column is anchored to rather than filling. */
const RIGHT = WIDTH - 20;
const COLUMN_GAP = 18;

/**
 * Glyph advances, estimated, because SVG text does not wrap and nothing here can
 * measure a font.
 *
 * Both are rounded UP from what a system sans at 13px and a system mono at 12px
 * actually take, so the error truncates a title one character early rather than
 * running it under the column to its right. A generated layout that overlaps its
 * own labels passes every test there is, so the estimate is deliberately the
 * pessimistic one.
 */
const TITLE_ADVANCE = 7;
const MONO_ADVANCE = 7.3;

/**
 * The same two estimates, for the check that no row's title runs under the column
 * beside it.
 *
 * Shared on purpose, and worth knowing what that buys and what it does not. The
 * check and the layout agree on how wide a character is, so it can catch the
 * arithmetic going wrong — a title not cut, a column anchored from the wrong edge,
 * a gap spent twice — and it cannot catch the estimate itself being wrong for the
 * font the browser picks. That half is what the screenshot in the pull request is
 * for, in both appearance settings, which is the rule `AGENTS.md` states as a
 * green check proving nothing about how the page looks.
 */
export const ADVANCE = { title: TITLE_ADVANCE, mono: MONO_ADVANCE };

const NODE_R = 8;
const QUIET_R = 3.5;

/** What the axis is drawn past the first and last rung. */
const AXIS_OVERHANG = 12;

/**
 * How the list under the figure opens a record's standing, as a sentence.
 *
 * The board's own words at `/decisions`, which is the point: a reader who cannot
 * use the drawing and a reader scanning the table should be told the same three
 * things in the same three phrases.
 */
const STANDING_WORD: Record<Standing, string> = {
  stands: 'Stands',
  'partly-struck': 'Partly struck',
  withdrawn: 'No longer stands',
};

/** One record, placed. */
export interface ChainNode {
  number: string;
  /** The record's title in full, which is what the list under the figure prints. */
  title: string;
  /** The same title cut to the room this row actually has. May be identical. */
  label: string;
  standing: Standing;
  /**
   * Nothing recorded either way: it stands, it struck nothing, nothing struck it.
   *
   * Drawn as a dot with its number and no title, which is the one piece of
   * hierarchy in the drawing, and roughly a third of the set is in it. Printing
   * every title would be the table at `/decisions` with arcs drawn over it; the
   * list under the figure names all of them, quiet ones included.
   */
  quiet: boolean;
  y: number;
  radius: number;
  /** The records that struck a claim here, ascending, with how many each struck. */
  struckBy: Strike[];
  /** The records this one struck a claim in, ascending. */
  voids: string[];
  /**
   * How many claims are struck here that name no later record, or 0.
   *
   * A record can be partly struck with an empty `struckBy`: a claim can be
   * falsified by a re-measurement, and a clause can sit in the block after its
   * strike, which `plugin/decisions.ts` keeps a named list of. A yellow node with
   * an empty column would read as a drawing that failed rather than as a fact.
   */
  unattributed: number;
  /** The right-hand column's text, already assembled. Empty when there is none. */
  struckByText: string;
}

/** One arc, from the record that struck to the record struck. */
export interface ChainArc extends Strike {
  /** Which nesting lane it was packed into; 0 is nearest the axis. */
  lane: number;
  /** The cubic the drawing renders, already in the drawing's coordinates. */
  path: string;
}

/**
 * The figures the caption and the list are written around.
 *
 * Every one of them is counted here rather than typed there, for the same reason
 * the drawing is: a sentence under a picture goes stale in exactly the way the
 * picture does, and nothing about it looks wrong.
 */
export interface ChainSummary {
  records: number;
  stands: number;
  partlyStruck: number;
  withdrawn: number;
  quiet: number;
  arcs: number;
  /** The record that struck claims in the most others. */
  busiest: { number: string; count: number } | null;
  /** The record the most other records struck. */
  mostAmended: { number: string; count: number } | null;
  /** The single heaviest arc: the most claims one record struck in another. */
  heaviest: Strike | null;
}

export interface ChainLegendItem {
  kind: 'node' | 'arc' | 'note';
  /** Only for `node`: which standing's mark to draw, or `quiet` for the dot. */
  mark?: Standing | 'quiet';
  y: number;
  text: string;
}

export interface ChainLayout {
  width: number;
  height: number;
  /** The left edge everything starts at: the legend, the rule, the outermost arc. */
  marginX: number;
  axisX: number;
  arcX: number;
  numberX: number;
  titleX: number;
  rightX: number;
  headerY: number;
  axis: { top: number; bottom: number };
  ruleY: number;
  /** How many nesting lanes the arcs needed, and how far apart they ended up. */
  lanes: number;
  laneStep: number;
  nodes: ChainNode[];
  arcs: ChainArc[];
  legend: ChainLegendItem[];
  summary: ChainSummary;
}

/**
 * The drawing, as coordinates.
 *
 * Pure, and that is what makes it checkable: `test/diagrams.test.ts` runs it over
 * the same records the site builds from and asserts the properties a generator
 * can break — a record that did not become a rung, two rungs at one y, an arc
 * whose end is not a rung, an arc off the canvas, a label overlapping the column
 * beside it.
 */
export function chainLayout(records: DecisionRecord[], strikes: Strike[]): ChainLayout {
  const drawn = new Set(records.map((record) => record.number));
  // An arc whose other end is not on the axis has nowhere to point. It cannot
  // happen from `adr/` — a voider is a record — but it is the shape of failure a
  // generated drawing has and a typed one did not, so it is dropped here and the
  // test asserts that nothing was dropped.
  const edges = strikes.filter((strike) => drawn.has(strike.by) && drawn.has(strike.of));

  const nodes = records.map((record, index) => placeNode(record, index, edges));
  const y = new Map(nodes.map((node) => [node.number, node.y]));

  const arcs = packArcs(edges, y);
  const lanes = arcs.reduce((most, arc) => Math.max(most, arc.lane + 1), 0);
  const step = laneStep(lanes);
  for (const arc of arcs)
    arc.path = arcPath(y.get(arc.by) as number, y.get(arc.of) as number, arc.lane, step);

  const lastRung = nodes.length > 0 ? (nodes[nodes.length - 1].y ?? FIRST_RUNG) : FIRST_RUNG;
  const ruleY = lastRung + 34;
  const legend = placeLegend(ruleY);
  const height = (legend[legend.length - 1]?.y ?? ruleY) + 24;

  return {
    width: WIDTH,
    height,
    marginX: MARGIN,
    axisX: AXIS_X,
    arcX: ARC_X,
    numberX: NUMBER_X,
    titleX: TITLE_X,
    rightX: RIGHT,
    headerY: HEADER_Y,
    axis: { top: FIRST_RUNG - AXIS_OVERHANG, bottom: lastRung + AXIS_OVERHANG },
    ruleY,
    lanes,
    laneStep: step,
    nodes,
    arcs,
    legend,
    summary: summarise(nodes, arcs),
  };
}

/**
 * One rung: what it says, and how much room is left to say it in.
 *
 * The title is cut to what THIS row has free rather than to a budget the widest
 * row in the set would set for all of them, because the two columns rarely peak
 * together: 0006 carries the longest struck-by list and one of the shortest
 * titles, and 0027 the longest title and a six-character list.
 */
function placeNode(record: DecisionRecord, index: number, edges: Strike[]): ChainNode {
  const struckBy = edges
    .filter((edge) => edge.of === record.number)
    .toSorted((a, b) => a.by.localeCompare(b.by));
  const quiet = record.standing === 'stands' && struckBy.length === 0 && record.voids.length === 0;
  const unattributed = struckBy.length === 0 ? record.struck.length : 0;
  const struckByText = columnText(struckBy, unattributed);

  const room = RIGHT - struckByText.length * MONO_ADVANCE - COLUMN_GAP - TITLE_X;

  return {
    number: record.number,
    title: record.title,
    label: quiet ? '' : fit(record.title, room),
    standing: record.standing,
    quiet,
    y: FIRST_RUNG + index * PITCH,
    radius: quiet ? QUIET_R : NODE_R,
    struckBy,
    voids: record.voids,
    unattributed,
    struckByText,
  };
}

/**
 * The right-hand column: who struck a claim here, and how many each struck.
 *
 * `0009×2 0015` rather than `0009 (2 claims), 0015`, because the column is one
 * line of monospace beside thirty-odd others and the legend below carries the
 * reading of it. A record with struck claims and no voider says so in words: a
 * yellow node with nothing beside it reads as a parser that gave up.
 */
function columnText(struckBy: Strike[], unattributed: number): string {
  if (struckBy.length > 0) {
    return struckBy.map((s) => (s.claims > 1 ? `${s.by}×${s.claims}` : s.by)).join(' ');
  }
  return unattributed > 0 ? `${unattributed}, none named` : '';
}

/** A title cut to the pixels it has, with the cut marked. */
function fit(text: string, room: number): string {
  const max = Math.floor(room / TITLE_ADVANCE);
  if (max < 4) return '';
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1).trimEnd()}…`;
}

/**
 * Arcs into nesting lanes, shortest first.
 *
 * Two arcs may share a lane only when their spans do not touch, so the drawing
 * has no two arcs running down the same x at the same y. Shortest first is what
 * makes the result nest instead of interleave: a neighbour-to-neighbour strike
 * takes the lane against the axis and the long reaches stack outward behind it.
 *
 * The lane count is therefore the deepest overlap in the graph and not the size
 * of it, which is the property that keeps the drawing's width bounded while its
 * height grows.
 */
function packArcs(edges: Strike[], y: ReadonlyMap<string, number>): ChainArc[] {
  const spans = edges
    .map((edge) => {
      const a = y.get(edge.by) as number;
      const b = y.get(edge.of) as number;
      return { edge, top: Math.min(a, b), bottom: Math.max(a, b) };
    })
    .toSorted((a, b) => a.bottom - a.top - (b.bottom - b.top) || a.top - b.top);

  const lanes: { top: number; bottom: number }[][] = [];
  return spans.map(({ edge, top, bottom }) => {
    let lane = 0;
    while (
      lanes[lane]?.some(
        (taken) => top - LANE_CLEARANCE < taken.bottom && taken.top < bottom + LANE_CLEARANCE,
      )
    ) {
      lane += 1;
    }
    (lanes[lane] ??= []).push({ top, bottom });
    return { by: edge.by, of: edge.of, claims: edge.claims, lane, path: '' };
  });
}

/** How far apart the lanes sit: `LANE_STEP`, or less once the gutter is full. */
function laneStep(lanes: number): number {
  if (lanes === 0) return LANE_STEP;
  return Math.min(LANE_STEP, (ARC_X - MARGIN) / lanes);
}

/** The cubic from the record that struck, up to the record it struck. */
function arcPath(from: number, to: number, lane: number, step: number): string {
  const x = round(ARC_X - (lane + 1) * step);
  return `M${ARC_X} ${from} C ${x} ${from} ${x} ${to} ${ARC_X} ${to}`;
}

function round(n: number): number {
  return Math.round(n * 10) / 10;
}

/**
 * The legend, which is prose about the marks and so is the one part of the
 * drawing that is written rather than derived. Only its position is computed.
 */
function placeLegend(ruleY: number): ChainLegendItem[] {
  const rows: Omit<ChainLegendItem, 'y'>[] = [
    { kind: 'node', mark: 'stands', text: 'stands: nothing in it has been made false' },
    {
      kind: 'node',
      mark: 'partly-struck',
      text: 'partly struck: the decision holds, some of its claims do not',
    },
    {
      kind: 'node',
      mark: 'withdrawn',
      text: 'no longer stands: the status line itself is struck through',
    },
    { kind: 'node', mark: 'quiet', text: 'nothing recorded either way' },
    {
      kind: 'arc',
      text: 'a later record struck a claim in an earlier one, and ×n is how many',
    },
    {
      kind: 'note',
      text: '"n, none named": claims struck here whose clause names no later record',
    },
  ];
  return rows.map((row, index) => ({
    kind: row.kind,
    mark: row.mark,
    text: row.text,
    y: ruleY + 26 + index * 24,
  }));
}

/** The counts the caption and the list are written around. */
function summarise(nodes: ChainNode[], arcs: ChainArc[]): ChainSummary {
  const by = (standing: Standing) => nodes.filter((node) => node.standing === standing).length;

  const voidsCount = nodes
    .map((node) => ({ number: node.number, count: node.voids.length }))
    .filter((entry) => entry.count > 0)
    .toSorted((a, b) => b.count - a.count || a.number.localeCompare(b.number));
  const amendedCount = nodes
    .map((node) => ({ number: node.number, count: node.struckBy.length }))
    .filter((entry) => entry.count > 0)
    .toSorted((a, b) => b.count - a.count || a.number.localeCompare(b.number));

  return {
    records: nodes.length,
    stands: by('stands'),
    partlyStruck: by('partly-struck'),
    withdrawn: by('withdrawn'),
    quiet: nodes.filter((node) => node.quiet).length,
    arcs: arcs.length,
    busiest: voidsCount[0] ?? null,
    mostAmended: amendedCount[0] ?? null,
    heaviest: arcs.toSorted((a, b) => b.claims - a.claims)[0] ?? null,
  };
}

/** How the list under the figure opens a record. The board says the same. */
export function standingWord(standing: Standing): string {
  return STANDING_WORD[standing];
}
