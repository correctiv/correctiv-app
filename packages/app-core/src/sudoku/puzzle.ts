/**
 * The Sudoku itself: the grid, a solver, a generator and the checks a screen asks for.
 *
 * **A puzzle is a function of its seed.** `generatePuzzle(seed, difficulty)` draws from a
 * seeded generator and from nothing else, so the same seed gives the same givens and the
 * same solution on every device and on a server. That is what the daily puzzle rests on
 * (everyone plays `dailySeed(date, difficulty)`), and what a public highscore table will
 * rest on: a server can rebuild the grid from the id a score names and check the claim
 * against it, without the app having to upload a board.
 *
 * A grid is a flat array of 81 numbers, row by row, `0` for an empty cell. Plain numbers
 * rather than a class, because it lives in a Redux slice and is persisted as JSON.
 */

import type { BerlinDate } from '../lib/berlin-time';

export type Grid = readonly number[];

export type Difficulty = 'easy' | 'medium' | 'hard';

export const DIFFICULTIES: readonly Difficulty[] = ['easy', 'medium', 'hard'];

export const CELLS = 81;

/**
 * How many givens the generator stops at. Fewer givens is harder, and the bound is a
 * target rather than a promise: removal stops early where taking one more cell away
 * would leave a second solution, which for `hard` happens a few cells above 24 on some
 * seeds. Every puzzle it returns has exactly one solution whatever the count.
 */
export const CLUE_TARGET: Readonly<Record<Difficulty, number>> = {
  easy: 38,
  medium: 30,
  hard: 24,
};

export const rowOf = (index: number) => Math.floor(index / 9);
export const colOf = (index: number) => index % 9;
export const boxOf = (index: number) =>
  Math.floor(rowOf(index) / 3) * 3 + Math.floor(colOf(index) / 3);

/** The twenty cells that share a row, a column or a box with each cell. */
export const PEERS: readonly (readonly number[])[] = Array.from({ length: CELLS }, (_, index) =>
  Array.from({ length: CELLS }, (__, other) => other).filter(
    (other) =>
      other !== index &&
      (rowOf(other) === rowOf(index) ||
        colOf(other) === colOf(index) ||
        boxOf(other) === boxOf(index)),
  ),
);

export function isPeer(a: number, b: number): boolean {
  return a !== b && (rowOf(a) === rowOf(b) || colOf(a) === colOf(b) || boxOf(a) === boxOf(b));
}

/** Whether a value is a grid this module can work with: 81 integers from 0 to 9. */
export function isGrid(value: unknown): value is number[] {
  return (
    Array.isArray(value) &&
    value.length === CELLS &&
    value.every((cell) => Number.isInteger(cell) && cell >= 0 && cell <= 9)
  );
}

// --- randomness ------------------------------------------------------------------

