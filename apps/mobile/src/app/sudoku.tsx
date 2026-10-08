import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { defineMessages, useIntl, type MessageDescriptor } from 'react-intl';
import { AppState, Platform, ScrollView, View } from 'react-native';

import {
  conflictCells,
  dailyDone,
  elapsedSeconds,
  isTodaysDaily,
  resultOf,
  todayOf,
} from '@correctiv/app-core/stores/sudoku';
import { DIFFICULTIES, placedCounts, type Difficulty } from '@correctiv/app-core/sudoku/puzzle';
import {
  dailyResult,
  formatDuration,
  rankOf,
  topScores,
  type SudokuScore,
} from '@correctiv/app-core/sudoku/score';

import { NumberPad } from '@/components/sudoku/NumberPad';
import { SudokuBoard } from '@/components/sudoku/SudokuBoard';
import {
  Button,
  Chip,
  ContentColumn,
  Hairline,
  ScreenHeader,
  SectionCard,
  SplitRow,
  Typo,
} from '@/components/ui';
import { useCoreActions, usePlayerName, useSudoku } from '@/lib/store/core';

/**
 * Everything a person reads on this screen, in ENGLISH; the German that ships is
 * `packages/catalogue/src/de/sudoku.ts`.
 */
const COPY = defineMessages({
  screenTitle: { id: 'sudoku.title', defaultMessage: 'Sudoku' },
  intro: {
    id: 'sudoku.intro',
    defaultMessage:
      'A new puzzle every day, the same for every member. Fill each row, column and box with the digits 1 to 9.',
  },
  difficulty: { id: 'sudoku.difficulty', defaultMessage: 'Difficulty' },
  playDaily: { id: 'sudoku.playDaily', defaultMessage: "Play today's puzzle" },
  continueDaily: { id: 'sudoku.continueDaily', defaultMessage: "Continue today's puzzle" },
  dailySolved: {
    id: 'sudoku.dailySolved',
    defaultMessage: "Today's puzzle solved: {points, number} points in {time}",
    description:
      'Under the difficulty choice once the daily puzzle at that difficulty is solved. {points} is the score, {time} the time it took as minutes:seconds.',
  },
  newFree: { id: 'sudoku.newFree', defaultMessage: 'New free game' },
  freeNote: {
    id: 'sudoku.freeNote',
    defaultMessage: 'A free game is a puzzle of its own and counts towards the table as well.',
  },
  status: {
    id: 'sudoku.status',
    defaultMessage:
      '{kind, select, daily {Daily puzzle} other {Free game}} · {difficulty} · {time} · {mistakes, plural, =0 {no mistakes} one {one mistake} other {# mistakes}}',
    description:
      'The line above the board. {kind} is daily or free, {difficulty} the difficulty as sudoku.level.* words it, {time} the clock as minutes:seconds, {mistakes} how many wrong digits were entered.',
  },
  notes: {
    id: 'sudoku.notes',
    defaultMessage: 'Notes',
    description:
      'A switch under the board: while it is on, a digit goes into the chosen cell as a pencil mark. The button is filled while it is on.',
  },
  erase: { id: 'sudoku.erase', defaultMessage: 'Erase' },
  hint: { id: 'sudoku.hint', defaultMessage: 'Hint' },
  giveUp: { id: 'sudoku.giveUp', defaultMessage: 'Abandon this game' },
  solvedSection: { id: 'sudoku.solved.section', defaultMessage: 'Solved' },
  solvedPoints: {
    id: 'sudoku.solved.points',
    defaultMessage: '{points, number} points',
    description:
      'The large figure on the card shown once a puzzle is solved. {points} is the score.',
  },
  solvedDetail: {
    id: 'sudoku.solved.detail',
    defaultMessage:
      '{time} · {mistakes, plural, =0 {no mistakes} one {one mistake} other {# mistakes}} · {hints, plural, =0 {no hints} one {one hint} other {# hints}} · place {rank} at this level',
    description:
      'Under the points once a puzzle is solved. {time} is minutes:seconds, {mistakes} and {hints} are counts, {rank} the place among all results at the same difficulty on this device.',
  },
  tableSection: { id: 'sudoku.table.section', defaultMessage: 'High scores' },
  tableAll: { id: 'sudoku.table.all', defaultMessage: 'All' },
  tableEmpty: {
    id: 'sudoku.table.empty',
    defaultMessage: 'No puzzle solved yet. The first result will be listed here.',
  },
  tableRow: {
    id: 'sudoku.table.row',
    defaultMessage: '{rank}. {name}',
    description: 'One row of the high score table: {rank} is the place, {name} who played.',
  },
  tableValue: {
    id: 'sudoku.table.value',
    defaultMessage: '{points, number} · {time}',
    description:
      'The right side of one high score row: {points} the score, {time} minutes:seconds.',
  },
  anonymous: {
    id: 'sudoku.table.anonymous',
    defaultMessage: 'Anonymous member',
    description:
      'Stands in the high score table for a result entered while nobody was signed in, and for the player when no name is known.',
  },
  tableNote: {
    id: 'sudoku.table.note',
    defaultMessage:
      'Your results are listed as "{name}". The table is kept on this device for now; a shared one for all members is planned.',
    description:
      'Under the high score table. {name} is the nickname, or the first name and the initial of the last name.',
  },
  setNickname: { id: 'sudoku.setNickname', defaultMessage: 'Choose a nickname' },
});

