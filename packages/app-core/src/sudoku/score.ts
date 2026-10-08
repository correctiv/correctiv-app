/**
 * What a solved puzzle is worth, and how results rank against each other.
 *
 * The points are a pure function of four facts a finished game carries: the difficulty,
 * the seconds, the mistakes and the hints. Nothing else goes in, so a server that
 * receives a result can recompute its points rather than trust them, which is the
 * property a public table needs before it can exist.
 */

import type { BerlinDate } from '../lib/berlin-time';
import type { Difficulty } from './puzzle';

/** What a solve is worth before speed and penalties. */
export const BASE_POINTS: Readonly<Record<Difficulty, number>> = {
  easy: 1000,
  medium: 2000,
  hard: 3000,
};

/** Seconds under which every second saved earns `SPEED_POINTS`. */
export const PAR_SECONDS: Readonly<Record<Difficulty, number>> = {
  easy: 300,
  medium: 600,
  hard: 900,
};

export const SPEED_POINTS = 2;
export const MISTAKE_PENALTY = 100;
export const HINT_PENALTY = 250;

export interface ScoreFacts {
  readonly difficulty: Difficulty;
  readonly seconds: number;
  readonly mistakes: number;
  readonly hints: number;
}

/**
 * Base points, plus a bonus for every second under par, minus the penalties. Never less
 * than a tenth of the base: a puzzle solved slowly and with help is still solved.
 */
export function pointsFor({ difficulty, seconds, mistakes, hints }: ScoreFacts): number {
  const base = BASE_POINTS[difficulty];
  const speed = Math.max(0, PAR_SECONDS[difficulty] - seconds) * SPEED_POINTS;
  const raw = base + speed - mistakes * MISTAKE_PENALTY - hints * HINT_PENALTY;
  return Math.max(Math.round(base / 10), Math.round(raw));
}

/** One finished game, as the highscore table keeps it. */
export interface SudokuScore extends ScoreFacts {
  /** The puzzle it was played on (`puzzleIdOf`), which is enough to rebuild the grid. */
  readonly puzzleId: string;
  /** The day of the daily puzzle, or null for a free game. */
  readonly daily: BerlinDate | null;
  readonly points: number;
  /** The name the player went by when they finished, or null when nobody was signed in. */
  readonly player: string | null;
  /** ISO timestamp. */
  readonly finishedAt: string;
}

/** More points first; equal points go to the faster, then to the earlier. */
export function compareScores(a: SudokuScore, b: SudokuScore): number {
  return b.points - a.points || a.seconds - b.seconds || a.finishedAt.localeCompare(b.finishedAt);
}

/** The best results, optionally of one difficulty, in rank order. */
export function topScores(
  scores: readonly SudokuScore[],
  difficulty: Difficulty | null,
  limit: number,
): SudokuScore[] {
  return scores
    .filter((score) => difficulty === null || score.difficulty === difficulty)
    .sort(compareScores)
    .slice(0, limit);
}

/** A result's place among those of its difficulty, from 1. */
export function rankOf(scores: readonly SudokuScore[], score: SudokuScore): number {
  return (
    scores.filter(
      (other) => other.difficulty === score.difficulty && compareScores(other, score) < 0,
    ).length + 1
  );
}

/** The best result on one daily puzzle, or null when it has not been solved. */
export function dailyResult(
  scores: readonly SudokuScore[],
  date: BerlinDate,
  difficulty: Difficulty,
): SudokuScore | null {
  return (
    scores
      .filter((score) => score.daily === date && score.difficulty === difficulty)
      .sort(compareScores)[0] ?? null
  );
}

/** `m:ss`, or `h:mm:ss` from an hour on. */
export function formatDuration(totalSeconds: number): string {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
}
