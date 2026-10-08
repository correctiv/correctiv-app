import { defineMessages, useIntl } from 'react-intl';
import { Pressable, View } from 'react-native';

import { Typo } from '@/components/ui';
import { sizes } from '@/lib/theme';

/** What the pad says, in ENGLISH; the German that ships is `packages/catalogue/src/de/sudoku.ts`. */
const COPY = defineMessages({
  digit: {
    id: 'sudoku.pad.digit',
    defaultMessage: '{digit}, {remaining, plural, =0 {all placed} one {one left} other {# left}}',
    description:
      'The accessible name of one digit button under the board. {digit} is the digit from 1 to 9, {remaining} how many of it are still missing from the board.',
  },
});

export interface NumberPadProps {
  /** How many of each digit stand correctly on the board, indexed 1 to 9. */
  placed: readonly number[];
  onDigit: (digit: number) => void;
  disabled?: boolean;
}

/**
 * The digits one to nine in a row, each with how many of it are still to place.
 *
 * A digit all nine of which stand is greyed and takes no touch, which is the one piece of
 * help every Sudoku app gives and which costs no points: it says nothing the board does not.
 */
export function NumberPad({ placed, onDigit, disabled = false }: NumberPadProps) {
  const intl = useIntl();
  return (
    <View className="flex-row gap-3xs">
      {Array.from({ length: 9 }, (_, i) => {
        const digit = i + 1;
        const remaining = Math.max(0, 9 - (placed[digit] ?? 0));
        const off = disabled || remaining === 0;
        return (
          <Pressable
            key={digit}
            accessibilityRole="button"
            accessibilityLabel={intl.formatMessage(COPY.digit, { digit, remaining })}
            accessibilityState={{ disabled: off }}
            disabled={off}
            onPress={() => onDigit(digit)}
            className={[
              'flex-1 items-center justify-center rounded-md bg-surface py-2xs active:opacity-70',
              off ? 'opacity-40' : '',
            ].join(' ')}
            style={{ minHeight: sizes.tapTarget }}
          >
            <Typo variant="headline-m">{String(digit)}</Typo>
            <Typo variant="text-s" color="on-canvas-muted">
              {String(remaining)}
            </Typo>
          </Pressable>
        );
      })}
    </View>
  );
}