/** The words for each difficulty, in the order the chips draw them. */
const LEVEL_LABELS: Record<Difficulty, MessageDescriptor> = defineMessages({
  easy: { id: 'sudoku.level.easy', defaultMessage: 'Easy' },
  medium: { id: 'sudoku.level.medium', defaultMessage: 'Medium' },
  hard: { id: 'sudoku.level.hard', defaultMessage: 'Hard' },
});

const TABLE_SIZE = 10;

/**
 * The full game: the board, the pad, the result and the table.
 *
 * The clock runs only while this screen is in front and the app is in the foreground:
 * focus and the app's state resume and pause it, and the store keeps the time as two
 * numbers, so the one-second redraw below is this screen's own and nothing is dispatched
 * for it.
 */
export default function SudokuScreen() {
  const intl = useIntl();
  const actions = useCoreActions();
  const sudoku = useSudoku();
  const player = usePlayerName();
  const game = sudoku.game;
  const playing = game !== null && game.finishedAt === null ? game : null;
  const open = playing !== null;
  const [level, setLevel] = useState<Difficulty>(game?.difficulty ?? 'medium');
  const [tableLevel, setTableLevel] = useState<Difficulty | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useFocusEffect(
    useCallback(() => {
      actions.sudoku.resumed(Date.now());
      const subscription = AppState.addEventListener('change', (state) => {
        if (state === 'active') actions.sudoku.resumed(Date.now());
        else actions.sudoku.paused(Date.now());
      });
      return () => {
        subscription.remove();
        actions.sudoku.paused(Date.now());
      };
    }, [actions]),
  );

  // A game dealt while the screen is already in front starts its clock here.
  useEffect(() => {
    if (playing !== null && playing.resumedAt === null) actions.sudoku.resumed(Date.now());
  }, [actions, playing]);

  useEffect(() => {
    if (!open) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [open]);

  useBoardKeys(open, sudoku.selected);

  const wrong = useMemo(() => {
    if (!game) return undefined;
    const clashes = conflictCells(game);
    return game.values.map(
      (digit, i) => clashes[i]! || (digit !== 0 && digit !== game.solution[i]),
    );
  }, [game]);
  const placed = useMemo(() => (game ? placedCounts(game.values, game.solution) : []), [game]);

  const today = todayOf(now);
  const todays = dailyResult(sudoku.scores, today, level);
  const dailyOnBoard = isTodaysDaily(game, now, level) && open;
  const result = resultOf(sudoku);
  const levelWord = (difficulty: Difficulty) => intl.formatMessage(LEVEL_LABELS[difficulty]);

  return (
    <View className="flex-1 bg-canvas">
      <ScreenHeader title={intl.formatMessage(COPY.screenTitle)} />
      <ScrollView
        className="flex-1"
        contentContainerClassName="px-m pt-m pb-2xl"
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <ContentColumn>
          <Typo variant="headline-l">{intl.formatMessage(COPY.screenTitle)}</Typo>

          {playing ? (
            <>
              <Typo variant="text-s" color="on-canvas-muted" className="mt-s">
                {intl.formatMessage(COPY.status, {
                  kind: playing.daily ? 'daily' : 'free',
                  difficulty: levelWord(playing.difficulty),
                  time: formatDuration(elapsedSeconds(game, now)),
                  mistakes: playing.mistakes,
                })}
              </Typo>
              <View className="mt-s">
                <SudokuBoard
                  givens={playing.givens}
                  values={playing.values}
                  notes={playing.notes}
                  wrong={wrong}
                  selected={sudoku.selected}
                  onSelect={(index) => actions.sudoku.cellSelected(index)}
                />
              </View>
              <View className="mt-s flex-row gap-xs">
                <View className="flex-1">
                  <Button
                    title={intl.formatMessage(COPY.notes)}
                    variant={sudoku.notesMode ? 'primary' : 'outline'}
                    accessibilityState={{ checked: sudoku.notesMode }}
                    fullWidth
                    onPress={() => actions.sudoku.notesModeToggled()}
                  />
                </View>
                <View className="flex-1">
                  <Button
                    title={intl.formatMessage(COPY.erase)}
                    variant="outline"
                    fullWidth
                    onPress={() => actions.sudoku.erased()}
                  />
                </View>
                <View className="flex-1">
                  <Button
                    title={intl.formatMessage(COPY.hint)}
                    variant="outline"
                    fullWidth
                    onPress={() => actions.sudoku.giveHint(Date.now())}
                  />
                </View>
              </View>
              <View className="mt-s">
                <NumberPad
                  placed={placed}
                  onDigit={(digit) => actions.sudoku.enterDigit(digit, Date.now())}
                  disabled={sudoku.selected === null}
                />
              </View>
              <Button
                title={intl.formatMessage(COPY.giveUp)}
                variant="secondary"
                className="mt-m"
                fullWidth
                onPress={() => actions.sudoku.abandoned()}
              />
            </>
          ) : (
            <>
              {result && game && (
                <SectionCard label={intl.formatMessage(COPY.solvedSection)} className="mt-m">
                  <View className="mb-s">
                    <SudokuBoard givens={game.givens} values={game.values} />
                  </View>
                  <Typo variant="headline-xl">
                    {intl.formatMessage(COPY.solvedPoints, { points: result.points })}
                  </Typo>
                  <Typo variant="text-s" color="on-canvas-muted" className="mt-2xs">
                    {intl.formatMessage(COPY.solvedDetail, {
                      time: formatDuration(result.seconds),
                      mistakes: result.mistakes,
                      hints: result.hints,
                      rank: rankOf(sudoku.scores, result),
                    })}
                  </Typo>
                </SectionCard>
              )}

              {!result && (
                <Typo variant="text-m" className="mt-s">
                  {intl.formatMessage(COPY.intro)}
                </Typo>
              )}

              <SectionCard label={intl.formatMessage(COPY.difficulty)} className="mt-m">
                <View className="flex-row flex-wrap gap-xs">
                  {DIFFICULTIES.map((difficulty) => (
                    <Chip
                      key={difficulty}
                      label={levelWord(difficulty)}
                      selected={level === difficulty}
                      onPress={() => setLevel(difficulty)}
                    />
                  ))}
                </View>
                {todays ? (
                  <Typo variant="text-s" color="on-canvas-muted" className="mt-s">
                    {intl.formatMessage(COPY.dailySolved, {
                      points: todays.points,
                      time: formatDuration(todays.seconds),
                    })}
                  </Typo>
                ) : (
                  <Button
                    title={intl.formatMessage(dailyOnBoard ? COPY.continueDaily : COPY.playDaily)}
                    className="mt-s"
                    fullWidth
                    disabled={dailyDone(sudoku, now, level)}
                    onPress={() => actions.sudoku.startDaily(level, Date.now())}
                  />
                )}
                <Button
                  title={intl.formatMessage(COPY.newFree)}
                  variant="outline"
                  className="mt-s"
                  fullWidth
                  onPress={() => actions.sudoku.startFree(level)}
                />
                <Typo variant="text-s" color="on-canvas-muted" className="mt-s">
                  {intl.formatMessage(COPY.freeNote)}
                </Typo>
              </SectionCard>
            </>
          )}

          <HighScores
            scores={sudoku.scores}
            level={tableLevel}
            onLevel={setTableLevel}
            levelWord={levelWord}
            player={player}
          />
        </ContentColumn>
      </ScrollView>
    </View>
  );
}

function HighScores({
  scores,
  level,
  onLevel,
  levelWord,
  player,
}: {
  scores: readonly SudokuScore[];
  level: Difficulty | null;
  onLevel: (level: Difficulty | null) => void;
  levelWord: (difficulty: Difficulty) => string;
  player: string | null;
}) {
  const intl = useIntl();
  const rows = topScores(scores, level, TABLE_SIZE);
  return (
    <SectionCard label={intl.formatMessage(COPY.tableSection)} className="mt-l">
      <View className="flex-row flex-wrap gap-xs">
        <Chip
          label={intl.formatMessage(COPY.tableAll)}
          selected={level === null}
          onPress={() => onLevel(null)}
        />
        {DIFFICULTIES.map((difficulty) => (
          <Chip
            key={difficulty}
            label={levelWord(difficulty)}
            selected={level === difficulty}
            onPress={() => onLevel(difficulty)}
          />
        ))}
      </View>
      {rows.length === 0 ? (
        <Typo variant="text-s" color="on-canvas-muted" className="mt-s">
          {intl.formatMessage(COPY.tableEmpty)}
        </Typo>
      ) : (
        <View className="mt-s">
          {rows.map((score, i) => (
            <View key={`${score.puzzleId}-${score.finishedAt}`}>
              {i > 0 && <Hairline className="my-2xs" />}
              <SplitRow align="baseline">
                <View className="shrink">
                  <Typo variant="text-m" weight="semibold">
                    {intl.formatMessage(COPY.tableRow, {
                      rank: i + 1,
                      name: score.player ?? intl.formatMessage(COPY.anonymous),
                    })}
                  </Typo>
                  {level === null && (
                    <Typo variant="text-s" color="on-canvas-muted">
                      {levelWord(score.difficulty)}
                    </Typo>
                  )}
                </View>
                <Typo variant="text-m" className="shrink text-right">
                  {intl.formatMessage(COPY.tableValue, {
                    points: score.points,
                    time: formatDuration(score.seconds),
                  })}
                </Typo>
              </SplitRow>
            </View>
          ))}
        </View>
      )}
      <Typo variant="text-s" color="on-canvas-muted" className="mt-s">
        {intl.formatMessage(COPY.tableNote, {
          name: player ?? intl.formatMessage(COPY.anonymous),
        })}
      </Typo>
      <Button
        title={intl.formatMessage(COPY.setNickname)}
        variant="outline"
        className="mt-s"
        fullWidth
        onPress={() => router.push('/einstellungen')}
      />
    </SectionCard>
  );
}

/**
 * A keyboard on the web: digits enter, Backspace and Delete erase, the arrows move the
 * selection. A phone has no keyboard here and registers nothing.
 */
function useBoardKeys(open: boolean, selected: number | null) {
  const actions = useCoreActions();
  useEffect(() => {
    if (Platform.OS !== 'web' || !open) return;
    const target = globalThis as unknown as {
      addEventListener: (type: 'keydown', listener: (event: KeyboardEvent) => void) => void;
      removeEventListener: (type: 'keydown', listener: (event: KeyboardEvent) => void) => void;
    };
    const onKey = (event: KeyboardEvent) => {
      if (/^[1-9]$/.test(event.key)) {
        actions.sudoku.enterDigit(Number(event.key), Date.now());
      } else if (event.key === 'Backspace' || event.key === 'Delete') {
        actions.sudoku.erased();
      } else if (event.key.startsWith('Arrow')) {
        const from = selected ?? 0;
        const row = Math.floor(from / 9);
        const column = from % 9;
        const step: Record<string, [number, number]> = {
          ArrowUp: [-1, 0],
          ArrowDown: [1, 0],
          ArrowLeft: [0, -1],
          ArrowRight: [0, 1],
        };
        const [dr, dc] = step[event.key] ?? [0, 0];
        const next = ((row + dr + 9) % 9) * 9 + ((column + dc + 9) % 9);
        actions.sudoku.cellSelected(selected === null ? 0 : next);
        event.preventDefault();
      }
    };
    target.addEventListener('keydown', onKey);
    return () => target.removeEventListener('keydown', onKey);
  }, [actions, open, selected]);
}
