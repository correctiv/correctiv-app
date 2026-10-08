import { defineMessages, useIntl } from 'react-intl';
import { Pressable, View } from 'react-native';

import { colOf, hasNote, isPeer, rowOf } from '@correctiv/app-core/sudoku/puzzle';

import { ScaledText, Typo } from '@/components/ui';
import { typography, useColors, type ColorToken } from '@/lib/theme';

/**
 * What the board says to a screen reader, in ENGLISH; the German that ships is
 * `packages/catalogue/src/de/sudoku.ts`. A sighted player reads the grid, so these are
 * never drawn.
 */
const COPY = defineMessages({
  board: { id: 'sudoku.board', defaultMessage: 'Sudoku board' },
  cell: {
    id: 'sudoku.cell',
    defaultMessage:
      'Row {row}, column {column}: {digit, select, 0 {empty} other {{digit}}}{state, select, given {, given} wrong {, wrong} other {}}',
    description:
      'The accessible name of one cell, read aloud and never seen. {row} and {column} count from 1 to 9 from the top left; {digit} is the digit in the cell, 0 when it is empty; {state} is given for a printed digit the player cannot change, wrong for a digit that is not the solution, and anything else for neither.',
  },
});

export interface SudokuBoardProps {
  givens: readonly number[];
  values: readonly number[];
  /** Pencil marks per cell, bit `d` for digit `d`. Left out on the small board. */
  notes?: readonly number[];
  /** Cells drawn as a mistake: a digit that is not the solution's or clashes with a peer. */
  wrong?: readonly boolean[];
  selected?: number | null;
  /** Without it the board is a picture: no cell takes a touch, and the notes are not drawn. */
  onSelect?: (index: number) => void;
  /** The widget's board, a picture a third of a phone wide: the smallest type, no notes. */
  compact?: boolean;
}

const THIN = 1;
const THICK = 2;

/**
 * The nine by nine grid, square at whatever width it is given.
 *
 * **The board is sized by its width and nothing else**: `aspectRatio` makes it square and
 * each row and cell is a share of it, so there is no fixed height anywhere for a larger
 * text size to overflow — a digit grows inside its cell, and at the largest sizes the
 * cell is what limits it. A cell on a phone is about 36 dp, under the 44 the rest of the
 * app keeps; nine across is the game, and the cell is the whole target with no gap
 * between two of them to miss into.
 */
export function SudokuBoard({
  givens,
  values,
  notes,
  wrong,
  selected = null,
  onSelect,
  compact = false,
}: SudokuBoardProps) {
  const intl = useIntl();
  const colors = useColors();
  const selectedDigit = selected === null ? 0 : (values[selected] ?? 0);

  const backgroundOf = (index: number): ColorToken => {
    if (selected === null) return 'canvas';
    if (index === selected) return 'stroke-strong';
    if (selectedDigit !== 0 && values[index] === selectedDigit) return 'stroke';
    return isPeer(index, selected) ? 'surface' : 'canvas';
  };

  return (
    <View
      accessibilityLabel={intl.formatMessage(COPY.board)}
      style={{
        width: '100%',
        aspectRatio: 1,
        borderWidth: THICK,
        borderColor: colors['on-canvas'],
      }}
    >
      {Array.from({ length: 9 }, (_, row) => (
        <View key={row} className="flex-1 flex-row">
          {Array.from({ length: 9 }, (__, column) => {
            const index = row * 9 + column;
            const digit = values[index] ?? 0;
            const given = (givens[index] ?? 0) !== 0;
            const isWrong = !given && (wrong?.[index] ?? false);
            const cellStyle = {
              flex: 1,
              alignItems: 'center' as const,
              justifyContent: 'center' as const,
              backgroundColor: colors[backgroundOf(index)],
              borderRightWidth: column === 8 ? 0 : column % 3 === 2 ? THICK : THIN,
              borderBottomWidth: row === 8 ? 0 : row % 3 === 2 ? THICK : THIN,
              borderRightColor: column % 3 === 2 ? colors['on-canvas'] : colors.stroke,
              borderBottomColor: row % 3 === 2 ? colors['on-canvas'] : colors.stroke,
            };
            const content =
              digit !== 0 && compact ? (
                <ScaledText
                  style={[
                    typography['text-s'],
                    { fontSize: 10, lineHeight: 12, color: colors['on-canvas'] },
                  ]}
                >
                  {String(digit)}
                </ScaledText>
              ) : digit !== 0 ? (
                <Typo
                  variant="headline-s"
                  weight={given ? 'bold' : 'normal'}
                  color={isWrong ? 'accent' : 'on-canvas'}
                >
                  {String(digit)}
                </Typo>
              ) : !compact && notes ? (
                <Notes mask={notes[index] ?? 0} color={colors['on-canvas-muted']} />
              ) : null;
            if (!onSelect) {
              return (
                <View key={column} style={cellStyle}>
                  {content}
                </View>
              );
            }
            return (
              <Pressable
                key={column}
                accessibilityRole="button"
                accessibilityState={{ selected: index === selected }}
                accessibilityLabel={intl.formatMessage(COPY.cell, {
                  row: rowOf(index) + 1,
                  column: colOf(index) + 1,
                  digit,
                  state: given ? 'given' : isWrong ? 'wrong' : 'none',
                })}
                onPress={() => onSelect(index)}
                style={cellStyle}
              >
                {content}
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

/**
 * Pencil marks, three by three in the cell, each digit where it sits on the pad.
 *
 * Laid out by `style` rather than by class, because the cell centres its content and a
 * `w-full` child of it measured as wide as its widest digit on the web, which stacked the
 * marks in one column; `alignSelf: 'stretch'` is what takes the cell's width.
 *
 * Smaller than any type the design names, and on purpose: nine of them share a cell of
 * about 36 dp. They still go through `ScaledText`, so the reader's text size moves them
 * with everything else.
 */
function Notes({ mask, color }: { mask: number; color: string }) {
  if (mask === 0) return null;
  return (
    <View style={{ alignSelf: 'stretch', flex: 1 }}>
      {[0, 1, 2].map((row) => (
        <View key={row} style={{ flex: 1, flexDirection: 'row' }}>
          {[1, 2, 3].map((offset) => {
            const digit = row * 3 + offset;
            return (
              <View key={digit} style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                <ScaledText style={[typography['text-s'], { fontSize: 9, lineHeight: 10, color }]}>
                  {hasNote(mask, digit) ? String(digit) : ''}
                </ScaledText>
              </View>
            );
          })}
        </View>
      ))}
    </View>
  );
}
