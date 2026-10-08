import { beforeEach, describe, expect, it } from 'vitest';

import { normaliseNickname, playerName, shortName } from '../src/lib/player-name';
import { settingsActions } from '../src/stores/settings';
import { sessionActions } from '../src/stores/session';
import { createAppStore, type AppStore } from '../src/stores/store';
import {
  conflictCells,
  currentPlayer,
  dailyDone,
  elapsedSeconds,
  enterDigit,
  giveHint,
  resultOf,
  startDaily,
  startFree,
  sudokuActions,
  todayOf,
} from '../src/stores/sudoku';
import {
  CLUE_TARGET,
  conflictsOf,
  countSolutions,
  dailySeed,
  DIFFICULTIES,
  generatePuzzle,
  isSolved,
  parsePuzzleId,
  PEERS,
  puzzleIdOf,
  seededRandom,
  solve,
} from '../src/sudoku/puzzle';
import {
  formatDuration,
  pointsFor,
  rankOf,
  topScores,
  type SudokuScore,
} from '../src/sudoku/score';

/**
 * The Sudoku: a puzzle that is a function of its seed, points that are a function of four
 * facts, and a slice that turns moves into a result. The first two are what a public table
 * will rest on, so they are pinned as properties rather than as examples.
 */
const NOW = Date.parse('2026-10-08T10:00:00.000Z');

describe('the puzzle', () => {
  it('gives every cell twenty peers', () => {
    expect(PEERS.every((peers) => peers.length === 20)).toBe(true);
  });

  it('is the same puzzle for the same seed', () => {
    expect(generatePuzzle(42, 'medium')).toEqual(generatePuzzle(42, 'medium'));
    expect(generatePuzzle(42, 'medium').givens).not.toEqual(generatePuzzle(43, 'medium').givens);
  });

  it.each(DIFFICULTIES)('has exactly one solution at %s, and it is a valid grid', (difficulty) => {
    for (const seed of [1, 2, 3]) {
      const { givens, solution } = generatePuzzle(seed, difficulty);
      expect(countSolutions(givens, 2)).toBe(1);
      expect(solve(givens)).toEqual(solution);
      expect(conflictsOf(solution).some(Boolean)).toBe(false);
      expect(givens.every((digit, i) => digit === 0 || digit === solution[i])).toBe(true);
      const clues = givens.filter((digit) => digit !== 0).length;
      expect(clues).toBeGreaterThanOrEqual(CLUE_TARGET[difficulty]);
      expect(clues).toBeLessThan(CLUE_TARGET[difficulty] + 8);
    }
  });

  it('is generated fast enough to run in a render', () => {
    const started = performance.now();
    for (let seed = 100; seed < 110; seed++) generatePuzzle(seed, 'hard');
    expect((performance.now() - started) / 10).toBeLessThan(100);
  });

  it('deals the same daily puzzle for a day and a different one the next', () => {
    expect(dailySeed('2026-10-08', 'easy')).toBe(dailySeed('2026-10-08', 'easy'));
    expect(dailySeed('2026-10-08', 'easy')).not.toBe(dailySeed('2026-10-09', 'easy'));
    expect(dailySeed('2026-10-08', 'easy')).not.toBe(dailySeed('2026-10-08', 'hard'));
  });

  it('names a puzzle so that it can be rebuilt', () => {
    const id = puzzleIdOf(0xffffffff, 'hard');
    expect(parsePuzzleId(id)).toEqual({ seed: 0xffffffff, difficulty: 'hard' });
    expect(parsePuzzleId('hard-')).toBeNull();
    expect(parsePuzzleId('silly-1')).toBeNull();
  });

  it('counts no solution for a grid that contradicts itself', () => {
    const grid = Array.from({ length: 81 }, (): number => 0);
    grid[0] = 5;
    grid[1] = 5;
    expect(countSolutions(grid)).toBe(0);
    expect(solve(grid)).toBeNull();
  });

  it('draws the same numbers from the same seed', () => {
    const a = seededRandom(7);
    const b = seededRandom(7);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });
});

