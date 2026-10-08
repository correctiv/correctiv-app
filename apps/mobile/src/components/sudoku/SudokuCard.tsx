import { defineMessages, useIntl } from 'react-intl';
import { View } from 'react-native';

import { Button, SectionCard, Typo } from '@/components/ui';

import { SudokuBoard } from './SudokuBoard';

/** What the card says, in ENGLISH; the German that ships is `packages/catalogue/src/de/sudoku.ts`. */
const COPY = defineMessages({
  label: { id: 'sudoku.card.label', defaultMessage: 'Puzzle of the day' },
  heading: { id: 'sudoku.card.heading', defaultMessage: 'The daily Sudoku' },
  leadNew: {
    id: 'sudoku.card.leadNew',
    defaultMessage: 'One puzzle a day, the same for every member. How fast are you?',
  },
  leadPlaying: {
    id: 'sudoku.card.leadPlaying',
    defaultMessage: 'Your game is open: {time} so far.',
    description: 'On the home card while a game is open. {time} is the clock as minutes:seconds.',
  },
  leadSolved: {
    id: 'sudoku.card.leadSolved',
    defaultMessage: 'Solved today: {points, number} points in {time}.',
    description:
      "On the home card once today's puzzle is solved. {points} is the score, {time} minutes:seconds.",
  },
  play: { id: 'sudoku.card.play', defaultMessage: 'Play now' },
  resume: { id: 'sudoku.card.resume', defaultMessage: 'Continue' },
  table: { id: 'sudoku.card.table', defaultMessage: 'See the high scores' },
});

export type SudokuCardState =
  | { readonly kind: 'new' }
  | { readonly kind: 'playing'; readonly time: string }
  | { readonly kind: 'solved'; readonly points: number; readonly time: string };

export interface SudokuCardProps {
  givens: readonly number[];
  values: readonly number[];
  state: SudokuCardState;
  onPress?: () => void;
}

/** Wide enough to read as a Sudoku, narrow enough to leave the words their column. */
const BOARD_WIDTH = 120;

/**
 * The small form: the day's grid as a picture, one line about where the player stands and
 * the way into the full game. The board takes no touch here; the button is the one target.
 */
export function SudokuCard({ givens, values, state, onPress }: SudokuCardProps) {
  const intl = useIntl();
  const lead =
    state.kind === 'playing'
      ? intl.formatMessage(COPY.leadPlaying, { time: state.time })
      : state.kind === 'solved'
        ? intl.formatMessage(COPY.leadSolved, { points: state.points, time: state.time })
        : intl.formatMessage(COPY.leadNew);
  const action =
    state.kind === 'playing' ? COPY.resume : state.kind === 'solved' ? COPY.table : COPY.play;
  return (
    <SectionCard label={intl.formatMessage(COPY.label)}>
      <View className="flex-row gap-s">
        <View style={{ width: BOARD_WIDTH }}>
          <SudokuBoard givens={givens} values={values} compact />
        </View>
        <View className="flex-1">
          <Typo variant="headline-xs">{intl.formatMessage(COPY.heading)}</Typo>
          <Typo variant="text-s" color="on-canvas-muted" className="mt-2xs">
            {lead}
          </Typo>
        </View>
      </View>
      <Button
        title={intl.formatMessage(action)}
        variant={state.kind === 'solved' ? 'outline' : 'primary'}
        fullWidth
        onPress={onPress}
        className="mt-s"
      />
    </SectionCard>
  );
}
