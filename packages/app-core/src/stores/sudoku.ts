import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

import { berlinWallClock, type BerlinDate, type Instant } from '../lib/berlin-time';
import { playerName } from '../lib/player-name';
import {
  conflictsOf,
  dailySeed,
  DIFFICULTIES,
  freeSeed,
  generatePuzzle,
  isGrid,
  isPeer,
  isSolved,
  puzzleIdOf,
  toggleNote,
  CELLS,
  type Difficulty,
  type Puzzle,
} from '../sudoku/puzzle';
import { compareScores, dailyResult, pointsFor, type SudokuScore } from '../sudoku/score';
import type { AppThunk, RootState } from './store';

/**
 * The game in progress and the results kept on this device.
 *
 * **The clock is two numbers, not a ticking one.** `elapsedMs` is what the closed
 * stretches of play add up to and `resumedAt` is when the open one began, so the time on
 * the board is a selector of `now` and nothing has to be dispatched every second: an audio
 * tick twice a second is already what this store is tuned around, and a timer would be a
 * third. The screen resumes the clock when it is shown and pauses it when it is left.
 *
 * **The table is local for now and written to become public.** A result carries the
 * puzzle id it was played on, the four facts its points are computed from and the name
 * the player went by, which is everything a server needs to rebuild the grid and recompute
 * the points rather than trust them (`sudoku/puzzle.ts`, `sudoku/score.ts`). Uploading is
 * a later decision; nothing here has to change shape for it.
 */
export interface SudokuGame {
  puzzleId: string;
  difficulty: Difficulty;
  /** The day of the daily puzzle, or null for a free game. */
  daily: BerlinDate | null;
  givens: number[];
  solution: number[];
  /** What is on the board, givens included; 0 is empty. */
  values: number[];
  /** Pencil marks per cell, bit `d` for digit `d`. */
  notes: number[];
  mistakes: number;
  hints: number;
  elapsedMs: number;
  /** When the running stretch of play began, or null while the clock is stopped. */
  resumedAt: Instant | null;
  /** ISO timestamp of the solve, or null while the game is open. */
  finishedAt: string | null;
}

export interface SudokuState {
  game: SudokuGame | null;
  /**
   * Daily puzzles left open when another game took the board or the player stepped away,
   * one per difficulty. Starting that daily puzzle again picks the parked game up, clock,
   * mistakes and hints included, so stepping away is not a way to a fresh clock on a grid
   * the player has already half seen.
   */
  parked: SudokuGame[];
  scores: SudokuScore[];
  /** The cell the player has chosen. Not persisted: a restart starts with none. */
  selected: number | null;
  /** Whether a digit goes in as a pencil mark. Not persisted, for the same reason. */
  notesMode: boolean;
}

/** What survives a restart. */
export const PERSISTED_KEYS = ['game', 'parked', 'scores'] satisfies Array<keyof SudokuState>;

/**
 * How many results the device keeps. The weakest go first, so a table drawn from them
 * never loses a place it shows; 200 is several months of daily play at all three levels.
 */
export const SCORES_KEPT = 200;

const initialState: SudokuState = {
  game: null,
  parked: [],
  scores: [],
  selected: null,
  notesMode: false,
};

function gameOf(puzzle: Puzzle, daily: BerlinDate | null): SudokuGame {
  return {
    puzzleId: puzzleIdOf(puzzle.seed, puzzle.difficulty),
    difficulty: puzzle.difficulty,
    daily,
    givens: [...puzzle.givens],
    solution: [...puzzle.solution],
    values: [...puzzle.givens],
    notes: Array.from({ length: CELLS }, (): number => 0),
    mistakes: 0,
    hints: 0,
    elapsedMs: 0,
    resumedAt: null,
    finishedAt: null,
  };
}

function stopClock(game: SudokuGame, now: Instant) {
  if (game.resumedAt === null) return;
  game.elapsedMs += Math.max(0, now - game.resumedAt);
  game.resumedAt = null;
}