const score = (points: number, seconds: number): SudokuScore => ({
  difficulty: 'easy',
  seconds,
  mistakes: 0,
  hints: 0,
  puzzleId: 'easy-1',
  daily: null,
  points,
  player: null,
  finishedAt: '2026-10-08T10:00:00.000Z',
});

describe('the points', () => {
  it('reward speed under par and take penalties off', () => {
    expect(pointsFor({ difficulty: 'easy', seconds: 300, mistakes: 0, hints: 0 })).toBe(1000);
    expect(pointsFor({ difficulty: 'easy', seconds: 200, mistakes: 0, hints: 0 })).toBe(1200);
    expect(pointsFor({ difficulty: 'easy', seconds: 300, mistakes: 1, hints: 1 })).toBe(650);
  });

  it('never fall under a tenth of the base', () => {
    expect(pointsFor({ difficulty: 'hard', seconds: 9999, mistakes: 99, hints: 99 })).toBe(300);
  });

  it('rank more points first, then the faster', () => {
    const scores = [score(900, 100), score(1000, 300), score(1000, 200)];
    expect(topScores(scores, 'easy', 2).map((s) => s.seconds)).toEqual([200, 300]);
    expect(rankOf(scores, scores[0]!)).toBe(3);
    expect(topScores(scores, 'hard', 10)).toEqual([]);
  });

  it('print a duration as a clock', () => {
    expect(formatDuration(5)).toBe('0:05');
    expect(formatDuration(754)).toBe('12:34');
    expect(formatDuration(3725)).toBe('1:02:05');
  });
});

describe('the player name', () => {
  it('is the first name and the initial of the last', () => {
    expect(shortName('Alex Beispiel')).toBe('Alex B.');
    expect(shortName('Anna Maria von berg')).toBe('Anna B.');
    expect(shortName('Alex')).toBe('Alex');
    expect(shortName('  ')).toBeNull();
  });

  it('is the nickname when there is one', () => {
    expect(playerName('Rätselfuchs', 'Alex Beispiel')).toBe('Rätselfuchs');
    expect(playerName('   ', 'Alex Beispiel')).toBe('Alex B.');
    expect(playerName(null, null)).toBeNull();
  });

  it('keeps a nickname printable and short', () => {
    expect(normaliseNickname('  a\u0000b   c ')).toBe('a b c');
    expect(normaliseNickname('x'.repeat(40))).toHaveLength(24);
    expect(normaliseNickname('')).toBeNull();
  });
});