/** Mulberry32: small, fast and the same on every engine, which is the property needed. */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** FNV-1a over a string, as an unsigned 32-bit seed. */
export function hashSeed(text: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/** The seed of the day's puzzle at one difficulty: the same for every player. */
export function dailySeed(date: BerlinDate, difficulty: Difficulty): number {
  return hashSeed(`correctiv-sudoku:${date}:${difficulty}`);
}

/**
 * The name of a puzzle, from which it can be rebuilt: `medium-1a2b3c`. A daily puzzle
 * needs no date in its id, because its seed already is one.
 */
export function puzzleIdOf(seed: number, difficulty: Difficulty): string {
  return `${difficulty}-${(seed >>> 0).toString(36)}`;
}

/** The seed and difficulty a puzzle id names, or null for one this module did not write. */
export function parsePuzzleId(id: string): { seed: number; difficulty: Difficulty } | null {
  const match = /^(easy|medium|hard)-([0-9a-z]{1,7})$/.exec(id);
  if (!match) return null;
  const seed = parseInt(match[2]!, 36);
  return seed > 0xffffffff ? null : { seed, difficulty: match[1] as Difficulty };
}

/** A seed for a free game, from whatever randomness the caller has. */
export function freeSeed(random: () => number = Math.random): number {
  return Math.floor(random() * 4294967296) >>> 0;
}

function shuffled<T>(items: readonly T[], random: () => number): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

// --- solving ---------------------------------------------------------------------

const ALL = 0x3fe; // bits 1 to 9

function bitCount(mask: number): number {
  let count = 0;
  for (let m = mask; m !== 0; m &= m - 1) count++;
  return count;
}

interface Masks {
  rows: number[];
  cols: number[];
  boxes: number[];
}

/** The digits already used around every cell, or null when the grid contradicts itself. */
function masksOf(grid: Grid): Masks | null {
  const rows = Array.from({ length: 9 }, (): number => 0);
  const cols = Array.from({ length: 9 }, (): number => 0);
  const boxes = Array.from({ length: 9 }, (): number => 0);
  for (let i = 0; i < CELLS; i++) {
    const digit = grid[i]!;
    if (digit === 0) continue;
    const bit = 1 << digit;
    const r = rowOf(i);
    const c = colOf(i);
    const b = boxOf(i);
    if ((rows[r]! | cols[c]! | boxes[b]!) & bit) return null;
    rows[r]! |= bit;
    cols[c]! |= bit;
    boxes[b]! |= bit;
  }
  return { rows, cols, boxes };
}

/**
 * Depth-first search with the most constrained cell first, which is what keeps it fast
 * enough to run on a phone between two frames. `visit` is called with every complete
 * grid and returns whether to keep going.
 */
function search(
  grid: number[],
  masks: Masks,
  order: (candidates: number) => number[],
  visit: (grid: number[]) => boolean,
): boolean {
  let best = -1;
  let bestCandidates = 0;
  let bestCount = 10;
  for (let i = 0; i < CELLS; i++) {
    if (grid[i] !== 0) continue;
    const used = masks.rows[rowOf(i)]! | masks.cols[colOf(i)]! | masks.boxes[boxOf(i)]!;
    const candidates = ALL & ~used;
    const count = bitCount(candidates);
    if (count === 0) return true;
    if (count < bestCount) {
      best = i;
      bestCandidates = candidates;
      bestCount = count;
      if (count === 1) break;
    }
  }
  if (best === -1) return visit(grid);

  const r = rowOf(best);
  const c = colOf(best);
  const b = boxOf(best);
  for (const digit of order(bestCandidates)) {
    const bit = 1 << digit;
    grid[best] = digit;
    masks.rows[r]! |= bit;
    masks.cols[c]! |= bit;
    masks.boxes[b]! |= bit;
    const keepGoing = search(grid, masks, order, visit);
    masks.rows[r]! &= ~bit;
    masks.cols[c]! &= ~bit;
    masks.boxes[b]! &= ~bit;
    grid[best] = 0;
    if (!keepGoing) return false;
  }
  return true;
}

function digitsOf(candidates: number): number[] {
  const digits: number[] = [];
  for (let d = 1; d <= 9; d++) if (candidates & (1 << d)) digits.push(d);
  return digits;
}

/** How many solutions a grid has, counting no further than `limit`. */
export function countSolutions(grid: Grid, limit = 2): number {
  const masks = masksOf(grid);
  if (!masks) return 0;
  let found = 0;
  search([...grid], masks, digitsOf, () => ++found < limit);
  return found;
}

/** The first solution in digit order, or null for a grid that has none. */
export function solve(grid: Grid): number[] | null {
  const masks = masksOf(grid);
  if (!masks) return null;
  let solution: number[] | null = null;
  search([...grid], masks, digitsOf, (complete) => {
    solution = [...complete];
    return false;
  });
  return solution;
}

// --- generating ------------------------------------------------------------------

export interface Puzzle {
  readonly seed: number;
  readonly difficulty: Difficulty;
  readonly givens: number[];
  readonly solution: number[];
}

/**
 * A puzzle with exactly one solution, determined by the seed alone.
 *
 * A full grid is drawn first, then cells are taken away in a random order and each
 * removal is kept only while the puzzle still has one solution, until the difficulty's
 * clue target is reached or no further cell can go.
 */
export function generatePuzzle(seed: number, difficulty: Difficulty): Puzzle {
  const random = seededRandom(seed);
  const empty = Array.from({ length: CELLS }, (): number => 0);
  let solution: number[] = empty;
  search(
    [...empty],
    masksOf(empty)!,
    (candidates) => shuffled(digitsOf(candidates), random),
    (complete) => {
      solution = [...complete];
      return false;
    },
  );

  const givens = [...solution];
  let clues = CELLS;
  const target = CLUE_TARGET[difficulty];
  for (const index of shuffled(
    Array.from({ length: CELLS }, (_, i) => i),
    random,
  )) {
    if (clues <= target) break;
    const kept = givens[index]!;
    givens[index] = 0;
    if (countSolutions(givens, 2) === 1) clues--;
    else givens[index] = kept;
  }
  return { seed, difficulty, givens, solution };
}

// --- checking --------------------------------------------------------------------

/** For each cell, whether its digit appears again in its row, column or box. */
export function conflictsOf(grid: Grid): boolean[] {
  return grid.map(
    (digit, index) => digit !== 0 && PEERS[index]!.some((peer) => grid[peer] === digit),
  );
}

/** Whether every cell holds the solution's digit. */
export function isSolved(values: Grid, solution: Grid): boolean {
  return values.length === CELLS && values.every((digit, index) => digit === solution[index]);
}

/** How many times each digit stands correctly on the board, indexed 1 to 9. */
export function placedCounts(values: Grid, solution: Grid): number[] {
  const counts = Array.from({ length: 10 }, (): number => 0);
  values.forEach((digit, index) => {
    if (digit !== 0 && digit === solution[index]) counts[digit]!++;
  });
  return counts;
}

/** Note bitmask helpers: bit `d` set means the player pencilled `d` in. */
export const hasNote = (mask: number, digit: number) => (mask & (1 << digit)) !== 0;
export const toggleNote = (mask: number, digit: number) => mask ^ (1 << digit);