/** What a move needs that the reducer cannot read: the clock and the player's name. */
interface MoveMeta {
  now: Instant;
  player: string | null;
}

/** Closes a game that has just been solved and enters its result. */
function finishIfSolved(state: SudokuState, { now, player }: MoveMeta) {
  const game = state.game;
  if (!game || game.finishedAt !== null || !isSolved(game.values, game.solution)) return;
  stopClock(game, now);
  game.finishedAt = new Date(now).toISOString();
  state.selected = null;
  const facts = {
    difficulty: game.difficulty,
    seconds: Math.round(game.elapsedMs / 1000),
    mistakes: game.mistakes,
    hints: game.hints,
  };
  const score: SudokuScore = {
    ...facts,
    puzzleId: game.puzzleId,
    daily: game.daily,
    points: pointsFor(facts),
    player,
    finishedAt: game.finishedAt,
  };
  state.scores = [...state.scores, score].sort(compareScores).slice(0, SCORES_KEPT);
}

/** Places a digit the player cannot have wrong, and takes it out of the peers' notes. */
function place(game: SudokuGame, index: number, digit: number) {
  game.values[index] = digit;
  game.notes[index] = 0;
  if (digit !== game.solution[index]) return;
  for (let other = 0; other < CELLS; other++) {
    if (isPeer(index, other) && game.notes[other]! & (1 << digit)) {
      game.notes[other] = toggleNote(game.notes[other]!, digit);
    }
  }
}

/**
 * Takes the game off the board. An open daily puzzle is parked with its clock stopped, and
 * parked games of an earlier day go: they can no longer be dealt.
 */
function clearBoard(state: SudokuState, now: Instant) {
  const game = state.game;
  if (isOpen(game) && game.daily !== null) {
    stopClock(game, now);
    state.parked = [
      ...state.parked.filter((p) => p.daily === game.daily && p.puzzleId !== game.puzzleId),
      game,
    ];
  }
  state.game = null;
  state.selected = null;
  state.notesMode = false;
}

const isOpen = (game: SudokuGame | null): game is SudokuGame =>
  game !== null && game.finishedAt === null;

const editable = (game: SudokuGame, index: number) => game.givens[index] === 0;

function isScore(value: unknown): value is SudokuScore {
  if (typeof value !== 'object' || value === null) return false;
  const s = value as Record<string, unknown>;
  return (
    typeof s.puzzleId === 'string' &&
    (DIFFICULTIES as readonly unknown[]).includes(s.difficulty) &&
    typeof s.points === 'number' &&
    typeof s.seconds === 'number' &&
    typeof s.mistakes === 'number' &&
    typeof s.hints === 'number' &&
    typeof s.finishedAt === 'string' &&
    (s.daily === null || typeof s.daily === 'string') &&
    (s.player === null || typeof s.player === 'string')
  );
}

function isGame(value: unknown): value is SudokuGame {
  if (typeof value !== 'object' || value === null) return false;
  const g = value as Record<string, unknown>;
  return (
    typeof g.puzzleId === 'string' &&
    (DIFFICULTIES as readonly unknown[]).includes(g.difficulty) &&
    (g.daily === null || typeof g.daily === 'string') &&
    isGrid(g.givens) &&
    isGrid(g.solution) &&
    isGrid(g.values) &&
    Array.isArray(g.notes) &&
    g.notes.length === CELLS &&
    typeof g.mistakes === 'number' &&
    typeof g.hints === 'number' &&
    typeof g.elapsedMs === 'number' &&
    (g.finishedAt === null || typeof g.finishedAt === 'string')
  );
}