describe('the slice', () => {
  let store: AppStore;
  const sudoku = () => store.getState().sudoku;
  const game = () => sudoku().game!;
  const firstEmpty = () => game().values.findIndex((digit) => digit === 0);

  beforeEach(() => {
    store = createAppStore();
  });

  it('deals the daily puzzle once and keeps it on the board', () => {
    expect(store.dispatch(startDaily('easy', NOW))).toBe(true);
    const id = game().puzzleId;
    expect(game().daily).toBe('2026-10-08');
    store.dispatch(sudokuActions.cellSelected(firstEmpty()));
    store.dispatch(enterDigit(game().solution[firstEmpty()]!, NOW));
    store.dispatch(startDaily('easy', NOW));
    expect(game().puzzleId).toBe(id);
    expect(game().values).not.toEqual(game().givens);
  });

  it('counts a wrong digit as a mistake and shows it', () => {
    store.dispatch(startFree('easy', seededRandom(1)));
    const index = firstEmpty();
    const wrong = (game().solution[index]! % 9) + 1;
    store.dispatch(sudokuActions.cellSelected(index));
    store.dispatch(enterDigit(wrong, NOW));
    expect(game().mistakes).toBe(1);
    expect(game().values[index]).toBe(wrong);
    store.dispatch(sudokuActions.erased());
    expect(game().values[index]).toBe(0);
  });

  it('does not let a given be changed', () => {
    store.dispatch(startFree('easy', seededRandom(1)));
    const given = game().givens.findIndex((digit) => digit !== 0);
    store.dispatch(sudokuActions.cellSelected(given));
    store.dispatch(enterDigit(game().givens[given] === 1 ? 2 : 1, NOW));
    store.dispatch(sudokuActions.erased());
    expect(game().values[given]).toBe(game().givens[given]);
  });

  it('pencils notes and clears them from peers when a digit is placed', () => {
    store.dispatch(startFree('easy', seededRandom(2)));
    const index = firstEmpty();
    const digit = game().solution[index]!;
    const peer = PEERS[index]!.find((other) => game().values[other] === 0)!;
    store.dispatch(sudokuActions.notesModeToggled());
    store.dispatch(sudokuActions.cellSelected(peer));
    store.dispatch(enterDigit(digit, NOW));
    expect(game().notes[peer]).toBe(1 << digit);
    store.dispatch(sudokuActions.notesModeToggled());
    store.dispatch(sudokuActions.cellSelected(index));
    store.dispatch(enterDigit(digit, NOW));
    expect(game().notes[peer]).toBe(0);
  });

  it('runs the clock only while the board is shown', () => {
    store.dispatch(startFree('easy', seededRandom(3)));
    store.dispatch(sudokuActions.resumed(NOW));
    expect(elapsedSeconds(game(), NOW + 61_000)).toBe(61);
    store.dispatch(sudokuActions.paused(NOW + 61_000));
    expect(elapsedSeconds(game(), NOW + 999_000)).toBe(61);
  });

  it('enters a result under the nickname once the board is solved', () => {
    store.dispatch(
      sessionActions.succeeded({
        account: { email: 'alex.beispiel@example.org', name: 'Alex Beispiel' },
        entitlement: null as never,
      }),
    );
    expect(currentPlayer(store.getState())).toBe('Alex B.');
    store.dispatch(settingsActions.setNickname('  Rätselfuchs '));
    expect(currentPlayer(store.getState())).toBe('Rätselfuchs');

    store.dispatch(startDaily('medium', NOW));
    store.dispatch(sudokuActions.resumed(NOW));
    store.dispatch(giveHint(NOW));
    for (let i = 0; i < 81; i++) {
      if (game().values[i] !== 0) continue;
      store.dispatch(sudokuActions.cellSelected(i));
      store.dispatch(enterDigit(game().solution[i]!, NOW + 120_000));
    }
    expect(isSolved(game().values, game().solution)).toBe(true);
    expect(game().finishedAt).not.toBeNull();
    const result = resultOf(sudoku())!;
    expect(result).toMatchObject({
      player: 'Rätselfuchs',
      daily: '2026-10-08',
      seconds: 120,
      hints: 1,
      mistakes: 0,
      points: pointsFor({ difficulty: 'medium', seconds: 120, mistakes: 0, hints: 1 }),
    });
    expect(dailyDone(sudoku(), NOW, 'medium')).toBe(true);

    // A solved daily puzzle is not dealt a second time, even after a free game.
    store.dispatch(startFree('easy', seededRandom(4)));
    expect(store.dispatch(startDaily('medium', NOW))).toBe(false);
    expect(game().daily).toBeNull();
  });

  it('drops a stored game of the wrong shape and stops a clock left running', () => {
    store.dispatch(startFree('easy', seededRandom(5)));
    const kept = { ...game(), resumedAt: NOW };
    store.dispatch(sudokuActions.hydrate({ game: kept, scores: [{ nonsense: true } as never] }));
    expect(game().resumedAt).toBeNull();
    expect(sudoku().scores).toEqual([]);
    store.dispatch(sudokuActions.hydrate({ game: { values: [] } as never }));
    expect(sudoku().game).toBeNull();
  });

  it('marks clashing cells', () => {
    expect(conflictCells(null).some(Boolean)).toBe(false);
    expect(todayOf(Date.parse('2026-10-08T22:30:00.000Z'))).toBe('2026-10-09');
  });
});