const slice = createSlice({
  name: 'sudoku',
  initialState,
  reducers: {
    started(
      state,
      action: PayloadAction<{ puzzle: Puzzle; daily: BerlinDate | null; now: Instant }>,
    ) {
      clearBoard(state, action.payload.now);
      state.game = gameOf(action.payload.puzzle, action.payload.daily);
    },

    /** A parked daily puzzle back on the board, as it was left. */
    unparked(state, action: PayloadAction<{ puzzleId: string; now: Instant }>) {
      const { puzzleId, now } = action.payload;
      const game = state.parked.find((p) => p.puzzleId === puzzleId);
      if (!game) return;
      state.parked = state.parked.filter((p) => p !== game);
      clearBoard(state, now);
      state.game = game;
    },

    /** The board is on screen. A clock that is already running keeps its start. */
    resumed(state, action: PayloadAction<Instant>) {
      if (isOpen(state.game) && state.game.resumedAt === null) {
        state.game.resumedAt = action.payload;
      }
    },

    /** The board has left the screen. */
    paused(state, action: PayloadAction<Instant>) {
      if (isOpen(state.game)) stopClock(state.game, action.payload);
    },

    cellSelected(state, action: PayloadAction<number | null>) {
      const index = action.payload;
      state.selected = index !== null && index >= 0 && index < CELLS ? index : null;
    },

    notesModeToggled(state) {
      state.notesMode = !state.notesMode;
    },

    /**
     * A digit into the chosen cell: a pencil mark in notes mode, otherwise a value. A
     * value that is not the solution's counts as a mistake and stays on the board, drawn
     * as one, so the player sees what they did rather than having it silently refused.
     */
    entered: {
      reducer(state, action: PayloadAction<MoveMeta & { digit: number }>) {
        const game = state.game;
        const index = state.selected;
        const { digit } = action.payload;
        if (!isOpen(game) || index === null || !editable(game, index)) return;
        if (!Number.isInteger(digit) || digit < 1 || digit > 9) return;
        if (state.notesMode) {
          if (game.values[index] === 0) game.notes[index] = toggleNote(game.notes[index]!, digit);
          return;
        }
        if (game.values[index] === digit) return;
        if (digit !== game.solution[index]) game.mistakes++;
        place(game, index, digit);
        finishIfSolved(state, action.payload);
      },
      prepare: (digit: number, meta: MoveMeta) => ({ payload: { digit, ...meta } }),
    },

    erased(state) {
      const game = state.game;
      const index = state.selected;
      if (!isOpen(game) || index === null || !editable(game, index)) return;
      game.values[index] = 0;
      game.notes[index] = 0;
    },

    /**
     * The solution's digit, in the chosen cell when it is empty or wrong, otherwise in the
     * first cell that is. Costs `HINT_PENALTY` points at the end.
     */
    hinted(state, action: PayloadAction<MoveMeta>) {
      const game = state.game;
      if (!isOpen(game)) return;
      const needs = (i: number) => editable(game, i) && game.values[i] !== game.solution[i];
      const chosen = state.selected;
      const index =
        chosen !== null && needs(chosen)
          ? chosen
          : Array.from({ length: CELLS }, (_, i) => i).find(needs);
      if (index === undefined) return;
      game.hints++;
      place(game, index, game.solution[index]!);
      state.selected = index;
      finishIfSolved(state, action.payload);
    },

    /** Leaves the board: a free game is gone, a daily puzzle is parked. */
    left(state, action: PayloadAction<Instant>) {
      clearBoard(state, action.payload);
    },

    /**
     * Applied by persist() at startup — see stores/persist.ts. A game or a result that
     * does not have the shape this build writes is dropped rather than half-read, and a
     * clock that was running when the app went away is stopped: the time between then and
     * now was not play, and there is no way to say how much of it was.
     */
    hydrate(state, action: PayloadAction<Partial<SudokuState>>) {
      const { game, parked, scores } = action.payload;
      if (game !== undefined) state.game = isGame(game) ? { ...game, resumedAt: null } : null;
      if (Array.isArray(parked)) {
        state.parked = parked.filter(isGame).map((p) => ({ ...p, resumedAt: null }));
      }
      if (Array.isArray(scores)) state.scores = scores.filter(isScore);
    },
  },
});

export const sudokuReducer = slice.reducer;
export const sudokuActions = slice.actions;

// --- selectors ------------------------------------------------------------------

/** Seconds on the board's clock at `now`. */
export function elapsedSeconds(game: SudokuGame | null, now: Instant): number {
  if (!game) return 0;
  const running = game.resumedAt === null ? 0 : Math.max(0, now - game.resumedAt);
  return Math.floor((game.elapsedMs + running) / 1000);
}

/** Cells whose digit clashes with a peer, which the board draws as a mistake. */
export function conflictCells(game: SudokuGame | null): boolean[] {
  return game ? conflictsOf(game.values) : Array.from({ length: CELLS }, (): boolean => false);
}

/** The day's Berlin date, which decides the daily puzzle. */
export const todayOf = (now: Instant): BerlinDate => berlinWallClock(now).date;

/** The name this device's results are entered under: the nickname, or "Alex B.". */
export function currentPlayer(state: Pick<RootState, 'settings' | 'session'>): string | null {
  return playerName(state.settings.nickname, state.session.account?.name);
}

/** Whether the daily puzzle at a difficulty has been solved today. */
export function dailyDone(state: SudokuState, now: Instant, difficulty: Difficulty): boolean {
  return dailyResult(state.scores, todayOf(now), difficulty) !== null;
}

/** Whether the game on the board is today's daily puzzle at a difficulty. */
export function isTodaysDaily(
  game: SudokuGame | null,
  now: Instant,
  difficulty: Difficulty,
): boolean {
  return game !== null && game.daily === todayOf(now) && game.difficulty === difficulty;
}

/** Today's daily puzzle at a difficulty when it is parked, open and waiting. */
export function parkedDaily(
  state: SudokuState,
  now: Instant,
  difficulty: Difficulty,
): SudokuGame | null {
  return state.parked.find((game) => isTodaysDaily(game, now, difficulty)) ?? null;
}

/** The result the open-or-finished game produced, when it is finished. */
export function resultOf(state: SudokuState): SudokuScore | null {
  const game = state.game;
  if (!game || game.finishedAt === null) return null;
  return (
    state.scores.find(
      (score) => score.puzzleId === game.puzzleId && score.finishedAt === game.finishedAt,
    ) ?? null
  );
}

// --- thunks ---------------------------------------------------------------------

/**
 * Today's puzzle at a difficulty. A daily puzzle already on the board is kept as it is, a
 * parked one is picked up where it was left, and one already solved is not dealt again, because a second try at it would be a
 * second result on a puzzle whose answer the player has seen. Returns whether a game is
 * on the board for it afterwards.
 */
export function startDaily(difficulty: Difficulty, now: Instant = Date.now()): AppThunk<boolean> {
  return (dispatch, getState) => {
    const state = getState().sudoku;
    if (isTodaysDaily(state.game, now, difficulty)) return true;
    if (dailyDone(state, now, difficulty)) return false;
    const parked = parkedDaily(state, now, difficulty);
    if (parked) {
      dispatch(sudokuActions.unparked({ puzzleId: parked.puzzleId, now }));
      return true;
    }
    const date = todayOf(now);
    dispatch(
      sudokuActions.started({
        puzzle: generatePuzzle(dailySeed(date, difficulty), difficulty),
        daily: date,
        now,
      }),
    );
    return true;
  };
}

/** A new free game at a difficulty, from a fresh seed. */
export function startFree(
  difficulty: Difficulty,
  random: () => number = Math.random,
  now: Instant = Date.now(),
): AppThunk {
  return (dispatch) => {
    dispatch(
      sudokuActions.started({
        puzzle: generatePuzzle(freeSeed(random), difficulty),
        daily: null,
        now,
      }),
    );
  };
}

export function enterDigit(digit: number, now: Instant = Date.now()): AppThunk {
  return (dispatch, getState) => {
    dispatch(sudokuActions.entered(digit, { now, player: currentPlayer(getState()) }));
  };
}

export function giveHint(now: Instant = Date.now()): AppThunk {
  return (dispatch, getState) => {
    dispatch(sudokuActions.hinted({ now, player: currentPlayer(getState()) }));
  };
}
